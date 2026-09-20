-- ============================================================================
-- CIVICFLOW — COMPLETE DATABASE INITIALIZATION SCRIPT (POSTGRESQL + POSTGIS)
-- Run this in pgAdmin 4 or DBeaver inside the 'civicflow' database.
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PostGIS Extension (Enables spatial operations if available; gracefully falls back if not installed)
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS postgis;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PostGIS extension not installed in PostgreSQL. Proceeding with native PostgreSQL JSONB geospatial engine.';
END $$;

-- 2. USERS & RBAC TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_uid VARCHAR(128) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'CITIZEN' CHECK (role IN ('CITIZEN', 'STAFF', 'ADMIN')),
    password_hash VARCHAR(255),
    authority_id UUID,
    department_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_auth_uid ON users(auth_uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 3. CITIZEN PROBLEM REPORTS TABLE
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- 4. AI ISSUE UNDERSTANDING TABLE
CREATE TABLE IF NOT EXISTS report_ai_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- 5. SPATIAL JURISDICTIONS TABLE
CREATE TABLE IF NOT EXISTS jurisdictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'MCC_WARD',
        'TOWN_PANCHAYAT',
        'GRAM_PANCHAYAT',
        'SPECIAL_ZONE'
    )),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TEMPORAL JURISDICTION BOUNDARIES TABLE (PostGIS Polygons or GeoJSON JSONB)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
        EXECUTE 'CREATE TABLE IF NOT EXISTS jurisdiction_boundaries (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            jurisdiction_id UUID NOT NULL REFERENCES jurisdictions(id) ON DELETE CASCADE,
            version VARCHAR(50) NOT NULL,
            geometry GEOMETRY(Polygon, 4326) NOT NULL,
            valid_from TIMESTAMPTZ NOT NULL,
            valid_until TIMESTAMPTZ,
            metadata JSONB DEFAULT ''{}''::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_jurisdiction_boundaries_geom ON jurisdiction_boundaries USING GIST (geometry)';
    ELSE
        EXECUTE 'CREATE TABLE IF NOT EXISTS jurisdiction_boundaries (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            jurisdiction_id UUID NOT NULL REFERENCES jurisdictions(id) ON DELETE CASCADE,
            version VARCHAR(50) NOT NULL,
            geometry JSONB NOT NULL,
            valid_from TIMESTAMPTZ NOT NULL,
            valid_until TIMESTAMPTZ,
            metadata JSONB DEFAULT ''{}''::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_jurisdiction_boundaries_geom ON jurisdiction_boundaries USING GIN (geometry)';
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_jurisdiction_boundaries_temporal ON jurisdiction_boundaries (valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_jurisdiction_boundaries_jur_version ON jurisdiction_boundaries (jurisdiction_id, version);

-- 7. REPORT JURISDICTION AUDIT SNAPSHOTS TABLE
CREATE TABLE IF NOT EXISTS report_jurisdiction (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    jurisdiction_id UUID REFERENCES jurisdictions(id),
    jurisdiction_boundary_id UUID REFERENCES jurisdiction_boundaries(id),
    matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    report_time TIMESTAMPTZ NOT NULL,
    match_status VARCHAR(50) NOT NULL CHECK (match_status IN (
        'MATCHED',
        'NO_JURISDICTION_MATCH',
        'JURISDICTION_CONFLICT'
    )),
    match_method VARCHAR(50) NOT NULL DEFAULT 'POSTGIS_POINT_IN_POLYGON',
    requires_review BOOLEAN NOT NULL DEFAULT false,
    candidate_matches JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_report_jurisdiction_report_id ON report_jurisdiction (report_id);

-- 8. AUTHORITIES & DEPARTMENTS
CREATE TABLE IF NOT EXISTS authorities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- 9. RESPONSIBILITY RULES TABLE
CREATE TABLE IF NOT EXISTS responsibility_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- 10. REPORT ROUTING SNAPSHOTS TABLE
CREATE TABLE IF NOT EXISTS report_routing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    routing_status VARCHAR(50) DEFAULT 'PENDING' CHECK (routing_status IN (
        'PENDING',
        'AUTO_ROUTED',
        'NEEDS_REVIEW',
        'REVIEWED',
        'ROUTING_FAILED'
    )),
    review_reasons JSONB DEFAULT '[]'::jsonb,
    decision_source VARCHAR(50) DEFAULT 'AUTOMATIC' CHECK (decision_source IN (
        'AUTOMATIC',
        'HUMAN_REVIEW'
    )),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    final_authority_id UUID REFERENCES authorities(id),
    final_department_id UUID REFERENCES departments(id),
    match_method VARCHAR(50) NOT NULL DEFAULT 'DETERMINISTIC_RULE_MATCH',
    requires_review BOOLEAN NOT NULL DEFAULT false,
    candidate_rules JSONB DEFAULT '[]'::jsonb,
    explanation TEXT NOT NULL,
    routed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_report_routing_report_id ON report_routing (report_id);
CREATE INDEX IF NOT EXISTS idx_report_routing_routing_status ON report_routing (routing_status);

-- 11. ROUTING REVIEWS AUDIT TABLE
CREATE TABLE IF NOT EXISTS routing_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- 12. OPERATIONAL CIVIC CASES TABLE
CREATE SEQUENCE IF NOT EXISTS civic_case_seq START WITH 10001;

CREATE TABLE IF NOT EXISTS civic_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE INDEX IF NOT EXISTS idx_civic_cases_status ON civic_cases(status);

-- 13. IMMUTABLE CASE EVENTS TIMELINE TABLE
CREATE TABLE IF NOT EXISTS case_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
        'CASE_CLOSED',
        'RESOLUTION_SUBMITTED',
        'RESOLUTION_VERIFIED',
        'RESOLUTION_DISPUTED',
        'CASE_REOPENED'
    )),
    from_status VARCHAR(50),
    to_status VARCHAR(50),
    actor_user_id UUID NOT NULL REFERENCES users(id),
    note TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_case_events_case_id ON case_events(case_id);

-- 14. RESOLUTION EVIDENCE TABLE
CREATE TABLE IF NOT EXISTS resolution_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES civic_cases(id) ON DELETE CASCADE,
    submitted_by UUID NOT NULL REFERENCES users(id),
    evidence_type VARCHAR(50) NOT NULL DEFAULT 'PHOTO' CHECK (evidence_type IN ('PHOTO', 'DOCUMENT', 'COMPLETION_IMAGE', 'NOTE_ONLY')),
    media_url TEXT,
    resolution_note TEXT NOT NULL,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_resolution_evidence_case_id ON resolution_evidence(case_id);

-- 15. CASE VERIFICATIONS TABLE (Phase 8: RESOLVED != VERIFIED)
CREATE TABLE IF NOT EXISTS case_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES civic_cases(id) ON DELETE CASCADE,
    resolution_evidence_id UUID REFERENCES resolution_evidence(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'DISPUTED')),
    resolution_note TEXT NOT NULL,
    cycle_number INT NOT NULL DEFAULT 1,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    disputed_by UUID REFERENCES users(id),
    disputed_at TIMESTAMPTZ,
    dispute_reason TEXT,
    reopened_by UUID REFERENCES users(id),
    reopened_at TIMESTAMPTZ,
    reopen_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_case_verifications_case_id ON case_verifications(case_id);

-- ============================================================================
-- PRE-SEEDED CORE DATA (USERS & CIVIC AUTHORITIES)
-- ============================================================================

-- Authorities
INSERT INTO authorities (id, code, name, type) VALUES
('56f99c25-03cc-4532-9ce0-e1732542110b', 'MCC', 'Mysuru City Corporation', 'MUNICIPAL_CORPORATION'),
('67f99c25-03cc-4532-9ce0-e1732542110c', 'MUDA', 'Mysuru Urban Development Authority', 'SPECIAL_AUTHORITY'),
('78f99c25-03cc-4532-9ce0-e1732542110d', 'CHESCOM', 'Chamundeshwari Electricity Supply Corp', 'UTILITY_BOARD')
ON CONFLICT (code) DO NOTHING;

-- Departments
INSERT INTO departments (id, authority_id, code, name, description) VALUES
('0105ebf7-de96-4ab1-a1f3-410e8e76f1b2', '56f99c25-03cc-4532-9ce0-e1732542110b', 'MCC_ROADS', 'Road Infrastructure & Maintenance', 'Asphalt, potholes, civil work'),
('0205ebf7-de96-4ab1-a1f3-410e8e76f1b3', '56f99c25-03cc-4532-9ce0-e1732542110b', 'MCC_DRAINAGE', 'Stormwater & Under-ground Drainage', 'Stormwater drains, culverts'),
('0305ebf7-de96-4ab1-a1f3-410e8e76f1b4', '56f99c25-03cc-4532-9ce0-e1732542110b', 'MCC_HEALTH', 'Solid Waste & Sanitation', 'Garbage clearing, waste bins'),
('0405ebf7-de96-4ab1-a1f3-410e8e76f1b5', '78f99c25-03cc-4532-9ce0-e1732542110d', 'CHESCOM_POWER', 'Electrical & Street Lighting', 'Power supply, streetlights')
ON CONFLICT (authority_id, code) DO NOTHING;

-- Default Test Users (Password: CivicFlow@2026)
-- Hash created via crypto scrypt: salt:key
INSERT INTO users (id, auth_uid, name, email, role, password_hash, authority_id, department_id) VALUES
('00000000-0000-0000-0000-000000000001', 'dev-citizen-01', 'Naveen Kumar (Mysuru Citizen)', 'citizen@mysuru.civicflow.in', 'CITIZEN', '00000000000000000000000000000000:f42fabe23b5f5e6b95f60099a394713d6e47cc3e851153840deb853de4bc7bc84a6d914088a102d8b133a48b15f7105ad444ab213f57c1fdc40263451b05eed2', NULL, NULL),
('00000000-0000-0000-0000-000000000004', 'dev-citizen-02', 'Ananya Deshmukh (Other Citizen)', 'citizen2@mysuru.civicflow.in', 'CITIZEN', '00000000000000000000000000000000:f42fabe23b5f5e6b95f60099a394713d6e47cc3e851153840deb853de4bc7bc84a6d914088a102d8b133a48b15f7105ad444ab213f57c1fdc40263451b05eed2', NULL, NULL),
('00000000-0000-0000-0000-000000000002', 'dev-staff-01', 'Radha Shastry (MCC Ward Officer)', 'staff@mysuru.civicflow.in', 'STAFF', '00000000000000000000000000000000:f42fabe23b5f5e6b95f60099a394713d6e47cc3e851153840deb853de4bc7bc84a6d914088a102d8b133a48b15f7105ad444ab213f57c1fdc40263451b05eed2', '56f99c25-03cc-4532-9ce0-e1732542110b', '0105ebf7-de96-4ab1-a1f3-410e8e76f1b2'),
('00000000-0000-0000-0000-000000000005', 'dev-staff-drainage', 'Mahesh Gowda (MCC Drainage Officer)', 'staff-drainage@mysuru.civicflow.in', 'STAFF', '00000000000000000000000000000000:f42fabe23b5f5e6b95f60099a394713d6e47cc3e851153840deb853de4bc7bc84a6d914088a102d8b133a48b15f7105ad444ab213f57c1fdc40263451b05eed2', '56f99c25-03cc-4532-9ce0-e1732542110b', '0205ebf7-de96-4ab1-a1f3-410e8e76f1b3'),
('00000000-0000-0000-0000-000000000003', 'dev-admin-01', 'Dr. Ramesh Rao (Chief Admin)', 'admin@mysuru.civicflow.in', 'ADMIN', '00000000000000000000000000000000:f42fabe23b5f5e6b95f60099a394713d6e47cc3e851153840deb853de4bc7bc84a6d914088a102d8b133a48b15f7105ad444ab213f57c1fdc40263451b05eed2', NULL, NULL)
ON CONFLICT (email) DO NOTHING;

-- Complete!
