/**
 * CivicFlow — Phase 3B: Duplicate Incident Clustering Service
 * 
 * Objectives:
 * 1. Spatiotemporal clustering: 50-meter radius, 48-hour window, same category.
 * 2. Multi-citizen incident grouping without creating duplicate civic cases.
 * 3. Links incoming duplicate reports to an existing open incident and operational case.
 * 4. Appends a DUPLICATE_REPORT_LINKED event to the existing case history for field staff awareness.
 * 5. Preserves each citizen's individual report traceability.
 */

const { db } = require('../config/db');

class IncidentClusteringService {
  constructor() {
    this.DEFAULT_RADIUS_METERS = 50;
    this.DEFAULT_HOURS_WINDOW = 48;
  }

  /**
   * Evaluates whether a new report matches an existing incident cluster.
   * 
   * @param {Object} params - { category, latitude, longitude }
   * @returns {Object} Cluster evaluation result
   */
  async evaluateCluster({ category, latitude, longitude }) {
    if (
      latitude === null ||
      longitude === null ||
      latitude === undefined ||
      longitude === undefined
    ) {
      return {
        isCluster: false,
        incidentId: null,
        hasExistingCase: false,
        existingCaseId: null,
        reportCount: 1,
      };
    }

    try {
      const match = await db.findNearbyIncident({
        category,
        latitude,
        longitude,
        hoursWindow: this.DEFAULT_HOURS_WINDOW,
        radiusMeters: this.DEFAULT_RADIUS_METERS,
      });

      if (match) {
        return {
          isCluster: true,
          incidentId: match.id,
          hasExistingCase: Boolean(match.case_id),
          existingCaseId: match.case_id || null,
          reportCount: (match.report_count || 1) + 1,
          distanceMeters: match.distance_meters ? parseFloat(match.distance_meters) : 0,
        };
      }
    } catch (err) {
      console.warn('[Clustering Warning] Failed to find nearby incident:', err.message);
    }

    return {
      isCluster: false,
      incidentId: null,
      hasExistingCase: false,
      existingCaseId: null,
      reportCount: 1,
    };
  }

  /**
   * Links a created report to either the existing incident cluster or creates a new incident.
   * 
   * @param {string} reportId - Newly created report ID
   * @param {Object} clusterEvaluation - Result from evaluateCluster()
   * @param {Object} reportData - { category, latitude, longitude, reporterUserId }
   * @returns {Object} Final incident linkage { incidentId, caseId, isCluster }
   */
  async recordReportLink(reportId, clusterEvaluation, reportData) {
    if (
      reportData.latitude === null ||
      reportData.longitude === null ||
      reportData.latitude === undefined ||
      reportData.longitude === undefined
    ) {
      return { incidentId: null, caseId: null, isCluster: false };
    }

    try {
      if (clusterEvaluation && clusterEvaluation.isCluster && clusterEvaluation.incidentId) {
        // Link to existing incident
        const updatedIncident = await db.linkReportToIncident(reportId, clusterEvaluation.incidentId);

        // If existing case is attached to this incident, record audit event
        const caseId = clusterEvaluation.existingCaseId || updatedIncident?.case_id;
        if (caseId) {
          try {
            await db.recordCaseEvent(caseId, {
              eventType: 'DUPLICATE_REPORT_LINKED',
              fromStatus: null,
              toStatus: null,
              actorUserId: reportData.reporterUserId || null,
              note: `Additional citizen report linked to this incident cluster (Report #${reportId.slice(0, 8)}).`,
              metadata: {
                reportId,
                incidentId: clusterEvaluation.incidentId,
                reporterUserId: reportData.reporterUserId,
                reportCount: clusterEvaluation.reportCount,
                category: reportData.category,
              },
            });
          } catch (evErr) {
            console.warn(`[Clustering Warning] Failed to record duplicate event for Case ${caseId}:`, evErr.message);
          }
        }

        return {
          incidentId: clusterEvaluation.incidentId,
          caseId: caseId || null,
          isCluster: true,
          reportCount: clusterEvaluation.reportCount,
        };
      }

      // No match: Create a new incident cluster
      const newIncident = await db.createIncident({
        category: reportData.category,
        latitude: reportData.latitude,
        longitude: reportData.longitude,
        initialReportId: reportId,
      });

      return {
        incidentId: newIncident.id,
        caseId: null,
        isCluster: false,
        reportCount: 1,
      };
    } catch (err) {
      console.warn(`[Clustering Warning] Failed to link/create incident for Report ${reportId}:`, err.message);
      return { incidentId: null, caseId: null, isCluster: false };
    }
  }

  /**
   * Associates a created case with an incident cluster.
   */
  async associateCaseWithIncident(incidentId, caseId) {
    if (!incidentId || !caseId) return null;
    try {
      return await db.updateIncidentCaseId(incidentId, caseId);
    } catch (err) {
      console.warn(`[Clustering Warning] Failed to update case_id for Incident ${incidentId}:`, err.message);
      return null;
    }
  }
}

const incidentClusteringService = new IncidentClusteringService();
module.exports = incidentClusteringService;
