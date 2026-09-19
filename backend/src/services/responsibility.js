const { db } = require('../config/db');
const jurisdictionService = require('./jurisdiction');
const routingAssessmentService = require('./routingAssessment');

/**
 * Phase 5: Dynamic Civic Responsibility Rule Engine Service
 * 
 * Core responsibilities:
 * - Deterministically evaluate WHO (Authority + Department) is responsible for a civic report.
 * - Inputs:
 *     1. Issue type (Category from AI Analysis or Citizen Report Submission)
 *     2. Jurisdiction determined by Phase 4 PostGIS/Spatial engine
 *     3. Report timestamp (strictly respects temporal validity of rules)
 *     4. AI uncertainty status (if AI is uncertain, flags NEEDS_REVIEW)
 * 
 * - Handles 3 Resolution Outcomes + AI Uncertainty:
 *     Case A: Exactly 1 valid rule -> ROUTED (requires_review: false)
 *     Case B: 0 valid rules -> NO_RESPONSIBLE_RULE (requires_review: true)
 *     Case C: Multiple competing rules with equal priority -> RESPONSIBILITY_CONFLICT (requires_review: true)
 *     Case D: AI confidence < 0.70 / status NEEDS_REVIEW -> NEEDS_REVIEW (requires_review: true)
 * 
 * - Records immutable historical snapshot in report_routing table.
 * 
 * Non-goals:
 * - Gemini NEVER decides authority or department.
 * - Rules are stored as versioned data, NOT hardcoded if/else statements.
 */
class ResponsibilityService {
  /**
   * Deterministically evaluate responsible authority and department.
   * 
   * @param {Object} jurisdiction - Jurisdiction object or snapshot
   * @param {string} issueCategory - Civic category (e.g. 'POTHOLE', 'BLOCKED_DRAIN')
   * @param {Date|string} reportTime - Incident report timestamp
   * @param {Object|null} aiAnalysis - Optional AI analysis object
   * @returns {Promise<Object>} Resolution outcome
   */
  async resolveResponsibility(jurisdiction, issueCategory, reportTime = new Date(), aiAnalysis = null) {
    const normCategory = (issueCategory || '').trim().toUpperCase();
    let targetTime = reportTime instanceof Date ? reportTime : new Date(reportTime);
    if (isNaN(targetTime.getTime())) {
      targetTime = new Date();
    }

    const jurisdictionId = jurisdiction?.jurisdiction_id || jurisdiction?.jurisdictionId || jurisdiction?.id || null;
    const jurisdictionCode = jurisdiction?.jurisdiction_code || jurisdiction?.jurisdictionCode || jurisdiction?.code || 'UNKNOWN';
    const jurisdictionName = jurisdiction?.jurisdiction_name || jurisdiction?.jurisdictionName || jurisdiction?.name || 'Unknown Zone';
    const boundaryVersion = jurisdiction?.jurisdiction_version || jurisdiction?.boundaryVersion || jurisdiction?.version || 'N/A';
    const jurisdictionStatus = jurisdiction?.match_status || jurisdiction?.matchStatus || (jurisdictionId ? 'MATCHED' : 'NO_JURISDICTION');

    // If jurisdiction is missing or in conflict, we cannot match authority
    if (!jurisdictionId || jurisdictionStatus !== 'MATCHED') {
      return {
        route_status: 'NO_RESPONSIBLE_RULE',
        requires_review: true,
        authority: null,
        department: null,
        responsibility_rule_id: null,
        candidate_rules: [],
        match_method: 'NO_JURISDICTION',
        explanation: `No valid administrative jurisdiction resolved for this report location at ${targetTime.toISOString()} (Status: ${jurisdictionStatus}). Civic responsibility cannot be determined.`,
      };
    }

    // Query active rules from database / fallback store matching jurisdiction, category, and report timestamp
    const matchingRules = await db.findApplicableRules(jurisdictionId, normCategory, targetTime);
    const matchMethod = db.isConnected ? 'DATABASE_RULE_EVALUATION' : 'IN_MEMORY_RULE_EVALUATION';

    // Case B: No matching rules found
    if (!matchingRules || matchingRules.length === 0) {
      return {
        route_status: 'NO_RESPONSIBLE_RULE',
        requires_review: true,
        authority: null,
        department: null,
        responsibility_rule_id: null,
        candidate_rules: [],
        match_method: matchMethod,
        explanation: `WHAT: ${normCategory} | WHERE: ${jurisdictionName} (${jurisdictionCode}) | JURISDICTION VERSION: ${boundaryVersion} | RESULT: No active responsibility rule found for category '${normCategory}' in '${jurisdictionName}' as of ${targetTime.toISOString()}. Flagged for administrative allocation.`,
      };
    }

    // Check for highest priority rule
    const maxPriority = matchingRules[0].priority;
    const topRules = matchingRules.filter((r) => r.priority === maxPriority);

    // Case C: Multiple competing rules with identical priority -> Responsibility Conflict
    if (topRules.length > 1) {
      const candidates = topRules.map((r) => ({
        rule_id: r.id,
        rule_version: r.version,
        priority: r.priority,
        authority_id: r.authority_id,
        authority_code: r.authority_code,
        authority_name: r.authority_name,
        authority_type: r.authority_type,
        department_id: r.department_id,
        department_code: r.department_code,
        department_name: r.department_name,
      }));

      const candidateSummary = candidates
        .map((c) => `${c.authority_name} [${c.department_name}] (Rule: ${c.rule_version})`)
        .join(', ');

      return {
        route_status: 'RESPONSIBILITY_CONFLICT',
        requires_review: true,
        authority: null,
        department: null,
        responsibility_rule_id: null,
        candidate_rules: candidates,
        match_method: matchMethod,
        explanation: `WHAT: ${normCategory} | WHERE: ${jurisdictionName} (${jurisdictionCode}) | JURISDICTION VERSION: ${boundaryVersion} | RESULT: Conflicting responsibility detected: ${topRules.length} competing rules found with equal priority (${maxPriority}). Competing authorities: ${candidateSummary}. Flagged for administrative resolution.`,
      };
    }

    // Single winner rule
    const selectedRule = topRules[0];
    const authority = {
      id: selectedRule.authority_id,
      code: selectedRule.authority_code,
      name: selectedRule.authority_name,
      type: selectedRule.authority_type,
    };
    const department = {
      id: selectedRule.department_id,
      code: selectedRule.department_code,
      name: selectedRule.department_name,
    };

    // Case D: AI Uncertainty Check
    // If AI confidence is below threshold or status is NEEDS_REVIEW, routing is provisional
    const isAiUncertain =
      aiAnalysis &&
      (aiAnalysis.status === 'NEEDS_REVIEW' ||
        (typeof aiAnalysis.confidence === 'number' && aiAnalysis.confidence < 0.7));

    if (isAiUncertain) {
      const confPct = aiAnalysis.confidence !== undefined ? `${Math.round(aiAnalysis.confidence * 100)}%` : 'uncertain';
      return {
        route_status: 'NEEDS_REVIEW',
        requires_review: true,
        authority,
        department,
        responsibility_rule_id: selectedRule.id,
        rule_version: selectedRule.version,
        candidate_rules: [selectedRule],
        match_method: matchMethod,
        explanation: `WHAT: ${normCategory} | WHERE: ${jurisdictionName} (${jurisdictionCode}) | JURISDICTION VERSION: ${boundaryVersion} | RULE VERSION: ${selectedRule.version} | WHO: ${authority.name} (${authority.code}) | DEPARTMENT: ${department.name} (${department.code}) | NOTE: Provisionally routed, but AI issue understanding confidence (${confPct}) is below threshold or marked NEEDS_REVIEW. Human verification required before dispatch.`,
      };
    }

    // Case A: Exactly 1 valid rule -> ROUTED
    return {
      route_status: 'ROUTED',
      requires_review: false,
      authority,
      department,
      responsibility_rule_id: selectedRule.id,
      rule_version: selectedRule.version,
      candidate_rules: [selectedRule],
      match_method: matchMethod,
      explanation: `WHAT: ${normCategory} | WHERE: ${jurisdictionName} (${jurisdictionCode}) | JURISDICTION VERSION: ${boundaryVersion} | RULE VERSION: ${selectedRule.version} | WHO: ${authority.name} (${authority.code}) | DEPARTMENT: ${department.name} (${department.code}) | WHY: Deterministic rule match under active policy ${selectedRule.version} at report timestamp.`,
    };
  }

  /**
   * Resolve and record an immutable routing snapshot for a civic report.
   * 
   * @param {Object} report - Report database row
   * @param {Object|null} jurisdictionSnapshot - Optional pre-computed jurisdiction snapshot
   * @param {Object|null} aiAnalysis - Optional pre-computed AI analysis
   * @returns {Promise<Object|null>} Saved report_routing snapshot
   */
  async recordReportRoutingSnapshot(report, jurisdictionSnapshot = null, aiAnalysis = null) {
    if (!report || !report.id) return null;

    // 1. Obtain jurisdiction snapshot
    let jurSnapshot = jurisdictionSnapshot;
    if (!jurSnapshot) {
      jurSnapshot = await jurisdictionService.getReportJurisdictionSnapshot(report.id);
      if (!jurSnapshot && report.latitude !== null && report.longitude !== null) {
        try {
          jurSnapshot = await jurisdictionService.recordReportJurisdictionSnapshot(report);
        } catch (jErr) {
          console.warn(`[Routing] Could not obtain jurisdiction for Report ${report.id}:`, jErr.message);
        }
      }
    }

    // 2. Obtain AI analysis if available
    let analysis = aiAnalysis;
    if (!analysis) {
      try {
        analysis = await db.getLatestAiAnalysisByReportId(report.id);
      } catch (aErr) {
        console.warn(`[Routing] Could not fetch AI analysis for Report ${report.id}:`, aErr.message);
      }
    }

    // 3. Determine category to use and track source
    let issueCategoryUsed = report.category;
    let categorySource = 'REPORT_SUBMISSION';

    if (analysis && analysis.category) {
      issueCategoryUsed = analysis.category;
      categorySource = 'AI_ANALYSIS';
    }

    const reportTime = report.reported_at || report.created_at || new Date();

    // 4. Resolve Responsibility
    const resolution = await this.resolveResponsibility(
      jurSnapshot,
      issueCategoryUsed,
      reportTime,
      analysis
    );

    // 5. Assess Routing Confidence & Review Requirements (Phase 6)
    const assessment = routingAssessmentService.assessRouting(
      report,
      analysis,
      jurSnapshot,
      resolution
    );

    // 6. Persist snapshot in database
    const snapshot = await db.createReportRoutingSnapshot({
      reportId: report.id,
      jurisdictionId: jurSnapshot?.jurisdiction_id || jurSnapshot?.jurisdictionId || jurSnapshot?.id || null,
      jurisdictionBoundaryId: jurSnapshot?.jurisdiction_boundary_id || jurSnapshot?.jurisdictionBoundaryId || jurSnapshot?.boundary_id || null,
      responsibilityRuleId: resolution.responsibility_rule_id,
      authorityId: resolution.authority?.id || null,
      departmentId: resolution.department?.id || null,
      issueCategoryUsed,
      categorySource,
      routeStatus: resolution.route_status,
      routingStatus: assessment.status,
      reviewReasons: assessment.reviewReasons,
      decisionSource: assessment.decisionSource,
      matchMethod: resolution.match_method,
      requiresReview: assessment.reviewRequired,
      candidateRules: resolution.candidate_rules,
      explanation: resolution.explanation,
      routedAt: new Date(),
    });

    return {
      ...snapshot,
      authority_code: resolution.authority?.code || null,
      authority_name: resolution.authority?.name || null,
      authority_type: resolution.authority?.type || null,
      department_code: resolution.department?.code || null,
      department_name: resolution.department?.name || null,
      jurisdiction_code: jurSnapshot?.jurisdiction_code || null,
      jurisdiction_name: jurSnapshot?.jurisdiction_name || null,
      rule_version: resolution.rule_version || null,
      explanation: resolution.explanation,
      routing_status: assessment.status,
      review_reasons: assessment.reviewReasons,
      decision_source: assessment.decisionSource,
      review_required: assessment.reviewRequired,
      assessment,
    };
  }

  /**
   * Retrieve current routing snapshot for a report.
   * If none exists yet, dynamically computes and records one.
   * 
   * @param {string} reportId 
   * @returns {Promise<Object|null>}
   */
  async getReportRoutingSnapshot(reportId) {
    let snapshot = await db.getReportRoutingSnapshot(reportId);
    if (!snapshot) {
      const report = await db.getReportById(reportId);
      if (report) {
        snapshot = await this.recordReportRoutingSnapshot(report);
      }
    }
    return snapshot;
  }
}

module.exports = new ResponsibilityService();
