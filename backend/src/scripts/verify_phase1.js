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

async function runTests() {
  console.log('====================================================');
  console.log(' CIVICFLOW PHASE 1 VERIFICATION TEST SUITE');
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

  // 1. Health Endpoint
  console.log('--- Phase 0: Health Check Endpoint ---');
  const healthRes = await makeRequest({ path: '/api/health' });
  assert(healthRes.status === 200 && healthRes.data.status === 'ok', 'GET /api/health returns 200 OK with status "ok"', healthRes.data);

  // 2. Unauthenticated Request
  console.log('\n--- Section 9 & 16: Unauthenticated Request ---');
  const unauthRes = await makeRequest({ path: '/api/users/me' });
  assert(unauthRes.status === 401, 'Unauthenticated GET /api/users/me returns 401 Unauthorized', unauthRes);

  // 3. Invalid Auth Token
  console.log('\n--- Section 16: Invalid Authentication Token ---');
  const invalidTokenRes = await makeRequest({
    path: '/api/users/me',
    headers: { Authorization: 'Bearer invalid.bogus.token.value' },
  });
  assert(invalidTokenRes.status === 401, 'Invalid Bearer token returns 401 Unauthorized', invalidTokenRes);

  // 4. Citizen Registration
  console.log('\n--- Section 3 & 4: New Citizen Registration & Default Role Policy ---');
  const uniqueId = Date.now().toString(36);
  const newCitizenEmail = `citizen.${uniqueId}@mysuru.in`;
  const registerRes = await makeRequest({
    path: '/api/auth/register-sync',
    method: 'POST',
    body: {
      authUid: `auth-uid-${uniqueId}`,
      name: 'Pooja Hegde',
      email: newCitizenEmail,
      role: 'ADMIN', // MALICIOUS CLIENT ATTEMPT: Trying to elevate to ADMIN
    },
  });
  assert(
    registerRes.status === 201 && registerRes.data.user.role === 'CITIZEN',
    'Registration strictly defaults role to CITIZEN, rejecting client role tampering',
    registerRes.data
  );

  // 5. Existing Email Conflict Handling
  console.log('\n--- Section 12: Existing Email Conflict Handling ---');
  const duplicateRes = await makeRequest({
    path: '/api/auth/register-sync',
    method: 'POST',
    body: {
      authUid: `auth-uid-dup-${uniqueId}`,
      name: 'Duplicate Account',
      email: newCitizenEmail,
    },
  });
  assert(duplicateRes.status === 409, 'Duplicate email registration returns 409 Conflict', duplicateRes.data);

  // 6. Citizen Login & Token Retrieval
  console.log('\n--- Section 2: Citizen Login ---');
  const citizenLoginRes = await makeRequest({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'citizen@mysuru.civicflow.in' },
  });
  assert(citizenLoginRes.status === 200 && citizenLoginRes.data.token, 'Citizen login returns valid auth token', citizenLoginRes.data);
  const citizenToken = citizenLoginRes.data.token;

  // 7. Invalid Login
  console.log('\n--- Section 12 & 16: Invalid Login ---');
  const invalidLoginRes = await makeRequest({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'nonexistent.user@unknown.in' },
  });
  assert(invalidLoginRes.status === 404, 'Non-existent user login returns 404/401 with clear message', invalidLoginRes.data);

  // 8. Current User API (GET /api/users/me)
  console.log('\n--- Section 8: Current User API ---');
  const meRes = await makeRequest({
    path: '/api/users/me',
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  assert(
    meRes.status === 200 && meRes.data.role === 'CITIZEN' && meRes.data.email === 'citizen@mysuru.civicflow.in' && !meRes.data.password,
    'GET /api/users/me returns authenticated citizen profile without sensitive info',
    meRes.data
  );

  // 9. Staff Login
  console.log('\n--- Section 2: Staff Login ---');
  const staffLoginRes = await makeRequest({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'staff@mysuru.civicflow.in' },
  });
  assert(staffLoginRes.status === 200 && staffLoginRes.data.user.role === 'STAFF', 'Staff login returns STAFF role', staffLoginRes.data);
  const staffToken = staffLoginRes.data.token;

  // 10. Admin Login
  console.log('\n--- Section 2: Admin Login ---');
  const adminLoginRes = await makeRequest({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'admin@mysuru.civicflow.in' },
  });
  assert(adminLoginRes.status === 200 && adminLoginRes.data.user.role === 'ADMIN', 'Admin login returns ADMIN role', adminLoginRes.data);
  const adminToken = adminLoginRes.data.token;

  // 11. Role-Based Access Control: Citizen Permissions
  console.log('\n--- Section 9 & 16: Role-Based Authorization Enforcement ---');
  // Citizen on Citizen endpoint -> 200
  const cOnC = await makeRequest({
    path: '/api/auth/test/citizen',
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  assert(cOnC.status === 200, 'Citizen accessing Citizen endpoint -> 200 OK', cOnC.data);

  // Citizen on Staff endpoint -> 403 Forbidden
  const cOnS = await makeRequest({
    path: '/api/auth/test/staff',
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  assert(cOnS.status === 403, 'Citizen accessing Staff endpoint -> 403 Forbidden', cOnS.data);

  // Citizen on Admin endpoint -> 403 Forbidden
  const cOnA = await makeRequest({
    path: '/api/auth/test/admin',
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  assert(cOnA.status === 403, 'Citizen accessing Admin endpoint -> 403 Forbidden', cOnA.data);

  // 12. Staff Permissions
  // Staff on Citizen endpoint -> 200
  const sOnC = await makeRequest({
    path: '/api/auth/test/citizen',
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert(sOnC.status === 200, 'Staff accessing Citizen endpoint -> 200 OK', sOnC.data);

  // Staff on Staff endpoint -> 200
  const sOnS = await makeRequest({
    path: '/api/auth/test/staff',
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert(sOnS.status === 200, 'Staff accessing Staff endpoint -> 200 OK', sOnS.data);

  // Staff on Admin endpoint -> 403 Forbidden
  const sOnA = await makeRequest({
    path: '/api/auth/test/admin',
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert(sOnA.status === 403, 'Staff accessing Admin endpoint -> 403 Forbidden', sOnA.data);

  // 13. Admin Permissions
  // Admin on Citizen endpoint -> 200
  const aOnC = await makeRequest({
    path: '/api/auth/test/citizen',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(aOnC.status === 200, 'Admin accessing Citizen endpoint -> 200 OK', aOnC.data);

  // Admin on Staff endpoint -> 200
  const aOnS = await makeRequest({
    path: '/api/auth/test/staff',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(aOnS.status === 200, 'Admin accessing Staff endpoint -> 200 OK', aOnS.data);

  // Admin on Admin endpoint -> 200
  const aOnA = await makeRequest({
    path: '/api/auth/test/admin',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(aOnA.status === 200, 'Admin accessing Admin endpoint -> 200 OK', aOnA.data);

  console.log('\n====================================================');
  console.log(` VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
