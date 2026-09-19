/**
 * seed_demo_scenarios.js
 * Seeds the three specific demo scenarios specified in Phase 6:
 * SCENARIO A: AUTOMATIC (High confidence, Ward 42, MCC Roads -> AUTO_ROUTED)
 * SCENARIO B: UNCERTAIN (Ambiguous description, Low confidence AI -> NEEDS_REVIEW)
 * SCENARIO C: DATA CONFLICT (Overlapping boundary coordinates 12.36, 76.76 -> JURISDICTION_CONFLICT -> NEEDS_REVIEW)
 */

const http = require('http');

const API_BASE = 'http://localhost:5000';

function request({ path, method = 'GET', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
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
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function seedDemoScenarios() {
  console.log('================================================================');
  console.log(' CIVICFLOW SEED DEMO SCENARIOS: PHASE 6 DEMONSTRATION');
  console.log('================================================================\n');

  // Authenticate citizen
  const loginRes = await request({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'citizen@mysuru.civicflow.in' },
  });
  const citToken = loginRes.data.token;
  console.log('Authenticated Citizen:', loginRes.data.user.name);

  // SCENARIO A: AUTOMATIC
  console.log('\n--- Seeding Scenario A: AUTOMATIC ---');
  const scenarioARes = await request({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citToken}` },
    body: {
      category: 'POTHOLE',
      description: 'Huge dangerous pothole right near the road center in Jayalakshmipuram, breaking vehicle axles.',
      latitude: 12.315,
      longitude: 76.635,
      accuracy: 5.0,
    },
  });
  console.log(`Scenario A Report ID: ${scenarioARes.data.id}`);

  // SCENARIO B: UNCERTAIN
  console.log('\n--- Seeding Scenario B: UNCERTAIN (System Refuses to Guess) ---');
  const scenarioBRes = await request({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citToken}` },
    body: {
      category: 'OTHER',
      description: 'Something feels weird or uncertain near the corner, possible low rumble or unspecified civic issue.',
      latitude: 12.315,
      longitude: 76.635,
      accuracy: 8.0,
    },
  });
  console.log(`Scenario B Report ID: ${scenarioBRes.data.id}`);

  // SCENARIO C: DATA CONFLICT
  console.log('\n--- Seeding Scenario C: DATA CONFLICT (Overlapping Spatial Boundaries) ---');
  const scenarioCRes = await request({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citToken}` },
    body: {
      category: 'POTHOLE',
      description: 'Deep road depression directly located on the disputed boundary between municipal jurisdictions.',
      latitude: 12.36,
      longitude: 76.76,
      accuracy: 4.0,
    },
  });
  console.log(`Scenario C Report ID: ${scenarioCRes.data.id}`);

  // Wait 3 seconds for background AI & routing analysis to complete
  console.log('\nWaiting for background processing...');
  await new Promise((r) => setTimeout(r, 3500));

  // Inspect Routing Results
  const [routA, routB, routC] = await Promise.all([
    request({ path: `/api/reports/${scenarioARes.data.id}/routing`, headers: { Authorization: `Bearer ${citToken}` } }),
    request({ path: `/api/reports/${scenarioBRes.data.id}/routing`, headers: { Authorization: `Bearer ${citToken}` } }),
    request({ path: `/api/reports/${scenarioCRes.data.id}/routing`, headers: { Authorization: `Bearer ${citToken}` } }),
  ]);

  console.log('\n================================================================');
  console.log(' SEEDING SUMMARY');
  console.log('================================================================');
  console.log(`Scenario A: ID=${scenarioARes.data.id} -> Routing Status: ${routA.data?.routing?.routing_status || routA.data?.routing?.route_status} (Source: ${routA.data?.routing?.decision_source})`);
  console.log(`Scenario B: ID=${scenarioBRes.data.id} -> Routing Status: ${routB.data?.routing?.routing_status || routB.data?.routing?.route_status} (Reasons: ${JSON.stringify(routB.data?.routing?.review_reasons)})`);
  console.log(`Scenario C: ID=${scenarioCRes.data.id} -> Routing Status: ${routC.data?.routing?.routing_status || routC.data?.routing?.route_status} (Reasons: ${JSON.stringify(routC.data?.routing?.review_reasons)})`);
  console.log('================================================================\n');
}

seedDemoScenarios().catch(console.error);
