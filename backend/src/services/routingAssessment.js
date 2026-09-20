/**
 * Phase 6: Routing Confidence + Human Review System
 * RoutingAssessmentService
 * 
 * Core principle:
 *   AUTOMATE WHEN CONFIDENT.
 *   ESCALATE WHEN UNCERTAIN.
 *   NEVER GUESS RESPONSIBILITY.
 * 
 * This service implements the deterministic decision layer that evaluates
 * all signals (Report + AI Analysis + Jurisdiction + Responsibility Rules)
 * and determines whether automatic routing is safe or human review is required.
 */

const ROUTING_STATUS = Object.freeze({
  PENDING: 'PENDING',
  AUTO_ROUTED: 'AUTO_ROUTED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  REVIEWED: 'REVIEWED',
  ROUTING_FAILED: 'ROUTING_FAILED',
});

const REVIEW_REASONS = Object.freeze({
  AI_LOW_CONFIDENCE: 'AI_LOW_CONFIDENCE',
  AI_NEEDS_REVIEW: 'AI_NEEDS_REVIEW',
  NO_JURISDICTION_MATCH: 'NO_JURISDICTION_MATCH',
  JURISDICTION_CONFLICT: 'JURISDICTION_CONFLICT',
  NO_RESPONSIBILITY_RULE: 'NO_RESPONSIBILITY_RULE',
  RESPONSIBILITY_CONFLICT: 'RESPONSIBILITY_CONFLICT',
  INVALID_LOCATION: 'INVALID_LOCATION',
  INCOMPLETE_REPORT: 'INCOMPLETE_REPORT',
  ROUTING_DATA_ERROR: 'ROUTING_DATA_ERROR',
  PHOTO_LOCATION_MISMATCH: 'PHOTO_LOCATION_MISMATCH',
  UNKNOWN: 'UNKNOWN',
});

class RoutingAssessmentService {
  constructor() {
    this.ROUTING_STATUS = ROUTING_STATUS;
    this.REVIEW_REASONS = REVIEW_REASONS;
  }

  /**
   * Get configured AI confidence threshold. Reuses Phase 3 threshold.
   */
  getConfidenceThreshold() {
    const envVal = process.env.AI_CONFIDENCE_THRESHOLD;
    if (envVal !== undefined && envVal !== null && envVal !== '') {
      const parsed = parseFloat(envVal);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        return parsed;
      }
    }
    return 0.70;
  }

  /**
   * Deterministically evaluate all routing signals and decide whether
   * a case is AUTO_ROUTED or requires human review (NEEDS_REVIEW).
   * 
   * @param {Object} report - Citizen civic report
   * @param {Object|null} aiAnalysis - AI issue understanding result
   * @param {Object|null} jurisdiction - Spatial jurisdiction resolution / snapshot
   * @param {Object|null} responsibility - Responsibility rule evaluation outcome
   * @returns {Object} Structured Routing Decision Object
   */
  assessRouting(report, aiAnalysis = null, jurisdiction = null, responsibility = null) {
    try {
      const reviewReasons = [];
      const threshold = this.getConfidenceThreshold();

      // 1. Report Completeness & Location Validity Check
      if (!report || !report.description) {
        reviewReasons.push(REVIEW_REASONS.INCOMPLETE_REPORT);
      }

      const hasCoords =
        report &&
        report.latitude !== null &&
        report.latitude !== undefined &&
        report.latitude !== '' &&
        report.longitude !== null &&
        report.longitude !== undefined &&
        report.longitude !== '';

      if (!hasCoords || report.location_status === 'LOCATION_MISSING') {
        reviewReasons.push(REVIEW_REASONS.INVALID_LOCATION);
      }

      // Photo Authenticity Check (Phase 3B)
      const photoStatus = report?.photo_status || report?.photoStatus;
      if (photoStatus === 'LOCATION_MISMATCH') {
        if (!reviewReasons.includes(REVIEW_REASONS.PHOTO_LOCATION_MISMATCH)) {
          reviewReasons.push(REVIEW_REASONS.PHOTO_LOCATION_MISMATCH);
        }
      }

      // 2. AI Confidence & Uncertainty Evaluation
      if (aiAnalysis) {
        if (aiAnalysis.status === 'NEEDS_REVIEW') {
          if (!reviewReasons.includes(REVIEW_REASONS.AI_NEEDS_REVIEW)) {
            reviewReasons.push(REVIEW_REASONS.AI_NEEDS_REVIEW);
          }
        }
        if (typeof aiAnalysis.confidence === 'number' && aiAnalysis.confidence < threshold) {
          if (!reviewReasons.includes(REVIEW_REASONS.AI_LOW_CONFIDENCE)) {
            reviewReasons.push(REVIEW_REASONS.AI_LOW_CONFIDENCE);
          }
        }
      }

      // 3. Administrative Jurisdiction Spatial Resolution Evaluation
      const jurStatus = jurisdiction?.match_status || jurisdiction?.matchStatus;
      const jurId = jurisdiction?.jurisdiction_id || jurisdiction?.jurisdictionId || jurisdiction?.id;

      if (jurStatus === 'JURISDICTION_CONFLICT') {
        reviewReasons.push(REVIEW_REASONS.JURISDICTION_CONFLICT);
      } else if (!jurisdiction || jurStatus === 'NO_JURISDICTION_MATCH' || !jurId) {
        if (!reviewReasons.includes(REVIEW_REASONS.INVALID_LOCATION)) {
          reviewReasons.push(REVIEW_REASONS.NO_JURISDICTION_MATCH);
        }
      }

      // 4. Responsibility Rules Evaluation
      const respStatus = responsibility?.route_status;
      const hasAuthority = Boolean(responsibility?.authority && responsibility.authority.id);
      const hasDepartment = Boolean(responsibility?.department && responsibility.department.id);

      if (respStatus === 'RESPONSIBILITY_CONFLICT') {
        reviewReasons.push(REVIEW_REASONS.RESPONSIBILITY_CONFLICT);
      } else if (respStatus === 'NO_RESPONSIBLE_RULE' || !hasAuthority || !hasDepartment) {
        // Only flag NO_RESPONSIBLE_RULE if jurisdiction was otherwise valid
        const hasJurFailure =
          reviewReasons.includes(REVIEW_REASONS.NO_JURISDICTION_MATCH) ||
          reviewReasons.includes(REVIEW_REASONS.JURISDICTION_CONFLICT) ||
          reviewReasons.includes(REVIEW_REASONS.INVALID_LOCATION);
        if (!hasJurFailure) {
          reviewReasons.push(REVIEW_REASONS.NO_RESPONSIBILITY_RULE);
        }
      }

      // Case: Hard Review Conditions Triggered
      if (reviewReasons.length > 0) {
        // Suggested route details (if responsibility rule found a candidate, but AI was uncertain)
        const suggestedRoute =
          hasAuthority && hasDepartment
            ? {
                authorityId: responsibility.authority.id,
                authorityCode: responsibility.authority.code,
                authorityName: responsibility.authority.name,
                authorityType: responsibility.authority.type,
                departmentId: responsibility.department.id,
                departmentCode: responsibility.department.code,
                departmentName: responsibility.department.name,
                responsibilityRuleId: responsibility.responsibility_rule_id,
                ruleVersion: responsibility.rule_version,
              }
            : null;

        return {
          status: ROUTING_STATUS.NEEDS_REVIEW,
          reviewRequired: true,
          reviewReasons,
          decision: null,
          suggestedRoute,
          decisionMethod: 'DETERMINISTIC_ROUTING_PIPELINE',
          decisionSource: 'AUTOMATIC',
        };
      }

      // Case: Automatic Route Safe (All conditions satisfied)
      return {
        status: ROUTING_STATUS.AUTO_ROUTED,
        reviewRequired: false,
        reviewReasons: [],
        decision: {
          issueCategory:
            responsibility.issue_category ||
            aiAnalysis?.category ||
            report.category,
          jurisdictionId: jurId,
          jurisdictionCode: jurisdiction?.jurisdiction_code || jurisdiction?.code,
          jurisdictionName: jurisdiction?.jurisdiction_name || jurisdiction?.name,
          jurisdictionVersion:
            jurisdiction?.jurisdiction_version ||
            jurisdiction?.boundary_version ||
            jurisdiction?.version,
          authorityId: responsibility.authority.id,
          authorityCode: responsibility.authority.code,
          authorityName: responsibility.authority.name,
          authorityType: responsibility.authority.type,
          departmentId: responsibility.department.id,
          departmentCode: responsibility.department.code,
          departmentName: responsibility.department.name,
          responsibilityRuleId: responsibility.responsibility_rule_id,
          ruleVersion: responsibility.rule_version,
        },
        decisionMethod: 'DETERMINISTIC_ROUTING_PIPELINE',
        decisionSource: 'AUTOMATIC',
      };
    } catch (err) {
      console.error('[RoutingAssessment Error] Failure during assessment:', err);
      return {
        status: ROUTING_STATUS.ROUTING_FAILED,
        reviewRequired: true,
        reviewReasons: [REVIEW_REASONS.ROUTING_DATA_ERROR],
        decision: null,
        decisionMethod: 'DETERMINISTIC_ROUTING_PIPELINE',
        decisionSource: 'AUTOMATIC',
        errorMessage: err.message,
      };
    }
  }
}

module.exports = new RoutingAssessmentService();
