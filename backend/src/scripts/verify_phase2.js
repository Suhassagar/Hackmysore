const http = require('http');

function makeRequest({ path, method = 'GET', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, data: parsed });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

// 1x1 valid transparent PNG base64 data URI
const VALID_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// Invalid fake image data URI
const INVALID_MIME_BASE64 = 'data:image/png;base64,VGhpcyBpcyBub3QgYW4gaW1hZ2UgZmlsZQ=='; // "This is not an image file"

async function runTests() {
  console.log('====================================================');
  console.log(' CIVICFLOW PHASE 2 CITIZEN REPORT VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message, detail = '') {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      if (detail) console.error(`   Detail: ${JSON.stringify(detail)}`);
      failed++;
    }
  }

  // 1. Obtain Tokens
  console.log('--- Step 0: Auth Setup ---');
  const citizenLogin = await makeRequest({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'citizen@mysuru.civicflow.in' },
  });
  assert(citizenLogin.status === 200, 'Citizen token obtained');
  const citizenToken = citizenLogin.data.token;

  const staffLogin = await makeRequest({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'staff@mysuru.civicflow.in' },
  });
  assert(staffLogin.status === 200, 'Staff token obtained');
  const staffToken = staffLogin.data.token;

  const adminLogin = await makeRequest({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'admin@mysuru.civicflow.in' },
  });
  assert(adminLogin.status === 200, 'Admin token obtained');
  const adminToken = adminLogin.data.token;

  // Register a secondary citizen to test IDOR
  const citizen2Email = `citizen2.${Date.now()}@mysuru.in`;
  await makeRequest({
    path: '/api/auth/register-sync',
    method: 'POST',
    body: {
      authUid: `auth-c2-${Date.now()}`,
      name: 'Kavitha S.',
      email: citizen2Email,
    },
  });
  const citizen2Login = await makeRequest({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: citizen2Email },
  });
  const citizen2Token = citizen2Login.data.token;

  // 2. Authentication & Citizen-Only Authorization (Sections 2 & 24.1-24.4)
  console.log('\n--- Section 2: Citizen-Only Access Control ---');
  const unauthReport = await makeRequest({
    path: '/api/reports',
    method: 'POST',
    body: { category: 'POTHOLE', description: 'Test report with unauthenticated user' },
  });
  assert(unauthReport.status === 401, 'Unauthenticated user cannot create report (401 Unauthorized)');

  const staffReport = await makeRequest({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: { category: 'POTHOLE', description: 'Staff attempting to create report' },
  });
  assert(staffReport.status === 403, 'Staff cannot create citizen report (403 Forbidden)');

  const adminReport = await makeRequest({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { category: 'POTHOLE', description: 'Admin attempting to create report' },
  });
  assert(adminReport.status === 403, 'Admin cannot create citizen report (403 Forbidden)');

  // 3. Validation: Description (Sections 7 & 24.5-24.6)
  console.log('\n--- Section 7: Description Validation ---');
  const emptyDesc = await makeRequest({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
    body: { category: 'POTHOLE', description: '   ' },
  });
  assert(emptyDesc.status === 400, 'Empty or blank description is rejected (400)');

  const shortDesc = await makeRequest({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
    body: { category: 'POTHOLE', description: 'pothole' },
  });
  assert(shortDesc.status === 400, 'Description < 10 characters is rejected (400)');

  const longDesc = await makeRequest({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
    body: { category: 'POTHOLE', description: 'x'.repeat(1001) },
  });
  assert(longDesc.status === 400, 'Description > 1000 characters is rejected (400)');

  // 4. Validation: Category (Sections 5 & 24.7)
  console.log('\n--- Section 5: Category Validation ---');
  const invalidCat = await makeRequest({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
    body: { category: 'ALIEN_INVASION', description: 'Aliens spotted near Mysore Palace' },
  });
  assert(invalidCat.status === 400, 'Invalid category is rejected (400)');

  // 5. Validation: Location (Sections 10, 11, 12 & 24.8-24.10)
  console.log('\n--- Section 12: Location Validation ---');
  const badLat = await makeRequest({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
    body: { category: 'POTHOLE', description: 'Broken road near Chamundi Hills', latitude: 95.5, longitude: 76.6 },
  });
  assert(badLat.status === 400, 'Latitude > 90 is rejected (400)');

  const badLng = await makeRequest({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
    body: { category: 'POTHOLE', description: 'Broken road near Chamundi Hills', latitude: 12.3, longitude: 195.0 },
  });
  assert(badLng.status === 400, 'Longitude > 180 is rejected (400)');

  const badAccuracy = await makeRequest({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
    body: {
      category: 'POTHOLE',
      description: 'Broken road near Chamundi Hills',
      latitude: 12.3,
      longitude: 76.6,
      accuracy: -5,
    },
  });
  assert(badAccuracy.status === 400, 'Negative accuracy is rejected (400)');

  // Missing location handled gracefully
  const noLocReport = await makeRequest({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
    body: {
      category: 'OTHER',
      description: 'Noise complaint near residential area, no GPS captured',
    },
  });
  assert(
    noLocReport.status === 201 && noLocReport.data.location.status === 'LOCATION_MISSING',
    'Missing location is handled gracefully with status LOCATION_MISSING',
    noLocReport.data
  );

  // 6. Validation: Media / Photo (Sections 8, 9 & 24.11-24.12)
  console.log('\n--- Section 8 & 9: Media Validation ---');
  const fakeImgReport = await makeRequest({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
    body: {
      category: 'POTHOLE',
      description: 'Fake image upload attempt testing magic bytes',
      photoData: INVALID_MIME_BASE64,
    },
  });
  assert(fakeImgReport.status === 400, 'Fake image failing magic byte inspection is rejected (400)');

  // 7. Successful Report Creation (Sections 13, 14, 24.23)
  console.log('\n--- Section 13 & 14: Valid Report Creation ---');
  const validReportRes = await makeRequest({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
    body: {
      category: 'POTHOLE',
      description: 'Large pothole on Jayalakshmipuram 5th Main Road near college entrance.',
      latitude: 12.3154,
      longitude: 76.6412,
      accuracy: 14.5,
      photoData: VALID_PNG_BASE64,
    },
  });
  assert(
    validReportRes.status === 201 &&
      validReportRes.data.id &&
      validReportRes.data.category === 'POTHOLE' &&
      validReportRes.data.location.latitude === 12.3154 &&
      validReportRes.data.location.accuracy === 14.5 &&
      validReportRes.data.photoUrl &&
      validReportRes.data.photoUrl.startsWith('/uploads/') &&
      validReportRes.data.status === 'SUBMITTED',
    'Valid citizen report created with coordinates, accuracy, photoUrl, and status SUBMITTED',
    validReportRes.data
  );
  const createdReportId = validReportRes.data.id;

  // 8. Ownership & IDOR Protection (Sections 15, 16, 20 & 24.13-24.15)
  console.log('\n--- Section 15 & 16: Ownership & IDOR Protection ---');
  // Citizen 1 can see their own reports via /my
  const myReportsRes = await makeRequest({
    path: '/api/reports/my',
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  assert(
    myReportsRes.status === 200 && Array.isArray(myReportsRes.data.reports) && myReportsRes.data.reports.length >= 2,
    'GET /api/reports/my returns list of authenticated citizen reports'
  );

  // Citizen 1 can retrieve their own report detail by ID
  const ownDetailRes = await makeRequest({
    path: `/api/reports/${createdReportId}`,
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  assert(
    ownDetailRes.status === 200 && ownDetailRes.data.id === createdReportId,
    'Citizen can fetch their own report details via GET /api/reports/:id'
  );

  // Citizen 2 attempting to view Citizen 1's report -> 403 Forbidden (IDOR Guard)
  const idorAttemptRes = await makeRequest({
    path: `/api/reports/${createdReportId}`,
    headers: { Authorization: `Bearer ${citizen2Token}` },
  });
  assert(
    idorAttemptRes.status === 403,
    'Citizen B attempting to access Citizen A report is blocked (403 Forbidden IDOR Guard)',
    idorAttemptRes.data
  );

  // Non-existent report ID -> 404 Not Found
  const notFoundRes = await makeRequest({
    path: '/api/reports/00000000-0000-0000-0000-000000009999',
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  assert(notFoundRes.status === 404, 'Non-existent report ID returns 404 Not Found');

  console.log('\n====================================================');
  console.log(` PHASE 2 VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
