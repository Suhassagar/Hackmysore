# CivicFlow System Limitations & Phase 4 Scope

This document outlines intentional architectural boundaries, current prototype limitations, and non-goals for Phase 4.

---

## 1. AI Issue Understanding Boundaries (Phase 3)

- **Decision Support Only**:
  Gemini is used purely to provide structured insights into the nature of the physical problem (e.g. classifying category, estimating severity, and identifying risk factors). AI outputs are treated as suggestions, not unquestionable facts.
- **Confidence Caveats**:
  A high confidence score does not represent mathematical certainty. Reports with confidence $< 0.70$ are flagged as `NEEDS_REVIEW` and require human administrative verification.
- **Strict Prohibition Against Authority Decisions**:
  Gemini is strictly prohibited from inferring whether Mysore City Corporation (MCC) or a Gram Panchayat owns the problem.

---

## 2. Geospatial & Dynamic Jurisdiction Engine Boundaries (Phase 4)

- **Spatial Coverage vs. Legal Responsibility**:
  Phase 4 deterministically determines **WHERE** the incident is located (which administrative jurisdiction polygon spatially covers the point at the report timestamp). It intentionally does **NOT** determine **WHO** is responsible (which department or authority owns the case). Responsibility rules (e.g., MCC vs. Panchayat department routing) are the explicit scope of Phase 5.
- **Synthetic Test Dataset**:
  The jurisdiction polygons in `backend/src/data/fixtures/mysuru_jurisdictions.geojson` are synthetic development fixtures created to model Ward 42, Town Panchayats, Gram Panchayats, boundary changes over time, and overlapping boundary disputes. They do not represent official government land survey records.
- **Immutability of Historical Snapshots**:
  Once a report's jurisdiction is resolved and snapshotted in `report_jurisdiction`, it represents an immutable historical record of where the incident was located under the boundary version active at report time. It is not retroactively rewritten when new boundary versions take effect in the future.

---

## 3. Dynamic Civic Responsibility Rule Engine Boundaries (Phase 5)

- **Rules as Data, Not Application Code**:
  Responsibility rules are defined as versioned data rows in the `responsibility_rules` table, linking normalized foreign keys (`jurisdiction_id`, `authority_id`, `department_id`, `issue_category`, `valid_from`, `valid_until`, `priority`). Application logic merely evaluates this data; it never hard-codes "Ward 42 = MCC".
- **Strict Prohibition Against Gemini Deciding Authority**:
  The system strictly enforces separation of concerns: Gemini understands **WHAT** happened; PostGIS determines **WHERE** it happened; the versioned Rule Engine determines **WHO** is responsible. Gemini never assigns department ownership.
- **Refusal to Guess Arbitrarily on Gaps or Conflicts**:
  When no rule matches an issue category in a jurisdiction, or when competing authorities claim jurisdiction with equal priority, the system does not fall back to an arbitrary default. It deterministically flags `NO_RESPONSIBLE_RULE` or `RESPONSIBILITY_CONFLICT` with `requires_review: true` for administrative adjudication.
- **AI Uncertainty Interlock**:
  If AI understanding confidence is below threshold (<0.70) or marked `NEEDS_REVIEW`, routing is flagged as `NEEDS_REVIEW` with `requires_review: true`, requiring human confirmation prior to dispatch.

---

## 4. Routing Confidence & Human Review System (Phase 6)

- **AI Confidence vs Routing Certainty**:
  AI confidence measures only model certainty about *what* the problem is (e.g. 0.92 confidence that a photo depicts a pothole). It has zero correlation with administrative authority or jurisdictional certainty. A report with 0.99 AI confidence will still be routed to `NEEDS_REVIEW` if it falls in an overlapping spatial boundary or lacks a responsibility rule.
- **Why the System Refuses to Guess**:
  Guessing administrative authority in ambiguous civic incidents causes inter-agency ping-pong, citizen frustration, and delayed remediation. The system deterministically routes when exactly one authority is unambiguously responsible, and escalates to human adjudication the moment any ambiguity or conflict appears.
- **Reviewer Impersonation Protections**:
  Reviewer credentials are authenticated strictly from the server session token (`req.user.id`). No client-supplied reviewer identities or arbitrary role overrides are honored.
- **Audit Immutability**:
  Staff review actions never destroy or mutate the original automatic decision history. Both original and final decisions remain preserved in perpetuity for municipal audit compliance.

---

---

## 5. Staff Case Workflow & Lifecycle Boundaries (Phase 7)

- **RESOLVED Is NOT Equivalent to VERIFIED**:
  Marking a case `RESOLVED` in Phase 7 indicates strictly that an authorized staff member *claims* the physical work is complete. The system intentionally does **NOT** mark the case `CLOSED` automatically, nor does it guarantee physical remediation. Independent resolution verification (multimodal image verification, GPS match at site, and citizen dispute periods) is explicitly deferred to Phase 8.
- **Controlled State Machine**:
  State transitions are strictly linear and server-enforced (`UNASSIGNED ──► ASSIGNED ──► ACKNOWLEDGED ──► IN_PROGRESS ──► RESOLVED ──► CLOSED`). Direct shortcuts (e.g., `ASSIGNED ──► RESOLVED` or `RESOLVED ──► IN_PROGRESS`) are rejected. Resuming work after an `ON_HOLD` pause requires structured validation.
- **Audit Immutability**:
  All operational actions write an append-only event into `case_events`. Events can never be modified or deleted by users or staff. Corrections require appending new audit events.
- **Lean Organizational Scoping**:
  Staff-to-department membership is modeled cleanly via `authority_id` and `department_id` on user records without bloating into a complex enterprise hierarchy management system.

---

---

## 6. Resolution Verification Boundaries (Phase 8)

- **Citizen as Verification Authority**:
  The system strictly enforces that only the citizen who created the original civic problem report has the authority to independently confirm (`VERIFIED`) or challenge (`DISPUTED`) the resolution claim. Municipal staff cannot mark resolutions verified on behalf of citizens.
- **Controlled Reopen Bound**:
  A dispute by a citizen does not cause infinite cyclic churn. A disputed resolution returns the case to `IN_PROGRESS` under the same case number and emits an immutable `CASE_REOPENED` audit event, incrementing the verification cycle counter for full accountability.
- **Photographic Evidence Is Supportive, Not Absolute**:
  Resolution photos submitted by field staff provide auditable proof of work for citizen review. However, visual photo evidence does not supersede physical reality (e.g. an improperly compacted pothole that sinks after rain). The affected citizen's on-the-ground confirmation remains the definitive verification gate.
- **Advisory Nature of AI**:
  While AI provides issue classification in earlier phases, the Phase 8 resolution verification standard relies on human accountability: municipal staff operational responsibility vs. citizen physical verification.

---

## 7. Deferred Capabilities (Non-Goals for Phase 8)

The following capabilities belong to future enhancement roadmaps:

1. **Automated SLA Management & Escalation Timers**:
   Turnaround countdown timers, overdue alerts, and hierarchical administrative escalation.
2. **Duplicate Detection & Incident Clustering**:
   Spatial and semantic grouping of multiple citizen submissions into a single consolidated operational case.
3. **Notifications & Multi-Channel Alerts**:
   Email, WhatsApp, or SMS updates sent to citizens and field staff upon status changes.
4. **Offline Support & Mobile Sync**:
   Field worker offline caching and sync for intermittent rural connectivity.
5. **Analytics Dashboards & Performance Heatmaps**:
   Authority-wide SLA metrics, ward-level resolution times, and departmental responsiveness rankings.


