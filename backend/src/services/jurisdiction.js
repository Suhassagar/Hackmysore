const { db } = require('../config/db');

/**
 * Phase 4: Geospatial + Dynamic Jurisdiction Engine Service
 * 
 * Core responsibilities:
 * - Deterministically resolve which administrative jurisdiction spatially covers a coordinate
 *   at the exact report timestamp.
 * - Enforce boundary-safe spatial predicates (ST_Covers).
 * - Enforce temporal validity (valid_from <= report_time < valid_until).
 * - Handle 3 deterministic resolution outcomes:
 *     Case A: Exactly 1 match -> MATCHED, requires_review: false
 *     Case B: 0 matches -> NO_JURISDICTION_MATCH, requires_review: true
 *     Case C: >1 matches -> JURISDICTION_CONFLICT, requires_review: true
 * - Record immutable historical jurisdiction snapshots in report_jurisdiction table.
 * 
 * Non-goals:
 * - Does NOT determine department routing or authority responsibility rules (Phase 5).
 * - Does NOT invoke Gemini (Gemini is strictly issue understanding).
 */
class JurisdictionService {
  /**
   * Validate geographical coordinates
   * @param {number|string} lat 
   * @param {number|string} lng 
   * @returns {{ valid: boolean, error?: string, latitude?: number, longitude?: number }}
   */
  validateCoordinates(lat, lng) {
    if (lat === undefined || lat === null || lat === '' || lng === undefined || lng === null || lng === '') {
      return { valid: false, error: 'Both latitude and longitude are required.' };
    }

    const parsedLat = Number(lat);
    const parsedLng = Number(lng);

    if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      return { valid: false, error: 'Latitude must be a valid number between -90 and 90.' };
    }

    if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      return { valid: false, error: 'Longitude must be a valid number between -180 and 180.' };
    }

    return { valid: true, latitude: parsedLat, longitude: parsedLng };
  }

  /**
   * Spatially and temporally resolve jurisdiction for a point at a given report time.
   * 
   * @param {number|string} lat - Latitude
   * @param {number|string} lng - Longitude
   * @param {Date|string} reportTime - Timestamp when the incident was reported
   * @returns {Promise<Object>} Resolution outcome
   */
  async resolveJurisdiction(lat, lng, reportTime = new Date()) {
    const coordValidation = this.validateCoordinates(lat, lng);
    if (!coordValidation.valid) {
      const err = new Error(coordValidation.error);
      err.code = 'INVALID_COORDINATES';
      err.status = 400;
      throw err;
    }

    const { latitude, longitude } = coordValidation;
    let targetTime = reportTime instanceof Date ? reportTime : new Date(reportTime);
    if (isNaN(targetTime.getTime())) {
      targetTime = new Date();
    }

    // Query database for spatial & temporal match
    const matches = await db.findJurisdictionsByPointAndTimestamp(longitude, latitude, targetTime);
    const matchMethod = db.isConnected ? 'POSTGIS_ST_COVERS' : 'IN_MEMORY_ST_COVERS';

    // Case A: Exactly 1 valid match
    if (matches.length === 1) {
      const match = matches[0];
      return {
        matchStatus: 'MATCHED',
        requiresReview: false,
        jurisdictionId: match.jurisdiction_id,
        jurisdictionBoundaryId: match.boundary_id,
        jurisdictionCode: match.jurisdiction_code,
        jurisdictionName: match.jurisdiction_name,
        jurisdictionType: match.jurisdiction_type,
        boundaryVersion: match.version,
        validFrom: match.valid_from,
        validUntil: match.valid_until,
        matchMethod,
        candidateMatches: [match],
        explanation: `Spatially resolved to ${match.jurisdiction_name} (${match.jurisdiction_type}) under active boundary version ${match.version}.`,
      };
    }

    // Case B: No matches found (unincorporated, outside boundaries, or temporal gap)
    if (matches.length === 0) {
      return {
        matchStatus: 'NO_JURISDICTION_MATCH',
        requiresReview: true,
        jurisdictionId: null,
        jurisdictionBoundaryId: null,
        jurisdictionCode: null,
        jurisdictionName: null,
        jurisdictionType: null,
        boundaryVersion: null,
        validFrom: null,
        validUntil: null,
        matchMethod,
        candidateMatches: [],
        explanation: `Coordinates [${latitude.toFixed(5)}, ${longitude.toFixed(5)}] do not fall within any registered administrative jurisdiction as of ${targetTime.toISOString()}. Flagged for manual boundary review.`,
      };
    }

    // Case C: Overlapping boundaries / spatial conflict (> 1 match)
    return {
      matchStatus: 'JURISDICTION_CONFLICT',
      requiresReview: true,
      jurisdictionId: null,
      jurisdictionBoundaryId: null,
      jurisdictionCode: null,
      jurisdictionName: null,
      jurisdictionType: null,
      boundaryVersion: null,
      validFrom: null,
      validUntil: null,
      matchMethod,
      candidateMatches: matches,
      explanation: `Spatial conflict detected: Point [${latitude.toFixed(5)}, ${longitude.toFixed(5)}] falls within ${matches.length} overlapping administrative jurisdictions (${matches.map(m => m.jurisdiction_name).join(', ')}). Flagged for administrative boundary review.`,
    };
  }

  /**
   * Resolve jurisdiction for a report and record an immutable historical snapshot.
   * 
   * @param {Object} report - Civic report row object
   * @returns {Promise<Object|null>} The saved report_jurisdiction snapshot
   */
  async recordReportJurisdictionSnapshot(report) {
    if (!report || report.latitude === null || report.latitude === undefined ||
        report.longitude === null || report.longitude === undefined) {
      return null;
    }

    const reportTime = report.reported_at || report.created_at || new Date();
    const resolution = await this.resolveJurisdiction(report.latitude, report.longitude, reportTime);

    const snapshot = await db.createReportJurisdictionSnapshot({
      reportId: report.id,
      jurisdictionId: resolution.jurisdictionId,
      jurisdictionBoundaryId: resolution.jurisdictionBoundaryId,
      reportTime,
      matchStatus: resolution.matchStatus,
      matchMethod: resolution.matchMethod,
      requiresReview: resolution.requiresReview,
      candidateMatches: resolution.candidateMatches,
    });

    return {
      ...snapshot,
      jurisdiction_code: resolution.jurisdictionCode,
      jurisdiction_name: resolution.jurisdictionName,
      jurisdiction_type: resolution.jurisdictionType,
      jurisdiction_version: resolution.boundaryVersion,
      valid_from: resolution.validFrom,
      valid_until: resolution.validUntil,
      explanation: resolution.explanation,
    };
  }

  /**
   * Fetch historical snapshot for a report
   * @param {string} reportId 
   * @returns {Promise<Object|null>}
   */
  async getReportJurisdictionSnapshot(reportId) {
    const snapshot = await db.getReportJurisdictionSnapshot(reportId);
    if (!snapshot) return null;

    // Generate human explanation if not stored directly
    let explanation = '';
    if (snapshot.match_status === 'MATCHED') {
      explanation = `Spatially resolved to ${snapshot.jurisdiction_name} (${snapshot.jurisdiction_type}) under active boundary version ${snapshot.jurisdiction_version}.`;
    } else if (snapshot.match_status === 'NO_JURISDICTION_MATCH') {
      explanation = `Report coordinates did not fall within any registered administrative jurisdiction at report timestamp. Flagged for manual boundary review.`;
    } else if (snapshot.match_status === 'JURISDICTION_CONFLICT') {
      const candidateNames = (snapshot.candidate_matches || []).map(m => m.jurisdiction_name).join(', ');
      explanation = `Spatial conflict detected: Point falls within overlapping administrative zones (${candidateNames || 'Multiple'}). Flagged for administrative boundary review.`;
    }

    return {
      ...snapshot,
      explanation,
    };
  }
}

module.exports = new JurisdictionService();
