const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { requireRole } = require('../middleware/requireRole');
const { db } = require('../config/db');
const mediaStorage = require('../services/storage');
const aiService = require('../services/ai');
const jurisdictionService = require('../services/jurisdiction');
const responsibilityService = require('../services/responsibility');

const router = express.Router();

// Allowed civic categories
const ALLOWED_CATEGORIES = [
  'POTHOLE',
  'BLOCKED_DRAIN',
  'GARBAGE_OVERFLOW',
  'BROKEN_STREETLIGHT',
  'ILLEGAL_DUMPING',
  'OTHER',
];

// Anti-duplicate submission guard (prevents rapid double-clicks within 3 seconds)
const recentSubmissions = new Map();

function cleanOldSubmissions() {
  const now = Date.now();
  for (const [key, timestamp] of recentSubmissions.entries()) {
    if (now - timestamp > 5000) {
      recentSubmissions.delete(key);
    }
  }
}

/**
 * Helper to trigger AI analysis asynchronously without blocking report creation
 */
async function triggerAsyncAiAnalysis(report) {
  try {
    const analysisResult = await aiService.analyzeReport(report);
    await db.createAiAnalysis({
      reportId: report.id,
      model: analysisResult.model,
      category: analysisResult.category,
      severity: analysisResult.severity,
      summary: analysisResult.summary,
      riskFactors: analysisResult.riskFactors,
      confidence: analysisResult.confidence,
      status: analysisResult.status,
      rawVersion: analysisResult.rawVersion,
      errorMessage: analysisResult.errorMessage,
    });
    console.log(`[AI] Background analysis completed for Report ${report.id} (Status: ${analysisResult.status})`);
    
    // Automatically evaluate & record dynamic responsibility routing snapshot (Phase 5)
    try {
      await responsibilityService.recordReportRoutingSnapshot(report, null, analysisResult);
      console.log(`[Routing] Updated civic responsibility routing snapshot for Report ${report.id}`);
    } catch (routErr) {
      console.warn(`[Routing Warning] Post-AI routing update failed for Report ${report.id}:`, routErr.message);
    }
  } catch (err) {
    console.error(`[AI Error] Background analysis failed for Report ${report.id}:`, err.message);
  }
}

/**
 * POST /api/reports
 * Allows an authenticated CITIZEN to submit a civic problem report.
 * Asynchronously schedules AI issue understanding in the background.
 */
router.post('/', requireAuth, requireRole('CITIZEN'), async (req, res) => {
  try {
    cleanOldSubmissions();

    const {
      category,
      description,
      latitude,
      longitude,
      accuracy,
      photoData,
    } = req.body;

    const reporterUserId = req.user.id;

    // 1. Anti-duplicate submission check (double-click protection)
    const dedupKey = `${reporterUserId}-${(description || '').trim().slice(0, 30)}`;
    if (recentSubmissions.has(dedupKey)) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Duplicate submission in progress. Please wait a moment.',
      });
    }

    // 2. Validate category
    if (!category || !ALLOWED_CATEGORIES.includes(category.toUpperCase())) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid category: '${category}'. Allowed: ${ALLOWED_CATEGORIES.join(', ')}`,
      });
    }
    const normalizedCategory = category.toUpperCase();

    // 3. Validate description
    if (!description || typeof description !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Description is required and must be text.',
      });
    }

    const trimmedDescription = description.trim();
    if (trimmedDescription.length < 10) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Description is too short. Please provide at least 10 characters detailing the problem.',
      });
    }

    if (trimmedDescription.length > 1000) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Description exceeds maximum limit of 1000 characters.',
      });
    }

    // 4. Validate Location
    let parsedLat = null;
    let parsedLng = null;
    let parsedAccuracy = null;
    let locationStatus = 'LOCATION_MISSING';

    const hasLat = latitude !== undefined && latitude !== null && latitude !== '';
    const hasLng = longitude !== undefined && longitude !== null && longitude !== '';

    if (hasLat || hasLng) {
      parsedLat = Number(latitude);
      parsedLng = Number(longitude);

      if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid latitude. Must be a valid number between -90 and 90.',
        });
      }

      if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid longitude. Must be a valid number between -180 and 180.',
        });
      }

      if (accuracy !== undefined && accuracy !== null && accuracy !== '') {
        parsedAccuracy = Number(accuracy);
        if (isNaN(parsedAccuracy) || parsedAccuracy < 0) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Invalid accuracy value. Must be a non-negative number.',
          });
        }
      }

      locationStatus = 'VERIFIED_COORDINATES';
    } else {
      locationStatus = 'LOCATION_MISSING';
    }

    // 5. Process Photo / Media if attached
    let photoUrl = null;
    if (photoData) {
      try {
        photoUrl = await mediaStorage.upload(photoData);
      } catch (mediaErr) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Photo upload validation failed: ${mediaErr.message}`,
        });
      }
    }

    // 6. Create Report Record in Database
    recentSubmissions.set(dedupKey, Date.now());
    const newReport = await db.createReport({
      reporterUserId,
      category: normalizedCategory,
      description: trimmedDescription,
      latitude: parsedLat,
      longitude: parsedLng,
      locationAccuracy: parsedAccuracy,
      locationStatus,
      photoUrl,
    });

    // 7. Resolve Geospatial Jurisdiction & Record Historical Snapshot (Phase 4)
    let jurisdictionSnapshot = null;
    if (parsedLat !== null && parsedLng !== null) {
      try {
        jurisdictionSnapshot = await jurisdictionService.recordReportJurisdictionSnapshot(newReport);
      } catch (jurErr) {
        console.error(`[Jurisdiction Error] Failed to resolve jurisdiction for Report ${newReport.id}:`, jurErr.message);
      }
    }

    // 8. Resolve Civic Responsibility & Record Routing Snapshot (Phase 5)
    let routingSnapshot = null;
    if (parsedLat !== null && parsedLng !== null) {
      try {
        routingSnapshot = await responsibilityService.recordReportRoutingSnapshot(newReport, jurisdictionSnapshot, null);
      } catch (routErr) {
        console.error(`[Routing Error] Failed to resolve routing for Report ${newReport.id}:`, routErr.message);
      }
    }

    // 9. Trigger Asynchronous AI Issue Understanding (Phase 3)
    // Non-blocking: if Gemini takes time or fails, citizen report is already safely saved
    triggerAsyncAiAnalysis(newReport);

    // 10. Format clean response
    res.status(201).json({
      id: newReport.id,
      category: newReport.category,
      description: newReport.description,
      location: {
        latitude: newReport.latitude !== null && newReport.latitude !== undefined ? parseFloat(newReport.latitude) : null,
        longitude: newReport.longitude !== null && newReport.longitude !== undefined ? parseFloat(newReport.longitude) : null,
        accuracy: newReport.location_accuracy !== null && newReport.location_accuracy !== undefined ? parseFloat(newReport.location_accuracy) : null,
        status: newReport.location_status,
      },
      photoUrl: newReport.photo_url,
      status: newReport.status,
      reportedAt: newReport.reported_at,
      jurisdiction: jurisdictionSnapshot,
      routing: routingSnapshot,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Failed to create civic report',
    });
  }
});

/**
 * GET /api/reports/my
 * Returns all reports belonging exclusively to the authenticated citizen.
 */
router.get('/my', requireAuth, requireRole('CITIZEN'), async (req, res) => {
  try {
    const reporterUserId = req.user.id;
    const reports = await db.getReportsByUserId(reporterUserId);

    const formatted = reports.map((r) => ({
      id: r.id,
      category: r.category,
      description: r.description,
      location: {
        latitude: r.latitude,
        longitude: r.longitude,
        accuracy: r.location_accuracy,
        status: r.location_status,
      },
      photoUrl: r.photo_url,
      status: r.status,
      reportedAt: r.reported_at,
    }));

    res.json({ reports: formatted });
  } catch (err) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Failed to retrieve reports',
    });
  }
});

/**
 * GET /api/reports/:id
 * Returns a specific report with strict IDOR prevention.
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const report = await db.getReportById(id);

    if (!report) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Report with ID '${id}' was not found.`,
      });
    }

    // IDOR Protection: verify ownership unless ADMIN or STAFF
    if (report.reporter_user_id !== req.user.id && req.user.role !== 'ADMIN' && req.user.role !== 'STAFF') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied. You do not have authorization to view this citizen report.',
      });
    }

    // Retrieve historical jurisdiction snapshot if available
    let jurisdictionSnapshot = await jurisdictionService.getReportJurisdictionSnapshot(id);
    if (!jurisdictionSnapshot && report.latitude !== null && report.longitude !== null) {
      try {
        jurisdictionSnapshot = await jurisdictionService.recordReportJurisdictionSnapshot(report);
      } catch (jurErr) {
        console.warn(`[Jurisdiction] On-the-fly resolution for Report ${id} failed:`, jurErr.message);
      }
    }

    // Retrieve historical routing snapshot if available (Phase 5)
    let routingSnapshot = await responsibilityService.getReportRoutingSnapshot(id);
    if (!routingSnapshot && jurisdictionSnapshot) {
      try {
        routingSnapshot = await responsibilityService.recordReportRoutingSnapshot(report, jurisdictionSnapshot, null);
      } catch (routErr) {
        console.warn(`[Routing] On-the-fly routing resolution for Report ${id} failed:`, routErr.message);
      }
    }

    // Retrieve operational civic case if available (Phase 7)
    let caseItem = null;
    try {
      caseItem = await db.getCaseByReportId(id);
    } catch (cErr) {
      console.warn(`[Case] Could not fetch case for Report ${id}:`, cErr.message);
    }

    res.json({
      id: report.id,
      category: report.category,
      description: report.description,
      location: {
        latitude: report.latitude !== null && report.latitude !== undefined ? parseFloat(report.latitude) : null,
        longitude: report.longitude !== null && report.longitude !== undefined ? parseFloat(report.longitude) : null,
        accuracy: report.location_accuracy !== null && report.location_accuracy !== undefined ? parseFloat(report.location_accuracy) : null,
        status: report.location_status,
      },
      photoUrl: report.photo_url,
      status: report.status,
      reportedAt: report.reported_at,
      jurisdiction: jurisdictionSnapshot,
      routing: routingSnapshot,
      case: caseItem,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Failed to fetch report details',
    });
  }
});

// =========================================================================
// PHASE 3: AI ISSUE UNDERSTANDING ENDPOINTS
// =========================================================================

/**
 * POST /api/reports/:id/analyze
 * Triggers or reprocesses AI issue understanding for a report.
 * 
 * AUTHORIZATION:
 * - Citizen can analyze only their own report.
 * - Admin can analyze any report.
 * - Staff are disallowed.
 * 
 * ABUSE / COST PROTECTION (Section 15 & 19):
 * If a completed analysis already exists, regular citizen requests return the cached result.
 * Only ADMIN can force-reprocess an existing completed analysis.
 */
router.post('/:id/analyze', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { forceReprocess } = req.body || {};
    const report = await db.getReportById(id);

    if (!report) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Report with ID '${id}' was not found.`,
      });
    }

    // Role & Ownership Check
    const isOwner = report.reporter_user_id === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied. You do not have authorization to trigger AI analysis for this report.',
      });
    }

    if (req.user.role === 'STAFF') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Staff members cannot trigger citizen report AI analysis directly.',
      });
    }

    // Check for existing completed analysis (Abuse & Cost Safeguard)
    const existingAnalysis = await db.getLatestAiAnalysisByReportId(id);
    if (existingAnalysis && existingAnalysis.status === 'COMPLETED' && !isAdmin && !forceReprocess) {
      return res.status(200).json({
        message: 'Returning cached AI issue understanding result (re-analysis protected).',
        cached: true,
        analysis: existingAnalysis,
        originalCitizenCategory: report.category,
      });
    }

    // Execute AI Analysis via IssueUnderstandingService
    const result = await aiService.analyzeReport(report);

    // Persist structured analysis in database
    const savedAnalysis = await db.createAiAnalysis({
      reportId: report.id,
      model: result.model,
      category: result.category,
      severity: result.severity,
      summary: result.summary,
      riskFactors: result.riskFactors,
      confidence: result.confidence,
      status: result.status,
      rawVersion: result.rawVersion,
      errorMessage: result.errorMessage,
    });

    // Update responsibility routing snapshot with latest AI issue understanding
    try {
      await responsibilityService.recordReportRoutingSnapshot(report, null, result);
    } catch (routErr) {
      console.warn(`[Routing] Failed to refresh routing snapshot after re-analysis:`, routErr.message);
    }

    res.status(200).json({
      message: 'AI issue understanding completed successfully.',
      cached: false,
      analysis: savedAnalysis,
      originalCitizenCategory: report.category, // Original citizen category explicitly preserved
    });
  } catch (err) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Failed to analyze report',
    });
  }
});

/**
 * GET /api/reports/:id/analysis
 * Returns the latest AI understanding result for a report.
 */
router.get('/:id/analysis', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const report = await db.getReportById(id);

    if (!report) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Report with ID '${id}' was not found.`,
      });
    }

    // Ownership check
    if (report.reporter_user_id !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied.',
      });
    }

    const latest = await db.getLatestAiAnalysisByReportId(id);
    if (!latest) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No AI analysis has been recorded for this report yet.',
      });
    }

    res.json({
      analysis: latest,
      originalCitizenCategory: report.category,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Failed to fetch analysis',
    });
  }
});

/**
 * GET /api/reports/:id/jurisdiction
 * Retrieves the immutable historical jurisdiction snapshot for a report.
 * Accessible by the report owner, staff, or admin.
 */
router.get('/:id/jurisdiction', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const report = await db.getReportById(id);
    if (!report) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Report with ID '${id}' was not found.`,
      });
    }

    // Check ownership or privileged role
    const isOwner = report.reporter_user_id === req.user.id;
    const isPrivileged = ['STAFF', 'ADMIN'].includes(req.user.role);
    if (!isOwner && !isPrivileged) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied. You do not have authorization to view this report jurisdiction.',
      });
    }

    let snapshot = await jurisdictionService.getReportJurisdictionSnapshot(id);
    if (!snapshot) {
      if (report.latitude !== null && report.longitude !== null) {
        snapshot = await jurisdictionService.recordReportJurisdictionSnapshot(report);
      }
    }

    if (!snapshot) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No jurisdiction resolution available for this report (location may be missing).',
      });
    }

    res.status(200).json({
      reportId: id,
      coordinates: {
        latitude: report.latitude,
        longitude: report.longitude,
      },
      jurisdiction: snapshot,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Failed to fetch jurisdiction snapshot',
    });
  }
});

/**
 * POST /api/reports/:id/jurisdiction/resolve
 * Allows re-evaluating or resolving jurisdiction for a report.
 * Accessible by report owner or admin.
 */
router.post('/:id/jurisdiction/resolve', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const report = await db.getReportById(id);
    if (!report) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Report with ID '${id}' was not found.`,
      });
    }

    const isOwner = report.reporter_user_id === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied.',
      });
    }

    if (report.latitude === null || report.longitude === null) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot resolve jurisdiction: Report does not have verified coordinates.',
      });
    }

    const snapshot = await jurisdictionService.recordReportJurisdictionSnapshot(report);
    res.status(200).json({
      message: 'Jurisdiction resolved successfully.',
      jurisdiction: snapshot,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Failed to resolve jurisdiction',
    });
  }
});

// =========================================================================
// PHASE 5: DYNAMIC CIVIC RESPONSIBILITY ROUTING ENDPOINTS
// =========================================================================

/**
 * GET /api/reports/:id/routing
 * Retrieves the immutable historical responsibility routing snapshot for a report.
 * Accessible by report owner, staff, or admin.
 */
router.get('/:id/routing', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const report = await db.getReportById(id);
    if (!report) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Report with ID '${id}' was not found.`,
      });
    }

    // Check ownership or privileged role
    const isOwner = report.reporter_user_id === req.user.id;
    const isPrivileged = ['STAFF', 'ADMIN'].includes(req.user.role);
    if (!isOwner && !isPrivileged) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied. You do not have authorization to view this report routing.',
      });
    }

    let snapshot = await responsibilityService.getReportRoutingSnapshot(id);
    if (!snapshot) {
      snapshot = await responsibilityService.recordReportRoutingSnapshot(report);
    }

    if (!snapshot) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No responsibility routing resolution available for this report.',
      });
    }

    res.status(200).json({
      reportId: id,
      category: report.category,
      routing: snapshot,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Failed to fetch routing snapshot',
    });
  }
});

/**
 * POST /api/reports/:id/routing/resolve
 * Allows resolving or re-calculating responsibility routing for a report.
 * Accessible by report owner or admin.
 */
router.post('/:id/routing/resolve', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const report = await db.getReportById(id);
    if (!report) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Report with ID '${id}' was not found.`,
      });
    }

    const isOwner = report.reporter_user_id === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied.',
      });
    }

    const snapshot = await responsibilityService.recordReportRoutingSnapshot(report);
    res.status(200).json({
      message: 'Responsibility routing resolved successfully.',
      routing: snapshot,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Failed to resolve responsibility routing',
    });
  }
});

// =========================================================================
// PHASE 6: ROUTING CONFIDENCE & HUMAN REVIEW ENDPOINTS
// =========================================================================

// Idempotency anti-duplicate review guard (prevents rapid double-clicks)
const recentReviewActions = new Map();

/**
 * POST /api/reports/:id/routing-review
 * Protected endpoint for Staff/Admin to review and adjudicate routing.
 * 
 * Supports two actions:
 * 1. 'APPROVE': Staff confirms the automated suggestion
 * 2. 'OVERRIDE': Staff designates a different authority and department
 * 
 * Permissions:
 * - STAFF and ADMIN only.
 * - CITIZEN requests are strictly rejected with 403 Forbidden.
 */
router.post('/:id/routing-review', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { action, final_authority_id, final_department_id, review_notes } = req.body || {};
    const reviewerUserId = req.user.id;

    // 1. Idempotency double-click guard
    const dedupKey = `${reviewerUserId}-${id}`;
    const lastAction = recentReviewActions.get(dedupKey);
    if (lastAction && Date.now() - lastAction < 3000) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Duplicate review action detected. Request is already being processed.',
      });
    }
    recentReviewActions.set(dedupKey, Date.now());

    // 2. Validate report exists
    const report = await db.getReportById(id);
    if (!report) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Report with ID '${id}' was not found.`,
      });
    }

    // 3. Validate action
    if (!action || !['APPROVE', 'OVERRIDE'].includes(action)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: "Invalid action. Allowed values: 'APPROVE' or 'OVERRIDE'.",
      });
    }

    // 4. Retrieve existing routing snapshot
    let snapshot = await responsibilityService.getReportRoutingSnapshot(id);
    if (!snapshot) {
      snapshot = await responsibilityService.recordReportRoutingSnapshot(report);
    }

    if (!snapshot) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot review: No routing snapshot exists for this report.',
      });
    }

    // Idempotency check: if already reviewed by human, prevent duplicate overwrite
    if (snapshot.decision_source === 'HUMAN_REVIEW' && snapshot.reviewed_at) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'This report has already been reviewed and resolved by an authorized staff member.',
        routing: snapshot,
      });
    }

    let finalAuthId = null;
    let finalDeptId = null;

    if (action === 'APPROVE') {
      // Approve requires an automated suggested authority & department
      if (!snapshot.authority_id || !snapshot.department_id) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Cannot approve route: No automated suggestion exists. Please use OVERRIDE to assign authority and department.',
        });
      }
      finalAuthId = snapshot.authority_id;
      finalDeptId = snapshot.department_id;
    } else if (action === 'OVERRIDE') {
      // Override requires client to supply valid authority and department
      if (!final_authority_id || !final_department_id) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Override action requires both final_authority_id and final_department_id.',
        });
      }

      const authRecord = await db.getAuthorityById(final_authority_id);
      if (!authRecord) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Authority with ID '${final_authority_id}' does not exist.`,
        });
      }

      const deptRecord = await db.getDepartmentById(final_department_id);
      if (!deptRecord) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Department with ID '${final_department_id}' does not exist.`,
        });
      }

      finalAuthId = authRecord.id;
      finalDeptId = deptRecord.id;
    }

    const reviewedAt = new Date();

    // 5. Create immutable review audit entry
    const reviewRecord = await db.createRoutingReview({
      reportId: id,
      reportRoutingId: snapshot.id,
      action,
      reviewedBy: reviewerUserId,
      reviewedAt,
      reviewNotes: review_notes || null,
      originalAuthorityId: snapshot.authority_id || null,
      originalDepartmentId: snapshot.department_id || null,
      finalAuthorityId: finalAuthId,
      finalDepartmentId: finalDeptId,
    });

    // 6. Update report_routing current state
    const updatedRouting = await db.updateReportRoutingReview({
      reportId: id,
      routingStatus: 'REVIEWED',
      decisionSource: 'HUMAN_REVIEW',
      reviewedBy: reviewerUserId,
      reviewedAt,
      reviewNotes: review_notes || null,
      finalAuthorityId: finalAuthId,
      finalDepartmentId: finalDeptId,
    });

    // 7. Phase 7: Automatically create operational case after human routing decision
    let createdCase = null;
    try {
      const caseService = require('../services/caseService');
      createdCase = await caseService.createCaseForReport(id, {
        ...updatedRouting,
        final_authority_id: finalAuthId,
        final_department_id: finalDeptId,
        authority_id: finalAuthId,
        department_id: finalDeptId,
        decision_source: 'HUMAN_REVIEW',
      }, {
        actor_user_id: reviewerUserId,
        note: `Case created following human review ${action.toLowerCase()}.`,
      });
    } catch (cErr) {
      console.warn(`[CaseService] Failed to create case after review for Report ${id}:`, cErr.message);
    }

    res.status(200).json({
      message: `Routing successfully ${action === 'APPROVE' ? 'approved' : 'overridden'} by reviewer.`,
      action,
      review: reviewRecord,
      routing: updatedRouting,
      case: createdCase,
    });
  } catch (err) {
    console.error('[Routing Review Error]', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Failed to apply routing review.',
    });
  }
});

/**
 * GET /api/reports/:id/routing-reviews
 * Fetches the audit trail of human review actions for a report.
 * Accessible to report owner, staff, or admin.
 */
router.get('/:id/routing-reviews', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const report = await db.getReportById(id);
    if (!report) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Report with ID '${id}' was not found.`,
      });
    }

    const isOwner = report.reporter_user_id === req.user.id;
    const isPrivileged = ['STAFF', 'ADMIN'].includes(req.user.role);
    if (!isOwner && !isPrivileged) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied.',
      });
    }

    const reviews = await db.getRoutingReviewsByReportId(id);
    res.status(200).json({
      reportId: id,
      reviews,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Failed to fetch review history.',
    });
  }
});

/**
 * GET /api/reports/:id/case
 * Citizen & Staff endpoint to retrieve the operational case and citizen-safe timeline.
 */
router.get('/:id/case', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const report = await db.getReportById(id);
    if (!report) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Report with ID '${id}' was not found.`,
      });
    }

    const isOwner = report.reporter_user_id === req.user.id;
    const isPrivileged = ['STAFF', 'ADMIN'].includes(req.user.role);
    if (!isOwner && !isPrivileged) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied. You do not have authorization to view this report case.',
      });
    }

    const caseService = require('../services/caseService');
    const caseItem = await caseService.getCaseByReportId(id, req.user);
    if (!caseItem) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No operational case has been created for this report yet.',
      });
    }

    const timeline = await caseService.getCaseTimeline(caseItem.id, req.user);

    res.json({
      case: {
        id: caseItem.id,
        report_id: caseItem.report_id,
        case_number: caseItem.case_number,
        status: caseItem.status,
        priority: caseItem.priority,
        authority_id: caseItem.authority_id,
        authority_name: caseItem.authority_name,
        authority_code: caseItem.authority_code,
        department_id: caseItem.department_id,
        department_name: caseItem.department_name,
        department_code: caseItem.department_code,
        jurisdiction_id: caseItem.jurisdiction_id,
        jurisdiction_name: caseItem.jurisdiction_name,
        assigned_to_name: isPrivileged ? caseItem.assigned_to_name : undefined,
        assigned_at: caseItem.assigned_at,
        acknowledged_at: caseItem.acknowledged_at,
        started_at: caseItem.started_at,
        resolved_at: caseItem.resolved_at,
        resolution_notes: caseItem.resolution_notes,
        created_at: caseItem.created_at,
      },
      timeline,
    });
  } catch (err) {
    res.status(err.status || 500).json({
      error: err.status === 403 ? 'Forbidden' : 'Internal Server Error',
      message: err.message,
    });
  }
});

module.exports = router;

