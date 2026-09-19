const http = require('http');
const aiService = require('../services/ai');

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

const VALID_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

async function runTests() {
  console.log('====================================================');
  console.log(' CIVICFLOW PHASE 3 AI UNDERSTANDING VERIFICATION');
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

  // 1. Setup Auth Tokens
  console.log('--- Step 0: Auth Setup ---');
  const citizenLogin = await makeRequest({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'citizen@mysuru.civicflow.in' },
  });
  assert(citizenLogin.status === 200, 'Citizen token obtained');
  const citizenToken = citizenLogin.data.token;

  const adminLogin = await makeRequest({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'admin@mysuru.civicflow.in' },
  });
  assert(adminLogin.status === 200, 'Admin token obtained');
  const adminToken = adminLogin.data.token;

  // Secondary citizen to test IDOR
  const citizen2Email = `citizen2.${Date.now()}@mysuru.in`;
  await makeRequest({
    path: '/api/auth/register-sync',
    method: 'POST',
    body: {
      authUid: `auth-c2-${Date.now()}`,
      name: 'Praveen K.',
      email: citizen2Email,
    },
  });
  const citizen2Login = await makeRequest({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: citizen2Email },
  });
  const citizen2Token = citizen2Login.data.token;

  // 2. Unit Testing AI Schema Validator (Section 6 & Section 22.8-22.11)
  console.log('\n--- Section 6: AI Output Schema Validator ---');
  try {
    aiService.validateAiOutput({
      category: 'INVALID_CATEGORY',
      severity: 'HIGH',
      summary: 'Test',
      riskFactors: ['Risk'],
      confidence: 0.9,
    });
    assert(false, 'Validator should reject invalid category');
  } catch (e) {
    assert(true, 'Invalid category rejected by schema validator');
  }

  try {
    aiService.validateAiOutput({
      category: 'POTHOLE',
      severity: 'EXTREME', // Invalid severity
      summary: 'Test',
      riskFactors: ['Risk'],
      confidence: 0.9,
    });
    assert(false, 'Validator should reject invalid severity');
  } catch (e) {
    assert(true, 'Invalid severity rejected by schema validator');
  }

  try {
    aiService.validateAiOutput({
      category: 'POTHOLE',
      severity: 'HIGH',
      summary: 'Test',
      riskFactors: ['Risk'],
      confidence: 'very high', // Invalid non-numeric confidence
    });
    assert(false, 'Validator should reject non-numeric confidence');
  } catch (e) {
    assert(true, 'Non-numeric confidence rejected by schema validator');
  }

  try {
    aiService.validateAiOutput({
      category: 'POTHOLE',
      severity: 'HIGH',
      summary: 'Test',
      riskFactors: ['Risk'],
      confidence: 1.5, // Out of range
    });
    assert(false, 'Validator should reject confidence > 1.0');
  } catch (e) {
    assert(true, 'Out-of-range confidence (>1.0) rejected by schema validator');
  }

  // 3. Issue Understanding Classification Tests (Section 22.1 - 22.7)
  console.log('\n--- Section 22.1-22.7: Category Issue Understanding ---');

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Test 1: Pothole report
  const potholeReport = await makeRequest({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
    body: {
      category: 'POTHOLE',
      description: `Massive deep pothole on KRS Road near railway crossing. Two-wheelers falling daily ${Date.now()}`,
      latitude: 12.33,
      longitude: 76.62,
    },
  });
  assert(potholeReport.status === 201, 'Pothole report created');
  const potholeReportId = potholeReport.data.id;

  await sleep(1500);
  const potholeAnalysis = await makeRequest({
    path: `/api/reports/${potholeReportId}/analyze`,
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  assert(
    potholeAnalysis.status === 200 && potholeAnalysis.data.analysis.category === 'POTHOLE',
    `Pothole report correctly analyzed as POTHOLE (Confidence: ${potholeAnalysis.data.analysis?.confidence})`
  );

  // Test 2: Garbage report
  await sleep(1500);
  const garbageReport = await makeRequest({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
    body: {
      category: 'GARBAGE_OVERFLOW',
      description: `Huge overflow of uncollected domestic waste and garbage dumping near Kuvempunagar market ${Date.now()}`,
      latitude: 12.29,
      longitude: 76.63,
    },
  });
  assert(garbageReport.status === 201, 'Garbage report created');
  await sleep(1500);
  const garbageAnalysis = await makeRequest({
    path: `/api/reports/${garbageReport.data.id}/analyze`,
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  assert(
    garbageAnalysis.status === 200 && (garbageAnalysis.data.analysis.category === 'GARBAGE_OVERFLOW' || garbageAnalysis.data.analysis.category === 'ILLEGAL_DUMPING'),
    `Garbage report correctly analyzed as GARBAGE_OVERFLOW / DUMPING (${garbageAnalysis.data.analysis?.category})`
  );

  // Test 3: Streetlight report (with citizen disagreement test)
  await sleep(1500);
  const streetlightReport = await makeRequest({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
    body: {
      category: 'OTHER', // Citizen marked OTHER
      description: `Streetlight pole is completely dark and leaning dangerously over pedestrian sidewalk on Sayyaji Rao Road ${Date.now()}`,
      latitude: 12.31,
      longitude: 76.65,
    },
  });
  assert(streetlightReport.status === 201, 'Streetlight report created');
  await sleep(1500);
  const streetlightAnalysis = await makeRequest({
    path: `/api/reports/${streetlightReport.data.id}/analyze`,
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  assert(
    streetlightAnalysis.status === 200 && streetlightAnalysis.data.analysis.category === 'BROKEN_STREETLIGHT',
    `Streetlight report correctly classified as BROKEN_STREETLIGHT even though citizen marked OTHER`
  );
  assert(
    streetlightAnalysis.data.originalCitizenCategory === 'OTHER',
    'Original citizen category remains preserved as OTHER (not overwritten)'
  );

  // Test 4: Blocked drain report
  await sleep(1500);
  const drainReport = await makeRequest({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
    body: {
      category: 'BLOCKED_DRAIN',
      description: `Stormwater drain is completely clogged with silt and overflowing onto the main road causing severe waterlogging ${Date.now()}`,
      latitude: 12.32,
      longitude: 76.64,
    },
  });
  assert(drainReport.status === 201, 'Drain report created');
  await sleep(1500);
  const drainAnalysis = await makeRequest({
    path: `/api/reports/${drainReport.data.id}/analyze`,
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  assert(
    drainAnalysis.status === 200 && drainAnalysis.data.analysis.category === 'BLOCKED_DRAIN',
    `Drain report correctly classified as BLOCKED_DRAIN`
  );

  // Test 5: Ambiguous report testing NEEDS_REVIEW (confidence < 0.70)
  await sleep(1500);
  const ambiguousReport = await makeRequest({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
    body: {
      category: 'OTHER',
      description: `Something seems wrong around this corner, please check it out sometime ${Date.now()}`,
      latitude: 12.30,
      longitude: 76.65,
    },
  });
  assert(ambiguousReport.status === 201, 'Ambiguous report created');
  await sleep(1500);
  const ambiguousAnalysis = await makeRequest({
    path: `/api/reports/${ambiguousReport.data.id}/analyze`,
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  assert(
    ambiguousAnalysis.status === 200 &&
      (ambiguousAnalysis.data.analysis.status === 'NEEDS_REVIEW' || ambiguousAnalysis.data.analysis.confidence < 0.70),
    `Ambiguous report flagged as NEEDS_REVIEW / low confidence (${ambiguousAnalysis.data.analysis?.status}, Confidence: ${ambiguousAnalysis.data.analysis?.confidence})`
  );

  // Test 6 & 7: Multimodal photo handling
  await sleep(1500);
  const photoReport = await makeRequest({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
    body: {
      category: 'POTHOLE',
      description: `Pothole with attached photo evidence ${Date.now()}`,
      photoData: VALID_PNG_BASE64,
      latitude: 12.30,
      longitude: 76.65,
    },
  });
  assert(photoReport.status === 201, 'Photo report created');
  await sleep(1500);
  const photoAnalysis = await makeRequest({
    path: `/api/reports/${photoReport.data.id}/analyze`,
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  const returnedRisks = photoAnalysis.data?.analysis?.risk_factors || photoAnalysis.data?.analysis?.riskFactors || [];
  assert(
    photoAnalysis.status === 200 && Array.isArray(returnedRisks) && returnedRisks.length > 0,
    'Report with photo evidence processes multimodal visual data successfully'
  );

  // 4. Repeated Analysis & Abuse Protection (Section 15, 19, 22.14)
  console.log('\n--- Section 15 & 19: Abuse & Reprocessing Safeguards ---');
  const repeatedAnalysis = await makeRequest({
    path: `/api/reports/${potholeReportId}/analyze`,
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  assert(
    repeatedAnalysis.status === 200 && repeatedAnalysis.data.cached === true,
    'Repeated analysis by citizen returns cached result without re-invoking Gemini (cost protection)'
  );

  // Admin can force reprocess
  const adminReprocess = await makeRequest({
    path: `/api/reports/${potholeReportId}/analyze`,
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { forceReprocess: true },
  });
  assert(
    adminReprocess.status === 200 && adminReprocess.data.cached === false,
    'Admin is permitted to force-reprocess an existing completed analysis'
  );

  // 5. Authorization & IDOR Protection (Section 22.15, 22.16)
  console.log('\n--- Section 21 & 22.15-22.16: Security & IDOR Protection ---');
  // Unauthenticated analysis trigger -> 401
  const unauthAnalyze = await makeRequest({
    path: `/api/reports/${potholeReportId}/analyze`,
    method: 'POST',
  });
  assert(unauthAnalyze.status === 401, 'Unauthenticated analysis request rejected (401)');

  // Citizen 2 attempting to trigger analysis on Citizen 1's report -> 403 Forbidden
  const idorAnalyze = await makeRequest({
    path: `/api/reports/${potholeReportId}/analyze`,
    method: 'POST',
    headers: { Authorization: `Bearer ${citizen2Token}` },
  });
  assert(idorAnalyze.status === 403, 'Citizen B cannot analyze Citizen A report (403 Forbidden IDOR Guard)');

  // Citizen 2 attempting to view Citizen 1's analysis -> 403 Forbidden
  const idorGetAnalysis = await makeRequest({
    path: `/api/reports/${potholeReportId}/analysis`,
    headers: { Authorization: `Bearer ${citizen2Token}` },
  });
  assert(idorGetAnalysis.status === 403, 'Citizen B cannot fetch Citizen A analysis (403 Forbidden IDOR Guard)');

  // 6. Fetching Analysis via GET /api/reports/:id/analysis
  console.log('\n--- Section 14: GET Analysis API ---');
  const getAnalysisRes = await makeRequest({
    path: `/api/reports/${potholeReportId}/analysis`,
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  assert(
    getAnalysisRes.status === 200 &&
      getAnalysisRes.data.analysis.category === 'POTHOLE' &&
      getAnalysisRes.data.analysis.severity &&
      getAnalysisRes.data.analysis.summary &&
      Array.isArray(getAnalysisRes.data.analysis.risk_factors),
    'GET /api/reports/:id/analysis returns full structured AI analysis'
  );

  console.log('\n====================================================');
  console.log(` PHASE 3 VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
