require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function seedDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[Seed] No DATABASE_URL specified in environment.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    console.log('[Seed] Connected to PostgreSQL. Seeding core data...');

    // 1. Jurisdictions and Boundaries (seed first so rules can link to jurisdiction_id)
    const geoPath = path.join(__dirname, '../data/fixtures/mysuru_jurisdictions.geojson');
    const jurMap = new Map();
    if (fs.existsSync(geoPath)) {
      const geo = JSON.parse(fs.readFileSync(geoPath, 'utf8'));
      await client.query('TRUNCATE reports, report_ai_analysis, report_jurisdiction, report_routing, routing_reviews, civic_cases, case_events, resolution_evidence, case_verifications, jurisdiction_boundaries CASCADE');
      let boundaryCount = 0;
      for (const feat of geo.features) {
        const p = feat.properties;
        const insJur = await client.query(
          'INSERT INTO jurisdictions (code, name, type) VALUES ($1, $2, $3) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id, code',
          [p.code, p.name, p.type]
        );
        const jId = insJur.rows[0].id;
        jurMap.set(p.code, jId);
        const validFrom = p.valid_from || p.validFrom || new Date().toISOString();
        const validUntil = p.valid_until || p.validUntil || null;

        await client.query(
          `INSERT INTO jurisdiction_boundaries (jurisdiction_id, version, geometry, valid_from, valid_until, metadata)
           VALUES ($1, $2, $3::jsonb, $4, $5, $6)`,
          [jId, p.version || 'v1', JSON.stringify(feat.geometry), validFrom, validUntil, JSON.stringify(p.metadata || {})]
        );
        boundaryCount++;
      }
      console.log(`[Seed] Seeded ${boundaryCount} jurisdiction boundaries and ${jurMap.size} jurisdictions.`);
    }

    // 2. Authorities & Departments & Rules
    const fixturePath = path.join(__dirname, '../data/fixtures/mysuru_responsibility_rules.json');
    if (fs.existsSync(fixturePath)) {
      const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
      const authMap = new Map();
      for (const a of fixture.authorities) {
        const res = await client.query(
          'INSERT INTO authorities (code, name, type) VALUES ($1, $2, $3) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id, code',
          [a.code, a.name, a.type]
        );
        authMap.set(a.code, res.rows[0].id);
      }
      console.log(`[Seed] Seeded ${authMap.size} authorities.`);

      const deptMap = new Map();
      for (const d of fixture.departments) {
        const authId = authMap.get(d.authorityCode);
        if (authId) {
          const res = await client.query(
            'INSERT INTO departments (authority_id, code, name, description) VALUES ($1, $2, $3, $4) ON CONFLICT (authority_id, code) DO UPDATE SET name = EXCLUDED.name RETURNING id, code',
            [authId, d.code, d.name, d.description]
          );
          deptMap.set(`${d.authorityCode}:${d.code}`, res.rows[0].id);
        }
      }
      console.log(`[Seed] Seeded ${deptMap.size} departments.`);

      await client.query('DELETE FROM responsibility_rules');
      for (const r of fixture.rules) {
        const jurId = r.jurisdictionCode ? jurMap.get(r.jurisdictionCode) || null : null;
        const authId = authMap.get(r.authorityCode);
        const deptId = deptMap.get(`${r.authorityCode}:${r.departmentCode}`);
        if (authId && deptId) {
          await client.query(
            `INSERT INTO responsibility_rules (
              jurisdiction_id, jurisdiction_type, issue_category, authority_id, department_id,
              version, valid_from, valid_until, priority, active, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              jurId,
              r.jurisdictionType || null,
              r.issueCategory,
              authId,
              deptId,
              r.version || 'v1',
              new Date(r.validFrom || Date.now()),
              r.validUntil ? new Date(r.validUntil) : null,
              r.priority || 100,
              true,
              JSON.stringify({ description: r.description }),
            ]
          );
        }
      }
      console.log(`[Seed] Seeded ${fixture.rules.length} responsibility rules.`);
    }

    // 3. Default Test Users
    const defaultHash = '00000000000000000000000000000000:f42fabe23b5f5e6b95f60099a394713d6e47cc3e851153840deb853de4bc7bc84a6d914088a102d8b133a48b15f7105ad444ab213f57c1fdc40263451b05eed2';
    const mccRes = await client.query("SELECT id FROM authorities WHERE code = 'MCC'");
    const mccId = mccRes.rows[0]?.id || null;
    const roadsRes = await client.query("SELECT id FROM departments WHERE code = 'MCC_ROADS'");
    const roadsId = roadsRes.rows[0]?.id || null;
    const drainRes = await client.query("SELECT id FROM departments WHERE code = 'MCC_DRAINAGE'");
    const drainId = drainRes.rows[0]?.id || null;

    await client.query(`
      INSERT INTO users (id, auth_uid, name, email, role, password_hash, authority_id, department_id) VALUES
      ('00000000-0000-0000-0000-000000000001', 'dev-citizen-01', 'Naveen Kumar (Mysuru Citizen)', 'citizen@mysuru.civicflow.in', 'CITIZEN', $1, NULL, NULL),
      ('00000000-0000-0000-0000-000000000004', 'dev-citizen-02', 'Ananya Deshmukh (Other Citizen)', 'citizen2@mysuru.civicflow.in', 'CITIZEN', $1, NULL, NULL),
      ('00000000-0000-0000-0000-000000000002', 'dev-staff-01', 'Radha Shastry (MCC Ward Officer)', 'staff@mysuru.civicflow.in', 'STAFF', $1, $2, $3),
      ('00000000-0000-0000-0000-000000000005', 'dev-staff-drainage', 'Mahesh Gowda (MCC Drainage Officer)', 'staff-drainage@mysuru.civicflow.in', 'STAFF', $1, $2, $4),
      ('00000000-0000-0000-0000-000000000003', 'dev-admin-01', 'Dr. Ramesh Rao (Chief Admin)', 'admin@mysuru.civicflow.in', 'ADMIN', $1, NULL, NULL)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, authority_id = EXCLUDED.authority_id, department_id = EXCLUDED.department_id
    `, [defaultHash, mccId, roadsId, drainId]);
    console.log('[Seed] Seeded 5 default test users.');

    console.log('[Seed] All database tables seeded successfully!');
  } catch (err) {
    console.error('[Seed Error]:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDatabase();
