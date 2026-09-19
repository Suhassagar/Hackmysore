-- CivicFlow Phase 5: Dynamic Civic Responsibility Rule Schema
-- Migration 005: Normalized Authorities, Departments, Versioned Responsibility Rules, and Routing Snapshots

-- 1. Authorities Table (Legal Administrative Bodies)
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

-- 2. Departments Table (Functional Work Divisions within Authorities)
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

-- 3. Versioned Responsibility Rules Table (Data-Driven Routing Rules)
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
    valid_until TIMESTAMPTZ, -- NULL denotes currently active without expiration
    priority INTEGER NOT NULL DEFAULT 100, -- Higher number = higher precedence
    active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_resp_rules_lookup ON responsibility_rules (jurisdiction_id, issue_category, valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_resp_rules_active ON responsibility_rules (active);
CREATE INDEX IF NOT EXISTS idx_resp_rules_version ON responsibility_rules (version);

-- 4. Historical Report Routing Snapshots Table (Immutable Case Audit Trail)
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
