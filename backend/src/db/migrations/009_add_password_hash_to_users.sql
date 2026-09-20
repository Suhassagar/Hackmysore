-- CivicFlow Stage 1: Production-Like Authentication
-- Migration 009: Add password_hash column to users table

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
