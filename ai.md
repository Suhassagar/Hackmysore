# AI Issue Understanding Engine (CivicFlow)

## Overview

In CivicFlow, Google Gemini is integrated to convert unstructured citizen problem descriptions and photo evidence into structured, validated civic problem intelligence.

---

## 1. Core Architectural Separation: Understanding vs. Routing

> [!IMPORTANT]
> **Gemini understands WHAT the civic problem is. Gemini NEVER decides WHO is responsible.**
>
> The architectural separation in CivicFlow is strictly maintained:
>
> ```text
> Citizen Report ──► [ AI Issue Understanding ] ──► WHAT is happening? (Category, Severity, Risks)
>                                                           │
>                                                           ▼
>                   [ Geospatial Engine ]       ──► WHERE is it happening? (GPS, Polygons, Boundaries)
>                                                           │
>                                                           ▼
>                   [ Responsibility Engine ]   ──► WHO is responsible? (MCC vs. Panchayat vs. Ward)
> ```
>
> Gemini is **never** asked to infer, predict, or assign government jurisdiction, municipal authority, or department ownership.

---

## 2. Inputs to Gemini (Data Minimization)

The backend sends only the minimal required problem evidence to Gemini:
- **Citizen Description**: Cleaned, trimmed problem text.
- **Citizen-Selected Category**: The category initially selected by the citizen.
- **Uploaded Image Evidence**: Base64 inline visual evidence (if attached).

### What is NEVER Sent
- Citizen name or email address
- Authentication tokens or passwords
- Database internal IDs
- Geolocation coordinates as an authority hint

---

## 3. Structured Output & Allowed Values

Gemini must return a strict JSON payload adhering to the following schema:

```json
{
  "category": "POTHOLE",
  "severity": "HIGH",
  "summary": "Large pothole creating road safety risk.",
  "riskFactors": [
    "Near school",
    "Two-wheeler safety risk"
  ],
  "confidence": 0.94
}
```

### Allowed Values
- **Category**: `POTHOLE`, `BLOCKED_DRAIN`, `GARBAGE_OVERFLOW`, `BROKEN_STREETLIGHT`, `ILLEGAL_DUMPING`, `OTHER`
- **Severity**: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- **Confidence**: Numeric float between `0.00` and `1.00`

---

## 4. Backend Schema Validation

Gemini output is **never blindly trusted**. The backend [`IssueUnderstandingService`](file:///d:/HackMysuru/backend/src/services/ai.js) validates the response:
- Rejects non-allowed categories (e.g. `MCC` $\rightarrow$ rejected).
- Rejects non-allowed severities (e.g. `EXTREME` $\rightarrow$ rejected).
- Rejects non-numeric confidence (e.g. `"very high"` $\rightarrow$ rejected) or out-of-range values ($> 1.0$).
- Enforces non-empty summaries and array of risk factors.

---

## 5. Confidence Handling & Human Review Threshold

AI confidence is treated as a decision-support metric rather than absolute truth:
- **Configurable Threshold**: `AI_CONFIDENCE_THRESHOLD` (default: `0.70`).
- **High Confidence ($\ge 0.70$)**: Analysis marked as `COMPLETED`.
- **Low Confidence ($< 0.70$)**: Analysis marked as `NEEDS_REVIEW`.
  - The UI displays an advisory: *"AI confidence is below 70%. This issue understanding requires human review."*

---

## 6. Failure Handling & Resilient Pipeline

- **Asynchronous Execution**: AI analysis runs asynchronously after the report is safely stored in PostgreSQL.
- **Outage Resilience**: A Gemini timeout, network error, or rate limit **never fails the citizen's report**. The report remains intact and visible, and the analysis status is marked as `FAILED` with the error logged.
- **Cost & Abuse Protection**: Re-analyzing a completed report by a citizen returns the cached analysis. Only administrators can force-reprocess existing analyses.

---

## 7. AI Disagreement & Evidence Preservation

When Gemini predicts a category different from the citizen's initial choice:
- The citizen's category is **never overwritten** and remains preserved in `reports.category`.
- Gemini's prediction is recorded in `report_ai_analysis.category`.
- Both are presented transparently side-by-side in the CivicFlow dashboard.
