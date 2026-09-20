const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fix() {
  await pool.query('ALTER TABLE incidents ADD COLUMN IF NOT EXISTS address_text TEXT;');
  await pool.query('ALTER TABLE incidents ADD COLUMN IF NOT EXISTS case_id UUID;');
  await pool.query('ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_status_check;');
  await pool.query(`ALTER TABLE incidents ADD CONSTRAINT incidents_status_check CHECK (status IN ('ACTIVE', 'OPEN', 'MERGED', 'RESOLVED', 'CLOSED'));`);
  await pool.query('ALTER TABLE case_events DROP CONSTRAINT IF EXISTS case_events_event_type_check;');
  await pool.query(`ALTER TABLE case_events ADD CONSTRAINT case_events_event_type_check CHECK (event_type IN (
    'CASE_CREATED', 'CASE_ASSIGNED', 'CASE_REASSIGNED', 'CASE_ACKNOWLEDGED',
    'CASE_STARTED', 'CASE_ON_HOLD', 'CASE_RESUMED', 'CASE_NOTE_ADDED',
    'CASE_RESOLVED', 'CASE_CLOSED', 'RESOLUTION_SUBMITTED', 'RESOLUTION_VERIFIED',
    'RESOLUTION_DISPUTED', 'CASE_REOPENED', 'DUPLICATE_REPORT_LINKED'
  ));`);
  await pool.query('ALTER TABLE case_events ALTER COLUMN actor_user_id DROP NOT NULL;');
  console.log('ALTER_INCIDENTS_AND_CASE_EVENTS_SUCCESS');
  await pool.end();
}

fix().catch((e) => {
  console.error(e);
  process.exit(1);
});
