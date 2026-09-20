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

async function runStage1Verification() {
  console.log('================================================================');
  console.log(' CIVICFLOW STAGE 1: PRODUCTION AUTHENTICATION & RBAC TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message, detail = '') {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      if (detail) console.error(`    Detail: ${JSON.stringify(detail)}`);
      failed++;
    }
  }

  const timestamp = Date.now();
  const testCitizenEmail = `citizen_test_${timestamp}@mysuru.civicflow.in`;
  const testPassword = 'Password123!';

  // ==============================================================
  // FLOW A: NEW CITIZEN REGISTRATION & SESSION CREATION
  // ==============================================================
  console.log('--- FLOW A: New Citizen Registration ---');

  // Test A1: Valid registration
  const regRes = await makeRequest({
    path: '/api/auth/register',
    method: 'POST',
    body: {
      name: 'Kavitha Hegde',
      email: testCitizenEmail,
      password: testPassword,
    },
  });

  assert(regRes.status === 201, 'Citizen registration returns 201 Created', regRes.data);
  assert(regRes.data.token && typeof regRes.data.token === 'string', 'Registration issues an authenticated JWT token');
  assert(regRes.data.user.role === 'CITIZEN', 'Server enforces role = CITIZEN');
  assert(!regRes.data.user.password_hash && !regRes.data.user.password, 'Sensitive password hash is NOT exposed in response');

  const newCitizenToken = regRes.data.token;

  // Test A2: Session verification via /api/users/me
  const meRes = await makeRequest({
    path: '/api/users/me',
    headers: { Authorization: `Bearer ${newCitizenToken}` },
  });
  assert(meRes.status === 200, 'GET /api/users/me succeeds with newly issued token');
  assert(meRes.data.email === testCitizenEmail, 'Server derives correct email from token');
  assert(meRes.data.role === 'CITIZEN', 'Server derives CITIZEN role from database profile');

  // ==============================================================
  // FLOW B: EXISTING CITIZEN LOGIN & ROLE-BASED ACCESS
  // ==============================================================
  console.log('\n--- FLOW B: Existing Citizen Login & RBAC Boundaries ---');

  // Test B1: Citizen login with credentials
  const loginRes = await makeRequest({
    path: '/api/auth/login',
    method: 'POST',
    body: {
      email: testCitizenEmail,
      password: testPassword,
    },
  });
  assert(loginRes.status === 200, 'Citizen login with credentials returns 200 OK', loginRes.data);
  assert(loginRes.data.token, 'Login issues valid JWT token');
  assert(loginRes.data.user.role === 'CITIZEN', 'User profile role is CITIZEN');

  const citizenToken = loginRes.data.token;

  // Test B2: Citizen access to citizen endpoint
  const citAccess = await makeRequest({
    path: '/api/auth/test/citizen',
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  assert(citAccess.status === 200, 'Citizen can access citizen-level functionality');

  // Test B3: Citizen blocked from staff endpoint
  const staffAccessBlocked = await makeRequest({
    path: '/api/auth/test/staff',
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  assert(staffAccessBlocked.status === 403, 'Citizen CANNOT access staff test endpoint (403 Forbidden)');

  // Test B4: Citizen blocked from staff operational cases
  const casesBlocked = await makeRequest({
    path: '/api/staff/cases',
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  assert(casesBlocked.status === 403, 'Citizen CANNOT access staff operational cases (403 Forbidden)');

  // Test B5: Citizen blocked from admin endpoint
  const adminAccessBlocked = await makeRequest({
    path: '/api/auth/test/admin',
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  assert(adminAccessBlocked.status === 403, 'Citizen CANNOT access admin endpoint (403 Forbidden)');

  // ==============================================================
  // FLOW C: STAFF LOGIN & SCOPE INTEGRITY
  // ==============================================================
  console.log('\n--- FLOW C: Staff Login & Operational Scope ---');

  const staffLoginRes = await makeRequest({
    path: '/api/auth/login',
    method: 'POST',
    body: {
      email: 'staff@mysuru.civicflow.in',
      password: 'CivicFlow@2026',
    },
  });
  assert(staffLoginRes.status === 200, 'Staff login with credentials returns 200 OK', staffLoginRes.data);
  assert(staffLoginRes.data.user.role === 'STAFF', 'Staff role is server-derived as STAFF');

  const staffToken = staffLoginRes.data.token;

  // Test C2: Staff can access staff endpoints
  const staffTestAccess = await makeRequest({
    path: '/api/auth/test/staff',
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert(staffTestAccess.status === 200, 'Staff can access staff endpoints (200 OK)');

  // Test C3: Staff can access staff cases
  const staffCasesAccess = await makeRequest({
    path: '/api/staff/cases',
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert(staffCasesAccess.status === 200, 'Staff can access operational cases queue');

  // Test C4: Staff blocked from admin endpoints
  const staffAdminBlocked = await makeRequest({
    path: '/api/auth/test/admin',
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert(staffAdminBlocked.status === 403, 'Staff CANNOT access admin-only endpoints (403 Forbidden)');

  // ==============================================================
  // FLOW D: ADMIN LOGIN & PRIVILEGE VERIFICATION
  // ==============================================================
  console.log('\n--- FLOW D: Admin Login & Administrative Privileges ---');

  const adminLoginRes = await makeRequest({
    path: '/api/auth/login',
    method: 'POST',
    body: {
      email: 'admin@mysuru.civicflow.in',
      password: 'CivicFlow@2026',
    },
  });
  assert(adminLoginRes.status === 200, 'Admin login with credentials returns 200 OK', adminLoginRes.data);
  assert(adminLoginRes.data.user.role === 'ADMIN', 'Admin role is server-derived as ADMIN');

  const adminToken = adminLoginRes.data.token;

  const adminTestAccess = await makeRequest({
    path: '/api/auth/test/admin',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminTestAccess.status === 200, 'Admin can access administrative endpoints (200 OK)');

  // ==============================================================
  // FLOW E: SECURITY ATTACK TESTS
  // ==============================================================
  console.log('\n--- FLOW E: Security Attack & Tampering Tests ---');

  // Attack 1: Client role escalation attempt during registration
  const exploitEmail = `attacker_${timestamp}@mysuru.civicflow.in`;
  const exploitReg = await makeRequest({
    path: '/api/auth/register',
    method: 'POST',
    body: {
      name: 'Malicious Actor',
      email: exploitEmail,
      password: 'Password123!',
      role: 'ADMIN', // Tampering attempt: requesting ADMIN role
      authority_id: '00000000-0000-0000-0000-000000000099',
      department_id: '00000000-0000-0000-0000-000000000099',
    },
  });
  assert(exploitReg.status === 201, 'Registration accepted but sanitized');
  assert(exploitReg.data.user.role === 'CITIZEN', 'Server rejected client role escalation and forced CITIZEN');

  // Verify DB record itself has CITIZEN
  const exploitMe = await makeRequest({
    path: '/api/users/me',
    headers: { Authorization: `Bearer ${exploitReg.data.token}` },
  });
  assert(exploitMe.data.role === 'CITIZEN', 'Authoritative DB profile is strictly CITIZEN');

  // Attack 2: Duplicate email registration
  const dupReg = await makeRequest({
    path: '/api/auth/register',
    method: 'POST',
    body: {
      name: 'Duplicate Attempt',
      email: exploitEmail,
      password: 'Password123!',
    },
  });
  assert(dupReg.status === 409, 'Duplicate registration returns 409 Conflict');
  assert(dupReg.data.message === 'An account with this email already exists.', 'Error message matches safe expected format');

  // Attack 3: Password validation (short password rejection)
  const shortPassReg = await makeRequest({
    path: '/api/auth/register',
    method: 'POST',
    body: {
      name: 'Short Pass User',
      email: `shortpass_${timestamp}@mysuru.in`,
      password: 'short',
    },
  });
  assert(shortPassReg.status === 400, 'Registration with password < 8 chars rejected with 400 Bad Request');

  // Attack 4: Invalid login credentials
  const wrongPassLogin = await makeRequest({
    path: '/api/auth/login',
    method: 'POST',
    body: {
      email: testCitizenEmail,
      password: 'WrongPassword999!',
    },
  });
  assert(wrongPassLogin.status === 401, 'Invalid password returns 401 Unauthorized');
  assert(wrongPassLogin.data.message === 'Email or password is incorrect.', 'Safe generic error message used');

  // Attack 5: Non-existent user login
  const nonExistentLogin = await makeRequest({
    path: '/api/auth/login',
    method: 'POST',
    body: {
      email: 'nonexistent_account_xyz@mysuru.in',
      password: 'SomePassword123!',
    },
  });
  assert(nonExistentLogin.status === 401, 'Non-existent user login returns 401 Unauthorized');
  assert(nonExistentLogin.data.message === 'Email or password is incorrect.', 'Does not leak whether user exists');

  // Attack 6: Unauthenticated access to protected routes
  const unauthMe = await makeRequest({ path: '/api/users/me' });
  assert(unauthMe.status === 401, 'Unauthenticated request to /api/users/me returns 401 Unauthorized');

  // Attack 7: Forged / corrupted Bearer token
  const forgedTokenRes = await makeRequest({
    path: '/api/users/me',
    headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.tampered_signature' },
  });
  assert(forgedTokenRes.status === 401, 'Forged JWT signature rejected with 401 Unauthorized');

  // Attack 8: IDOR spoofing attempt on report creation (sending another user_id)
  const idorReportRes = await makeRequest({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
    body: {
      reporterUserId: '00000000-0000-0000-0000-000000000003', // Trying to spoof admin ID
      category: 'POTHOLE',
      description: 'Pothole on Sayyaji Rao Road near city library IDOR test',
      latitude: 12.3118,
      longitude: 76.6529,
    },
  });
  assert(idorReportRes.status === 201, 'Report created successfully');
  const reportId = idorReportRes.data.id;

  // Verify the report was created under the authenticated citizen's ID, NOT the spoofed admin ID
  const reportFetch = await makeRequest({
    path: `/api/reports/${reportId}`,
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  assert(reportFetch.status === 200, 'Authenticated citizen can view their own report');
  assert(reportFetch.data.id === reportId, 'Report was saved with correct ID');

  // Attack 9: Cross-citizen access to reports (IDOR Protection)
  const otherCitizenEmail = `other_citizen_${timestamp}@mysuru.civicflow.in`;
  const otherCitizenReg = await makeRequest({
    path: '/api/auth/register',
    method: 'POST',
    body: {
      name: 'Unrelated Citizen',
      email: otherCitizenEmail,
      password: 'Password123!',
    },
  });
  const otherCitizenToken = otherCitizenReg.data.token;

  const otherCitizenRes = await makeRequest({
    path: `/api/reports/${reportId}`,
    headers: { Authorization: `Bearer ${otherCitizenToken}` }, // Distinct second citizen
  });
  assert(otherCitizenRes.status === 403, 'Another citizen cannot access report (403 Forbidden IDOR Guard)');

  // Test 10: Logout endpoint
  const logoutRes = await makeRequest({
    path: '/api/auth/logout',
    method: 'POST',
  });
  assert(logoutRes.status === 200, 'POST /api/auth/logout returns 200 OK');

  console.log('\n================================================================');
  console.log(` STAGE 1 VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runStage1Verification().catch((err) => {
  console.error('Fatal error running verification:', err);
  process.exit(1);
});
