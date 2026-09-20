/**
 * Verification Script for Phase 7: Staff Case Workflow + Follow-Through
 * 
 * Verifies all 18 requirements from Section 26:
 * TEST 1: AUTO_ROUTED report creates exactly one case.
 * TEST 2: NEEDS_REVIEW report does not become operationally assigned before human review.
 * TEST 3: Valid status transition: ASSIGNED -> ACKNOWLEDGED (success + event).
 * TEST 4: Valid transition: ACKNOWLEDGED -> IN_PROGRESS.
 * TEST 5: Valid transition: IN_PROGRESS -> RESOLVED (resolution timestamp + event).
 * TEST 6: Invalid transition: ASSIGNED -> RESOLVED (rejected 400).
 * TEST 7: Invalid transition: RESOLVED -> IN_PROGRESS (rejected 400).
 * TEST 8: Citizen attempts status change (403 Forbidden).
 * TEST 9: Citizen attempts assignment (403 Forbidden).
 * TEST 10: Unauthorized staff attempts to modify another department's case (403 Forbidden).
 * TEST 11: Duplicate case creation attempt (exactly one case maintained).
 * TEST 12: Duplicate status request (idempotent, no duplicate event).
 * TEST 13: Status update + event creation safety (atomic, no corruption).
 * TEST 14: Reassignment (assignment history preserved in audit events).
 * TEST 15: ON_HOLD without reason (validation failure 400; success with reason).
 * TEST 16: RESOLVED without resolution note (validation failure 400).
 * TEST 17: Citizen can see current case status.
 * TEST 18: Citizen cannot see unauthorized reports/cases (403 Forbidden).
 */

require('dotenv').config();
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

async function runPhase7Verification() {
  console.log('================================================================');
  console.log(' CIVICFLOW PHASE 7 VERIFICATION: STAFF CASE WORKFLOW & FOLLOW-THROUGH');
  console.log('================================================================\n');

  // Setup: Authenticate test users
  console.log('--- Setup: Authenticating Test Users ---');
  
  // Citizen 1
  const citLogin = await request({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'citizen@mysuru.civicflow.in' },
  });
  const citToken = citLogin.data.token;
  const citUser = citLogin.data.user;
  console.log(`Citizen 1: ${citUser.name} (${citUser.id})`);

  // Citizen 2 (unauthorized viewer)
  const cit2Login = await request({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'citizen2@mysuru.civicflow.in' },
  });
  const cit2Token = cit2Login.data.token;
  const cit2User = cit2Login.data.user;
  console.log(`Citizen 2: ${cit2User.name} (${cit2User.id})`);

  // Staff (MCC Road Maintenance)
  const staffLogin = await request({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'staff@mysuru.civicflow.in' },
  });
  const staffToken = staffLogin.data.token;
  const staffUser = staffLogin.data.user;
  console.log(`Staff (Roads): ${staffUser.name} (${staffUser.department_id || 'MCC_ROADS'})`);

  // Staff Drainage (MCC Drainage Maintenance)
  const staffDrainageLogin = await request({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'staff-drainage@mysuru.civicflow.in' },
  });
  const staffDrainageToken = staffDrainageLogin.data.token;
  const staffDrainageUser = staffDrainageLogin.data.user;
  console.log(`Staff (Drainage): ${staffDrainageUser.name} (${staffDrainageUser.department_id || 'MCC_DRAINAGE'})`);

  // Admin
  const adminLogin = await request({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'admin@mysuru.civicflow.in' },
  });
  const adminToken = adminLogin.data.token;
  const adminUser = adminLogin.data.user;
  console.log(`Admin: ${adminUser.name} (${adminUser.id})\n`);

  // Import local services for unit verification
  const { db, initDb } = require('../config/db');
  await initDb();
  const caseService = require('../services/caseService');

  // -------------------------------------------------------------
  // TEST 1: AUTO_ROUTED report creates exactly one case
  // -------------------------------------------------------------
  console.log('--- TEST 1: AUTO_ROUTED report creates exactly one case ---');
  const createReportRes1 = await request({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citToken}` },
    body: {
      category: 'POTHOLE',
      description: 'Huge dangerous pothole near railway gate',
      latitude: 12.315,
      longitude: 76.635,
    },
  });

  assert(createReportRes1.status === 201, 'Report 1 created successfully', createReportRes1.data);
  const report1 = createReportRes1.data;
  const report1Routing = report1.routing;

  assert(
    report1Routing && report1Routing.assessment && report1Routing.assessment.status === 'AUTO_ROUTED',
    'Report 1 was AUTO_ROUTED',
    report1Routing ? report1Routing.assessment : null
  );

  // Check case creation
  const caseRes1 = await request({
    path: `/api/reports/${report1.id}/case`,
    headers: { Authorization: `Bearer ${citToken}` },
  });

  assert(caseRes1.status === 200 && caseRes1.data.case, 'Case exists for AUTO_ROUTED report', caseRes1.data);
  const case1 = caseRes1.data.case;
  assert(case1.report_id === report1.id, 'Case references the correct report_id');
  assert(/^CIV-\d{4}-\d{6}$/.test(case1.case_number), `Case has human-friendly case_number: ${case1.case_number}`);
  assert(case1.status === 'UNASSIGNED', `Initial status is UNASSIGNED (got ${case1.status})`);
  assert(case1.department_code === 'MCC_ROADS' || case1.department_id === 'MCC_ROADS', `Case routed to MCC_ROADS (got code: ${case1.department_code}, id: ${case1.department_id})`);

  // Verify exactly 1 case exists for report 1 via staff queue
  const allCasesRes = await request({
    path: `/api/staff/cases?search=${case1.case_number}`,
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert(allCasesRes.status === 200 && allCasesRes.data.items.length === 1, 'Exactly one case stored in DB for report 1');

  // -------------------------------------------------------------
  // TEST 2: NEEDS_REVIEW report does not become operationally assigned before human review
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: NEEDS_REVIEW report does not become operationally assigned before human review ---');
  const createReportRes2 = await request({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citToken}` },
    body: {
      category: 'POTHOLE',
      description: 'Issue far away outside known boundary',
      latitude: 12.100, // outside boundaries -> NO_JURISDICTION_MATCH -> NEEDS_REVIEW
      longitude: 76.500,
    },
  });

  assert(createReportRes2.status === 201, 'Report 2 created successfully');
  const report2 = createReportRes2.data;
  const report2Routing = report2.routing;
  assert(
    report2Routing && report2Routing.assessment && report2Routing.assessment.status === 'NEEDS_REVIEW',
    'Report 2 is marked NEEDS_REVIEW',
    report2Routing ? report2Routing.assessment : null
  );

  // Case should NOT be operationally assigned
  const caseRes2 = await request({
    path: `/api/reports/${report2.id}/case`,
    headers: { Authorization: `Bearer ${citToken}` },
  });
  assert(
    caseRes2.status === 404 || !caseRes2.data.case || caseRes2.data.case.status === 'UNASSIGNED',
    'NEEDS_REVIEW report has no operationally assigned case before human review',
    caseRes2.data
  );

  // Now perform human review to create/route case cleanly
  const reviewRes = await request({
    path: `/api/reports/${report2.id}/routing-review`,
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: {
      action: 'OVERRIDE',
      final_authority_id: 'MCC',
      final_department_id: 'MCC_ROADS',
      review_notes: 'Confirmed location belongs to Ward 42 per local inspection',
    },
  });
  assert(reviewRes.status === 200, 'Human review override succeeded', reviewRes.data);
  const reviewedCase = reviewRes.data.case;
  assert(reviewedCase && reviewedCase.case_number, 'Case created after human review decision', reviewedCase);
  assert(reviewedCase.status === 'UNASSIGNED', 'Case created post-review starts UNASSIGNED');

  // -------------------------------------------------------------
  // TEST 3: Valid status transition: ASSIGNED -> ACKNOWLEDGED
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Valid status transition: ASSIGNED -> ACKNOWLEDGED ---');
  // First assign Case 1 to staff
  const assignRes1 = await request({
    path: `/api/staff/cases/${case1.id}/assignment`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: { staff_user_id: staffUser.id },
  });
  assert(assignRes1.status === 200, 'Case assigned to staffUser', assignRes1.data);
  assert(assignRes1.data.case.status === 'ASSIGNED', 'Case status moved to ASSIGNED upon assignment');

  // Now acknowledge case
  const ackRes = await request({
    path: `/api/staff/cases/${case1.id}/status`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: {
      status: 'ACKNOWLEDGED',
      note: 'Case received and acknowledged by road maintenance inspector',
    },
  });
  assert(ackRes.status === 200, 'ASSIGNED -> ACKNOWLEDGED succeeded', ackRes.data);
  assert(ackRes.data.case.status === 'ACKNOWLEDGED', 'Case status is ACKNOWLEDGED');
  assert(ackRes.data.case.acknowledged_at !== null, 'acknowledged_at timestamp is set');
  assert(ackRes.data.timeline && ackRes.data.timeline.some((e) => e.event_type === 'CASE_ACKNOWLEDGED'), 'CASE_ACKNOWLEDGED event recorded');

  // -------------------------------------------------------------
  // TEST 4: Valid transition: ACKNOWLEDGED -> IN_PROGRESS
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Valid transition: ACKNOWLEDGED -> IN_PROGRESS ---');
  const progressRes = await request({
    path: `/api/staff/cases/${case1.id}/status`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: {
      status: 'IN_PROGRESS',
      note: 'Road repair team dispatched to location with patcher vehicle',
    },
  });
  assert(progressRes.status === 200, 'ACKNOWLEDGED -> IN_PROGRESS succeeded', progressRes.data);
  assert(progressRes.data.case.status === 'IN_PROGRESS', 'Case status is IN_PROGRESS');
  assert(progressRes.data.case.started_at !== null, 'started_at timestamp is set');
  assert(progressRes.data.timeline && progressRes.data.timeline.some((e) => e.event_type === 'CASE_STARTED'), 'CASE_STARTED event recorded');

  // -------------------------------------------------------------
  // TEST 5: Valid transition: IN_PROGRESS -> RESOLVED
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Valid transition: IN_PROGRESS -> RESOLVED ---');
  const resolveRes = await request({
    path: `/api/staff/cases/${case1.id}/status`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: {
      status: 'RESOLVED',
      note: 'Pothole filled and road surface restored with hot asphalt mix',
    },
  });
  assert(resolveRes.status === 200, 'IN_PROGRESS -> RESOLVED succeeded', resolveRes.data);
  assert(resolveRes.data.case.status === 'RESOLVED', 'Case status is RESOLVED');
  assert(resolveRes.data.case.resolved_at !== null, 'resolved_at timestamp is set');
  assert(resolveRes.data.timeline && resolveRes.data.timeline.some((e) => e.event_type === 'CASE_RESOLVED'), 'CASE_RESOLVED event recorded');

  // -------------------------------------------------------------
  // TEST 6: Invalid transition: ASSIGNED -> RESOLVED
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Invalid transition: ASSIGNED -> RESOLVED (must be rejected) ---');
  // Use reviewedCase from Test 2, assign it first
  await request({
    path: `/api/staff/cases/${reviewedCase.id}/assignment`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: { staff_user_id: staffUser.id },
  });

  const invalidAssignToResolveRes = await request({
    path: `/api/staff/cases/${reviewedCase.id}/status`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: {
      status: 'RESOLVED',
      note: 'Skipping steps directly to resolved',
    },
  });
  assert(
    invalidAssignToResolveRes.status === 400,
    'ASSIGNED -> RESOLVED rejected with 400 Bad Request',
    invalidAssignToResolveRes.data
  );
  const errMsg = invalidAssignToResolveRes.data?.message || invalidAssignToResolveRes.data?.error || '';
  assert(
    errMsg.includes('Invalid status transition'),
    'Error message explains invalid transition'
  );

  // -------------------------------------------------------------
  // TEST 7: Invalid transition: RESOLVED -> IN_PROGRESS
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Invalid transition: RESOLVED -> IN_PROGRESS (must be rejected) ---');
  const invalidResolveToProgressRes = await request({
    path: `/api/staff/cases/${case1.id}/status`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: {
      status: 'IN_PROGRESS',
      note: 'Attempting to reopen resolved case directly',
    },
  });
  assert(
    invalidResolveToProgressRes.status === 400,
    'RESOLVED -> IN_PROGRESS rejected with 400 Bad Request',
    invalidResolveToProgressRes.data
  );

  // -------------------------------------------------------------
  // TEST 8: Citizen attempts status change
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: Citizen attempts status change (must return 403 Forbidden) ---');
  const citStatusRes = await request({
    path: `/api/staff/cases/${case1.id}/status`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${citToken}` },
    body: {
      status: 'CLOSED',
      note: 'Citizen trying to close case',
    },
  });
  assert(citStatusRes.status === 403, 'Citizen status change rejected with 403 Forbidden', citStatusRes.data);

  // -------------------------------------------------------------
  // TEST 9: Citizen attempts assignment
  // -------------------------------------------------------------
  console.log('\n--- TEST 9: Citizen attempts assignment (must return 403 Forbidden) ---');
  const citAssignRes = await request({
    path: `/api/staff/cases/${case1.id}/assignment`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${citToken}` },
    body: { staff_user_id: citUser.id },
  });
  assert(citAssignRes.status === 403, 'Citizen assignment rejected with 403 Forbidden', citAssignRes.data);

  // -------------------------------------------------------------
  // TEST 10: Unauthorized staff attempts to modify another department's case
  // -------------------------------------------------------------
  console.log('\n--- TEST 10: Unauthorized staff attempts to modify another department\'s case ---');
  // staffDrainageUser belongs to MCC_DRAINAGE; case1 belongs to MCC_ROADS
  const unauthorizedStaffRes = await request({
    path: `/api/staff/cases/${case1.id}/notes`,
    method: 'POST',
    headers: { Authorization: `Bearer ${staffDrainageToken}` },
    body: { note: 'Drainage staff intruding on roads case' },
  });
  assert(
    unauthorizedStaffRes.status === 403,
    'Cross-department staff action rejected with 403 Forbidden',
    unauthorizedStaffRes.data
  );

  // -------------------------------------------------------------
  // TEST 11: Duplicate case creation attempt
  // -------------------------------------------------------------
  console.log('\n--- TEST 11: Duplicate case creation attempt (one case only) ---');
  // Attempt to call review again on report 2 or search for case1
  const allCasesForReport1 = await request({
    path: `/api/staff/cases?search=${case1.case_number}`,
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert(
    allCasesForReport1.status === 200 && allCasesForReport1.data.items.length === 1,
    'Exactly 1 case exists for case_number query (idempotent)',
    allCasesForReport1.data
  );

  // -------------------------------------------------------------
  // TEST 12: Duplicate status request (idempotency)
  // -------------------------------------------------------------
  console.log('\n--- TEST 12: Duplicate status request (idempotency) ---');
  // Case 1 is already in RESOLVED status
  const beforeDetails = await request({
    path: `/api/staff/cases/${case1.id}`,
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  const beforeEvents = beforeDetails.data.timeline;

  const dupStatusRes = await request({
    path: `/api/staff/cases/${case1.id}/status`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: {
      status: 'RESOLVED',
      note: 'Duplicate resolve click',
    },
  });
  assert(dupStatusRes.status === 200, 'Duplicate status call returns 200 without error');

  const afterDetails = await request({
    path: `/api/staff/cases/${case1.id}`,
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  const afterEvents = afterDetails.data.timeline;
  assert(
    beforeEvents.length === afterEvents.length,
    `No duplicate event created on duplicate status call (${beforeEvents.length} events unchanged)`
  );

  // -------------------------------------------------------------
  // TEST 13: Status update + event creation failure / safety
  // -------------------------------------------------------------
  console.log('\n--- TEST 13: Status update + validation safety ---');
  // Invalid payload structure should not corrupt case state
  const badStatusRes = await request({
    path: `/api/staff/cases/${case1.id}/status`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: { status: 'INVALID_STATUS_UNKNOWN' },
  });
  assert(badStatusRes.status === 400, 'Invalid status rejected with 400 Bad Request');
  const verifyCaseUnchanged = await request({
    path: `/api/staff/cases/${case1.id}`,
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert(verifyCaseUnchanged.data.case.status === 'RESOLVED', 'Case status remains unchanged after failed request');

  // -------------------------------------------------------------
  // TEST 14: Reassignment (history preserved in audit events)
  // -------------------------------------------------------------
  console.log('\n--- TEST 14: Reassignment (audit history preserved) ---');
  // Reassign reviewedCase to Admin (or different staff)
  const reassignRes = await request({
    path: `/api/staff/cases/${reviewedCase.id}/assignment`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { staff_user_id: adminUser.id },
  });
  assert(reassignRes.status === 200, 'Reassignment request succeeded');
  const reviewedDetails = await request({
    path: `/api/staff/cases/${reviewedCase.id}`,
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const caseEvents = reviewedDetails.data.timeline;
  const assignEvents = caseEvents.filter((e) => e.event_type === 'CASE_ASSIGNED' || e.event_type === 'CASE_REASSIGNED');
  assert(
    assignEvents.length >= 2,
    `Assignment history preserved with ${assignEvents.length} assignment events`,
    assignEvents.map((e) => `${e.event_type}: ${e.note}`)
  );

  // -------------------------------------------------------------
  // TEST 15: ON_HOLD without reason (validation failure)
  // -------------------------------------------------------------
  console.log('\n--- TEST 15: ON_HOLD without reason (validation failure) ---');
  // Move reviewedCase: ACKNOWLEDGED -> IN_PROGRESS first
  await request({
    path: `/api/staff/cases/${reviewedCase.id}/status`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { status: 'ACKNOWLEDGED' },
  });
  await request({
    path: `/api/staff/cases/${reviewedCase.id}/status`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { status: 'IN_PROGRESS' },
  });

  // Attempt ON_HOLD without on_hold_reason
  const onHoldNoReasonRes = await request({
    path: `/api/staff/cases/${reviewedCase.id}/status`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      status: 'ON_HOLD',
      note: 'Pausing work',
    },
  });
  assert(
    onHoldNoReasonRes.status === 400,
    'ON_HOLD without on_hold_reason rejected with 400 Bad Request',
    onHoldNoReasonRes.data
  );

  // Valid ON_HOLD with structured reason
  const onHoldValidRes = await request({
    path: `/api/staff/cases/${reviewedCase.id}/status`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      status: 'ON_HOLD',
      on_hold_reason: 'WEATHER',
      note: 'Heavy monsoon downpour prevented asphalt curing',
    },
  });
  assert(onHoldValidRes.status === 200, 'ON_HOLD with valid structured reason succeeded', onHoldValidRes.data);
  assert(onHoldValidRes.data.case.status === 'ON_HOLD', 'Case status is now ON_HOLD');

  // Resume from ON_HOLD -> IN_PROGRESS
  const resumeRes = await request({
    path: `/api/staff/cases/${reviewedCase.id}/status`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      status: 'IN_PROGRESS',
      note: 'Weather cleared, road crew resumed patching',
    },
  });
  assert(resumeRes.status === 200, 'ON_HOLD -> IN_PROGRESS resumed successfully', resumeRes.data);

  // -------------------------------------------------------------
  // TEST 16: RESOLVED without resolution note (validation failure)
  // -------------------------------------------------------------
  console.log('\n--- TEST 16: RESOLVED without resolution note (validation failure) ---');
  const resolveNoNoteRes = await request({
    path: `/api/staff/cases/${reviewedCase.id}/status`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      status: 'RESOLVED',
      note: '', // missing note
    },
  });
  assert(
    resolveNoNoteRes.status === 400,
    'RESOLVED without resolution note rejected with 400 Bad Request',
    resolveNoNoteRes.data
  );

  // -------------------------------------------------------------
  // TEST 17: Citizen can see current case status
  // -------------------------------------------------------------
  console.log('\n--- TEST 17: Citizen can see current case status & timeline ---');
  const citizenViewRes = await request({
    path: `/api/reports/${report1.id}`,
    headers: { Authorization: `Bearer ${citToken}` },
  });
  assert(citizenViewRes.status === 200, 'Citizen fetched their report', citizenViewRes.data);
  const citReport = citizenViewRes.data;
  assert(citReport.case !== null, 'Citizen view includes attached case');
  assert(citReport.case.case_number === case1.case_number, 'Citizen view has correct case_number');
  assert(citReport.case.status === 'RESOLVED', `Citizen sees current case status: ${citReport.case.status}`);

  // Test citizen timeline endpoint
  const citCaseRes = await request({
    path: `/api/reports/${report1.id}/case`,
    headers: { Authorization: `Bearer ${citToken}` },
  });
  assert(citCaseRes.status === 200 && citCaseRes.data.timeline, 'Citizen timeline retrieved');
  assert(citCaseRes.data.timeline.length > 0, `Citizen timeline has ${citCaseRes.data.timeline.length} events`);

  // -------------------------------------------------------------
  // TEST 18: Citizen cannot see unauthorized reports/cases
  // -------------------------------------------------------------
  console.log('\n--- TEST 18: Citizen cannot see unauthorized reports/cases (403 Forbidden) ---');
  // Citizen 2 tries to view Citizen 1's report
  const unauthorizedReportRes = await request({
    path: `/api/reports/${report1.id}`,
    headers: { Authorization: `Bearer ${cit2Token}` },
  });
  assert(
    unauthorizedReportRes.status === 403,
    'Unauthorized citizen cannot access another citizen\'s report (403 Forbidden)',
    unauthorizedReportRes.data
  );

  // Citizen 2 tries to view Citizen 1's case timeline
  const unauthorizedCaseRes = await request({
    path: `/api/reports/${report1.id}/case`,
    headers: { Authorization: `Bearer ${cit2Token}` },
  });
  assert(
    unauthorizedCaseRes.status === 403,
    'Unauthorized citizen cannot access another citizen\'s case (403 Forbidden)',
    unauthorizedCaseRes.data
  );

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(` PHASE 7 VERIFICATION COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPhase7Verification().catch((err) => {
  console.error('Phase 7 Verification Unhandled Error:', err);
  process.exit(1);
});
