const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function check() {
  const incs = await pool.query('SELECT id, category, latitude, longitude, status, report_count, case_id FROM incidents');
  console.log('Incidents:', incs.rows);
  const cases = await pool.query('SELECT id, case_number, status, report_id FROM civic_cases');
  console.log('Cases count:', cases.rows.length);
  await pool.end();
}
check().catch(console.error);
