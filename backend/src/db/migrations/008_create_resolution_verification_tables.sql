-- CivicFlow Phase 8: Resolution Verification
-- Migration 008: Create resolution_evidence and case_verifications tables, and extend case_events enum

-- 1. Extend case_events event_type CHECK constraint to include Phase 8 events
ALTER TABLE case_events DROP CONSTRAINT IF EXISTS case_events_event_type_check;
ALTER TABLE case_events ADD CONSTRAINT case_events_event_type_check CHECK (event_type IN (
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
));

-- 2. Resolution Evidence Table
CREATE TABLE IF NOT EXISTS resolution_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE INDEX IF NOT EXISTS idx_resolution_evidence_submitted_by ON resolution_evidence(submitted_by);
CREATE INDEX IF NOT EXISTS idx_resolution_evidence_created_at ON resolution_evidence(created_at);

-- 3. Case Verifications Table
-- Separate from operational case lifecycle (case.status = 'RESOLVED', verification.status = 'PENDING')
CREATE TABLE IF NOT EXISTS case_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE INDEX IF NOT EXISTS idx_case_verifications_status ON case_verifications(status);
CREATE INDEX IF NOT EXISTS idx_case_verifications_cycle ON case_verifications(case_id, cycle_number);
