-- CivicFlow Phase 7: Staff Case Workflow & Follow-Through
-- Migration 007: Create civic_cases, case_events tables and staff department scoping

-- 1. Add optional authority and department scoping to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS authority_id UUID REFERENCES authorities(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);
CREATE INDEX IF NOT EXISTS idx_users_authority_dept ON users(authority_id, department_id);

-- 2. Case sequence for human-friendly case numbers
CREATE SEQUENCE IF NOT EXISTS civic_case_seq START WITH 10001;

-- 3. Operational Civic Cases Table (1:1 with routed reports)
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

-- Fast lookup indexes for operational queues and citizen lookups
CREATE INDEX IF NOT EXISTS idx_civic_cases_case_number ON civic_cases(case_number);
CREATE INDEX IF NOT EXISTS idx_civic_cases_report_id ON civic_cases(report_id);
CREATE INDEX IF NOT EXISTS idx_civic_cases_status ON civic_cases(status);
CREATE INDEX IF NOT EXISTS idx_civic_cases_authority_dept ON civic_cases(authority_id, department_id);
CREATE INDEX IF NOT EXISTS idx_civic_cases_assigned_to ON civic_cases(assigned_to);
CREATE INDEX IF NOT EXISTS idx_civic_cases_created_at ON civic_cases(created_at);

-- 4. Immutable Case Events Audit Trail
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

-- Audit log query indexes
CREATE INDEX IF NOT EXISTS idx_case_events_case_id ON case_events(case_id);
CREATE INDEX IF NOT EXISTS idx_case_events_actor ON case_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_case_events_created_at ON case_events(created_at);
