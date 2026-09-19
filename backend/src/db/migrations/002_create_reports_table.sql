-- CivicFlow Phase 2: Citizen Reports Schema
-- Migration 002: Create reports table with foreign key to users

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
    incident_id UUID, -- Nullable, reserved for future Phase 5 civic incident grouping
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for rapid lookup by reporter, status, and reported date
CREATE INDEX IF NOT EXISTS idx_reports_reporter_user_id ON reports(reporter_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_reported_at ON reports(reported_at);
