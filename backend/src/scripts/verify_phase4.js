/**
 * Verification Script for Phase 4: Geospatial + Dynamic Jurisdiction Engine
 * 
 * Verifies all 10 core requirements:
 * 1. Inside jurisdiction match (MATCHED, requires_review: false)
 * 2. Outside jurisdiction (NO_JURISDICTION_MATCH, requires_review: true)
 * 3. Point directly on polygon boundary segment (boundary-safe ST_Covers)
 * 4. Temporal boundary versioning before cutoff (2026-V1)
 * 5. Temporal boundary versioning after cutoff (2026-V2)
 * 6. Overlapping jurisdictions / conflict (JURISDICTION_CONFLICT, requires_review: true)
 * 7. Future version not selected for past report
 * 8. Invalid coordinates validation (latitude [-90, 90], longitude [-180, 180])
 * 9. Historical snapshot immutability via report_jurisdiction table
 * 10. Access control & IDOR protection on GET /api/reports/:id/jurisdiction
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

async function runPhase4Verification() {
  console.log('================================================================');
  console.log(' CIVICFLOW PHASE 4 VERIFICATION: GEOSPATIAL & JURISDICTION ENGINE');
  console.log('================================================================\n');

  // 1. Authenticate dev users (Citizen 1, Citizen 2, Admin)
  console.log('--- Setup: Authenticating Test Users ---');
  const cit1Login = await request({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'citizen@mysuru.civicflow.in' },
  });
  assert(cit1Login.status === 200 && cit1Login.data.token, 'Citizen 1 logged in');
  const citizen1Token = cit1Login.data.token;

  // Register Citizen 2 for IDOR tests
  const cit2Email = `cit2_${Date.now()}@mysuru.civicflow.in`;
  await request({
    path: '/api/auth/register-sync',
    method: 'POST',
    body: { authUid: `auth_uid_${Date.now()}`, name: 'Deepa Hegde', email: cit2Email },
  });
  const cit2Login = await request({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: cit2Email },
  });
  const citizen2Token = cit2Login.data.token;

  const adminLogin = await request({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'admin@mysuru.civicflow.in' },
  });
  const adminToken = adminLogin.data.token;

  // -------------------------------------------------------------
  // Test 1: Inside Jurisdiction Match (Case A: MATCHED)
  // -------------------------------------------------------------
  console.log('\n--- Test 1: Case A - Exactly 1 Valid Spatial Match (MATCHED) ---');
  const resCaseA = await request({
    path: '/api/jurisdictions/resolve',
    method: 'POST',
    body: {
      latitude: 12.315,
      longitude: 76.635,
      timestamp: '2026-09-19T10:00:00Z',
    },
  });
  assert(
    resCaseA.status === 200 &&
      resCaseA.data.matchStatus === 'MATCHED' &&
      resCaseA.data.requiresReview === false &&
      resCaseA.data.jurisdictionCode === 'MCC_WARD_42' &&
      resCaseA.data.jurisdictionType === 'MCC_WARD' &&
      resCaseA.data.boundaryVersion === '2026-V1' &&
      resCaseA.data.candidateMatches.length === 1,
    'Point inside MCC Ward 42 resolves to MATCHED with requiresReview: false',
    resCaseA.data
  );

  // -------------------------------------------------------------
  // Test 2: Outside Jurisdiction (Case B: NO_JURISDICTION_MATCH)
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Case B - 0 Matches Outside Admin Boundaries ---');
  const resCaseB = await request({
    path: '/api/jurisdictions/resolve',
    method: 'POST',
    body: {
      latitude: 12.9716, // Bengaluru coordinates (outside Mysuru)
      longitude: 77.5946,
      timestamp: '2026-09-19T10:00:00Z',
    },
  });
  assert(
    resCaseB.status === 200 &&
      resCaseB.data.matchStatus === 'NO_JURISDICTION_MATCH' &&
      resCaseB.data.requiresReview === true &&
      resCaseB.data.jurisdictionId === null &&
      resCaseB.data.candidateMatches.length === 0,
    'Point outside all jurisdictions resolves to NO_JURISDICTION_MATCH with requiresReview: true',
    resCaseB.data
  );

  // -------------------------------------------------------------
  // Test 3: Point Exactly on Boundary Segment (ST_Covers)
  // -------------------------------------------------------------
  console.log('\n--- Test 3: Point on Polygon Boundary Segment (ST_Covers) ---');
  const resBoundary = await request({
    path: '/api/jurisdictions/resolve',
    method: 'POST',
    body: {
      latitude: 12.31, // On edge segment between [76.65, 12.3] and [76.65, 12.325]
      longitude: 76.65,
      timestamp: '2026-09-19T10:00:00Z',
    },
  });
  assert(
    resBoundary.status === 200 &&
      resBoundary.data.matchStatus === 'MATCHED' &&
      resBoundary.data.jurisdictionCode === 'MCC_WARD_42',
    'Point lying directly on polygon boundary segment is matched by ST_Covers logic',
    resBoundary.data
  );

  // -------------------------------------------------------------
  // Test 4: Temporal Boundary Version Before Cutoff Date
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Temporal Boundary Version Before Cutoff Date (2026-09-19) ---');
  const resBeforeCutoff = await request({
    path: '/api/jurisdictions/resolve',
    method: 'POST',
    body: {
      latitude: 12.315,
      longitude: 76.635,
      timestamp: '2026-09-19T12:00:00Z',
    },
  });
  assert(
    resBeforeCutoff.status === 200 &&
      resBeforeCutoff.data.boundaryVersion === '2026-V1' &&
      resBeforeCutoff.data.validUntil === '2026-09-20T00:00:00.000Z',
    'Query before 2026-09-20 cutoff resolves to boundary version 2026-V1',
    resBeforeCutoff.data
  );

  // -------------------------------------------------------------
  // Test 5: Temporal Boundary Version After Cutoff Date
  // -------------------------------------------------------------
  console.log('\n--- Test 5: Temporal Boundary Version After Cutoff Date (2026-09-21) ---');
  const resAfterCutoff = await request({
    path: '/api/jurisdictions/resolve',
    method: 'POST',
    body: {
      latitude: 12.315,
      longitude: 76.635,
      timestamp: '2026-09-21T12:00:00Z',
    },
  });
  assert(
    resAfterCutoff.status === 200 &&
      resAfterCutoff.data.boundaryVersion === '2026-V2' &&
      resAfterCutoff.data.validFrom === '2026-09-20T00:00:00.000Z',
    'Query after 2026-09-20 cutoff resolves to new boundary version 2026-V2',
    resAfterCutoff.data
  );

  // -------------------------------------------------------------
  // Test 6: Overlapping Boundaries Conflict (Case C: JURISDICTION_CONFLICT)
  // -------------------------------------------------------------
  console.log('\n--- Test 6: Case C - Overlapping Boundaries Conflict ---');
  const resConflict = await request({
    path: '/api/jurisdictions/resolve',
    method: 'POST',
    body: {
      latitude: 12.36,
      longitude: 76.76,
      timestamp: '2026-09-19T10:00:00Z',
    },
  });
  assert(
    resConflict.status === 200 &&
      resConflict.data.matchStatus === 'JURISDICTION_CONFLICT' &&
      resConflict.data.requiresReview === true &&
      Array.isArray(resConflict.data.candidateMatches) &&
      resConflict.data.candidateMatches.length >= 2,
    'Overlapping boundaries resolve to JURISDICTION_CONFLICT with all candidate matches returned',
    resConflict.data
  );

  // -------------------------------------------------------------
  // Test 7: Future Version Never Selected for Past Incident
  // -------------------------------------------------------------
  console.log('\n--- Test 7: Future Version Never Selected for Past Incident ---');
  const resPast = await request({
    path: '/api/jurisdictions/resolve',
    method: 'POST',
    body: {
      latitude: 12.315,
      longitude: 76.635,
      timestamp: '2026-05-15T00:00:00Z',
    },
  });
  assert(
    resPast.status === 200 &&
      resPast.data.boundaryVersion === '2026-V1' &&
      resPast.data.boundaryVersion !== '2026-V2',
    'Incident in May 2026 matches V1 and strictly ignores future V2 boundary',
    resPast.data
  );

  // -------------------------------------------------------------
  // Test 8: Coordinate Validation (Rejects Out of Range Values)
  // -------------------------------------------------------------
  console.log('\n--- Test 8: Coordinate Validation Rules ---');
  const resBadLat = await request({
    path: '/api/jurisdictions/resolve',
    method: 'POST',
    body: { latitude: 95.5, longitude: 76.635 },
  });
  assert(
    resBadLat.status === 400 && resBadLat.data.message.includes('Latitude must be a valid number'),
    'Rejects invalid latitude > 90 with 400 Bad Request',
    resBadLat.data
  );

  const resBadLng = await request({
    path: '/api/jurisdictions/resolve',
    method: 'POST',
    body: { latitude: 12.315, longitude: -200 },
  });
  assert(
    resBadLng.status === 400 && resBadLng.data.message.includes('Longitude must be a valid number'),
    'Rejects invalid longitude < -180 with 400 Bad Request',
    resBadLng.data
  );

  // -------------------------------------------------------------
  // Test 9: Historical Snapshot Immutability & Report Integration
  // -------------------------------------------------------------
  console.log('\n--- Test 9: Historical Snapshot Immutability & Report Lifecycle ---');
  // Submit a report with coordinates
  const newReportRes = await request({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citizen1Token}` },
    body: {
      category: 'POTHOLE',
      description: 'Dangerous pothole near Jayalakshmipuram 5th main junction.',
      latitude: 12.315,
      longitude: 76.635,
    },
  });
  assert(
    newReportRes.status === 201 &&
      newReportRes.data.jurisdiction &&
      newReportRes.data.jurisdiction.match_status === 'MATCHED' &&
      newReportRes.data.jurisdiction.jurisdiction_name === 'Ward 42 - Jayalakshmipuram',
    'Creating a report automatically captures and returns jurisdiction snapshot',
    newReportRes.data.jurisdiction
  );
  const createdReportId = newReportRes.data.id;

  // Retrieve snapshot via GET /api/reports/:id/jurisdiction
  const getJurRes = await request({
    path: `/api/reports/${createdReportId}/jurisdiction`,
    method: 'GET',
    headers: { Authorization: `Bearer ${citizen1Token}` },
  });
  assert(
    getJurRes.status === 200 &&
      getJurRes.data.jurisdiction &&
      getJurRes.data.jurisdiction.match_status === 'MATCHED' &&
      getJurRes.data.jurisdiction.jurisdiction_code === 'MCC_WARD_42' &&
      getJurRes.data.jurisdiction.jurisdiction_version === '2026-V1',
    'GET /api/reports/:id/jurisdiction returns immutable snapshot for report owner',
    getJurRes.data
  );

  // -------------------------------------------------------------
  // Test 10: Access Control & IDOR Guard
  // -------------------------------------------------------------
  console.log('\n--- Test 10: Access Control & IDOR Guard on Jurisdiction Endpoint ---');
  // Unauthenticated request -> 401
  const unauthRes = await request({
    path: `/api/reports/${createdReportId}/jurisdiction`,
    method: 'GET',
  });
  assert(unauthRes.status === 401, 'Unauthenticated user cannot view jurisdiction snapshot (401 Unauthorized)');

  // Citizen 2 (different user) attempting to access Citizen 1's report jurisdiction -> 403
  const idorRes = await request({
    path: `/api/reports/${createdReportId}/jurisdiction`,
    method: 'GET',
    headers: { Authorization: `Bearer ${citizen2Token}` },
  });
  assert(idorRes.status === 403, 'Citizen 2 cannot view Citizen 1 report jurisdiction (403 IDOR Guard)');

  // Admin user CAN access any report's jurisdiction snapshot -> 200
  const adminJurRes = await request({
    path: `/api/reports/${createdReportId}/jurisdiction`,
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminJurRes.status === 200, 'Admin can view any report jurisdiction snapshot (200 OK)');

  // Summary
  console.log('\n================================================================');
  console.log(` PHASE 4 TEST RESULTS: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPhase4Verification().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
