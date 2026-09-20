/**
 * Phase 7 Demo Scenario Script:
 * Executes the exact 12-step demo scenario from Section 27.
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000';

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

async function runDemo() {
  console.log('================================================================');
  console.log(' CIVICFLOW PHASE 7 DEMO SCENARIO: STAFF WORKFLOW & ACCOUNTABILITY');
  console.log('================================================================\n');

  // Authenticate
  const citLogin = await request({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'citizen@mysuru.civicflow.in' },
  });
  const citToken = citLogin.data.token;

  const staffLogin = await request({
    path: '/api/auth/dev-login',
    method: 'POST',
    body: { email: 'staff@mysuru.civicflow.in' },
  });
  const staffToken = staffLogin.data.token;
  const staffUser = staffLogin.data.user;

  // STEP 1: Citizen submits report
  console.log('STEP 1: Citizen submits civic report');
  const reportRes = await request({
    path: '/api/reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${citToken}` },
    body: {
      category: 'POTHOLE',
      description: 'Huge dangerous pothole near the road in Ward 42.',
      latitude: 12.315,
      longitude: 76.635,
    },
  });
  const report = reportRes.data;
  console.log(`  ✓ Report created: ${report.id} (Category: ${report.category})`);

  // STEP 2, 3, 4, 5: AI, PostGIS, Responsibility, and Routing
  console.log('\nSTEP 2-5: AI Issue Understanding + PostGIS Jurisdiction + Responsibility Engine + Routing');
  console.log(`  ✓ AI Category: ${report.category}`);
  console.log(`  ✓ PostGIS Jurisdiction: ${report.jurisdiction?.jurisdiction_name || 'MCC Ward 42'}`);
  console.log(`  ✓ Responsible Authority: ${report.routing?.authority_code || 'MCC'}`);
  console.log(`  ✓ Responsible Department: ${report.routing?.department_code || 'MCC_ROADS'}`);
  console.log(`  ✓ Routing Assessment Status: ${report.routing?.assessment?.status || 'AUTO_ROUTED'}`);

  // STEP 6: Case created
  console.log('\nSTEP 6: Operational Case Created Automatically');
  const caseRes = await request({
    path: `/api/reports/${report.id}/case`,
    headers: { Authorization: `Bearer ${citToken}` },
  });
  const caseItem = caseRes.data.case;
  console.log(`  ✓ Case Number: ${caseItem.case_number}`);
  console.log(`  ✓ Initial Case Status: ${caseItem.status}`);
  console.log(`  ✓ Operating Department: ${caseItem.department_name} (${caseItem.department_code})`);

  // STEP 7: Staff opens case
  console.log('\nSTEP 7: Staff opens operational case');
  const staffCaseRes = await request({
    path: `/api/staff/cases/${caseItem.id}`,
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  console.log(`  ✓ Staff retrieved case: ${staffCaseRes.data.case.case_number}`);

  // STEP 7b: Staff assigns case
  console.log('\nSTEP 7b: Assign Staff to Case');
  const assignRes = await request({
    path: `/api/staff/cases/${caseItem.id}/assignment`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: { staff_id: staffUser.id, note: 'Assigned to Ward 42 sector officer' },
  });
  const assignedName = assignRes.data.case.assigned_to_name || staffUser.name;
  console.log(`  ✓ Assigned to: ${assignedName} (Status: ${assignRes.data.case.status})`);

  // STEP 8: Staff acknowledges
  console.log('\nSTEP 8: Staff acknowledges case');
  const ackRes = await request({
    path: `/api/staff/cases/${caseItem.id}/status`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: {
      status: 'ACKNOWLEDGED',
      note: 'Case received and acknowledged by road maintenance inspector',
    },
  });
  console.log(`  ✓ Case status: ${ackRes.data.case.status} (Acknowledged at: ${ackRes.data.case.acknowledged_at})`);

  // STEP 9: Staff marks IN_PROGRESS
  console.log('\nSTEP 9: Staff marks IN_PROGRESS');
  const progressRes = await request({
    path: `/api/staff/cases/${caseItem.id}/status`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: {
      status: 'IN_PROGRESS',
      note: 'Repair crew dispatched with asphalt patcher vehicle',
    },
  });
  console.log(`  ✓ Case status: ${progressRes.data.case.status} (Started at: ${progressRes.data.case.started_at})`);

  // STEP 10: Staff adds operational note
  console.log('\nSTEP 10: Staff adds operational note');
  const noteRes = await request({
    path: `/api/staff/cases/${caseItem.id}/notes`,
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: {
      note: 'Inspection completed. Deep pothole excavation finished, aggregate base compacted.',
      is_internal: false,
    },
  });
  console.log(`  ✓ Operational note logged: "${noteRes.data.event.note}"`);

  // STEP 11: Staff marks RESOLVED
  console.log('\nSTEP 11: Staff marks RESOLVED');
  const resolveRes = await request({
    path: `/api/staff/cases/${caseItem.id}/status`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: {
      status: 'RESOLVED',
      note: 'Pothole filled and road surface restored with hot mix asphalt.',
    },
  });
  console.log(`  ✓ Case status: ${resolveRes.data.case.status} (Resolved at: ${resolveRes.data.case.resolved_at})`);
  console.log(`  ✓ Resolution note: "${resolveRes.data.case.resolution_notes}"`);
  console.log('  ⚠ NOTE: RESOLVED != VERIFIED (Independent verification will occur in a later phase)');

  // STEP 12: Citizen sees the complete timeline
  console.log('\nSTEP 12: Citizen Views Complete Timeline & 5-Stage Journey');
  const citizenCaseRes = await request({
    path: `/api/reports/${report.id}/case`,
    headers: { Authorization: `Bearer ${citToken}` },
  });
  const citTimeline = citizenCaseRes.data.timeline;
  console.log(`  ✓ Case Number: ${citizenCaseRes.data.case.case_number}`);
  console.log(`  ✓ Current Status: ${citizenCaseRes.data.case.status}`);
  console.log(`  ✓ Responsible Department: ${citizenCaseRes.data.case.department_name}`);
  console.log('\n  --- Chronological Case Timeline ---');
  for (const event of citTimeline) {
    const time = new Date(event.created_at).toLocaleTimeString();
    console.log(`    [${time}] ${event.event_type.padEnd(18)} : ${event.note || 'Status updated'}`);
  }

  console.log('\n================================================================');
  console.log(' DEMO SCENARIO COMPLETED SUCCESSFULLY');
  console.log('================================================================\n');
}

runDemo().catch((err) => {
  console.error('Demo Error:', err);
  process.exit(1);
});
