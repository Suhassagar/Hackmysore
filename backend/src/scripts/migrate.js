require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[Migration Error] No DATABASE_URL specified in environment.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    console.log('[Migration] Connecting to PostgreSQL database...');
    const client = await pool.connect();

    const migrationPath = path.join(__dirname, '../db/migrations/001_create_users_table.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('[Migration] Executing 001_create_users_table.sql...');
    await client.query(sql);

    console.log('[Migration] ✅ Migration applied successfully.');
    client.release();
  } catch (err) {
    console.error('[Migration Error]', err.message);
  } finally {
    await pool.end();
  }
}

runMigrations();
