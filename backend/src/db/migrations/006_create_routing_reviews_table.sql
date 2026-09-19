-- Migration 006: Create Routing Reviews Table and Phase 6 Schema Extensions
-- HackMysuru 1.0: Phase 6 — Routing Confidence + Human Review System

-- 1. Extend report_routing table with Phase 6 confidence & review fields
ALTER TABLE report_routing ADD COLUMN IF NOT EXISTS routing_status VARCHAR(50) DEFAULT 'PENDING' CHECK (routing_status IN (
    'PENDING',
    'AUTO_ROUTED',
    'NEEDS_REVIEW',
    'REVIEWED',
    'ROUTING_FAILED'
));

ALTER TABLE report_routing ADD COLUMN IF NOT EXISTS review_reasons JSONB DEFAULT '[]'::jsonb;
ALTER TABLE report_routing ADD COLUMN IF NOT EXISTS decision_source VARCHAR(50) DEFAULT 'AUTOMATIC' CHECK (decision_source IN (
    'AUTOMATIC',
    'HUMAN_REVIEW'
));

ALTER TABLE report_routing ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);
ALTER TABLE report_routing ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE report_routing ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE report_routing ADD COLUMN IF NOT EXISTS final_authority_id UUID REFERENCES authorities(id);
ALTER TABLE report_routing ADD COLUMN IF NOT EXISTS final_department_id UUID REFERENCES departments(id);

CREATE INDEX IF NOT EXISTS idx_report_routing_routing_status ON report_routing (routing_status);
CREATE INDEX IF NOT EXISTS idx_report_routing_decision_source ON report_routing (decision_source);
CREATE INDEX IF NOT EXISTS idx_report_routing_reviewed_at ON report_routing (reviewed_at);

-- 2. Create routing_reviews audit table
-- Strictly preserves original automated route and records every staff/admin intervention
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
CREATE INDEX IF NOT EXISTS idx_routing_reviews_date ON routing_reviews (reviewed_at);
