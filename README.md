# CivicFlow — Unified Civic Incident & Accountability Platform

**HackMysuru 1.0 Project**

> **Core Principle**: ONE CIVIC INCIDENT → ONE RESPONSIBLE CASE → ONE AUDITABLE JOURNEY

Citizens should be able to report civic problems across Mysuru without needing to know whether Mysore City Corporation (MCC), a Town Panchayat, or a Gram Panchayat is responsible. CivicFlow deterministically resolves spatial jurisdictions, classifies issues with AI decision support, and maintains an auditable lifecycle.

---

## Current Status: Phase 7 Completed
 
 - [x] **Phase 0 — Project Foundation**: Express backend, PostgreSQL database, React + Vite frontend, design system.
 - [x] **Phase 1 — Authentication + Role-Based Access Control (RBAC)**: Strict role separation (`CITIZEN`, `STAFF`, `ADMIN`), secure JWT/Firebase tokens, IDOR protections, 19/19 automated tests passed.
 - [x] **Phase 2 — Citizen Civic Report Creation**: 5-step guided reporting flow, category validation, GPS coordinates & accuracy capture, media storage with magic byte inspection, 20/20 automated tests passed.
 - [x] **Phase 3 — AI Issue Understanding Engine**: Google Gemini multimodal analysis (`gemini-3.6-flash`), strict output validation schema, confidence thresholding ($< 0.70 \rightarrow$ `NEEDS_REVIEW`), offline semantic engine fallback, 25/25 automated tests passed.
 - [x] **Phase 4 — Geospatial + Dynamic Jurisdiction Engine**: PostGIS spatial queries (`ST_Covers`, SRID 4326), temporal boundary versioning (`valid_from`, `valid_until`), deterministic 3-case resolution (`MATCHED`, `NO_JURISDICTION_MATCH`, `JURISDICTION_CONFLICT`), immutable `report_jurisdiction` historical snapshots, 15/15 automated tests passed.
 - [x] **Phase 5 — Dynamic Civic Responsibility Rule Engine**: Data-driven versioned rules (`authorities`, `departments`, `responsibility_rules`), deterministic 3-case resolution (`ROUTED`, `NO_RESPONSIBLE_RULE`, `RESPONSIBILITY_CONFLICT`) + AI uncertainty handling (`NEEDS_REVIEW`), immutable `report_routing` historical snapshots with auditable explainability trace, 47/47 automated tests passed.
 - [x] **Phase 6 — Routing Confidence & Human Review System**: Deterministic routing confidence evaluation (`RoutingAssessmentService`), state model (`AUTO_ROUTED`, `NEEDS_REVIEW`, `REVIEWED`, `ROUTING_FAILED`), structured review reasons, human review adjudication API with idempotency & audit preservation (`routing_reviews`), Staff Review Queue & Adjudication modal, 40/40 automated tests passed.
 - [x] **Phase 7 — Staff Case Workflow + Follow-Through**: Operational case lifecycle (`civic_cases`), human-friendly case numbers (`CIV-YYYY-XXXXXX`), backend-enforced state transitions (`UNASSIGNED` $\rightarrow$ `ASSIGNED` $\rightarrow$ `ACKNOWLEDGED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `RESOLVED`), immutable audit events (`case_events`), department-scoped staff assignment, operational notes, Staff Dashboard & Case Detail workspace, Citizen 5-stage stepper & timeline, 54/54 automated tests passed (220/220 across all phases).

---

## Architecture & Operational Lifecycle

```text
    Citizen Report
         |
         v
    AI Issue Understanding (Gemini)
         |
         v
    Jurisdiction (PostGIS ST_Covers)
         |
         v
    Responsibility Rule Engine
         |
         v
    Routing Assessment
      /          \
     /            \
AUTO_ROUTED    NEEDS_REVIEW
     |              |
     |              v
     |        Human Review (Approve / Override)
     |              |
     +-------+------+
             |
             v
        Operational Case Created (CIV-2026-XXXXXX)
             |
             v
          ASSIGNED
             |
             v
       ACKNOWLEDGED
             |
             v
        IN_PROGRESS <---> ON_HOLD (structured reason)
             |
             v
         RESOLVED (staff claim - pending Phase 8 verification)
             |
             v
          [CLOSED]
```

---

## Quick Start

### 1. Prerequisites
- Node.js 18+ (tested on v24)
- npm 9+

### 2. Backend Setup
```bash
cd backend
npm install
npm start
# Runs on http://localhost:5000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

### 4. Running Verification Test Suites
```bash
cd backend

node src/scripts/verify_phase1.js   # 19/19 PASS
node src/scripts/verify_phase2.js   # 20/20 PASS
node src/scripts/verify_phase3.js   # 25/25 PASS
node src/scripts/verify_phase4.js   # 15/15 PASS
node src/scripts/verify_phase5.js   # 47/47 PASS
node src/scripts/verify_phase6.js   # 40/40 PASS
node src/scripts/verify_phase7.js   # 54/54 PASS (All 18 Section 26 Requirements)
node src/scripts/demo_phase7.js     # 12-step complete demo scenario PASS
```

---

## Documentation
- [Architecture Specification](file:///d:/HackMysuru/docs/architecture.md)
- [Setup & Running Guide](file:///d:/HackMysuru/docs/setup.md)
- [System Limitations & Phase Boundaries](file:///d:/HackMysuru/docs/limitations.md)

