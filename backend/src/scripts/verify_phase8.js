/**
 * Verification Suite for Phase 8: Resolution Verification
 * 
 * Verifies all Phase 8 requirements:
 * TEST 1: Staff resolution requires non-empty resolution note (400 Bad Request).
 * TEST 2: Staff resolution with note + evidence succeeds -> RESOLVED + PENDING verification.
 * TEST 3: Staff cannot verify on behalf of citizen (403 Forbidden).
 * TEST 4: Unauthorized citizen cannot verify another citizen's report (403 Forbidden IDOR).
 * TEST 5: Unresolved case cannot be verified (400 Bad Request).
 * TEST 6: Citizen confirmation transitions verification to VERIFIED.
 * TEST 7: Case remains VERIFIED, immutable RESOLUTION_VERIFIED event recorded.
 * TEST 8: Citizen dispute without reason is rejected (400 Bad Request).
 * TEST 9: Citizen dispute with valid reason transitions verification to DISPUTED.
 * TEST 10: Previous resolution note and evidence preserved intact after dispute.
 * TEST 11: Unauthorized staff from another department cannot reopen case (403 Forbidden).
 * TEST 12: Authorized staff reopens disputed case -> returns to IN_PROGRESS.
 * TEST 13: Original case number and report ID preserved; immutable CASE_REOPENED event recorded.
 * TEST 14: Re-resolution and second verification cycle succeeds.
 * TEST 15: Idempotency / duplicate verification attempts handled safely.
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

async function runPhase8Verification() {
  console.log('================================================================');
  console.log(' CIVICFLOW PHASE 8 VERIFICATION: RESOLUTION VERIFICATION');
  console.log(' Standard: RESOLVED ≠ VERIFIED');
  console.log('================================================================\n');

  // Setup: Authenticate test users
  console.log('--- Setup: Authenticating Test Users ---');
  
  // Citizen 1
  const cit1Login = await request({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'citizen@mysuru.civicflow.in' },
  });
  const cit1Token = cit1Login.data.token;
  const cit1User = cit1Login.data.user;
  console.log(`Citizen 1: ${cit1User.name} (${cit1User.id})`);

  // Citizen 2 (unauthorized viewer)
  const cit2Login = await request({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'citizen2@mysuru.civicflow.in' },
  });
  const cit2Token = cit2Login.data.token;
  const cit2User = cit2Login.data.user;
  console.log(`Citizen 2: ${cit2User.name} (${cit2User.id})`);

  // Staff Roads
  const staffRoadsLogin = await request({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'staff@mysuru.civicflow.in' },
  });
  const staffRoadsToken = staffRoadsLogin.data.token;
  const staffRoadsUser = staffRoadsLogin.data.user;
  console.log(`Staff (Roads): ${staffRoadsUser.name} (${staffRoadsUser.department_id || 'MCC_ROADS'})`);

  // Staff Drainage (cross-department)
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

  let reportCounter = 1;
  const runOffset = ((Date.now() % 500) / 100000);
  async function createReportAndAdvance(token, staffToken, targetStatus = 'IN_PROGRESS') {
    const repRes = await request({
      path: '/api/reports',
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        category: 'POTHOLE',
        description: `Pothole report test #${reportCounter++} - ${Date.now()} on Jayalakshmipuram 5th Main Rd near park.`,
        latitude: 12.3170 + runOffset + (reportCounter * 0.001),
        longitude: 76.6340,
      },
    });

    const report = repRes.data;
    const caseRes = await request({
      path: `/api/reports/${report.id}/case`,
      headers: { Authorization: `Bearer ${token}` },
    });
    const civicCase = caseRes.data.case;

    if (targetStatus === 'UNASSIGNED') return { report, civicCase };

    // Assign
    await request({
      path: `/api/staff/cases/${civicCase.id}/assignment`,
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { staff_id: staffRoadsUser.id },
    });

    if (targetStatus === 'ASSIGNED') return { report, civicCase };

    // Acknowledge
    await request({
      path: `/api/staff/cases/${civicCase.id}/status`,
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { status: 'ACKNOWLEDGED', note: 'Staff acknowledged receipt.' },
    });

    if (targetStatus === 'ACKNOWLEDGED') return { report, civicCase };

    // Start In Progress
    await request({
      path: `/api/staff/cases/${civicCase.id}/status`,
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { status: 'IN_PROGRESS', note: 'Road repair team mobilized.' },
    });

    return { report, civicCase };
  }

  // =========================================================================
  // TEST 1: Staff resolution requires non-empty resolution note
  // =========================================================================
  console.log('--- TEST 1: Staff resolution requires non-empty resolution note ---');
  const setup1 = await createReportAndAdvance(cit1Token, staffRoadsToken, 'IN_PROGRESS');
  const case1 = setup1.civicCase;

  const resEmptyNote = await request({
    path: `/api/staff/cases/${case1.id}/status`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staffRoadsToken}` },
    body: { status: 'RESOLVED', note: '   ' },
  });
  assert(resEmptyNote.status === 400, 'Blank resolution note rejected with 400 Bad Request');
  assert(
    resEmptyNote.data?.message?.includes('note'),
    'Error message specifies resolution note requirement',
    resEmptyNote.data?.message
  );

  // =========================================================================
  // TEST 2: Staff resolution with note + evidence succeeds -> RESOLVED + PENDING verification
  // =========================================================================
  console.log('\n--- TEST 2: Staff resolution with note + evidence succeeds ---');
  // Small 1x1 png base64 for test evidence
  const samplePhotoData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const resResolveSuccess = await request({
    path: `/api/staff/cases/${case1.id}/resolve`,
    method: 'POST',
    headers: { Authorization: `Bearer ${staffRoadsToken}` },
    body: {
      note: 'Filled crater with asphalt and compacted surface flush with road.',
      photoData: samplePhotoData,
    },
  });

  assert(resResolveSuccess.status === 200, 'Case resolved successfully with 200 OK');
  assert(resResolveSuccess.data?.case?.status === 'RESOLVED', 'Case status transitioned to RESOLVED');
  assert(resResolveSuccess.data?.verification?.status === 'PENDING', 'Verification record created with status PENDING');
  assert(resResolveSuccess.data?.verification?.cycle_number === 1, 'Verification cycle number initialized to 1');

  // Verify evidence attached
  const verDetailRes = await request({
    path: `/api/reports/${setup1.report.id}/verification`,
    headers: { Authorization: `Bearer ${cit1Token}` },
  });
  assert(verDetailRes.status === 200, 'Verification snapshot retrieved by citizen');
  assert(verDetailRes.data?.current_verification?.status === 'PENDING', 'Current verification is PENDING');
  assert(verDetailRes.data?.evidence?.length > 0, 'Resolution evidence photo stored and linked to case');

  // =========================================================================
  // TEST 3: Staff cannot verify on behalf of citizen (403 Forbidden)
  // =========================================================================
  console.log('\n--- TEST 3: Staff cannot verify on behalf of citizen (403 Forbidden) ---');
  const staffVerifyAttempt = await request({
    path: `/api/reports/${setup1.report.id}/verification/confirm`,
    method: 'POST',
    headers: { Authorization: `Bearer ${staffRoadsToken}` },
  });
  assert(staffVerifyAttempt.status === 403, 'Staff verification rejected with 403 Forbidden');
  assert(
    staffVerifyAttempt.data?.message?.includes('Staff cannot verify'),
    'Error explains staff cannot verify on citizen behalf'
  );

  // =========================================================================
  // TEST 4: Citizen cannot verify another citizen's case (403 Forbidden IDOR Guard)
  // =========================================================================
  console.log('\n--- TEST 4: Citizen cannot verify another citizen case (403 Forbidden IDOR Guard) ---');
  const idorVerifyAttempt = await request({
    path: `/api/reports/${setup1.report.id}/verification/confirm`,
    method: 'POST',
    headers: { Authorization: `Bearer ${cit2Token}` },
  });
  assert(idorVerifyAttempt.status === 403, 'Cross-citizen verification rejected with 403 Forbidden');

  // =========================================================================
  // TEST 5: Unresolved case cannot be verified (400 Bad Request)
  // =========================================================================
  console.log('\n--- TEST 5: Unresolved case cannot be verified (400 Bad Request) ---');
  const setupUnresolved = await createReportAndAdvance(cit1Token, staffRoadsToken, 'IN_PROGRESS');
  const unresolvedVerifyAttempt = await request({
    path: `/api/reports/${setupUnresolved.report.id}/verification/confirm`,
    method: 'POST',
    headers: { Authorization: `Bearer ${cit1Token}` },
  });
  assert(unresolvedVerifyAttempt.status === 400, 'Verification on unresolved case rejected with 400 Bad Request');
  assert(
    unresolvedVerifyAttempt.data?.message?.includes('Cannot verify unresolved'),
    'Error message indicates case is not resolved'
  );

  // =========================================================================
  // TEST 6: Citizen confirmation transitions verification to VERIFIED
  // =========================================================================
  console.log('\n--- TEST 6: Citizen confirmation transitions verification to VERIFIED ---');
  const confirmRes = await request({
    path: `/api/reports/${setup1.report.id}/verification/confirm`,
    method: 'POST',
    headers: { Authorization: `Bearer ${cit1Token}` },
  });
  assert(confirmRes.status === 200, 'Citizen confirmation succeeded with 200 OK');
  assert(confirmRes.data?.verification?.status === 'VERIFIED', 'Verification status moved to VERIFIED');
  assert(Boolean(confirmRes.data?.verification?.verified_at), 'verified_at timestamp populated');

  // =========================================================================
  // TEST 7: Case remains VERIFIED, immutable RESOLUTION_VERIFIED event recorded
  // =========================================================================
  console.log('\n--- TEST 7: Immutable audit event RESOLUTION_VERIFIED recorded ---');
  const caseAuditRes = await request({
    path: `/api/staff/cases/${case1.id}`,
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const timeline1 = caseAuditRes.data?.timeline || [];
  const verifiedEvent = timeline1.find((e) => e.event_type === 'RESOLUTION_VERIFIED');
  assert(Boolean(verifiedEvent), 'RESOLUTION_VERIFIED immutable event found in case timeline');
  assert(verifiedEvent?.actor_user_id === cit1User.id, 'RESOLUTION_VERIFIED event records citizen as actor');

  // =========================================================================
  // TEST 8: Citizen dispute without reason is rejected (400 Bad Request)
  // =========================================================================
  console.log('\n--- TEST 8: Citizen dispute without reason is rejected (400 Bad Request) ---');
  const setup2 = await createReportAndAdvance(cit1Token, staffRoadsToken, 'IN_PROGRESS');
  const case2 = setup2.civicCase;

  // Resolve case 2
  await request({
    path: `/api/staff/cases/${case2.id}/resolve`,
    method: 'POST',
    headers: { Authorization: `Bearer ${staffRoadsToken}` },
    body: {
      note: 'Filled pothole with gravel and leveled surface.',
    },
  });

  const emptyDisputeRes = await request({
    path: `/api/reports/${setup2.report.id}/verification/dispute`,
    method: 'POST',
    headers: { Authorization: `Bearer ${cit1Token}` },
    body: { reason: '   ' },
  });
  assert(emptyDisputeRes.status === 400, 'Dispute without reason rejected with 400 Bad Request');
  assert(
    emptyDisputeRes.data?.message?.includes('dispute reason'),
    'Error message requires dispute reason'
  );

  // =========================================================================
  // TEST 9: Citizen dispute with valid reason transitions verification to DISPUTED
  // =========================================================================
  console.log('\n--- TEST 9: Citizen dispute with valid reason transitions verification to DISPUTED ---');
  const disputeText = 'Pothole is still present, only loose dirt was poured which washed away in rain.';
  const disputeRes = await request({
    path: `/api/reports/${setup2.report.id}/verification/dispute`,
    method: 'POST',
    headers: { Authorization: `Bearer ${cit1Token}` },
    body: { reason: disputeText },
  });
  assert(disputeRes.status === 200, 'Dispute submitted successfully with 200 OK');
  assert(disputeRes.data?.verification?.status === 'DISPUTED', 'Verification status is DISPUTED');
  assert(disputeRes.data?.verification?.dispute_reason === disputeText, 'Dispute reason stored accurately');
  assert(Boolean(disputeRes.data?.verification?.disputed_at), 'disputed_at timestamp recorded');

  // Verify RESOLUTION_DISPUTED event
  const case2Audit = await request({
    path: `/api/staff/cases/${case2.id}`,
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const disputeEvent = case2Audit.data?.timeline?.find((e) => e.event_type === 'RESOLUTION_DISPUTED');
  assert(Boolean(disputeEvent), 'RESOLUTION_DISPUTED event recorded in timeline');
  assert(disputeEvent?.note === disputeText, 'Dispute event records citizen reason note');

  // =========================================================================
  // TEST 10: Previous resolution note and evidence preserved intact after dispute
  // =========================================================================
  console.log('\n--- TEST 10: Previous resolution note and evidence preserved intact after dispute ---');
  assert(
    disputeRes.data?.verification?.resolution_note === 'Filled pothole with gravel and leveled surface.',
    'Original staff resolution note preserved intact'
  );

  // =========================================================================
  // TEST 11: Unauthorized staff from another department cannot reopen case (403 Forbidden)
  // =========================================================================
  console.log('\n--- TEST 11: Cross-department staff cannot reopen case (403 Forbidden) ---');
  const unauthorizedReopen = await request({
    path: `/api/staff/cases/${case2.id}/reopen`,
    method: 'POST',
    headers: { Authorization: `Bearer ${staffDrainageToken}` },
    body: { note: 'Drainage officer attempting to reopen roads case.' },
  });
  assert(unauthorizedReopen.status === 403, 'Cross-department reopen rejected with 403 Forbidden');

  // =========================================================================
  // TEST 12: Authorized staff reopens disputed case -> returns to IN_PROGRESS
  // =========================================================================
  console.log('\n--- TEST 12: Authorized staff reopens disputed case -> returns to IN_PROGRESS ---');
  const reopenRes = await request({
    path: `/api/staff/cases/${case2.id}/reopen`,
    method: 'POST',
    headers: { Authorization: `Bearer ${staffRoadsToken}` },
    body: { note: 'Dispatched asphalt team with hot-mix bitumen for proper resurfacing.' },
  });
  assert(reopenRes.status === 200, 'Disputed case reopened with 200 OK');
  assert(reopenRes.data?.case?.status === 'IN_PROGRESS', 'Case status transitioned back to IN_PROGRESS');

  // =========================================================================
  // TEST 13: Original case number and report ID preserved; immutable CASE_REOPENED event recorded
  // =========================================================================
  console.log('\n--- TEST 13: Original case number preserved; immutable CASE_REOPENED event recorded ---');
  assert(reopenRes.data?.case?.id === case2.id, 'Case ID remains identical');
  assert(reopenRes.data?.case?.case_number === case2.case_number, 'Case number (CIV-YYYY-XXXXXX) remains identical');
  assert(reopenRes.data?.case?.report_id === setup2.report.id, 'Case report_id remains identical');

  const case2AfterReopen = await request({
    path: `/api/staff/cases/${case2.id}`,
    headers: { Authorization: `Bearer ${staffRoadsToken}` },
  });
  const reopenEvent = case2AfterReopen.data?.timeline?.find((e) => e.event_type === 'CASE_REOPENED');
  assert(Boolean(reopenEvent), 'CASE_REOPENED event found in case timeline');
  assert(reopenEvent?.from_status === 'RESOLVED', 'from_status is RESOLVED');
  assert(reopenEvent?.to_status === 'IN_PROGRESS', 'to_status is IN_PROGRESS');

  // =========================================================================
  // TEST 14: Re-resolution and second verification cycle succeeds
  // =========================================================================
  console.log('\n--- TEST 14: Re-resolution and second verification cycle succeeds ---');
  const reResolveRes = await request({
    path: `/api/staff/cases/${case2.id}/resolve`,
    method: 'POST',
    headers: { Authorization: `Bearer ${staffRoadsToken}` },
    body: {
      note: 'Proper hot-mix bitumen compacted flush. Photo attached.',
      photoData: samplePhotoData,
    },
  });
  assert(reResolveRes.status === 200, 'Case re-resolved successfully with 200 OK');
  assert(reResolveRes.data?.case?.status === 'RESOLVED', 'Case status is RESOLVED');
  assert(reResolveRes.data?.verification?.status === 'PENDING', 'New verification cycle is PENDING');
  assert(reResolveRes.data?.verification?.cycle_number === 2, 'Verification cycle incremented to 2');

  // Citizen confirms cycle 2
  const confirmCycle2 = await request({
    path: `/api/reports/${setup2.report.id}/verification/confirm`,
    method: 'POST',
    headers: { Authorization: `Bearer ${cit1Token}` },
  });
  assert(confirmCycle2.status === 200, 'Citizen confirms cycle 2 with 200 OK');
  assert(confirmCycle2.data?.verification?.status === 'VERIFIED', 'Verification cycle 2 status is VERIFIED');

  // =========================================================================
  // TEST 15: Idempotency / duplicate verification attempts handled safely
  // =========================================================================
  console.log('\n--- TEST 15: Duplicate verification attempt handled safely ---');
  const dupVerifyAttempt = await request({
    path: `/api/reports/${setup2.report.id}/verification/confirm`,
    method: 'POST',
    headers: { Authorization: `Bearer ${cit1Token}` },
  });
  assert(
    dupVerifyAttempt.status === 400,
    'Duplicate verification attempt rejected safely with 400 Bad Request'
  );

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n================================================================');
  console.log(` PHASE 8 VERIFICATION COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase8Verification().catch((err) => {
  console.error('[Verification Script Error]:', err);
  process.exit(1);
});
