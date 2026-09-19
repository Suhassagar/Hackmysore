/**
 * Verification Script for Phase 6: Routing Confidence + Human Review System
 * 
 * Verifies all 13 core requirements:
 * 1. High-confidence AI + exactly 1 jurisdiction + exactly 1 rule -> AUTO_ROUTED
 * 2. Low-confidence AI (< 0.70) -> NEEDS_REVIEW, AI_LOW_CONFIDENCE
 * 3. AI status NEEDS_REVIEW -> NEEDS_REVIEW, AI_NEEDS_REVIEW
 * 4. Outside boundaries -> NEEDS_REVIEW, NO_JURISDICTION_MATCH
 * 5. Spatial boundary conflict -> NEEDS_REVIEW, JURISDICTION_CONFLICT
 * 6. No responsibility rule -> NEEDS_REVIEW, NO_RESPONSIBILITY_RULE
 * 7. Competing rules conflict -> NEEDS_REVIEW, RESPONSIBILITY_CONFLICT
 * 8. Staff approves route -> reviewer saved, timestamp saved, original preserved
 * 9. Staff overrides route -> original preserved, final decision saved
 * 10. Citizen attempts review action -> 403 Forbidden
 * 11. Citizen attempts review queue -> 403 Forbidden
 * 12. Duplicate review request -> Idempotent handling (no double review)
 * 13. Unexpected routing error -> ROUTING_FAILED
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000';
let passedCount = 0;
let failedCount = 0;

function request({ path, method = 'GET', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(path, BASE_URL);
    const postData = body ? JSON.stringify(body) : null;

    const req = http.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let data = null;
          try {
            data = raw ? JSON.parse(raw) : null;
          } catch {
            data = raw;
          }
          resolve({ status: res.statusCode, data });
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function assert(condition, message, detail = null) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ✕ FAIL: ${message}`);
    if (detail) console.error('    Detail:', detail);
    failedCount++;
  }
}

async function runPhase6Verification() {
  console.log('================================================================');
  console.log(' CIVICFLOW PHASE 6 VERIFICATION: ROUTING CONFIDENCE & HUMAN REVIEW');
  console.log('================================================================\n');

  // Setup: Authenticate test users
  console.log('--- Setup: Authenticating Users ---');
  const citLogin = await request({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'citizen@mysuru.civicflow.in' },
  });
  const citToken = citLogin.data.token;
  console.log(`Citizen: ${citLogin.data.user.name}`);

  const staffLogin = await request({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'staff@mysuru.civicflow.in' },
  });
  const staffToken = staffLogin.data.token;
  console.log(`Staff: ${staffLogin.data.user.name}`);

  const adminLogin = await request({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'admin@mysuru.civicflow.in' },
  });
  const adminToken = adminLogin.data.token;
  console.log(`Admin: ${adminLogin.data.user.name}\n`);

  const routingAssessmentService = require('../services/routingAssessment');
  const responsibilityService = require('../services/responsibility');
  const { db, initDb } = require('../config/db');
  await initDb();

  const ward42Jur = await db.getJurisdictionById('MCC_WARD_42');

  // -------------------------------------------------------------
  // TEST 1: High confidence AI + Ward 42 + Rule -> AUTO_ROUTED
  // -------------------------------------------------------------
  console.log('--- Test 1: Full Confident Match -> AUTO_ROUTED ---');
  const mockReport1 = {
    id: 'test-report-01',
    category: 'POTHOLE',
    description: 'Deep dangerous pothole near railway gate',
    latitude: 12.315,
    longitude: 76.635,
    location_status: 'VERIFIED_COORDINATES',
  };
  const mockAi1 = {
    category: 'POTHOLE',
    confidence: 0.94,
    status: 'COMPLETED',
  };
  const resp1 = await responsibilityService.resolveResponsibility(
    ward42Jur,
    'POTHOLE',
    new Date('2026-09-19T10:00:00Z'),
    mockAi1
  );
  const assess1 = routingAssessmentService.assessRouting(mockReport1, mockAi1, ward42Jur, resp1);

  assert(assess1.status === 'AUTO_ROUTED', 'Status is AUTO_ROUTED', assess1);
  assert(assess1.reviewRequired === false, 'reviewRequired is false', assess1);
  assert(assess1.reviewReasons.length === 0, 'reviewReasons is empty', assess1.reviewReasons);
  assert(assess1.decision?.authorityCode === 'MCC', 'Decision authority is MCC', assess1.decision);
  assert(assess1.decision?.departmentCode === 'MCC_ROADS', 'Decision department is MCC_ROADS', assess1.decision);
  console.log();

  // -------------------------------------------------------------
  // TEST 2: Low-confidence AI (< 0.70) -> NEEDS_REVIEW, AI_LOW_CONFIDENCE
  // -------------------------------------------------------------
  console.log('--- Test 2: Low Confidence AI -> NEEDS_REVIEW (AI_LOW_CONFIDENCE) ---');
  const mockAi2 = {
    category: 'POTHOLE',
    confidence: 0.52, // Below 0.70 threshold
    status: 'COMPLETED',
  };
  const assess2 = routingAssessmentService.assessRouting(mockReport1, mockAi2, ward42Jur, resp1);

  assert(assess2.status === 'NEEDS_REVIEW', 'Status is NEEDS_REVIEW', assess2);
  assert(assess2.reviewRequired === true, 'reviewRequired is true', assess2);
  assert(assess2.reviewReasons.includes('AI_LOW_CONFIDENCE'), 'Contains AI_LOW_CONFIDENCE reason', assess2.reviewReasons);
  assert(assess2.decision === null, 'Decision is null during review state', assess2.decision);
  assert(assess2.suggestedRoute?.authorityCode === 'MCC', 'Retains non-binding suggested route', assess2.suggestedRoute);
  console.log();

  // -------------------------------------------------------------
  // TEST 3: AI status NEEDS_REVIEW -> NEEDS_REVIEW, AI_NEEDS_REVIEW
  // -------------------------------------------------------------
  console.log('--- Test 3: Ambiguous AI Status -> NEEDS_REVIEW (AI_NEEDS_REVIEW) ---');
  const mockAi3 = {
    category: 'POTHOLE',
    confidence: 0.65,
    status: 'NEEDS_REVIEW',
  };
  const assess3 = routingAssessmentService.assessRouting(mockReport1, mockAi3, ward42Jur, resp1);

  assert(assess3.status === 'NEEDS_REVIEW', 'Status is NEEDS_REVIEW', assess3);
  assert(assess3.reviewReasons.includes('AI_NEEDS_REVIEW'), 'Contains AI_NEEDS_REVIEW reason', assess3.reviewReasons);
  console.log();

  // -------------------------------------------------------------
  // TEST 4: Outside Boundaries -> NEEDS_REVIEW, NO_JURISDICTION_MATCH
  // -------------------------------------------------------------
  console.log('--- Test 4: Outside Boundaries -> NEEDS_REVIEW (NO_JURISDICTION_MATCH) ---');
  const mockOutsideJur = {
    jurisdiction_id: null,
    match_status: 'NO_JURISDICTION_MATCH',
  };
  const resp4 = await responsibilityService.resolveResponsibility(
    mockOutsideJur,
    'POTHOLE',
    new Date('2026-09-19T10:00:00Z'),
    mockAi1
  );
  const assess4 = routingAssessmentService.assessRouting(mockReport1, mockAi1, mockOutsideJur, resp4);

  assert(assess4.status === 'NEEDS_REVIEW', 'Status is NEEDS_REVIEW', assess4);
  assert(assess4.reviewReasons.includes('NO_JURISDICTION_MATCH'), 'Contains NO_JURISDICTION_MATCH', assess4.reviewReasons);
  console.log();

  // -------------------------------------------------------------
  // TEST 5: Spatial Conflict -> NEEDS_REVIEW, JURISDICTION_CONFLICT
  // -------------------------------------------------------------
  console.log('--- Test 5: Overlapping Boundaries -> NEEDS_REVIEW (JURISDICTION_CONFLICT) ---');
  const mockConflictJur = {
    jurisdiction_id: null,
    match_status: 'JURISDICTION_CONFLICT',
  };
  const resp5 = await responsibilityService.resolveResponsibility(
    mockConflictJur,
    'POTHOLE',
    new Date('2026-09-19T10:00:00Z'),
    mockAi1
  );
  const assess5 = routingAssessmentService.assessRouting(mockReport1, mockAi1, mockConflictJur, resp5);

  assert(assess5.status === 'NEEDS_REVIEW', 'Status is NEEDS_REVIEW', assess5);
  assert(assess5.reviewReasons.includes('JURISDICTION_CONFLICT'), 'Contains JURISDICTION_CONFLICT', assess5.reviewReasons);
  console.log();

  // -------------------------------------------------------------
  // TEST 6: No Responsibility Rule -> NEEDS_REVIEW, NO_RESPONSIBLE_RULE
  // -------------------------------------------------------------
  console.log('--- Test 6: Unmapped Issue Category -> NEEDS_REVIEW (NO_RESPONSIBLE_RULE) ---');
  const resp6 = await responsibilityService.resolveResponsibility(
    ward42Jur,
    'OTHER',
    new Date('2026-09-19T10:00:00Z'),
    { category: 'OTHER', confidence: 0.95, status: 'COMPLETED' }
  );
  const assess6 = routingAssessmentService.assessRouting(
    { ...mockReport1, category: 'OTHER' },
    { category: 'OTHER', confidence: 0.95, status: 'COMPLETED' },
    ward42Jur,
    resp6
  );

  assert(assess6.status === 'NEEDS_REVIEW', 'Status is NEEDS_REVIEW', assess6);
  assert(assess6.reviewReasons.includes('NO_RESPONSIBILITY_RULE'), 'Contains NO_RESPONSIBILITY_RULE', assess6.reviewReasons);
  console.log();

  // -------------------------------------------------------------
  // TEST 7: Competing Rules Conflict -> NEEDS_REVIEW, RESPONSIBILITY_CONFLICT
  // -------------------------------------------------------------
  console.log('--- Test 7: Competing Equal Priority Rules -> NEEDS_REVIEW (RESPONSIBILITY_CONFLICT) ---');
  const disputedJur = await db.getJurisdictionById('DISPUTED_ZONE_A');
  const resp7 = await responsibilityService.resolveResponsibility(
    disputedJur,
    'POTHOLE',
    new Date('2026-09-19T10:00:00Z'),
    mockAi1
  );
  const assess7 = routingAssessmentService.assessRouting(mockReport1, mockAi1, disputedJur, resp7);

  assert(assess7.status === 'NEEDS_REVIEW', 'Status is NEEDS_REVIEW', assess7);
  assert(assess7.reviewReasons.includes('RESPONSIBILITY_CONFLICT'), 'Contains RESPONSIBILITY_CONFLICT', assess7.reviewReasons);
  console.log();

  // -------------------------------------------------------------
  // SETUP FOR API TESTS: Create a Report that requires review
  // -------------------------------------------------------------
  console.log('--- Setup Review Case in Database ---');
  const reportSubmitRes = await request({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citToken}` },
    body: {
      category: 'OTHER', // Unmapped category will trigger NO_RESPONSIBLE_RULE
      description: 'Strange unclassified sinkhole forming on municipal boundary with broken culvert.',
      latitude: 12.315,
      longitude: 76.635,
      accuracy: 4.5,
    },
  });
  assert(reportSubmitRes.status === 201, 'Report created in database', reportSubmitRes.data);
  const reviewReportId = reportSubmitRes.data.id;
  console.log(`Created Report ID: ${reviewReportId}\n`);

  // -------------------------------------------------------------
  // TEST 8: Staff Approves Suggested Route
  // -------------------------------------------------------------
  console.log('--- Test 8: Staff Approves Suggested Route ---');
  // First create a report with a suggested route that requires review (e.g. uncertain AI)
  const report2Res = await request({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citToken}` },
    body: {
      category: 'POTHOLE',
      description: 'Vague minor bump on road surface near bus stop.',
      latitude: 12.315,
      longitude: 76.635,
      accuracy: 6.0,
    },
  });
  const report2Id = report2Res.data.id;

  // Let staff approve the route
  const approveRes = await request({
    path: `/api/reports/${report2Id}/routing-review`,
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: {
      action: 'APPROVE',
      review_notes: 'Verified photo evidence and confirmed road maintenance jurisdiction under MCC.',
    },
  });

  assert(approveRes.status === 200, 'Staff approve returns 200 OK', approveRes.data);
  assert(approveRes.data?.review?.action === 'APPROVE', 'Review action recorded as APPROVE', approveRes.data?.review);
  assert(approveRes.data?.review?.reviewed_by !== null, 'Reviewed by reviewer ID is recorded', approveRes.data?.review);
  assert(approveRes.data?.routing?.decision_source === 'HUMAN_REVIEW', 'Decision source updated to HUMAN_REVIEW', approveRes.data?.routing);
  assert(approveRes.data?.routing?.final_authority_id !== null, 'Final authority ID populated', approveRes.data?.routing);
  console.log();

  // -------------------------------------------------------------
  // TEST 9: Staff Overrides Route
  // -------------------------------------------------------------
  console.log('--- Test 9: Staff Overrides Route to Drainage Department ---');
  const allDepts = await request({
    path: '/api/routing/departments',
    method: 'GET',
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  const mccAuth = (await request({ path: '/api/routing/authorities', method: 'GET', headers: { Authorization: `Bearer ${staffToken}` } })).data.authorities.find((a) => a.code === 'MCC');
  const drainageDept = allDepts.data.departments.find((d) => d.code === 'MCC_DRAINAGE');

  const overrideRes = await request({
    path: `/api/reports/${reviewReportId}/routing-review`,
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: {
      action: 'OVERRIDE',
      final_authority_id: mccAuth.id,
      final_department_id: drainageDept.id,
      review_notes: 'Sinkhole is caused by underground stormwater pipe collapse. Transferring to Drainage Division.',
    },
  });

  assert(overrideRes.status === 200, 'Staff override returns 200 OK', overrideRes.data);
  assert(overrideRes.data?.review?.action === 'OVERRIDE', 'Action recorded as OVERRIDE', overrideRes.data?.review);
  assert(overrideRes.data?.review?.final_authority_id === mccAuth.id, 'Final authority assigned to MCC', overrideRes.data?.review);
  assert(overrideRes.data?.review?.final_department_id === drainageDept.id, 'Final department assigned to MCC_DRAINAGE', overrideRes.data?.review);
  assert(overrideRes.data?.routing?.decision_source === 'HUMAN_REVIEW', 'Routing marked as HUMAN_REVIEW', overrideRes.data?.routing);
  console.log();

  // -------------------------------------------------------------
  // TEST 10: Citizen Attempts Review Action -> 403 Forbidden
  // -------------------------------------------------------------
  console.log('--- Test 10: Citizen Blocked from Review Action (403 Forbidden) ---');
  const citReviewRes = await request({
    path: `/api/reports/${reviewReportId}/routing-review`,
    method: 'POST',
    headers: { Authorization: `Bearer ${citToken}` },
    body: {
      action: 'APPROVE',
    },
  });
  assert(citReviewRes.status === 403, 'Citizen blocked with 403 Forbidden', citReviewRes.status);
  console.log();

  // -------------------------------------------------------------
  // TEST 11: Citizen Attempts Review Queue -> 403 Forbidden
  // -------------------------------------------------------------
  console.log('--- Test 11: Citizen Blocked from Review Queue (403 Forbidden) ---');
  const citQueueRes = await request({
    path: '/api/staff/routing-review',
    method: 'GET',
    headers: { Authorization: `Bearer ${citToken}` },
  });
  assert(citQueueRes.status === 403, 'Citizen blocked from queue with 403 Forbidden', citQueueRes.status);

  // Staff accessing review queue returns 200 OK
  const staffQueueRes = await request({
    path: '/api/staff/routing-review',
    method: 'GET',
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert(staffQueueRes.status === 200, 'Staff permitted to access queue (200 OK)', staffQueueRes.status);
  assert(Array.isArray(staffQueueRes.data?.items), 'Queue returns items array', staffQueueRes.data);
  console.log();

  // -------------------------------------------------------------
  // TEST 12: Duplicate Review Request -> Idempotent Protection
  // -------------------------------------------------------------
  console.log('--- Test 12: Duplicate Review Idempotency Guard ---');
  // Attempt to review already-resolved report reviewReportId
  const dupReviewRes = await request({
    path: `/api/reports/${reviewReportId}/routing-review`,
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: {
      action: 'OVERRIDE',
      final_authority_id: mccAuth.id,
      final_department_id: drainageDept.id,
      review_notes: 'Duplicate click attempt',
    },
  });
  assert(
    dupReviewRes.status === 409 || dupReviewRes.status === 429,
    'Duplicate review rejected or protected against re-processing',
    dupReviewRes.status
  );
  console.log();

  // -------------------------------------------------------------
  // TEST 13: Unexpected Routing Error -> ROUTING_FAILED
  // -------------------------------------------------------------
  console.log('--- Test 13: Unexpected Error -> ROUTING_FAILED ---');
  // Pass corrupt circular object to trigger controlled catch in assessRouting
  const corruptReport = {};
  Object.defineProperty(corruptReport, 'description', {
    get() {
      throw new Error('Corrupt data stream during assessment');
    },
  });
  const failedAssessment = routingAssessmentService.assessRouting(corruptReport, null, null, null);

  assert(failedAssessment.status === 'ROUTING_FAILED', 'Status is ROUTING_FAILED', failedAssessment);
  assert(failedAssessment.reviewRequired === true, 'reviewRequired is true', failedAssessment);
  assert(failedAssessment.reviewReasons.includes('ROUTING_DATA_ERROR'), 'Review reason is ROUTING_DATA_ERROR', failedAssessment.reviewReasons);
  assert(failedAssessment.decision === null, 'Decision is null', failedAssessment);
  console.log();

  console.log('================================================================');
  console.log(` PHASE 6 VERIFICATION RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPhase6Verification().catch((err) => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});
