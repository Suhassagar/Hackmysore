# CivicFlow — Unified Civic Incident & Accountability Platform

**HackMysuru 1.0 Project**

> **Core Principle**: ONE CIVIC INCIDENT → ONE RESPONSIBLE CASE → ONE AUDITABLE JOURNEY  
> **Resolution Mandate**: AUTOMATION HANDLES THE CLEAR • PEOPLE HANDLE THE UNCERTAIN • RESOLVED ≠ VERIFIED

Citizens should be able to report civic problems across Mysuru without needing to know whether Mysore City Corporation (MCC), a Town Panchayat, or a Gram Panchayat is responsible. CivicFlow deterministically resolves spatial jurisdictions, classifies issues with AI decision support, routes to responsible authorities, guides staff follow-through, and empowers citizens to independently verify or dispute resolutions.

---

## Complete Project Status: Phase 0 through Phase 8 Completed

- [x] **Phase 0 — Foundation**: Node.js Express backend, PostgreSQL 18 with native JSONB GeoJSON spatial engine, React 18 + Vite frontend, responsive civic design system.
- [x] **Phase 1 — Authentication + Role-Based Access Control (RBAC)**: Strict role separation (`CITIZEN`, `STAFF`, `ADMIN`), secure JWT / Firebase token validation, IDOR protection, 19/19 automated tests passed.
- [x] **Phase 2 — Citizen Civic Report Creation**: 5-step guided reporting flow, category validation, GPS coordinates & accuracy capture, magic byte file inspection, 20/20 automated tests passed.
- [x] **Phase 3 — AI Issue Understanding Engine**: Google Gemini multimodal analysis (`gemini-3.6-flash`), strict JSON schema validation, confidence thresholding ($< 0.70 \rightarrow$ `NEEDS_REVIEW`), offline deterministic semantic engine fallback, 25/25 automated tests passed.
- [x] **Phase 3B — Critical Gap Implementation**:
  - Offline report queue with UUIDv4 `X-Idempotency-Key` replay protection.
  - Multi-citizen spatiotemporal duplicate incident clustering ($50\text{m}$ radius, $48\text{h}$ temporal window).
  - Deterministic abusive text moderation engine with civic criticism protection (permits legitimate criticism of municipal administration while blocking abusive content).
  - Pure-JS photo EXIF GPS extraction with location mismatch detection ($> 500\text{m} \rightarrow$ `PHOTO_LOCATION_MISMATCH` routing review flag).
  - 10/10 automated tests passed.
- [x] **Phase 4 — Geospatial + Dynamic Jurisdiction Engine**: PostGIS spatial queries (`ST_Covers`, SRID 4326) and native PostgreSQL GeoJSON ray-casting engine, temporal boundary versioning (`valid_from`, `valid_until`), deterministic 3-case resolution (`MATCHED`, `NO_JURISDICTION_MATCH`, `JURISDICTION_CONFLICT`), immutable `report_jurisdiction` historical snapshots, 15/15 automated tests passed.
- [x] **Phase 5 — Dynamic Civic Responsibility Rule Engine**: Data-driven versioned rules (`authorities`, `departments`, `responsibility_rules`), deterministic 3-case resolution (`ROUTED`, `NO_RESPONSIBLE_RULE`, `RESPONSIBILITY_CONFLICT`) + AI uncertainty handling (`NEEDS_REVIEW`), immutable `report_routing` historical snapshots with auditable explainability trace, 47/47 automated tests passed.
- [x] **Phase 6 — Routing Confidence & Human Review System**: Deterministic routing confidence evaluation (`RoutingAssessmentService`), state model (`AUTO_ROUTED`, `NEEDS_REVIEW`, `REVIEWED`, `ROUTING_FAILED`), structured review reasons, human review adjudication API with idempotency & audit preservation (`routing_reviews`), Staff Review Queue & Adjudication modal (Approve / Override with mandatory reason), 40/40 automated tests passed.
- [x] **Phase 7 — Staff Case Workflow + Follow-Through**: Operational case lifecycle (`civic_cases`), human-friendly case numbers (`CIV-YYYY-XXXXXX`), backend-enforced state transitions (`UNASSIGNED` $\rightarrow$ `ASSIGNED` $\rightarrow$ `ACKNOWLEDGED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `RESOLVED`), immutable audit events (`case_events`), department-scoped staff assignment, operational notes, Staff Dashboard & Case Detail workspace, Citizen 5-stage stepper & timeline, 54/54 automated tests passed.
- [x] **Phase 8 — Resolution Verification & Citizen Dispute Lifecycle**:
  - `RESOLVED ≠ VERIFIED` principle: Staff mark case as `RESOLVED` with mandatory physical remediation note and optional photo evidence.
  - Affected citizen verification flow: 1-click **Confirm Resolution** $\rightarrow$ `VERIFIED`.
  - Citizen dispute flow: **Dispute Resolution** with mandatory dispute reason $\rightarrow$ `DISPUTED`.
  - Authorized department staff can **Reopen Disputed Case** $\rightarrow$ `IN_PROGRESS` under the same original case number and audit timeline.
  - 15/15 automated tests passed.

**Total Automated Test Coverage: 245+ automated verification tests passing across all phases.**

---

## End-to-End Operational Lifecycle

```text
    Citizen Report (GPS + Category + Photo + Offline Queue)
                            |
                            v
       AI Issue Understanding (Gemini Flash / Fallback)
                            |
                            v
      Geospatial Engine (PostgreSQL GeoJSON Boundaries)
                            |
                            v
       Responsibility Rules Engine (Who is responsible?)
                            |
                            v
                     Routing Confidence
                   /                    \
     (High Confidence)                (Uncertain / Boundary Conflict)
           |                                     |
           v                                     v
      AUTO_ROUTED                       NEEDS_REVIEW Queue
           |                                     |
           |                            Human Adjudication
           |                            (Approve or Override)
           \                                     /
            +-----------------+-----------------+
                              |
                              v
                   Civic Case Created (CIV-2026-XXXXXX)
                              |
                              v
                    ASSIGNED (Department Staff)
                              |
                              v
                         ACKNOWLEDGED
                              |
                              v
           IN_PROGRESS <-------------> ON_HOLD (Material/Weather/Access)
                  |
                  v
         RESOLVED (Staff claim + Mandatory Remediation Note + Photo Evidence)
                  |
                  v
         Citizen Verification Cycle (RESOLVED ≠ VERIFIED)
               /                      \
        (Citizen Satisfied)     (Citizen Unsatisfied)
              |                               |
              v                               v
           VERIFIED                        DISPUTED
              |                               |
              v                               v
            CLOSED             Reopened by Staff to IN_PROGRESS
                               (Under same case number & audit trail)
```

---

## Default Pre-Seeded Accounts

| Role | Email | Password | Access / Capabilities |
| :--- | :--- | :--- | :--- |
| **Citizen** | `citizen@mysuru.civicflow.in` | `CivicFlow@2026` | Report civic issues, track personal reports, verify or dispute resolutions |
| **Staff** | `staff@mysuru.civicflow.in` | `CivicFlow@2026` | Operations dashboard, review queue adjudication, case assignment, mark resolved |
| **Admin** | `admin@mysuru.civicflow.in` | `CivicFlow@2026` | Full platform visibility, cross-department operations, system audit log |

---

## Quick Start & Local Execution

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v20 & v24)
- **PostgreSQL**: PostgreSQL 14+ (tested on PostgreSQL 18, port 5432)

### 2. Backend Setup
```bash
cd backend
npm install
npm start
# API starts on http://localhost:5000
# Health check: http://localhost:5000/api/health
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Vite dev server runs on http://localhost:3000
```

### 4. Running Automated Verification Test Suites
```bash
cd backend

# Phase 1: Authentication & Strict RBAC (19 tests)
node src/scripts/verify_phase1.js

# Phase 2: Citizen Reports & Location Capture (20 tests)
node src/scripts/verify_phase2.js

# Phase 3: Gemini AI Issue Understanding (25 tests)
node src/scripts/verify_phase3.js

# Phase 3B: Idempotency, Clustering, Moderation & EXIF (10 tests)
node src/scripts/verify_phase3b.js

# Phase 4: Geospatial & Jurisdiction Engine (15 tests)
node src/scripts/verify_phase4.js

# Phase 5: Civic Responsibility Rule Engine (47 tests)
node src/scripts/verify_phase5.js

# Phase 6: Routing Confidence & Human Review (40 tests)
node src/scripts/verify_phase6.js

# Phase 7: Staff Operations & Case Lifecycle (54 tests)
node src/scripts/verify_phase7.js

# Phase 8: Resolution Verification & Citizen Dispute (15 tests)
node src/scripts/verify_phase8.js

# Phase 8 End-to-End Live Demonstration Scenario:
node src/scripts/demo_phase8.js
```

---

## Project Structure

```text
HackMysuru/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js                # PostgreSQL connection & geospatial query engine
│   │   │   └── firebase.js          # Firebase Admin SDK initialization
│   │   ├── db/
│   │   │   ├── migrations/          # SQL migrations 001 through 008
│   │   │   └── seeds/               # Mysuru jurisdictions & responsibility rules
│   │   ├── middleware/              # requireAuth, requireRole, idempotencyKey
│   │   ├── routes/
│   │   │   ├── auth.js              # Register, login, dev-login, role verification
│   │   │   ├── reports.js           # Citizen report creation, duplicate clustering, EXIF
│   │   │   └── staff.js             # Routing review queue, cases, status transitions, verification
│   │   ├── services/
│   │   │   ├── aiService.js         # Gemini 3.6 multimodal analysis & semantic fallback
│   │   │   ├── caseService.js       # Case state machine, immutable audit events
│   │   │   ├── duplicateClusteringService.js # 50m / 48h spatiotemporal clustering
│   │   │   ├── exifValidationService.js      # Pure-JS EXIF GPS validation
│   │   │   ├── moderationService.js          # Abusive text filter with criticism protection
│   │   │   ├── offlineQueueService.js        # Offline report queue replay handler
│   │   │   ├── routingAssessmentService.js   # Confidence scoring & review gating
│   │   │   └── spatialEngine.js              # Native GeoJSON ray-casting engine
│   │   ├── scripts/                 # Verification suites (Phase 1-8) & demo scenarios
│   │   └── server.js                # Express entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ErrorBoundary.jsx    # Catches runtime render errors gracefully
│   │   │   ├── Navbar.jsx           # Role-aware nav with dev role toggle
│   │   │   ├── ProtectedRoute.jsx   # Role guards with redirection & dev helper
│   │   │   ├── RoleBadge.jsx        # Standardized badge styling
│   │   │   └── StaffDashboard.jsx   # Operations dashboard & metric counters
│   │   ├── pages/
│   │   │   ├── CaseDetail.jsx       # Operational case workspace, notes & resolution modal
│   │   │   ├── Dashboard.jsx        # Citizen home dashboard
│   │   │   ├── Login.jsx            # Sign in with redirect preservation & 1-click dev credentials
│   │   │   ├── MyReports.jsx        # Citizen tracked incident portfolio
│   │   │   ├── ReportDetail.jsx     # Citizen 5-stage tracker, timeline, verify/dispute cards
│   │   │   ├── ReportIssue.jsx      # Citizen 5-step report wizard with GPS capture
│   │   │   ├── ReviewQueue.jsx      # Staff human routing review queue & adjudication
│   │   │   └── StaffCases.jsx       # Staff case list with active / attention / my-cases filters
│   │   ├── services/
│   │   │   └── api.js               # Typed client API requests
│   │   └── App.jsx                  # Application routing & layout
│   └── package.json
└── docs/
    ├── architecture.md              # Technical architecture specification
    ├── limitations.md               # Safety boundaries & design decisions
    └── setup.md                     # Detailed environment setup guide
```

---

## Safety & Governance Principles

1. **Automation Handles the Clear • People Handle the Uncertain**:
   - High-confidence spatial matches with clear responsibility rules automatically transition into operational cases.
   - Any jurisdictional conflict, rule competition, low AI confidence ($< 0.70$), or photo-location discrepancy ($> 500\text{m}$) is automatically quarantined into the **Human Routing Review Queue**.

2. **Refusal to Guess**:
   - If an incident falls outside designated municipal boundaries or matches overlapping charters, CivicFlow refuses to make a guess. It escalates to human staff with full evidence signals.

3. **Resolved ≠ Verified**:
   - Department staff marking an issue as resolved is formally treated as a **staff claim of physical remediation**.
   - True closure (`VERIFIED`) is exclusively in the hands of the affected citizen. If dissatisfied, the citizen can dispute the claim, immediately reopening the case for follow-through.

4. **Immutable Audit Trail**:
   - Every status transition, note, assignment, routing adjudication, and citizen verification is permanently committed as an immutable chronological case event.
