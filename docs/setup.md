# CivicFlow Setup & Running Guide (Phase 3)

This document provides instructions for setting up, configuring, and running CivicFlow with Phase 3 Google Gemini AI Issue Understanding.

---

## 1. Prerequisites

- **Node.js**: v18+ (tested on Node v24)
- **npm**: v9+
- **PostgreSQL** (Optional for local testing; backend automatically falls back to an embedded in-memory datastore if PostgreSQL is not active)
- **Google Gemini API Key** (Optional; an intelligent local semantic rule engine fallback is active if no key is provided)

---

## 2. Environment Configuration

### Backend (`backend/.env`)

```env
PORT=5000
NODE_ENV=development

# PostgreSQL Connection String
DATABASE_URL=postgres://postgres:postgres@localhost:5432/civicflow

# JWT Secret for Dev & Fallback Verification
JWT_SECRET=civicflow-hackmysuru-dev-secret-key-phase1-2026

# Google Gemini Configuration (Phase 3)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
AI_CONFIDENCE_THRESHOLD=0.70
```

---

## 3. Database Migration

To apply all schema migrations against live PostgreSQL:

```bash
cd backend
npm run migrate
```
Applies:
- `001_create_users_table.sql`
- `002_create_reports_table.sql`
- `003_create_report_ai_analysis_table.sql`
- `004_create_jurisdictions_table.sql` (PostGIS extension, jurisdictions, versioned boundaries, snapshots)
- `005_create_responsibility_rules_table.sql` (authorities, departments, responsibility_rules, report_routing snapshots)

### Seeding Synthetic Jurisdiction Boundaries & Responsibility Rules
```bash
cd backend
# Seed PostGIS Boundaries:
npm run seed:jurisdictions
# or: node src/scripts/seed_jurisdictions.js

# Seed Responsibility Rules & Authorities:
npm run seed:rules
# or: node src/scripts/seed_responsibility_rules.js
```
*(Note: When running without live PostgreSQL, the in-memory fallback store automatically pre-seeds all 7 synthetic boundaries and 12 responsibility rules upon startup).*

---

## 4. Running the Application

### Running Backend (Port 5000)
```bash
cd backend
npm start
```

### Running Frontend (Port 3000)
```bash
cd frontend
npm run dev
```

---

## 5. Automated Verification Suites

```bash
cd backend

# Phase 1: Authentication & RBAC Test Suite (19 tests)
node src/scripts/verify_phase1.js

# Phase 2: Citizen Reporting & IDOR Test Suite (20 tests)
node src/scripts/verify_phase2.js

# Phase 3: AI Issue Understanding & Schema Test Suite (25 tests)
node src/scripts/verify_phase3.js

# Phase 4: Geospatial & Dynamic Jurisdiction Engine (15 tests)
node src/scripts/verify_phase4.js

# Phase 5: Dynamic Civic Responsibility Rule Engine (47 tests)
node src/scripts/verify_phase5.js
```

