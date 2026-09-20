-- CivicFlow Phase 3B: HackMysuru Critical Gaps
-- Migration 010: Idempotency Key, Photo Metadata, and Spatiotemporal Incident Clustering

-- 1. Reports table extensions for idempotency and photo authenticity
ALTER TABLE reports ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS photo_status VARCHAR(50) NOT NULL DEFAULT 'VALID_NO_METADATA';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS photo_metadata JSONB DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_idempotency_key ON reports (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_photo_status ON reports (photo_status);
CREATE INDEX IF NOT EXISTS idx_reports_incident_id ON reports (incident_id);

-- 2. Incidents Table for Spatiotemporal Duplicate Clustering
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(50) NOT NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'MERGED', 'RESOLVED', 'CLOSED')),
    first_reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    report_count INT NOT NULL DEFAULT 1,
    primary_report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_category ON incidents (category);
CREATE INDEX IF NOT EXISTS idx_incidents_coords ON incidents (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_incidents_time ON incidents (first_reported_at, last_reported_at);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents (status);

-- 3. Extend case_events event_type CHECK constraint for duplicate clustering audit events
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
    'CASE_REOPENED',
    'DUPLICATE_REPORT_LINKED'
));
ALTER TABLE case_events ALTER COLUMN actor_user_id DROP NOT NULL;
