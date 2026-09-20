const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

let pool = null;
let isPostgresConnected = false;

// Fallback in-memory stores for development/testing when PostgreSQL is not running
const fallbackUsers = new Map();
const fallbackReports = new Map();
const fallbackAiAnalyses = new Map();
const fallbackJurisdictions = new Map(); // id -> { id, code, name, type }
const fallbackBoundaries = []; // array of { id, jurisdiction_id, version, geometry, valid_from, valid_until, metadata }
const fallbackReportJurisdictions = new Map(); // report_id -> snapshot
const fallbackAuthorities = new Map(); // id -> authority
const fallbackDepartments = new Map(); // id -> department
const fallbackResponsibilityRules = []; // array of rules
const fallbackReportRoutings = new Map(); // report_id -> routing snapshot
const fallbackRoutingReviews = []; // array of review audit records

// Phase 7: Operational Civic Cases & Events
const fallbackCases = new Map(); // case_id -> case
const fallbackCaseEvents = []; // array of case events
let fallbackCaseSeq = 10001;

function generateFallbackCaseNumber() {
  const year = new Date().getFullYear();
  const num = fallbackCaseSeq++;
  return `CIV-${year}-${String(num).padStart(6, '0')}`;
}

// Seed initial default test users in fallback store
function seedFallbackUsers() {
  if (fallbackUsers.size === 0) {
    const now = new Date().toISOString();
    fallbackUsers.set('dev-citizen-01', {
      id: '00000000-0000-0000-0000-000000000001',
      auth_uid: 'dev-citizen-01',
      name: 'Naveen Kumar (Mysuru Citizen)',
      email: 'citizen@mysuru.civicflow.in',
      role: 'CITIZEN',
      created_at: now,
      updated_at: now,
    });
    fallbackUsers.set('dev-citizen-02', {
      id: '00000000-0000-0000-0000-000000000004',
      auth_uid: 'dev-citizen-02',
      name: 'Ananya Deshmukh (Other Citizen)',
      email: 'citizen2@mysuru.civicflow.in',
      role: 'CITIZEN',
      created_at: now,
      updated_at: now,
    });
    fallbackUsers.set('dev-staff-01', {
      id: '00000000-0000-0000-0000-000000000002',
      auth_uid: 'dev-staff-01',
      name: 'Radha Shastry (MCC Ward Officer)',
      email: 'staff@mysuru.civicflow.in',
      role: 'STAFF',
      authority_id: null,
      department_id: null,
      created_at: now,
      updated_at: now,
    });
    fallbackUsers.set('dev-staff-drainage', {
      id: '00000000-0000-0000-0000-000000000005',
      auth_uid: 'dev-staff-drainage',
      name: 'Mahesh Gowda (MCC Drainage Officer)',
      email: 'staff-drainage@mysuru.civicflow.in',
      role: 'STAFF',
      authority_id: null,
      department_id: null,
      created_at: now,
      updated_at: now,
    });
    fallbackUsers.set('dev-admin-01', {
      id: '00000000-0000-0000-0000-000000000003',
      auth_uid: 'dev-admin-01',
      name: 'Dr. Ramesh Rao (Chief Admin)',
      email: 'admin@mysuru.civicflow.in',
      role: 'ADMIN',
      created_at: now,
      updated_at: now,
    });
  }
}

// Seed fallback boundaries from GeoJSON fixture
function seedFallbackBoundaries() {
  if (fallbackBoundaries.length === 0) {
    try {
      const fixturePath = path.join(__dirname, '../data/fixtures/mysuru_jurisdictions.geojson');
      if (fs.existsSync(fixturePath)) {
        const geojson = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
        for (const f of geojson.features) {
          const { code, name, type, version, valid_from, valid_until, description } = f.properties;
          let jur = Array.from(fallbackJurisdictions.values()).find((j) => j.code === code);
          if (!jur) {
            jur = { id: uuidv4(), code, name, type };
            fallbackJurisdictions.set(jur.id, jur);
          }
          fallbackBoundaries.push({
            id: uuidv4(),
            jurisdiction_id: jur.id,
            version,
            geometry: f.geometry,
            valid_from: new Date(valid_from),
            valid_until: valid_until ? new Date(valid_until) : null,
            metadata: { description },
          });
        }
        console.log(`[DB] Fallback in-memory store pre-seeded with ${fallbackBoundaries.length} jurisdiction boundaries.`);
      }
    } catch (e) {
      console.warn('[DB] Failed to pre-seed fallback boundaries:', e.message);
    }
  }
}

// Seed fallback responsibility rules from JSON fixture
function seedFallbackResponsibilityRules() {
  if (fallbackAuthorities.size === 0) {
    try {
      const fixturePath = path.join(__dirname, '../data/fixtures/mysuru_responsibility_rules.json');
      if (fs.existsSync(fixturePath)) {
        const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
        // 1. Authorities
        for (const a of fixture.authorities) {
          let auth = Array.from(fallbackAuthorities.values()).find((x) => x.code === a.code);
          if (!auth) {
            auth = { id: uuidv4(), ...a, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
            fallbackAuthorities.set(auth.id, auth);
          }
        }
        // 2. Departments
        for (const d of fixture.departments) {
          const auth = Array.from(fallbackAuthorities.values()).find((x) => x.code === d.authorityCode);
          if (auth) {
            let dept = Array.from(fallbackDepartments.values()).find((x) => x.authority_id === auth.id && x.code === d.code);
            if (!dept) {
              dept = {
                id: uuidv4(),
                authority_id: auth.id,
                code: d.code,
                name: d.name,
                description: d.description,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              fallbackDepartments.set(dept.id, dept);
            }
          }
        }
        // 3. Rules
        for (const r of fixture.rules) {
          const jur = Array.from(fallbackJurisdictions.values()).find((x) => x.code === r.jurisdictionCode);
          const auth = Array.from(fallbackAuthorities.values()).find((x) => x.code === r.authorityCode);
          const dept = auth ? Array.from(fallbackDepartments.values()).find((x) => x.authority_id === auth.id && x.code === r.departmentCode) : null;
          if (auth && dept) {
            fallbackResponsibilityRules.push({
              id: uuidv4(),
              jurisdiction_id: jur ? jur.id : null,
              jurisdiction_type: jur ? jur.type : null,
              issue_category: r.issueCategory,
              authority_id: auth.id,
              department_id: dept.id,
              version: r.version,
              valid_from: new Date(r.validFrom),
              valid_until: r.validUntil ? new Date(r.validUntil) : null,
              priority: r.priority || 100,
              active: true,
              metadata: { description: r.description },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        }
        // Scope fallback staff users to MCC authority and respective departments
        const mccAuth = Array.from(fallbackAuthorities.values()).find((x) => x.code === 'MCC');
        const mccRoads = mccAuth ? Array.from(fallbackDepartments.values()).find((x) => x.authority_id === mccAuth.id && x.code === 'MCC_ROADS') : null;
        const mccDrainage = mccAuth ? Array.from(fallbackDepartments.values()).find((x) => x.authority_id === mccAuth.id && x.code === 'MCC_DRAINAGE') : null;

        const staff01 = fallbackUsers.get('dev-staff-01');
        if (staff01 && mccAuth) {
          staff01.authority_id = mccAuth.id;
          staff01.department_id = mccRoads ? mccRoads.id : null;
        }

        const staffDrainage = fallbackUsers.get('dev-staff-drainage');
        if (staffDrainage && mccAuth) {
          staffDrainage.authority_id = mccAuth.id;
          staffDrainage.department_id = mccDrainage ? mccDrainage.id : null;
        }

        console.log(`[DB] Fallback in-memory store pre-seeded with ${fallbackAuthorities.size} authorities, ${fallbackDepartments.size} departments, ${fallbackResponsibilityRules.length} responsibility rules.`);
      }
    } catch (err) {
      console.warn('[DB] Failed to pre-seed fallback responsibility rules:', err.message);
    }
  }
}

// Boundary segment proximity check for ST_Covers emulation
function isPointOnSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-12) {
    return Math.abs(px - x1) < 1e-7 && Math.abs(py - y1) < 1e-7;
  }
  const cross = Math.abs((px - x1) * dy - (py - y1) * dx);
  if (cross / Math.sqrt(lenSq) > 1e-6) return false;
  const dot = (px - x1) * dx + (py - y1) * dy;
  return dot >= -1e-8 && dot <= lenSq + 1e-8;
}

// Ray-casting algorithm with boundary tolerance for in-memory ST_Covers emulation
function isPointInPolygon([lng, lat], coordinates) {
  // coordinates[0] is the outer linear ring
  const ring = coordinates[0];
  if (!ring || ring.length < 4) return false;

  // 1. Check if point lies directly on any boundary segment (boundary-safe ST_Covers)
  for (let i = 0; i < ring.length - 1; i++) {
    if (isPointOnSegment(lng, lat, ring[i][0], ring[i][1], ring[i + 1][0], ring[i + 1][1])) {
      return true;
    }
  }

  // 2. Standard ray-casting for interior
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];

    if (yi === yj) continue;

    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}

async function initDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log('[DB] No DATABASE_URL specified. Initializing in-memory fallback store.');
    seedFallbackUsers();
    seedFallbackBoundaries();
    seedFallbackResponsibilityRules();
    return;
  }

  try {
    pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    const client = await pool.connect();
    console.log('[DB] Connected to PostgreSQL successfully.');
    isPostgresConnected = true;

    // PostGIS Extension and Schemas
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS postgis;

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        auth_uid VARCHAR(128) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'CITIZEN' CHECK (role IN ('CITIZEN', 'STAFF', 'ADMIN')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_users_auth_uid ON users(auth_uid);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

      CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reporter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category VARCHAR(50) NOT NULL CHECK (category IN (
          'POTHOLE',
          'BLOCKED_DRAIN',
          'GARBAGE_OVERFLOW',
          'BROKEN_STREETLIGHT',
          'ILLEGAL_DUMPING',
          'OTHER'
        )),
        description TEXT NOT NULL,
        latitude NUMERIC(10, 7),
        longitude NUMERIC(10, 7),
        location_accuracy NUMERIC(10, 2),
        location_status VARCHAR(30) NOT NULL DEFAULT 'VERIFIED_COORDINATES' CHECK (location_status IN ('VERIFIED_COORDINATES', 'LOCATION_MISSING')),
        photo_url TEXT,
        status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED',
        incident_id UUID,
        reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_reports_reporter_user_id ON reports(reporter_user_id);
      CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
      CREATE INDEX IF NOT EXISTS idx_reports_reported_at ON reports(reported_at);

      CREATE TABLE IF NOT EXISTS report_ai_analysis (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        model VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL CHECK (category IN (
          'POTHOLE',
          'BLOCKED_DRAIN',
          'GARBAGE_OVERFLOW',
          'BROKEN_STREETLIGHT',
          'ILLEGAL_DUMPING',
          'OTHER'
        )),
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
        summary TEXT NOT NULL,
        risk_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
        confidence NUMERIC(4, 3) NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
        status VARCHAR(30) NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'NEEDS_REVIEW')),
        raw_version VARCHAR(50) NOT NULL DEFAULT 'v1',
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_report_ai_analysis_report_id ON report_ai_analysis(report_id);
      CREATE INDEX IF NOT EXISTS idx_report_ai_analysis_status ON report_ai_analysis(status);

      CREATE TABLE IF NOT EXISTS jurisdictions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('MCC_WARD', 'TOWN_PANCHAYAT', 'GRAM_PANCHAYAT', 'SPECIAL_ZONE')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS jurisdiction_boundaries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        jurisdiction_id UUID NOT NULL REFERENCES jurisdictions(id) ON DELETE CASCADE,
        version VARCHAR(50) NOT NULL,
        geometry GEOMETRY(Polygon, 4326) NOT NULL,
        valid_from TIMESTAMPTZ NOT NULL,
        valid_until TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_jurisdiction_boundaries_geom ON jurisdiction_boundaries USING GIST (geometry);
      CREATE INDEX IF NOT EXISTS idx_jurisdiction_boundaries_temporal ON jurisdiction_boundaries (valid_from, valid_until);
      CREATE INDEX IF NOT EXISTS idx_jurisdiction_boundaries_jur_version ON jurisdiction_boundaries (jurisdiction_id, version);

      CREATE TABLE IF NOT EXISTS report_jurisdiction (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        jurisdiction_id UUID REFERENCES jurisdictions(id),
        jurisdiction_boundary_id UUID REFERENCES jurisdiction_boundaries(id),
        matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        report_time TIMESTAMPTZ NOT NULL,
        match_status VARCHAR(50) NOT NULL CHECK (match_status IN ('MATCHED', 'NO_JURISDICTION_MATCH', 'JURISDICTION_CONFLICT')),
        match_method VARCHAR(50) NOT NULL DEFAULT 'POSTGIS_POINT_IN_POLYGON',
        requires_review BOOLEAN NOT NULL DEFAULT false,
        candidate_matches JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_report_jurisdiction_report_id ON report_jurisdiction (report_id);

      -- Phase 5: Responsibility Rules & Routing Snapshots
      CREATE TABLE IF NOT EXISTS authorities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN (
          'MUNICIPAL_CORPORATION',
          'TOWN_PANCHAYAT',
          'GRAM_PANCHAYAT',
          'UTILITY_BOARD',
          'SPECIAL_AUTHORITY'
        )),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_authorities_code ON authorities (code);

      CREATE TABLE IF NOT EXISTS departments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        authority_id UUID NOT NULL REFERENCES authorities(id) ON DELETE CASCADE,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_authority_department UNIQUE (authority_id, code)
      );
      CREATE INDEX IF NOT EXISTS idx_departments_authority_id ON departments (authority_id);
      CREATE INDEX IF NOT EXISTS idx_departments_code ON departments (code);

      CREATE TABLE IF NOT EXISTS responsibility_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        jurisdiction_id UUID REFERENCES jurisdictions(id) ON DELETE CASCADE,
        jurisdiction_type VARCHAR(50),
        issue_category VARCHAR(50) NOT NULL CHECK (issue_category IN (
          'POTHOLE',
          'BLOCKED_DRAIN',
          'GARBAGE_OVERFLOW',
          'BROKEN_STREETLIGHT',
          'ILLEGAL_DUMPING',
          'OTHER'
        )),
        authority_id UUID NOT NULL REFERENCES authorities(id) ON DELETE RESTRICT,
        department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
        version VARCHAR(50) NOT NULL DEFAULT '2026-V1',
        valid_from TIMESTAMPTZ NOT NULL,
        valid_until TIMESTAMPTZ,
        priority INTEGER NOT NULL DEFAULT 100,
        active BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_resp_rules_lookup ON responsibility_rules (jurisdiction_id, issue_category, valid_from, valid_until);
      CREATE INDEX IF NOT EXISTS idx_resp_rules_active ON responsibility_rules (active);
      CREATE INDEX IF NOT EXISTS idx_resp_rules_version ON responsibility_rules (version);

      CREATE TABLE IF NOT EXISTS report_routing (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        jurisdiction_id UUID REFERENCES jurisdictions(id),
        jurisdiction_boundary_id UUID REFERENCES jurisdiction_boundaries(id),
        responsibility_rule_id UUID REFERENCES responsibility_rules(id),
        authority_id UUID REFERENCES authorities(id),
        department_id UUID REFERENCES departments(id),
        issue_category_used VARCHAR(50) NOT NULL,
        category_source VARCHAR(50) NOT NULL DEFAULT 'AI_DERIVED' CHECK (category_source IN (
          'AI_DERIVED',
          'CITIZEN_FALLBACK',
          'MANUAL_OVERRIDE'
        )),
        route_status VARCHAR(50) NOT NULL CHECK (route_status IN (
          'ROUTED',
          'NO_RESPONSIBLE_RULE',
          'RESPONSIBILITY_CONFLICT',
          'NEEDS_REVIEW'
        )),
        match_method VARCHAR(50) NOT NULL DEFAULT 'DETERMINISTIC_RULE_MATCH',
        requires_review BOOLEAN NOT NULL DEFAULT false,
        candidate_rules JSONB DEFAULT '[]'::jsonb,
        explanation TEXT NOT NULL,
        routed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_report_routing_report_id ON report_routing (report_id);
      CREATE INDEX IF NOT EXISTS idx_report_routing_status ON report_routing (route_status);
      CREATE INDEX IF NOT EXISTS idx_report_routing_routed_at ON report_routing (routed_at);

      -- Phase 6: Human Routing Review & Audit Log
      ALTER TABLE report_routing ADD COLUMN IF NOT EXISTS routing_status VARCHAR(50) DEFAULT 'PENDING';
      ALTER TABLE report_routing ADD COLUMN IF NOT EXISTS review_reasons JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE report_routing ADD COLUMN IF NOT EXISTS decision_source VARCHAR(50) DEFAULT 'AUTOMATIC';
      ALTER TABLE report_routing ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);
      ALTER TABLE report_routing ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
      ALTER TABLE report_routing ADD COLUMN IF NOT EXISTS review_notes TEXT;
      ALTER TABLE report_routing ADD COLUMN IF NOT EXISTS final_authority_id UUID REFERENCES authorities(id);
      ALTER TABLE report_routing ADD COLUMN IF NOT EXISTS final_department_id UUID REFERENCES departments(id);

      CREATE INDEX IF NOT EXISTS idx_report_routing_routing_status ON report_routing (routing_status);
      CREATE INDEX IF NOT EXISTS idx_report_routing_decision_source ON report_routing (decision_source);
      CREATE INDEX IF NOT EXISTS idx_report_routing_reviewed_at ON report_routing (reviewed_at);

      CREATE TABLE IF NOT EXISTS routing_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        report_routing_id UUID REFERENCES report_routing(id) ON DELETE SET NULL,
        action VARCHAR(50) NOT NULL CHECK (action IN ('APPROVE', 'OVERRIDE')),
        reviewed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        review_notes TEXT,
        original_authority_id UUID REFERENCES authorities(id),
        original_department_id UUID REFERENCES departments(id),
        final_authority_id UUID NOT NULL REFERENCES authorities(id),
        final_department_id UUID NOT NULL REFERENCES departments(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_routing_reviews_report ON routing_reviews (report_id);
      CREATE INDEX IF NOT EXISTS idx_routing_reviews_reviewer ON routing_reviews (reviewed_by);

      -- Phase 7: Operational Civic Cases & Event Audit Log
      ALTER TABLE users ADD COLUMN IF NOT EXISTS authority_id UUID REFERENCES authorities(id);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);
      CREATE INDEX IF NOT EXISTS idx_users_authority_dept ON users(authority_id, department_id);

      CREATE SEQUENCE IF NOT EXISTS civic_case_seq START WITH 10001;

      CREATE TABLE IF NOT EXISTS civic_cases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_number VARCHAR(50) UNIQUE NOT NULL,
        report_id UUID NOT NULL UNIQUE REFERENCES reports(id) ON DELETE CASCADE,
        routing_id UUID REFERENCES report_routing(id) ON DELETE SET NULL,
        authority_id UUID NOT NULL REFERENCES authorities(id),
        department_id UUID NOT NULL REFERENCES departments(id),
        jurisdiction_id UUID REFERENCES jurisdictions(id),
        jurisdiction_boundary_id UUID REFERENCES jurisdiction_boundaries(id),
        responsibility_rule_id UUID REFERENCES responsibility_rules(id),
        status VARCHAR(50) NOT NULL DEFAULT 'UNASSIGNED' CHECK (status IN (
          'UNASSIGNED',
          'ASSIGNED',
          'ACKNOWLEDGED',
          'IN_PROGRESS',
          'ON_HOLD',
          'RESOLVED',
          'CLOSED'
        )),
        priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN (
          'LOW',
          'MEDIUM',
          'HIGH',
          'CRITICAL'
        )),
        assigned_to UUID REFERENCES users(id),
        assigned_at TIMESTAMPTZ,
        acknowledged_at TIMESTAMPTZ,
        started_at TIMESTAMPTZ,
        resolved_at TIMESTAMPTZ,
        resolved_by UUID REFERENCES users(id),
        resolution_notes TEXT,
        on_hold_reason VARCHAR(50) CHECK (on_hold_reason IS NULL OR on_hold_reason IN (
          'WAITING_FOR_MATERIAL',
          'WEATHER',
          'ACCESS_BLOCKED',
          'REQUIRES_EXTERNAL_TEAM',
          'OTHER'
        )),
        on_hold_notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_civic_cases_case_number ON civic_cases(case_number);
      CREATE INDEX IF NOT EXISTS idx_civic_cases_report_id ON civic_cases(report_id);
      CREATE INDEX IF NOT EXISTS idx_civic_cases_status ON civic_cases(status);
      CREATE INDEX IF NOT EXISTS idx_civic_cases_authority_dept ON civic_cases(authority_id, department_id);
      CREATE INDEX IF NOT EXISTS idx_civic_cases_assigned_to ON civic_cases(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_civic_cases_created_at ON civic_cases(created_at);

      CREATE TABLE IF NOT EXISTS case_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID NOT NULL REFERENCES civic_cases(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
          'CASE_CREATED',
          'CASE_ASSIGNED',
          'CASE_REASSIGNED',
          'CASE_ACKNOWLEDGED',
          'CASE_STARTED',
          'CASE_ON_HOLD',
          'CASE_RESUMED',
          'CASE_NOTE_ADDED',
          'CASE_RESOLVED',
          'CASE_CLOSED'
        )),
        from_status VARCHAR(50),
        to_status VARCHAR(50),
        actor_user_id UUID NOT NULL REFERENCES users(id),
        note TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_case_events_case_id ON case_events(case_id);
      CREATE INDEX IF NOT EXISTS idx_case_events_actor ON case_events(actor_user_id);
      CREATE INDEX IF NOT EXISTS idx_case_events_created_at ON case_events(created_at);
    `);
    console.log('[DB] PostGIS, Jurisdictions, Responsibility Rules, and Civic Cases schemas verified in PostgreSQL.');
    client.release();
  } catch (err) {
    console.warn(`[DB] Live PostgreSQL/PostGIS connection failed (${err.message}).`);
    console.warn('[DB] Falling back to self-contained in-memory geospatial and rule store for testing.');
    isPostgresConnected = false;
    seedFallbackUsers();
    seedFallbackBoundaries();
    seedFallbackResponsibilityRules();
  }
}

// Data Access Layer
const db = {
  get isConnected() {
    return isPostgresConnected;
  },

  async query(text, params) {
    if (isPostgresConnected && pool) {
      return pool.query(text, params);
    }
    throw new Error('PostgreSQL pool not connected');
  },

  async getUserByAuthUid(authUid) {
    if (isPostgresConnected && pool) {
      const res = await pool.query('SELECT * FROM users WHERE auth_uid = $1', [authUid]);
      return res.rows[0] || null;
    }
    return fallbackUsers.get(authUid) || null;
  },

  async getUserByEmail(email) {
    if (isPostgresConnected && pool) {
      const res = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
      return res.rows[0] || null;
    }
    for (const u of fallbackUsers.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    return null;
  },

  async getUserById(id) {
    if (isPostgresConnected && pool) {
      const res = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      return res.rows[0] || null;
    }
    for (const u of fallbackUsers.values()) {
      if (u.id === id) return u;
    }
    return null;
  },

  async createUser({ authUid, name, email, role = 'CITIZEN' }) {
    const validRoles = ['CITIZEN', 'STAFF', 'ADMIN'];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role: ${role}. Must be CITIZEN, STAFF, or ADMIN.`);
    }

    if (isPostgresConnected && pool) {
      const res = await pool.query(
        `INSERT INTO users (auth_uid, name, email, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING *`,
        [authUid, name, email, role]
      );
      return res.rows[0];
    }

    const now = new Date().toISOString();
    const newUser = {
      id: uuidv4(),
      auth_uid: authUid,
      name,
      email,
      role,
      created_at: now,
      updated_at: now,
    };
    fallbackUsers.set(authUid, newUser);
    return newUser;
  },

  async updateUserRole(email, role) {
    const validRoles = ['CITIZEN', 'STAFF', 'ADMIN'];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role: ${role}. Must be CITIZEN, STAFF, or ADMIN.`);
    }

    if (isPostgresConnected && pool) {
      const res = await pool.query(
        `UPDATE users
         SET role = $1, updated_at = NOW()
         WHERE LOWER(email) = LOWER($2)
         RETURNING *`,
        [role, email]
      );
      return res.rows[0] || null;
    }

    for (const u of fallbackUsers.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        u.role = role;
        u.updated_at = new Date().toISOString();
        return u;
      }
    }
    return null;
  },

  async listAllUsers() {
    if (isPostgresConnected && pool) {
      const res = await pool.query('SELECT id, auth_uid, name, email, role, created_at, updated_at FROM users ORDER BY created_at ASC');
      return res.rows;
    }
    return Array.from(fallbackUsers.values());
  },

  // ==========================================
  // PHASE 2: CITIZEN REPORT METHODS
  // ==========================================

  async createReport({
    reporterUserId,
    category,
    description,
    latitude = null,
    longitude = null,
    locationAccuracy = null,
    locationStatus = 'VERIFIED_COORDINATES',
    photoUrl = null,
  }) {
    const validCategories = [
      'POTHOLE',
      'BLOCKED_DRAIN',
      'GARBAGE_OVERFLOW',
      'BROKEN_STREETLIGHT',
      'ILLEGAL_DUMPING',
      'OTHER',
    ];

    if (!validCategories.includes(category)) {
      throw new Error(`Invalid category: ${category}`);
    }

    if (isPostgresConnected && pool) {
      const res = await pool.query(
        `INSERT INTO reports (
          reporter_user_id,
          category,
          description,
          latitude,
          longitude,
          location_accuracy,
          location_status,
          photo_url,
          status,
          reported_at,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'SUBMITTED', NOW(), NOW(), NOW())
        RETURNING *`,
        [
          reporterUserId,
          category,
          description,
          latitude,
          longitude,
          locationAccuracy,
          locationStatus,
          photoUrl,
        ]
      );
      return res.rows[0];
    }

    const now = new Date().toISOString();
    const report = {
      id: uuidv4(),
      reporter_user_id: reporterUserId,
      category,
      description,
      latitude: latitude !== null ? Number(latitude) : null,
      longitude: longitude !== null ? Number(longitude) : null,
      location_accuracy: locationAccuracy !== null ? Number(locationAccuracy) : null,
      location_status: locationStatus,
      photo_url: photoUrl,
      status: 'SUBMITTED',
      incident_id: null,
      reported_at: now,
      created_at: now,
      updated_at: now,
    };
    fallbackReports.set(report.id, report);
    return report;
  },

  async getReportById(id) {
    if (isPostgresConnected && pool) {
      const res = await pool.query('SELECT * FROM reports WHERE id = $1', [id]);
      return res.rows[0] || null;
    }
    return fallbackReports.get(id) || null;
  },

  async getReportsByUserId(reporterUserId) {
    if (isPostgresConnected && pool) {
      const res = await pool.query(
        'SELECT * FROM reports WHERE reporter_user_id = $1 ORDER BY reported_at DESC',
        [reporterUserId]
      );
      return res.rows;
    }

    const userReports = [];
    for (const r of fallbackReports.values()) {
      if (r.reporter_user_id === reporterUserId) {
        userReports.push(r);
      }
    }
    return userReports.sort((a, b) => new Date(b.reported_at) - new Date(a.reported_at));
  },

  // ==========================================
  // PHASE 3: AI ANALYSIS METHODS
  // ==========================================

  async createAiAnalysis({
    reportId,
    model,
    category,
    severity,
    summary,
    riskFactors = [],
    confidence,
    status = 'COMPLETED',
    rawVersion = 'v1',
    errorMessage = null,
  }) {
    if (isPostgresConnected && pool) {
      const res = await pool.query(
        `INSERT INTO report_ai_analysis (
          report_id,
          model,
          category,
          severity,
          summary,
          risk_factors,
          confidence,
          status,
          raw_version,
          error_message,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        RETURNING *`,
        [
          reportId,
          model,
          category,
          severity,
          summary,
          JSON.stringify(riskFactors),
          confidence,
          status,
          rawVersion,
          errorMessage,
        ]
      );
      const row = res.rows[0];
      return {
        ...row,
        risk_factors: typeof row.risk_factors === 'string' ? JSON.parse(row.risk_factors) : row.risk_factors,
        confidence: Number(row.confidence),
      };
    }

    const now = new Date().toISOString();
    const analysis = {
      id: uuidv4(),
      report_id: reportId,
      model,
      category,
      severity,
      summary,
      risk_factors: riskFactors,
      confidence: Number(confidence),
      status,
      raw_version: rawVersion,
      error_message: errorMessage,
      created_at: now,
      updated_at: now,
    };
    fallbackAiAnalyses.set(analysis.id, analysis);
    return analysis;
  },

  async getLatestAiAnalysisByReportId(reportId) {
    if (isPostgresConnected && pool) {
      const res = await pool.query(
        `SELECT * FROM report_ai_analysis
         WHERE report_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [reportId]
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        ...row,
        risk_factors: typeof row.risk_factors === 'string' ? JSON.parse(row.risk_factors) : row.risk_factors,
        confidence: Number(row.confidence),
      };
    }

    const matching = [];
    for (const a of fallbackAiAnalyses.values()) {
      if (a.report_id === reportId) {
        matching.push(a);
      }
    }
    if (matching.length === 0) return null;
    matching.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return matching[0];
  },

  async getAllAiAnalysesByReportId(reportId) {
    if (isPostgresConnected && pool) {
      const res = await pool.query(
        `SELECT * FROM report_ai_analysis
         WHERE report_id = $1
         ORDER BY created_at DESC`,
        [reportId]
      );
      return res.rows.map((row) => ({
        ...row,
        risk_factors: typeof row.risk_factors === 'string' ? JSON.parse(row.risk_factors) : row.risk_factors,
        confidence: Number(row.confidence),
      }));
    }

    const matching = [];
    for (const a of fallbackAiAnalyses.values()) {
      if (a.report_id === reportId) {
        matching.push(a);
      }
    }
    return matching.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  // ==========================================
  // PHASE 4: GEOSPATIAL JURISDICTION METHODS
  // ==========================================

  async insertJurisdictionBoundary({
    code,
    name,
    type,
    version,
    validFrom,
    validUntil,
    geometry,
    metadata = {},
  }) {
    if (isPostgresConnected && pool) {
      // Upsert base jurisdiction
      let jurRes = await pool.query('SELECT id FROM jurisdictions WHERE code = $1', [code]);
      let jurId;
      if (jurRes.rows.length === 0) {
        const ins = await pool.query(
          'INSERT INTO jurisdictions (code, name, type) VALUES ($1, $2, $3) RETURNING id',
          [code, name, type]
        );
        jurId = ins.rows[0].id;
      } else {
        jurId = jurRes.rows[0].id;
      }

      // Insert versioned boundary with PostGIS geometry
      await pool.query(
        `INSERT INTO jurisdiction_boundaries (
          jurisdiction_id,
          version,
          geometry,
          valid_from,
          valid_until,
          metadata
        ) VALUES (
          $1,
          $2,
          ST_SetSRID(ST_GeomFromGeoJSON($3), 4326),
          $4,
          $5,
          $6
        )`,
        [
          jurId,
          version,
          JSON.stringify(geometry),
          validFrom,
          validUntil,
          JSON.stringify(metadata),
        ]
      );
      return { jurisdictionId: jurId, version };
    }

    // Fallback store
    let jur = Array.from(fallbackJurisdictions.values()).find((j) => j.code === code);
    if (!jur) {
      jur = { id: uuidv4(), code, name, type };
      fallbackJurisdictions.set(jur.id, jur);
    }

    const boundary = {
      id: uuidv4(),
      jurisdiction_id: jur.id,
      version,
      geometry,
      valid_from: new Date(validFrom),
      valid_until: validUntil ? new Date(validUntil) : null,
      metadata,
    };
    fallbackBoundaries.push(boundary);
    return { jurisdictionId: jur.id, version };
  },

  /**
   * High-performance point-in-polygon spatial & temporal query using PostGIS ST_Covers
   */
  async findJurisdictionsByPointAndTimestamp(lng, lat, reportTime) {
    const targetDate = new Date(reportTime);

    if (isPostgresConnected && pool) {
      // Boundary-safe PostGIS spatial predicate: ST_Covers
      // Checks point-in-polygon and temporal validity window
      const query = `
        SELECT 
          jb.id AS boundary_id,
          jb.version,
          jb.valid_from,
          jb.valid_until,
          j.id AS jurisdiction_id,
          j.code AS jurisdiction_code,
          j.name AS jurisdiction_name,
          j.type AS jurisdiction_type
        FROM jurisdiction_boundaries jb
        JOIN jurisdictions j ON jb.jurisdiction_id = j.id
        WHERE ST_Covers(jb.geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
          AND jb.valid_from <= $3
          AND (jb.valid_until IS NULL OR $3 < jb.valid_until)
      `;
      const res = await pool.query(query, [lng, lat, targetDate.toISOString()]);
      return res.rows;
    }

    // In-memory fallback ray-casting query
    const matches = [];
    for (const b of fallbackBoundaries) {
      // 1. Temporal filter: valid_from <= reportTime AND (valid_until IS NULL OR reportTime < valid_until)
      if (b.valid_from <= targetDate && (!b.valid_until || targetDate < b.valid_until)) {
        // 2. Spatial filter: Point in Polygon check (with boundary tolerance)
        if (b.geometry && b.geometry.coordinates && isPointInPolygon([lng, lat], b.geometry.coordinates)) {
          const jur = fallbackJurisdictions.get(b.jurisdiction_id);
          if (jur) {
            matches.push({
              boundary_id: b.id,
              version: b.version,
              valid_from: b.valid_from.toISOString(),
              valid_until: b.valid_until ? b.valid_until.toISOString() : null,
              jurisdiction_id: jur.id,
              jurisdiction_code: jur.code,
              jurisdiction_name: jur.name,
              jurisdiction_type: jur.type,
            });
          }
        }
      }
    }

    return matches;
  },

  /**
   * Save immutable historical report jurisdiction snapshot (Section 9)
   */
  async createReportJurisdictionSnapshot({
    reportId,
    jurisdictionId = null,
    jurisdictionBoundaryId = null,
    reportTime,
    matchStatus,
    matchMethod = 'POSTGIS_POINT_IN_POLYGON',
    requiresReview = false,
    candidateMatches = [],
  }) {
    if (isPostgresConnected && pool) {
      const res = await pool.query(
        `INSERT INTO report_jurisdiction (
          report_id,
          jurisdiction_id,
          jurisdiction_boundary_id,
          matched_at,
          report_time,
          match_status,
          match_method,
          requires_review,
          candidate_matches
        ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          reportId,
          jurisdictionId,
          jurisdictionBoundaryId,
          reportTime,
          matchStatus,
          matchMethod,
          requiresReview,
          JSON.stringify(candidateMatches),
        ]
      );
      return res.rows[0];
    }

    const snapshot = {
      id: uuidv4(),
      report_id: reportId,
      jurisdiction_id: jurisdictionId,
      jurisdiction_boundary_id: jurisdictionBoundaryId,
      matched_at: new Date().toISOString(),
      report_time: new Date(reportTime).toISOString(),
      match_status: matchStatus,
      match_method: matchMethod,
      requires_review: requiresReview,
      candidate_matches: candidateMatches,
      created_at: new Date().toISOString(),
    };
    fallbackReportJurisdictions.set(reportId, snapshot);
    return snapshot;
  },

  async getJurisdictionById(id) {
    if (isPostgresConnected && pool) {
      const res = await pool.query('SELECT * FROM jurisdictions WHERE id = $1 OR code = $1', [id]);
      return res.rows[0] || null;
    }
    const jur = fallbackJurisdictions.get(id);
    if (jur) return jur;
    return Array.from(fallbackJurisdictions.values()).find((j) => j.id === id || j.code === id) || null;
  },

  async getReportJurisdictionSnapshot(reportId) {
    if (isPostgresConnected && pool) {
      const res = await pool.query(
        `SELECT 
          rj.*,
          j.code AS jurisdiction_code,
          j.name AS jurisdiction_name,
          j.type AS jurisdiction_type,
          jb.version AS jurisdiction_version,
          jb.valid_from,
          jb.valid_until
        FROM report_jurisdiction rj
        LEFT JOIN jurisdictions j ON rj.jurisdiction_id = j.id
        LEFT JOIN jurisdiction_boundaries jb ON rj.jurisdiction_boundary_id = jb.id
        WHERE rj.report_id = $1
        ORDER BY rj.matched_at DESC
        LIMIT 1`,
        [reportId]
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        ...row,
        candidate_matches: typeof row.candidate_matches === 'string' ? JSON.parse(row.candidate_matches) : row.candidate_matches,
      };
    }

    const snapshot = fallbackReportJurisdictions.get(reportId);
    if (!snapshot) return null;

    let jur = null;
    let bnd = null;
    if (snapshot.jurisdiction_id) {
      jur = fallbackJurisdictions.get(snapshot.jurisdiction_id);
    }
    if (snapshot.jurisdiction_boundary_id) {
      bnd = fallbackBoundaries.find((b) => b.id === snapshot.jurisdiction_boundary_id);
    }

    return {
      ...snapshot,
      jurisdiction_code: jur?.code || null,
      jurisdiction_name: jur?.name || null,
      jurisdiction_type: jur?.type || null,
      jurisdiction_version: bnd?.version || null,
      valid_from: bnd?.valid_from ? bnd.valid_from.toISOString() : null,
      valid_until: bnd?.valid_until ? bnd.valid_until.toISOString() : null,
    };
  },

  // ==========================================
  // PHASE 5: RESPONSIBILITY RULE METHODS
  // ==========================================

  async insertAuthority({ code, name, type }) {
    if (isPostgresConnected && pool) {
      const res = await pool.query(
        `INSERT INTO authorities (code, name, type)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type
         RETURNING *`,
        [code, name, type]
      );
      return res.rows[0];
    }

    let auth = Array.from(fallbackAuthorities.values()).find((a) => a.code === code);
    if (auth) {
      auth.name = name;
      auth.type = type;
      auth.updated_at = new Date().toISOString();
      return auth;
    }
    auth = { id: uuidv4(), code, name, type, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    fallbackAuthorities.set(auth.id, auth);
    return auth;
  },

  async insertDepartment({ authorityCode, code, name, description = null }) {
    if (isPostgresConnected && pool) {
      const authRes = await pool.query('SELECT id FROM authorities WHERE code = $1', [authorityCode]);
      if (authRes.rows.length === 0) throw new Error(`Authority not found: ${authorityCode}`);
      const authorityId = authRes.rows[0].id;

      const res = await pool.query(
        `INSERT INTO departments (authority_id, code, name, description)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (authority_id, code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
         RETURNING *`,
        [authorityId, code, name, description]
      );
      return res.rows[0];
    }

    const auth = Array.from(fallbackAuthorities.values()).find((a) => a.code === authorityCode);
    if (!auth) throw new Error(`Authority not found: ${authorityCode}`);

    let dept = Array.from(fallbackDepartments.values()).find((d) => d.authority_id === auth.id && d.code === code);
    if (dept) {
      dept.name = name;
      dept.description = description;
      dept.updated_at = new Date().toISOString();
      return dept;
    }
    dept = { id: uuidv4(), authority_id: auth.id, code, name, description, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    fallbackDepartments.set(dept.id, dept);
    return dept;
  },

  async getAuthorityById(id) {
    if (isPostgresConnected && pool) {
      const res = await pool.query('SELECT * FROM authorities WHERE id = $1 OR code = $1', [id]);
      return res.rows[0] || null;
    }
    const auth = fallbackAuthorities.get(id);
    if (auth) return auth;
    return Array.from(fallbackAuthorities.values()).find((a) => a.id === id || a.code === id) || null;
  },

  async getDepartmentById(id) {
    if (isPostgresConnected && pool) {
      const res = await pool.query('SELECT * FROM departments WHERE id = $1 OR code = $1', [id]);
      return res.rows[0] || null;
    }
    const dept = fallbackDepartments.get(id);
    if (dept) return dept;
    return Array.from(fallbackDepartments.values()).find((d) => d.id === id || d.code === id) || null;
  },

  async getAllAuthorities() {
    if (isPostgresConnected && pool) {
      const res = await pool.query('SELECT * FROM authorities ORDER BY name ASC');
      return res.rows;
    }
    return Array.from(fallbackAuthorities.values());
  },

  async getDepartmentsByAuthorityId(authorityId) {
    if (isPostgresConnected && pool) {
      const res = await pool.query('SELECT * FROM departments WHERE authority_id = $1 ORDER BY name ASC', [authorityId]);
      return res.rows;
    }
    return Array.from(fallbackDepartments.values()).filter((d) => d.authority_id === authorityId);
  },

  async insertResponsibilityRule({
    jurisdictionCode = null,
    jurisdictionType = null,
    issueCategory,
    authorityCode,
    departmentCode,
    version = '2026-V1',
    validFrom,
    validUntil = null,
    priority = 100,
    active = true,
    description = '',
  }) {
    if (isPostgresConnected && pool) {
      let jurId = null;
      if (jurisdictionCode) {
        const jRes = await pool.query('SELECT id FROM jurisdictions WHERE code = $1', [jurisdictionCode]);
        if (jRes.rows.length > 0) jurId = jRes.rows[0].id;
      }
      const authRes = await pool.query('SELECT id FROM authorities WHERE code = $1', [authorityCode]);
      if (authRes.rows.length === 0) throw new Error(`Authority not found: ${authorityCode}`);
      const authorityId = authRes.rows[0].id;

      const deptRes = await pool.query('SELECT id FROM departments WHERE authority_id = $1 AND code = $2', [authorityId, departmentCode]);
      if (deptRes.rows.length === 0) throw new Error(`Department not found: ${departmentCode}`);
      const departmentId = deptRes.rows[0].id;

      const res = await pool.query(
        `INSERT INTO responsibility_rules (
          jurisdiction_id, jurisdiction_type, issue_category,
          authority_id, department_id, version,
          valid_from, valid_until, priority, active, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          jurId,
          jurisdictionType,
          issueCategory,
          authorityId,
          departmentId,
          version,
          validFrom,
          validUntil,
          priority,
          active,
          JSON.stringify({ description }),
        ]
      );
      return res.rows[0];
    }

    let jur = null;
    if (jurisdictionCode) {
      jur = Array.from(fallbackJurisdictions.values()).find((j) => j.code === jurisdictionCode);
    }
    const auth = Array.from(fallbackAuthorities.values()).find((a) => a.code === authorityCode);
    if (!auth) throw new Error(`Authority not found: ${authorityCode}`);

    const dept = Array.from(fallbackDepartments.values()).find((d) => d.authority_id === auth.id && d.code === departmentCode);
    if (!dept) throw new Error(`Department not found: ${departmentCode}`);

    const rule = {
      id: uuidv4(),
      jurisdiction_id: jur ? jur.id : null,
      jurisdiction_type: jurisdictionType || (jur ? jur.type : null),
      issue_category: issueCategory,
      authority_id: auth.id,
      department_id: dept.id,
      version,
      valid_from: new Date(validFrom),
      valid_until: validUntil ? new Date(validUntil) : null,
      priority,
      active,
      metadata: { description },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    fallbackResponsibilityRules.push(rule);
    return rule;
  },

  /**
   * High-performance temporal query finding applicable rules for a jurisdiction, category, and report time
   */
  async findApplicableRules(jurisdictionId, category, reportTime) {
    const targetDate = new Date(reportTime);

    if (isPostgresConnected && pool) {
      const query = `
        SELECT 
          rr.*,
          a.code AS authority_code,
          a.name AS authority_name,
          a.type AS authority_type,
          d.code AS department_code,
          d.name AS department_name,
          j.code AS jurisdiction_code,
          j.name AS jurisdiction_name
        FROM responsibility_rules rr
        JOIN authorities a ON rr.authority_id = a.id
        JOIN departments d ON rr.department_id = d.id
        LEFT JOIN jurisdictions j ON rr.jurisdiction_id = j.id
        WHERE rr.active = true
          AND rr.issue_category = $1
          AND (rr.jurisdiction_id = $2 OR rr.jurisdiction_id IS NULL)
          AND rr.valid_from <= $3
          AND (rr.valid_until IS NULL OR $3 < rr.valid_until)
        ORDER BY rr.priority DESC, rr.created_at DESC
      `;
      const res = await pool.query(query, [category, jurisdictionId, targetDate.toISOString()]);
      return res.rows;
    }

    // In-memory fallback query
    const matches = [];
    for (const r of fallbackResponsibilityRules) {
      if (!r.active) continue;
      if (r.issue_category !== category) continue;

      // Jurisdiction match: exact match or global fallback (null)
      const jurMatches = r.jurisdiction_id === jurisdictionId || r.jurisdiction_id === null;
      if (!jurMatches) continue;

      // Temporal validity check
      if (r.valid_from <= targetDate && (!r.valid_until || targetDate < r.valid_until)) {
        const auth = fallbackAuthorities.get(r.authority_id);
        const dept = fallbackDepartments.get(r.department_id);
        const jur = r.jurisdiction_id ? fallbackJurisdictions.get(r.jurisdiction_id) : null;

        if (auth && dept) {
          matches.push({
            id: r.id,
            jurisdiction_id: r.jurisdiction_id,
            jurisdiction_code: jur?.code || null,
            jurisdiction_name: jur?.name || null,
            jurisdiction_type: r.jurisdiction_type,
            issue_category: r.issue_category,
            authority_id: auth.id,
            authority_code: auth.code,
            authority_name: auth.name,
            authority_type: auth.type,
            department_id: dept.id,
            department_code: dept.code,
            department_name: dept.name,
            version: r.version,
            valid_from: r.valid_from.toISOString(),
            valid_until: r.valid_until ? r.valid_until.toISOString() : null,
            priority: r.priority,
            metadata: r.metadata,
          });
        }
      }
    }

    // Sort by priority DESC
    return matches.sort((a, b) => b.priority - a.priority);
  },

  /**
   * Save immutable historical report routing snapshot
   */
  async createReportRoutingSnapshot({
    reportId,
    jurisdictionId = null,
    jurisdictionBoundaryId = null,
    responsibilityRuleId = null,
    authorityId = null,
    departmentId = null,
    issueCategoryUsed,
    categorySource = 'AI_DERIVED',
    routeStatus,
    routingStatus = 'PENDING',
    reviewReasons = [],
    decisionSource = 'AUTOMATIC',
    reviewedBy = null,
    reviewedAt = null,
    reviewNotes = null,
    finalAuthorityId = null,
    finalDepartmentId = null,
    matchMethod = 'DETERMINISTIC_RULE_MATCH',
    requiresReview = false,
    candidateRules = [],
    explanation,
    routedAt = new Date(),
  }) {
    if (isPostgresConnected && pool) {
      const res = await pool.query(
        `INSERT INTO report_routing (
          report_id,
          jurisdiction_id,
          jurisdiction_boundary_id,
          responsibility_rule_id,
          authority_id,
          department_id,
          issue_category_used,
          category_source,
          route_status,
          routing_status,
          review_reasons,
          decision_source,
          reviewed_by,
          reviewed_at,
          review_notes,
          final_authority_id,
          final_department_id,
          match_method,
          requires_review,
          candidate_rules,
          explanation,
          routed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        RETURNING *`,
        [
          reportId,
          jurisdictionId,
          jurisdictionBoundaryId,
          responsibilityRuleId,
          authorityId,
          departmentId,
          issueCategoryUsed,
          categorySource,
          routeStatus,
          routingStatus,
          JSON.stringify(reviewReasons),
          decisionSource,
          reviewedBy,
          reviewedAt,
          reviewNotes,
          finalAuthorityId,
          finalDepartmentId,
          matchMethod,
          requiresReview,
          JSON.stringify(candidateRules),
          explanation,
          routedAt,
        ]
      );
      return res.rows[0];
    }

    const snapshot = {
      id: uuidv4(),
      report_id: reportId,
      jurisdiction_id: jurisdictionId,
      jurisdiction_boundary_id: jurisdictionBoundaryId,
      responsibility_rule_id: responsibilityRuleId,
      authority_id: authorityId,
      department_id: departmentId,
      issue_category_used: issueCategoryUsed,
      category_source: categorySource,
      route_status: routeStatus,
      routing_status: routingStatus,
      review_reasons: reviewReasons,
      decision_source: decisionSource,
      reviewed_by: reviewedBy,
      reviewed_at: reviewedAt ? new Date(reviewedAt).toISOString() : null,
      review_notes: reviewNotes,
      final_authority_id: finalAuthorityId,
      final_department_id: finalDepartmentId,
      match_method: matchMethod,
      requires_review: requiresReview,
      candidate_rules: candidateRules,
      explanation,
      routed_at: new Date(routedAt).toISOString(),
      created_at: new Date().toISOString(),
    };
    fallbackReportRoutings.set(reportId, snapshot);
    return snapshot;
  },

  async getReportRoutingSnapshot(reportId) {
    if (isPostgresConnected && pool) {
      const res = await pool.query(
        `SELECT 
          rr.*,
          a.code AS authority_code,
          a.name AS authority_name,
          a.type AS authority_type,
          d.code AS department_code,
          d.name AS department_name,
          fa.code AS final_authority_code,
          fa.name AS final_authority_name,
          fd.code AS final_department_code,
          fd.name AS final_department_name,
          u.name AS reviewer_name,
          j.code AS jurisdiction_code,
          j.name AS jurisdiction_name,
          r_rule.version AS rule_version
        FROM report_routing rr
        LEFT JOIN authorities a ON rr.authority_id = a.id
        LEFT JOIN departments d ON rr.department_id = d.id
        LEFT JOIN authorities fa ON rr.final_authority_id = fa.id
        LEFT JOIN departments fd ON rr.final_department_id = fd.id
        LEFT JOIN users u ON rr.reviewed_by = u.id
        LEFT JOIN jurisdictions j ON rr.jurisdiction_id = j.id
        LEFT JOIN responsibility_rules r_rule ON rr.responsibility_rule_id = r_rule.id
        WHERE rr.report_id = $1
        ORDER BY rr.routed_at DESC
        LIMIT 1`,
        [reportId]
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        ...row,
        candidate_rules: typeof row.candidate_rules === 'string' ? JSON.parse(row.candidate_rules) : row.candidate_rules,
        review_reasons: typeof row.review_reasons === 'string' ? JSON.parse(row.review_reasons) : (row.review_reasons || []),
        routing_status: row.routing_status || (row.route_status === 'ROUTED' ? 'AUTO_ROUTED' : row.route_status),
      };
    }

    const snapshot = fallbackReportRoutings.get(reportId);
    if (!snapshot) return null;

    let auth = null;
    let dept = null;
    let finalAuth = null;
    let finalDept = null;
    let reviewer = null;
    let jur = null;
    let rule = null;

    if (snapshot.authority_id) auth = fallbackAuthorities.get(snapshot.authority_id);
    if (snapshot.department_id) dept = fallbackDepartments.get(snapshot.department_id);
    if (snapshot.final_authority_id) finalAuth = fallbackAuthorities.get(snapshot.final_authority_id);
    if (snapshot.final_department_id) finalDept = fallbackDepartments.get(snapshot.final_department_id);
    if (snapshot.reviewed_by) reviewer = Array.from(fallbackUsers.values()).find((u) => u.id === snapshot.reviewed_by || u.auth_uid === snapshot.reviewed_by);
    if (snapshot.jurisdiction_id) jur = fallbackJurisdictions.get(snapshot.jurisdiction_id);
    if (snapshot.responsibility_rule_id) {
      rule = fallbackResponsibilityRules.find((r) => r.id === snapshot.responsibility_rule_id);
    }

    return {
      ...snapshot,
      authority_code: auth?.code || null,
      authority_name: auth?.name || null,
      authority_type: auth?.type || null,
      department_code: dept?.code || null,
      department_name: dept?.name || null,
      final_authority_code: finalAuth?.code || null,
      final_authority_name: finalAuth?.name || null,
      final_department_code: finalDept?.code || null,
      final_department_name: finalDept?.name || null,
      reviewer_name: reviewer?.name || null,
      jurisdiction_code: jur?.code || null,
      jurisdiction_name: jur?.name || null,
      rule_version: rule?.version || null,
      routing_status: snapshot.routing_status || (snapshot.route_status === 'ROUTED' ? 'AUTO_ROUTED' : snapshot.route_status),
      review_reasons: snapshot.review_reasons || [],
    };
  },

  // ==========================================
  // PHASE 6: HUMAN REVIEW & AUDIT LOG METHODS
  // ==========================================

  async createRoutingReview({
    reportId,
    reportRoutingId = null,
    action,
    reviewedBy,
    reviewedAt = new Date(),
    reviewNotes = null,
    originalAuthorityId = null,
    originalDepartmentId = null,
    finalAuthorityId,
    finalDepartmentId,
  }) {
    if (isPostgresConnected && pool) {
      const res = await pool.query(
        `INSERT INTO routing_reviews (
          report_id, report_routing_id, action, reviewed_by, reviewed_at,
          review_notes, original_authority_id, original_department_id,
          final_authority_id, final_department_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          reportId,
          reportRoutingId,
          action,
          reviewedBy,
          reviewedAt,
          reviewNotes,
          originalAuthorityId,
          originalDepartmentId,
          finalAuthorityId,
          finalDepartmentId,
        ]
      );
      return res.rows[0];
    }

    const review = {
      id: uuidv4(),
      report_id: reportId,
      report_routing_id: reportRoutingId,
      action,
      reviewed_by: reviewedBy,
      reviewed_at: new Date(reviewedAt).toISOString(),
      review_notes: reviewNotes,
      original_authority_id: originalAuthorityId,
      original_department_id: originalDepartmentId,
      final_authority_id: finalAuthorityId,
      final_department_id: finalDepartmentId,
      created_at: new Date().toISOString(),
    };
    fallbackRoutingReviews.push(review);
    return review;
  },

  async getRoutingReviewsByReportId(reportId) {
    if (isPostgresConnected && pool) {
      const res = await pool.query(
        `SELECT 
          rr.*,
          u.name AS reviewer_name,
          u.email AS reviewer_email,
          oa.code AS original_authority_code,
          oa.name AS original_authority_name,
          od.code AS original_department_code,
          od.name AS original_department_name,
          fa.code AS final_authority_code,
          fa.name AS final_authority_name,
          fd.code AS final_department_code,
          fd.name AS final_department_name
        FROM routing_reviews rr
        LEFT JOIN users u ON rr.reviewed_by = u.id
        LEFT JOIN authorities oa ON rr.original_authority_id = oa.id
        LEFT JOIN departments od ON rr.original_department_id = od.id
        LEFT JOIN authorities fa ON rr.final_authority_id = fa.id
        LEFT JOIN departments fd ON rr.final_department_id = fd.id
        WHERE rr.report_id = $1
        ORDER BY rr.reviewed_at DESC`,
        [reportId]
      );
      return res.rows;
    }

    return fallbackRoutingReviews
      .filter((r) => r.report_id === reportId)
      .map((r) => {
        const u = Array.from(fallbackUsers.values()).find((usr) => usr.id === r.reviewed_by || usr.auth_uid === r.reviewed_by);
        const oa = r.original_authority_id ? fallbackAuthorities.get(r.original_authority_id) : null;
        const od = r.original_department_id ? fallbackDepartments.get(r.original_department_id) : null;
        const fa = fallbackAuthorities.get(r.final_authority_id);
        const fd = fallbackDepartments.get(r.final_department_id);
        return {
          ...r,
          reviewer_name: u?.name || null,
          reviewer_email: u?.email || null,
          original_authority_code: oa?.code || null,
          original_authority_name: oa?.name || null,
          original_department_code: od?.code || null,
          original_department_name: od?.name || null,
          final_authority_code: fa?.code || null,
          final_authority_name: fa?.name || null,
          final_department_code: fd?.code || null,
          final_department_name: fd?.name || null,
        };
      })
      .sort((a, b) => new Date(b.reviewed_at) - new Date(a.reviewed_at));
  },

  async updateReportRoutingReview({
    reportId,
    routingStatus = 'REVIEWED',
    decisionSource = 'HUMAN_REVIEW',
    reviewedBy,
    reviewedAt = new Date(),
    reviewNotes = null,
    finalAuthorityId,
    finalDepartmentId,
  }) {
    if (isPostgresConnected && pool) {
      const res = await pool.query(
        `UPDATE report_routing
         SET routing_status = $1,
             decision_source = $2,
             reviewed_by = $3,
             reviewed_at = $4,
             review_notes = $5,
             final_authority_id = $6,
             final_department_id = $7,
             requires_review = false
         WHERE report_id = $8
         RETURNING *`,
        [
          routingStatus,
          decisionSource,
          reviewedBy,
          reviewedAt,
          reviewNotes,
          finalAuthorityId,
          finalDepartmentId,
          reportId,
        ]
      );
      return res.rows[0] || null;
    }

    const snapshot = fallbackReportRoutings.get(reportId);
    if (!snapshot) return null;
    snapshot.routing_status = routingStatus;
    snapshot.decision_source = decisionSource;
    snapshot.reviewed_by = reviewedBy;
    snapshot.reviewed_at = new Date(reviewedAt).toISOString();
    snapshot.review_notes = reviewNotes;
    snapshot.final_authority_id = finalAuthorityId;
    snapshot.final_department_id = finalDepartmentId;
    snapshot.requires_review = false;
    fallbackReportRoutings.set(reportId, snapshot);
    return snapshot;
  },

  async getUnresolvedRoutingReviews({ page = 1, limit = 20 }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    if (isPostgresConnected && pool) {
      const countRes = await pool.query(
        `SELECT COUNT(*) AS total
         FROM report_routing rr
         WHERE rr.routing_status = 'NEEDS_REVIEW' AND rr.reviewed_at IS NULL`
      );
      const total = parseInt(countRes.rows[0].total, 10);

      const itemsRes = await pool.query(
        `SELECT 
          r.id AS report_id,
          r.category,
          r.description,
          r.latitude,
          r.longitude,
          r.location_status,
          r.created_at,
          rr.id AS routing_id,
          rr.routing_status,
          rr.review_reasons,
          rr.explanation,
          rr.match_method,
          a.code AS authority_suggested_code,
          a.name AS authority_suggested_name,
          d.code AS department_suggested_code,
          d.name AS department_suggested_name,
          j.name AS jurisdiction_name
        FROM report_routing rr
        JOIN reports r ON rr.report_id = r.id
        LEFT JOIN authorities a ON rr.authority_id = a.id
        LEFT JOIN departments d ON rr.department_id = d.id
        LEFT JOIN jurisdictions j ON rr.jurisdiction_id = j.id
        WHERE rr.routing_status = 'NEEDS_REVIEW' AND rr.reviewed_at IS NULL
        ORDER BY r.created_at ASC
        LIMIT $1 OFFSET $2`,
        [limitNum, offset]
      );

      const formatted = itemsRes.rows.map((row) => ({
        reportId: row.report_id,
        category: row.category,
        description: row.description,
        locationAvailable: row.location_status === 'VERIFIED_COORDINATES' && row.latitude !== null,
        coordinates: { latitude: row.latitude, longitude: row.longitude },
        createdAt: row.created_at,
        routingStatus: row.routing_status,
        reviewReasons: typeof row.review_reasons === 'string' ? JSON.parse(row.review_reasons) : (row.review_reasons || []),
        jurisdictionName: row.jurisdiction_name || null,
        authoritySuggested: row.authority_suggested_code
          ? { code: row.authority_suggested_code, name: row.authority_suggested_name }
          : null,
        departmentSuggested: row.department_suggested_code
          ? { code: row.department_suggested_code, name: row.department_suggested_name }
          : null,
        explanation: row.explanation,
      }));

      return {
        items: formatted,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      };
    }

    // Fallback store query
    const unresolved = [];
    for (const [repId, snap] of fallbackReportRoutings.entries()) {
      if (snap.routing_status === 'NEEDS_REVIEW' && !snap.reviewed_at) {
        const report = fallbackReports.get(repId);
        if (report) {
          const auth = snap.authority_id ? fallbackAuthorities.get(snap.authority_id) : null;
          const dept = snap.department_id ? fallbackDepartments.get(snap.department_id) : null;
          const jur = snap.jurisdiction_id ? fallbackJurisdictions.get(snap.jurisdiction_id) : null;
          unresolved.push({
            reportId: repId,
            category: report.category,
            description: report.description,
            locationAvailable: report.location_status === 'VERIFIED_COORDINATES' && report.latitude !== null,
            coordinates: { latitude: report.latitude, longitude: report.longitude },
            createdAt: report.created_at,
            routingStatus: snap.routing_status,
            reviewReasons: snap.review_reasons || [],
            jurisdictionName: jur?.name || null,
            authoritySuggested: auth ? { code: auth.code, name: auth.name } : null,
            departmentSuggested: dept ? { code: dept.code, name: dept.name } : null,
            explanation: snap.explanation,
          });
        }
      }
    }

    // Sort by created_at ASC (oldest first)
    unresolved.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const total = unresolved.length;
    const items = unresolved.slice(offset, offset + limitNum);

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  },

  // -------------------------------------------------------------
  // Phase 7: Operational Civic Cases & Event Audit Log Methods
  // -------------------------------------------------------------

  async getUserById(id) {
    if (isPostgresConnected && pool) {
      const res = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      return res.rows[0] || null;
    }
    return Array.from(fallbackUsers.values()).find((u) => u.id === id) || null;
  },

  async getStaffUsers(filters = {}) {
    if (isPostgresConnected && pool) {
      let q = "SELECT id, name, email, role, authority_id, department_id FROM users WHERE role IN ('STAFF', 'ADMIN')";
      const params = [];
      if (filters.authorityId) {
        params.push(filters.authorityId);
        q += ` AND (authority_id = $${params.length} OR role = 'ADMIN')`;
      }
      if (filters.departmentId) {
        params.push(filters.departmentId);
        q += ` AND (department_id = $${params.length} OR role = 'ADMIN')`;
      }
      q += ' ORDER BY name ASC';
      const res = await pool.query(q, params);
      return res.rows;
    }

    return Array.from(fallbackUsers.values())
      .filter((u) => u.role === 'STAFF' || u.role === 'ADMIN')
      .filter((u) => !filters.authorityId || u.role === 'ADMIN' || !u.authority_id || u.authority_id === filters.authorityId)
      .filter((u) => !filters.departmentId || u.role === 'ADMIN' || !u.department_id || u.department_id === filters.departmentId)
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        authority_id: u.authority_id,
        department_id: u.department_id,
      }));
  },

  async createCase(caseData) {
    const {
      report_id,
      routing_id,
      authority_id,
      department_id,
      jurisdiction_id,
      jurisdiction_boundary_id,
      responsibility_rule_id,
      priority = 'MEDIUM',
      status = 'UNASSIGNED',
      assigned_to = null,
      actor_user_id = null,
      note = 'Case created from routed report.',
    } = caseData;

    // 1. PostgreSQL implementation with transaction
    if (isPostgresConnected && pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Check if case already exists (idempotency guard)
        const existingRes = await client.query('SELECT * FROM civic_cases WHERE report_id = $1', [report_id]);
        if (existingRes.rows.length > 0) {
          await client.query('COMMIT');
          return existingRes.rows[0];
        }

        // Generate case number
        const seqRes = await client.query("SELECT nextval('civic_case_seq') AS num");
        const seqNum = seqRes.rows[0].num;
        const caseNumber = `CIV-${new Date().getFullYear()}-${String(seqNum).padStart(6, '0')}`;

        const initialStatus = assigned_to ? 'ASSIGNED' : status;
        const assignedAt = assigned_to ? new Date().toISOString() : null;

        const insertCaseRes = await client.query(
          `INSERT INTO civic_cases (
            case_number, report_id, routing_id, authority_id, department_id,
            jurisdiction_id, jurisdiction_boundary_id, responsibility_rule_id,
            status, priority, assigned_to, assigned_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *`,
          [
            caseNumber,
            report_id,
            routing_id,
            authority_id,
            department_id,
            jurisdiction_id,
            jurisdiction_boundary_id,
            responsibility_rule_id,
            initialStatus,
            priority,
            assigned_to,
            assignedAt,
          ]
        );

        const createdCase = insertCaseRes.rows[0];

        // Create initial CASE_CREATED event
        const actorId = actor_user_id || '00000000-0000-0000-0000-000000000003'; // admin fallback
        await client.query(
          `INSERT INTO case_events (
            case_id, event_type, from_status, to_status, actor_user_id, note
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [createdCase.id, 'CASE_CREATED', null, initialStatus, actorId, note]
        );

        if (assigned_to) {
          await client.query(
            `INSERT INTO case_events (
              case_id, event_type, from_status, to_status, actor_user_id, note, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              createdCase.id,
              'CASE_ASSIGNED',
              'UNASSIGNED',
              'ASSIGNED',
              actorId,
              'Initially assigned during case creation.',
              JSON.stringify({ assigned_to }),
            ]
          );
        }

        await client.query('COMMIT');
        return createdCase;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // 2. Fallback in-memory implementation
    // Check if case already exists
    const existing = Array.from(fallbackCases.values()).find((c) => c.report_id === report_id);
    if (existing) {
      return existing;
    }

    const caseId = uuidv4();
    const caseNumber = generateFallbackCaseNumber();
    const initialStatus = assigned_to ? 'ASSIGNED' : status;
    const now = new Date().toISOString();

    const newCase = {
      id: caseId,
      case_number: caseNumber,
      report_id,
      routing_id,
      authority_id,
      department_id,
      jurisdiction_id,
      jurisdiction_boundary_id,
      responsibility_rule_id,
      status: initialStatus,
      priority,
      assigned_to: assigned_to || null,
      assigned_at: assigned_to ? now : null,
      acknowledged_at: null,
      started_at: null,
      resolved_at: null,
      resolved_by: null,
      resolution_notes: null,
      on_hold_reason: null,
      on_hold_notes: null,
      created_at: now,
      updated_at: now,
    };

    fallbackCases.set(caseId, newCase);

    // Record CASE_CREATED event
    const actorId = actor_user_id || '00000000-0000-0000-0000-000000000003';
    fallbackCaseEvents.push({
      id: uuidv4(),
      case_id: caseId,
      event_type: 'CASE_CREATED',
      from_status: null,
      to_status: initialStatus,
      actor_user_id: actorId,
      note,
      metadata: {},
      created_at: now,
    });

    if (assigned_to) {
      fallbackCaseEvents.push({
        id: uuidv4(),
        case_id: caseId,
        event_type: 'CASE_ASSIGNED',
        from_status: 'UNASSIGNED',
        to_status: 'ASSIGNED',
        actor_user_id: actorId,
        note: 'Initially assigned during case creation.',
        metadata: { assigned_to },
        created_at: now,
      });
    }

    return newCase;
  },

  async getCaseById(id) {
    if (isPostgresConnected && pool) {
      const res = await pool.query(
        `SELECT
          c.*,
          r.category,
          r.description AS report_description,
          r.photo_url,
          r.latitude,
          r.longitude,
          r.location_accuracy AS accuracy,
          r.location_status,
          r.reporter_user_id AS report_user_id,
          r.created_at AS report_created_at,
          a.code AS authority_code,
          a.name AS authority_name,
          d.code AS department_code,
          d.name AS department_name,
          j.name AS jurisdiction_name,
          j.code AS jurisdiction_code,
          u_assign.name AS assigned_to_name,
          u_assign.email AS assigned_to_email,
          u_resolve.name AS resolved_by_name
        FROM civic_cases c
        JOIN reports r ON c.report_id = r.id
        JOIN authorities a ON c.authority_id = a.id
        JOIN departments d ON c.department_id = d.id
        LEFT JOIN jurisdictions j ON c.jurisdiction_id = j.id
        LEFT JOIN users u_assign ON c.assigned_to = u_assign.id
        LEFT JOIN users u_resolve ON c.resolved_by = u_resolve.id
        WHERE c.id = $1`,
        [id]
      );
      if (res.rows.length === 0) return null;
      const caseItem = res.rows[0];
      const events = await this.getCaseEventsByCaseId(id);
      return { ...caseItem, events };
    }

    const c = fallbackCases.get(id);
    if (!c) return null;

    const report = fallbackReports.get(c.report_id);
    const auth = fallbackAuthorities.get(c.authority_id);
    const dept = fallbackDepartments.get(c.department_id);
    const jur = c.jurisdiction_id ? fallbackJurisdictions.get(c.jurisdiction_id) : null;
    const assignedUser = c.assigned_to ? Array.from(fallbackUsers.values()).find((u) => u.id === c.assigned_to) : null;
    const resolvedUser = c.resolved_by ? Array.from(fallbackUsers.values()).find((u) => u.id === c.resolved_by) : null;
    const events = await this.getCaseEventsByCaseId(id);

    return {
      ...c,
      category: report?.category,
      report_description: report?.description,
      photo_url: report?.photo_url,
      latitude: report?.latitude,
      longitude: report?.longitude,
      accuracy: report?.location_accuracy,
      location_status: report?.location_status,
      report_user_id: report?.reporter_user_id,
      report_created_at: report?.created_at,
      authority_code: auth?.code,
      authority_name: auth?.name,
      department_code: dept?.code,
      department_name: dept?.name,
      jurisdiction_name: jur?.name,
      jurisdiction_code: jur?.code,
      assigned_to_name: assignedUser?.name || null,
      assigned_to_email: assignedUser?.email || null,
      resolved_by_name: resolvedUser?.name || null,
      events,
    };
  },

  async getCaseByReportId(reportId) {
    if (isPostgresConnected && pool) {
      const res = await pool.query('SELECT id FROM civic_cases WHERE report_id = $1', [reportId]);
      if (res.rows.length === 0) return null;
      return this.getCaseById(res.rows[0].id);
    }

    const found = Array.from(fallbackCases.values()).find((c) => c.report_id === reportId);
    if (!found) return null;
    return this.getCaseById(found.id);
  },

  async getCases(options = {}) {
    const {
      status,
      authority_id,
      department_id,
      assigned_to,
      view = 'active',
      search,
      page = 1,
      limit = 20,
    } = options;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    if (isPostgresConnected && pool) {
      let countQuery = `
        SELECT COUNT(*)
        FROM civic_cases c
        JOIN reports r ON c.report_id = r.id
        JOIN authorities a ON c.authority_id = a.id
        JOIN departments d ON c.department_id = d.id
        WHERE 1=1`;
      let dataQuery = `
        SELECT
          c.*,
          r.category,
          r.description AS report_description,
          r.latitude,
          r.longitude,
          r.created_at AS report_created_at,
          a.code AS authority_code,
          a.name AS authority_name,
          d.code AS department_code,
          d.name AS department_name,
          j.name AS jurisdiction_name,
          u_assign.name AS assigned_to_name
        FROM civic_cases c
        JOIN reports r ON c.report_id = r.id
        JOIN authorities a ON c.authority_id = a.id
        JOIN departments d ON c.department_id = d.id
        LEFT JOIN jurisdictions j ON c.jurisdiction_id = j.id
        LEFT JOIN users u_assign ON c.assigned_to = u_assign.id
        WHERE 1=1`;

      const params = [];

      // View filtering
      if (view === 'needs_attention') {
        params.push(['UNASSIGNED', 'ON_HOLD']);
        countQuery += ` AND c.status = ANY($${params.length})`;
        dataQuery += ` AND c.status = ANY($${params.length})`;
      } else if (view === 'my_cases' && assigned_to) {
        params.push(assigned_to);
        countQuery += ` AND c.assigned_to = $${params.length}`;
        dataQuery += ` AND c.assigned_to = $${params.length}`;
      } else if (status) {
        params.push(status);
        countQuery += ` AND c.status = $${params.length}`;
        dataQuery += ` AND c.status = $${params.length}`;
      } else if (view === 'active') {
        countQuery += " AND c.status != 'CLOSED'";
        dataQuery += " AND c.status != 'CLOSED'";
      }

      if (authority_id) {
        params.push(authority_id);
        countQuery += ` AND c.authority_id = $${params.length}`;
        dataQuery += ` AND c.authority_id = $${params.length}`;
      }

      if (department_id) {
        params.push(department_id);
        countQuery += ` AND c.department_id = $${params.length}`;
        dataQuery += ` AND c.department_id = $${params.length}`;
      }

      if (search) {
        params.push(`%${search}%`);
        countQuery += ` AND (c.case_number ILIKE $${params.length} OR r.description ILIKE $${params.length})`;
        dataQuery += ` AND (c.case_number ILIKE $${params.length} OR r.description ILIKE $${params.length})`;
      }

      const countRes = await pool.query(countQuery, params);
      const total = parseInt(countRes.rows[0].count, 10);

      dataQuery += ` ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      const dataRes = await pool.query(dataQuery, [...params, limitNum, offset]);

      return {
        items: dataRes.rows,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      };
    }

    // Fallback in-memory
    let list = Array.from(fallbackCases.values());

    if (view === 'needs_attention') {
      list = list.filter((c) => c.status === 'UNASSIGNED' || c.status === 'ON_HOLD');
    } else if (view === 'my_cases' && assigned_to) {
      list = list.filter((c) => c.assigned_to === assigned_to);
    } else if (status) {
      list = list.filter((c) => c.status === status);
    } else if (view === 'active') {
      list = list.filter((c) => c.status !== 'CLOSED');
    }

    if (authority_id) {
      list = list.filter((c) => c.authority_id === authority_id);
    }
    if (department_id) {
      list = list.filter((c) => c.department_id === department_id);
    }

    if (search) {
      const s = search.toLowerCase();
      list = list.filter((c) => {
        const rep = fallbackReports.get(c.report_id);
        return (
          c.case_number.toLowerCase().includes(s) ||
          (rep && rep.description && rep.description.toLowerCase().includes(s))
        );
      });
    }

    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const total = list.length;
    const items = list.slice(offset, offset + limitNum).map((c) => {
      const rep = fallbackReports.get(c.report_id);
      const auth = fallbackAuthorities.get(c.authority_id);
      const dept = fallbackDepartments.get(c.department_id);
      const jur = c.jurisdiction_id ? fallbackJurisdictions.get(c.jurisdiction_id) : null;
      const assignUser = c.assigned_to ? Array.from(fallbackUsers.values()).find((u) => u.id === c.assigned_to) : null;
      return {
        ...c,
        category: rep?.category,
        report_description: rep?.description,
        latitude: rep?.latitude,
        longitude: rep?.longitude,
        authority_code: auth?.code,
        authority_name: auth?.name,
        department_code: dept?.code,
        department_name: dept?.name,
        jurisdiction_name: jur?.name,
        assigned_to_name: assignUser?.name || null,
      };
    });

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  },

  async updateCaseStatus(caseId, updateData) {
    const { toStatus, actorUserId, note, onHoldReason, onHoldNotes } = updateData;
    const now = new Date().toISOString();

    if (isPostgresConnected && pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const currentRes = await client.query('SELECT * FROM civic_cases WHERE id = $1 FOR UPDATE', [caseId]);
        if (currentRes.rows.length === 0) {
          throw new Error('Case not found');
        }
        const currentCase = currentRes.rows[0];

        let eventType = 'CASE_ACKNOWLEDGED';
        if (toStatus === 'ACKNOWLEDGED') eventType = 'CASE_ACKNOWLEDGED';
        else if (toStatus === 'IN_PROGRESS') eventType = currentCase.status === 'ON_HOLD' ? 'CASE_RESUMED' : 'CASE_STARTED';
        else if (toStatus === 'ON_HOLD') eventType = 'CASE_ON_HOLD';
        else if (toStatus === 'RESOLVED') eventType = 'CASE_RESOLVED';
        else if (toStatus === 'CLOSED') eventType = 'CASE_CLOSED';

        const updates = ['status = $1', 'updated_at = NOW()'];
        const params = [toStatus, caseId];

        if (toStatus === 'ACKNOWLEDGED') {
          updates.push('acknowledged_at = NOW()');
        } else if (toStatus === 'IN_PROGRESS') {
          updates.push('started_at = COALESCE(started_at, NOW())');
        } else if (toStatus === 'ON_HOLD') {
          params.push(onHoldReason);
          updates.push(`on_hold_reason = $${params.length}`);
          params.push(onHoldNotes || note || null);
          updates.push(`on_hold_notes = $${params.length}`);
        } else if (toStatus === 'RESOLVED') {
          updates.push('resolved_at = NOW()');
          params.push(actorUserId);
          updates.push(`resolved_by = $${params.length}`);
          params.push(note);
          updates.push(`resolution_notes = $${params.length}`);
        }

        const updateRes = await client.query(
          `UPDATE civic_cases SET ${updates.join(', ')} WHERE id = $2 RETURNING *`,
          params
        );

        // Record event
        await client.query(
          `INSERT INTO case_events (
            case_id, event_type, from_status, to_status, actor_user_id, note, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            caseId,
            eventType,
            currentCase.status,
            toStatus,
            actorUserId,
            note || null,
            JSON.stringify(onHoldReason ? { on_hold_reason: onHoldReason } : {}),
          ]
        );

        await client.query('COMMIT');
        return updateRes.rows[0];
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // Fallback in-memory
    const c = fallbackCases.get(caseId);
    if (!c) throw new Error('Case not found');

    const fromStatus = c.status;
    let eventType = 'CASE_ACKNOWLEDGED';
    if (toStatus === 'ACKNOWLEDGED') eventType = 'CASE_ACKNOWLEDGED';
    else if (toStatus === 'IN_PROGRESS') eventType = fromStatus === 'ON_HOLD' ? 'CASE_RESUMED' : 'CASE_STARTED';
    else if (toStatus === 'ON_HOLD') eventType = 'CASE_ON_HOLD';
    else if (toStatus === 'RESOLVED') eventType = 'CASE_RESOLVED';
    else if (toStatus === 'CLOSED') eventType = 'CASE_CLOSED';

    c.status = toStatus;
    c.updated_at = now;

    if (toStatus === 'ACKNOWLEDGED') {
      c.acknowledged_at = now;
    } else if (toStatus === 'IN_PROGRESS') {
      c.started_at = c.started_at || now;
    } else if (toStatus === 'ON_HOLD') {
      c.on_hold_reason = onHoldReason;
      c.on_hold_notes = onHoldNotes || note || null;
    } else if (toStatus === 'RESOLVED') {
      c.resolved_at = now;
      c.resolved_by = actorUserId;
      c.resolution_notes = note;
    }

    fallbackCaseEvents.push({
      id: uuidv4(),
      case_id: caseId,
      event_type: eventType,
      from_status: fromStatus,
      to_status: toStatus,
      actor_user_id: actorUserId,
      note: note || null,
      metadata: onHoldReason ? { on_hold_reason: onHoldReason } : {},
      created_at: now,
    });

    return c;
  },

  async updateCaseAssignment(caseId, assignData) {
    const { assignedToUserId, actorUserId, note } = assignData;
    const now = new Date().toISOString();

    if (isPostgresConnected && pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const currRes = await client.query('SELECT * FROM civic_cases WHERE id = $1 FOR UPDATE', [caseId]);
        if (currRes.rows.length === 0) throw new Error('Case not found');
        const currCase = currRes.rows[0];

        const prevAssignedTo = currCase.assigned_to;
        const fromStatus = currCase.status;
        const toStatus = currCase.status === 'UNASSIGNED' ? 'ASSIGNED' : currCase.status;
        const eventType = prevAssignedTo ? 'CASE_REASSIGNED' : 'CASE_ASSIGNED';

        const updateRes = await client.query(
          `UPDATE civic_cases
           SET assigned_to = $1, assigned_at = NOW(), status = $2, updated_at = NOW()
           WHERE id = $3 RETURNING *`,
          [assignedToUserId, toStatus, caseId]
        );

        await client.query(
          `INSERT INTO case_events (
            case_id, event_type, from_status, to_status, actor_user_id, note, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            caseId,
            eventType,
            fromStatus,
            toStatus,
            actorUserId,
            note || (prevAssignedTo ? 'Reassigned to another staff member' : 'Assigned to staff member'),
            JSON.stringify({ previous_assigned_to: prevAssignedTo, new_assigned_to: assignedToUserId }),
          ]
        );

        await client.query('COMMIT');
        return updateRes.rows[0];
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // Fallback in-memory
    const c = fallbackCases.get(caseId);
    if (!c) throw new Error('Case not found');

    const prevAssignedTo = c.assigned_to;
    const fromStatus = c.status;
    const toStatus = c.status === 'UNASSIGNED' ? 'ASSIGNED' : c.status;
    const eventType = prevAssignedTo ? 'CASE_REASSIGNED' : 'CASE_ASSIGNED';

    c.assigned_to = assignedToUserId;
    c.assigned_at = now;
    c.status = toStatus;
    c.updated_at = now;

    fallbackCaseEvents.push({
      id: uuidv4(),
      case_id: caseId,
      event_type: eventType,
      from_status: fromStatus,
      to_status: toStatus,
      actor_user_id: actorUserId,
      note: note || (prevAssignedTo ? 'Reassigned to another staff member' : 'Assigned to staff member'),
      metadata: { previous_assigned_to: prevAssignedTo, new_assigned_to: assignedToUserId },
      created_at: now,
    });

    return c;
  },

  async addCaseNote(caseId, noteData) {
    const { actorUserId, note, isInternal = false } = noteData;
    const now = new Date().toISOString();

    if (isPostgresConnected && pool) {
      const res = await pool.query(
        `INSERT INTO case_events (
          case_id, event_type, from_status, to_status, actor_user_id, note, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [caseId, 'CASE_NOTE_ADDED', null, null, actorUserId, note, JSON.stringify({ is_internal: isInternal })]
      );
      return res.rows[0];
    }

    const event = {
      id: uuidv4(),
      case_id: caseId,
      event_type: 'CASE_NOTE_ADDED',
      from_status: null,
      to_status: null,
      actor_user_id: actorUserId,
      note,
      metadata: { is_internal: isInternal },
      created_at: now,
    };
    fallbackCaseEvents.push(event);
    return event;
  },

  async getCaseEventsByCaseId(caseId) {
    if (isPostgresConnected && pool) {
      const res = await pool.query(
        `SELECT
          e.*,
          u.name AS actor_name,
          u.email AS actor_email,
          u.role AS actor_role
        FROM case_events e
        JOIN users u ON e.actor_user_id = u.id
        WHERE e.case_id = $1
        ORDER BY e.created_at ASC`,
        [caseId]
      );
      return res.rows;
    }

    return fallbackCaseEvents
      .filter((e) => e.case_id === caseId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map((e) => {
        const u = Array.from(fallbackUsers.values()).find((user) => user.id === e.actor_user_id);
        return {
          ...e,
          actor_name: u?.name || 'System / Staff',
          actor_email: u?.email || null,
          actor_role: u?.role || 'STAFF',
        };
      });
  },
};

module.exports = { initDb, db };

