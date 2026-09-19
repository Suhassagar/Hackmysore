/**
 * Verification Script for Phase 5: Dynamic Civic Responsibility Rule Engine
 * 
 * Verifies all 10 core requirements:
 * 1. Case A (Standard Route): Ward 42 + POTHOLE -> MCC + Roads Maintenance (ROUTED, requires_review: false)
 * 2. Category Sensitivity: Ward 42 + BLOCKED_DRAIN -> MCC + Drainage Division (different dept for same jurisdiction)
 * 3. Case B (No Responsible Rule): Ward 42 + OTHER -> NO_RESPONSIBLE_RULE, requires_review: true
 * 4. Case C (Responsibility Conflict): DISPUTED_ZONE_A + POTHOLE -> RESPONSIBILITY_CONFLICT, 2 candidate rules, requires_review: true
 * 5. Temporal Rule Cutoff (Past): Timestamp 2026-09-19 -> Rule 2026-V1
 * 6. Temporal Rule Cutoff (Future): Timestamp 2026-09-21 -> Rule 2026-V2
 * 7. Future Rule Invariance: Future rule (2026-V2) never selected for past report
 * 8. AI Uncertainty Interaction: AI status NEEDS_REVIEW -> Route status NEEDS_REVIEW, requires_review: true
 * 9. Lifecycle Snapshot & Auditable Explainability Trace (WHAT, WHERE, WHO, DEPARTMENT)
 * 10. RBAC & IDOR Guard: Citizen 2 blocked (403) from Citizen 1 routing; Staff & Admin permitted
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

async function runPhase5Verification() {
  console.log('================================================================');
  console.log(' CIVICFLOW PHASE 5 VERIFICATION: DYNAMIC CIVIC RESPONSIBILITY ENGINE');
  console.log('================================================================\n');

  // 1. Authenticate dev users
  console.log('--- Setup: Authenticating Test Users ---');
  const cit1Login = await request({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'citizen@mysuru.civicflow.in' },
  });
  const cit1Token = cit1Login.data.token;
  console.log(`Authenticated Citizen 1: ${cit1Login.data.user.name}`);

  await request({
    path: '/api/auth/register-sync',
    method: 'POST',
    body: {
      authUid: 'test-citizen-2',
      name: 'Ananya Deshmukh (Other Citizen)',
      email: 'ananya@mysuru.civicflow.in',
      role: 'CITIZEN',
    },
  });
  const cit2Login = await request({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'ananya@mysuru.civicflow.in' },
  });
  const cit2Token = cit2Login.data.token;
  console.log(`Authenticated Citizen 2: ${cit2Login.data.user.name}`);

  const staffLogin = await request({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'staff@mysuru.civicflow.in' },
  });
  const staffToken = staffLogin.data.token;
  console.log(`Authenticated Staff: ${staffLogin.data.user.name}`);

  const adminLogin = await request({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'admin@mysuru.civicflow.in' },
  });
  const adminToken = adminLogin.data.token;
  console.log(`Authenticated Admin: ${adminLogin.data.user.name}\n`);

  // Coordinates inside Ward 42: [12.315, 76.635]
  // Coordinates inside Disputed Zone A: [12.355, 76.760]

  // Test 1: Case A (Standard Route): Ward 42 + POTHOLE -> MCC + Roads Maintenance
  console.log('--- Test 1: Case A Standard Resolution (Ward 42 + POTHOLE) ---');
  const test1Res = await request({
    path: '/api/routing/resolve',
    method: 'POST',
    headers: { Authorization: `Bearer ${cit1Token}` },
    body: {
      latitude: 12.315,
      longitude: 76.635,
      category: 'POTHOLE',
      report_time: '2026-09-19T10:00:00Z',
    },
  });
  assert(test1Res.status === 200, 'Endpoint returned 200 OK', test1Res.data);
  assert(test1Res.data?.routing?.route_status === 'ROUTED', 'Status is ROUTED', test1Res.data?.routing);
  assert(test1Res.data?.routing?.requires_review === false, 'Requires review is false', test1Res.data?.routing);
  assert(test1Res.data?.routing?.authority?.code === 'MCC', 'Authority is MCC', test1Res.data?.routing?.authority);
  assert(test1Res.data?.routing?.department?.code === 'MCC_ROADS', 'Department is MCC_ROADS', test1Res.data?.routing?.department);
  console.log();

  // Test 2: Category Sensitivity: Ward 42 + BLOCKED_DRAIN -> MCC + Drainage Division
  console.log('--- Test 2: Category Sensitivity (Ward 42 + BLOCKED_DRAIN) ---');
  const test2Res = await request({
    path: '/api/routing/resolve',
    method: 'POST',
    headers: { Authorization: `Bearer ${cit1Token}` },
    body: {
      latitude: 12.315,
      longitude: 76.635,
      category: 'BLOCKED_DRAIN',
      report_time: '2026-09-19T10:00:00Z',
    },
  });
  assert(test2Res.status === 200, 'Endpoint returned 200 OK', test2Res.data);
  assert(test2Res.data?.routing?.route_status === 'ROUTED', 'Status is ROUTED', test2Res.data?.routing);
  assert(test2Res.data?.routing?.authority?.code === 'MCC', 'Authority is MCC', test2Res.data?.routing?.authority);
  assert(test2Res.data?.routing?.department?.code === 'MCC_DRAINAGE', 'Department is MCC_DRAINAGE', test2Res.data?.routing?.department);
  console.log();

  // Test 3: Case B (No Responsible Rule): Ward 42 + OTHER -> NO_RESPONSIBLE_RULE
  console.log('--- Test 3: Case B No Responsible Rule (Ward 42 + OTHER) ---');
  const test3Res = await request({
    path: '/api/routing/resolve',
    method: 'POST',
    headers: { Authorization: `Bearer ${cit1Token}` },
    body: {
      latitude: 12.315,
      longitude: 76.635,
      category: 'OTHER',
      report_time: '2026-09-19T10:00:00Z',
    },
  });
  assert(test3Res.status === 200, 'Endpoint returned 200 OK', test3Res.data);
  assert(test3Res.data?.routing?.route_status === 'NO_RESPONSIBLE_RULE', 'Status is NO_RESPONSIBLE_RULE', test3Res.data?.routing);
  assert(test3Res.data?.routing?.requires_review === true, 'Requires review is true', test3Res.data?.routing);
  assert(test3Res.data?.routing?.authority === null, 'Authority is null', test3Res.data?.routing?.authority);
  assert(test3Res.data?.routing?.department === null, 'Department is null', test3Res.data?.routing?.department);
  console.log();

  // Test 4: Case C (Responsibility Conflict): DISPUTED_ZONE_A + POTHOLE -> RESPONSIBILITY_CONFLICT
  console.log('--- Test 4: Case C Responsibility Conflict (DISPUTED_ZONE_A + POTHOLE) ---');
  const test4Res = await request({
    path: '/api/routing/resolve',
    method: 'POST',
    headers: { Authorization: `Bearer ${cit1Token}` },
    body: {
      jurisdiction_id: 'DISPUTED_ZONE_A',
      category: 'POTHOLE',
      report_time: '2026-09-19T10:00:00Z',
    },
  });
  assert(test4Res.status === 200, 'Endpoint returned 200 OK', test4Res.data);
  assert(test4Res.data?.routing?.route_status === 'RESPONSIBILITY_CONFLICT', 'Status is RESPONSIBILITY_CONFLICT', test4Res.data?.routing);
  assert(test4Res.data?.routing?.requires_review === true, 'Requires review is true', test4Res.data?.routing);
  assert(Array.isArray(test4Res.data?.routing?.candidate_rules), 'Candidate rules array returned', test4Res.data?.routing);
  assert(test4Res.data?.routing?.candidate_rules?.length >= 2, 'At least 2 conflicting rules returned', test4Res.data?.routing?.candidate_rules);
  const candidateAuths = test4Res.data?.routing?.candidate_rules?.map((c) => c.authority_code);
  assert(candidateAuths?.includes('MCC') && candidateAuths?.includes('CHAMUNDI_GP'), 'Contains MCC and Chamundi GP', candidateAuths);
  console.log();

  // Test 5: Temporal Boundary & Rule Cutoff (Past report - 2026-09-19)
  console.log('--- Test 5: Temporal Validity Before Cutoff (2026-09-19) ---');
  const test5Res = await request({
    path: '/api/routing/resolve',
    method: 'POST',
    headers: { Authorization: `Bearer ${cit1Token}` },
    body: {
      latitude: 12.315,
      longitude: 76.635,
      category: 'POTHOLE',
      report_time: '2026-09-19T12:00:00Z',
    },
  });
  assert(test5Res.status === 200, 'Endpoint returned 200 OK', test5Res.data);
  assert(test5Res.data?.routing?.route_status === 'ROUTED', 'Status is ROUTED', test5Res.data?.routing);
  assert(test5Res.data?.routing?.rule_version === '2026-V1', 'Matched Rule Version 2026-V1', test5Res.data?.routing);
  assert(test5Res.data?.jurisdiction?.boundary_version === '2026-V1', 'Matched Boundary Version 2026-V1', test5Res.data?.jurisdiction);
  console.log();

  // Test 6: Temporal Boundary & Rule Cutoff (Future report - 2026-09-21)
  console.log('--- Test 6: Temporal Validity After Cutoff (2026-09-21) ---');
  const test6Res = await request({
    path: '/api/routing/resolve',
    method: 'POST',
    headers: { Authorization: `Bearer ${cit1Token}` },
    body: {
      latitude: 12.315,
      longitude: 76.635,
      category: 'POTHOLE',
      report_time: '2026-09-21T12:00:00Z',
    },
  });
  assert(test6Res.status === 200, 'Endpoint returned 200 OK', test6Res.data);
  assert(test6Res.data?.routing?.route_status === 'ROUTED', 'Status is ROUTED', test6Res.data?.routing);
  assert(test6Res.data?.routing?.rule_version === '2026-V2', 'Matched Rule Version 2026-V2', test6Res.data?.routing);
  console.log();

  // Test 7: Future rule not selected for past report
  console.log('--- Test 7: Invariance: Future Rule Not Selected for Past Incident ---');
  const test7PastRes = await request({
    path: '/api/routing/resolve',
    method: 'POST',
    headers: { Authorization: `Bearer ${cit1Token}` },
    body: {
      latitude: 12.315,
      longitude: 76.635,
      category: 'POTHOLE',
      report_time: '2026-09-15T00:00:00Z',
    },
  });
  assert(test7PastRes.data?.routing?.rule_version !== '2026-V2', 'Past report does NOT get future rule 2026-V2', test7PastRes.data?.routing);
  assert(test7PastRes.data?.routing?.rule_version === '2026-V1', 'Past report correctly gets 2026-V1', test7PastRes.data?.routing);
  console.log();

  // Test 8: AI Uncertainty Interaction (status NEEDS_REVIEW flags route_status NEEDS_REVIEW)
  console.log('--- Test 8: AI Uncertainty Interaction ---');
  const { db, initDb } = require('../config/db');
  await initDb();
  const responsibilityService = require('../services/responsibility');
  const mockUncertainAi = {
    category: 'POTHOLE',
    status: 'NEEDS_REVIEW',
    confidence: 0.55,
  };
  const realWard42 = await db.getJurisdictionById('MCC_WARD_42');
  const mockWard42Jur = {
    jurisdiction_id: realWard42 ? realWard42.id : 'jur-ward-42',
    jurisdiction_code: 'MCC_WARD_42',
    jurisdiction_name: realWard42 ? realWard42.name : 'Ward 42 - Lakshmipuram',
    jurisdiction_type: realWard42 ? realWard42.type : 'MCC_WARD',
    jurisdiction_version: '2026-V1',
    match_status: 'MATCHED',
  };
  const test8Res = await responsibilityService.resolveResponsibility(
    mockWard42Jur,
    'POTHOLE',
    new Date('2026-09-19T10:00:00Z'),
    mockUncertainAi
  );
  assert(test8Res.route_status === 'NEEDS_REVIEW', 'Route status is NEEDS_REVIEW when AI is uncertain', test8Res);
  assert(test8Res.requires_review === true, 'Requires review is true', test8Res);
  assert(test8Res.authority?.code === 'MCC', 'Provisional authority is assigned (MCC)', test8Res.authority);
  assert(test8Res.explanation.includes('NOTE: Provisionally routed'), 'Explanation clarifies provisional status', test8Res.explanation);
  console.log();

  // Test 9: Complete Lifecycle Snapshot & Auditable Explainability Trace
  console.log('--- Test 9: Report Lifecycle Snapshot & Auditable Trace ---');
  const test9ReportRes = await request({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${cit1Token}` },
    body: {
      category: 'POTHOLE',
      description: 'Massive crater on Lakshmipuram Main Road opposite the post office.',
      latitude: 12.315,
      longitude: 76.635,
      accuracy: 5.0,
    },
  });
  assert(test9ReportRes.status === 201, 'Report created with status 201', test9ReportRes.data);
  const createdReport = test9ReportRes.data;
  assert(createdReport.routing !== null && createdReport.routing !== undefined, 'Report has routing snapshot', createdReport);
  assert(createdReport.routing.route_status === 'ROUTED', 'Snapshot status is ROUTED', createdReport.routing);
  assert(createdReport.routing.authority_code === 'MCC', 'Snapshot authority code is MCC', createdReport.routing);
  assert(createdReport.routing.explanation.includes('WHAT: POTHOLE'), 'Explanation contains WHAT', createdReport.routing.explanation);
  assert(createdReport.routing.explanation.includes('WHERE:'), 'Explanation contains WHERE', createdReport.routing.explanation);
  assert(createdReport.routing.explanation.includes('WHO:'), 'Explanation contains WHO', createdReport.routing.explanation);
  assert(createdReport.routing.explanation.includes('DEPARTMENT:'), 'Explanation contains DEPARTMENT', createdReport.routing.explanation);
  console.log();

  // Test 10: RBAC & IDOR Protection on Routing Endpoints
  console.log('--- Test 10: RBAC & IDOR Guard on Routing Endpoints ---');
  const reportId = createdReport.id;

  // Citizen 2 (unauthorized) tries to access Citizen 1's routing snapshot
  const idorRes = await request({
    path: `/api/reports/${reportId}/routing`,
    method: 'GET',
    headers: { Authorization: `Bearer ${cit2Token}` },
  });
  assert(idorRes.status === 403, 'Citizen 2 blocked with 403 Forbidden', idorRes.status);

  // Staff accessing Citizen 1's routing snapshot
  const staffRes = await request({
    path: `/api/reports/${reportId}/routing`,
    method: 'GET',
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert(staffRes.status === 200, 'Staff permitted with 200 OK', staffRes.status);
  assert(staffRes.data?.routing?.authority_code === 'MCC', 'Staff retrieves routing snapshot', staffRes.data?.routing);

  // Admin accessing Citizen 1's routing snapshot
  const adminRes = await request({
    path: `/api/reports/${reportId}/routing`,
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminRes.status === 200, 'Admin permitted with 200 OK', adminRes.status);

  // Re-resolve routing endpoint via Citizen 1
  const reResolveRes = await request({
    path: `/api/reports/${reportId}/routing/resolve`,
    method: 'POST',
    headers: { Authorization: `Bearer ${cit1Token}` },
  });
  assert(reResolveRes.status === 200, 'Re-resolve endpoint returns 200 OK', reResolveRes.status);
  assert(reResolveRes.data?.routing?.route_status === 'ROUTED', 'Re-resolved routing matches policy', reResolveRes.data?.routing);

  console.log('\n================================================================');
  console.log(` PHASE 5 VERIFICATION RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPhase5Verification().catch((err) => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});
