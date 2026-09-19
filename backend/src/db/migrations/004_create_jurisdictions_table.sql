-- CivicFlow Phase 4: Geospatial & Dynamic Jurisdiction Schema
-- Migration 004: PostGIS setup, temporal boundaries, and historical report snapshots

CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Base Jurisdictions Table (Identity and Type)
CREATE TABLE IF NOT EXISTS jurisdictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- 2. Versioned Boundaries Table (Temporal Spatial Polygons)
CREATE TABLE IF NOT EXISTS jurisdiction_boundaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jurisdiction_id UUID NOT NULL REFERENCES jurisdictions(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    geometry GEOMETRY(Polygon, 4326) NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ, -- NULL denotes currently active version
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GiST Spatial Index for high-performance spatial point-in-polygon queries
CREATE INDEX IF NOT EXISTS idx_jurisdiction_boundaries_geom ON jurisdiction_boundaries USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_jurisdiction_boundaries_temporal ON jurisdiction_boundaries (valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_jurisdiction_boundaries_jur_version ON jurisdiction_boundaries (jurisdiction_id, version);

-- 3. Historical Report Jurisdiction Snapshots (Audit and Immutability)
CREATE TABLE IF NOT EXISTS report_jurisdiction (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE INDEX IF NOT EXISTS idx_report_jurisdiction_status ON report_jurisdiction (match_status);
