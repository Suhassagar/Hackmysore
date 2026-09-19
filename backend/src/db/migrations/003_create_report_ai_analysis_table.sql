-- CivicFlow Phase 3: AI Issue Understanding Schema
-- Migration 003: Create report_ai_analysis table

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
