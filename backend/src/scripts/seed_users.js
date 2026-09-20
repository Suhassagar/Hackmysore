require('dotenv').config();
const { Pool } = require('pg');

async function seedUsers() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log('[Seed] No DATABASE_URL provided.');
    return;
  }

  const pool = new Pool({ connectionString });

  try {
    const authRes = await pool.query("SELECT id, code FROM authorities WHERE code = 'MCC'");
    const mccAuth = authRes.rows[0];

    const deptRoadsRes = await pool.query("SELECT id, code FROM departments WHERE code = 'MCC_ROADS'");
    const mccRoads = deptRoadsRes.rows[0];

    const deptDrainRes = await pool.query("SELECT id, code FROM departments WHERE code = 'MCC_DRAINAGE'");
    const mccDrain = deptDrainRes.rows[0];

    const users = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        auth_uid: 'dev-citizen-01',
        name: 'Naveen Kumar (Mysuru Citizen)',
        email: 'citizen@mysuru.civicflow.in',
        role: 'CITIZEN',
        authority_id: null,
        department_id: null,
      },
      {
        id: '00000000-0000-0000-0000-000000000004',
        auth_uid: 'dev-citizen-02',
        name: 'Ananya Deshmukh (Other Citizen)',
        email: 'citizen2@mysuru.civicflow.in',
        role: 'CITIZEN',
        authority_id: null,
        department_id: null,
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        auth_uid: 'dev-staff-01',
        name: 'Radha Shastry (MCC Ward Officer)',
        email: 'staff@mysuru.civicflow.in',
        role: 'STAFF',
        authority_id: mccAuth ? mccAuth.id : null,
        department_id: mccRoads ? mccRoads.id : null,
      },
      {
        id: '00000000-0000-0000-0000-000000000005',
        auth_uid: 'dev-staff-drainage',
        name: 'Mahesh Gowda (MCC Drainage Officer)',
        email: 'staff-drainage@mysuru.civicflow.in',
        role: 'STAFF',
        authority_id: mccAuth ? mccAuth.id : null,
        department_id: mccDrain ? mccDrain.id : null,
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        auth_uid: 'dev-admin-01',
        name: 'Dr. Ramesh Rao (Chief Admin)',
        email: 'admin@mysuru.civicflow.in',
        role: 'ADMIN',
        authority_id: null,
        department_id: null,
      },
    ];

    for (const u of users) {
      await pool.query(
        `INSERT INTO users (id, auth_uid, name, email, role, authority_id, department_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         ON CONFLICT (auth_uid) DO UPDATE
         SET name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role,
             authority_id = EXCLUDED.authority_id, department_id = EXCLUDED.department_id, updated_at = NOW()`,
        [u.id, u.auth_uid, u.name, u.email, u.role, u.authority_id, u.department_id]
      );
      console.log(`  ✓ Seeded user: ${u.name} [${u.role}]`);
    }

    console.log('[Seed] All dev users successfully seeded into PostgreSQL database.');
  } finally {
    await pool.end();
  }
}

seedUsers().catch(console.error);
