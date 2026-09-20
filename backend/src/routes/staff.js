const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { requireRole } = require('../middleware/requireRole');
const { db } = require('../config/db');

const router = express.Router();

/**
 * GET /api/staff/routing-review
 * Retrieves paginated queue of civic reports requiring human routing review.
 * 
 * Access: STAFF, ADMIN only.
 * CITIZEN requests receive 403 Forbidden.
 */
const caseService = require('../services/caseService');

/**
 * GET /api/staff/routing-review
 * Retrieves paginated queue of civic reports requiring human routing review.
 * 
 * Access: STAFF, ADMIN only.
 * CITIZEN requests receive 403 Forbidden.
 */
router.get('/routing-review', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = await db.getUnresolvedRoutingReviews({ page, limit });

    res.status(200).json({
      items: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  } catch (err) {
    console.error('[Staff API Error] Failed to fetch routing review queue:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Failed to fetch routing review queue.',
    });
  }
});

// =========================================================================
// PHASE 7: STAFF CASE WORKFLOW & LIFECYCLE ENDPOINTS
// =========================================================================

/**
 * GET /api/staff/cases
 * Retrieves paginated operational cases for staff workflow.
 * Supports views: 'active' (default), 'needs_attention', 'my_cases'.
 */
router.get('/cases', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      view = 'active',
      status,
      authorityId,
      departmentId,
      assignedTo,
      search,
    } = req.query;

    const result = await caseService.getCases(
      {
        page,
        limit,
        view,
        status,
        authority_id: authorityId,
        department_id: departmentId,
        assigned_to: assignedTo,
        search,
      },
      req.user
    );

    res.status(200).json({
      items: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  } catch (err) {
    console.error('[Staff API Error] Failed to fetch cases:', err);
    res.status(err.status || 500).json({
      error: err.status === 403 ? 'Forbidden' : 'Internal Server Error',
      message: err.message || 'Failed to fetch operational cases.',
    });
  }
});

/**
 * GET /api/staff/cases/:id
 * Retrieves detailed case information with citizen report, AI analysis,
 * jurisdiction, routing decision, and chronological case event timeline.
 */
router.get('/cases/:id', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const caseItem = await caseService.getCaseById(id, req.user);
    const timeline = await caseService.getCaseTimeline(id, req.user);

    res.status(200).json({
      case: caseItem,
      timeline,
    });
  } catch (err) {
    console.error(`[Staff API Error] Failed to fetch case ${req.params.id}:`, err);
    res.status(err.status || 500).json({
      error: err.status === 404 ? 'Not Found' : err.status === 403 ? 'Forbidden' : 'Internal Server Error',
      message: err.message || 'Failed to fetch case details.',
    });
  }
});

/**
 * PATCH /api/staff/cases/:id/status
 * Controlled state transition endpoint.
 * Validates transition rules, required reasons (ON_HOLD), notes (RESOLVED),
 * and creates atomic case event audit log entry.
 */
router.patch('/cases/:id/status', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note, on_hold_reason, on_hold_notes } = req.body;

    const updatedCase = await caseService.updateCaseStatus(
      id,
      {
        status,
        note,
        on_hold_reason,
        on_hold_notes,
      },
      req.user
    );

    const timeline = await caseService.getCaseTimeline(id, req.user);

    res.status(200).json({
      message: `Case status successfully updated to '${updatedCase.status}'.`,
      case: updatedCase,
      timeline,
    });
  } catch (err) {
    console.error(`[Staff API Error] Status transition failed for case ${req.params.id}:`, err);
    res.status(err.status || 500).json({
      error: err.status === 400 ? 'Bad Request' : err.status === 403 ? 'Forbidden' : err.status === 404 ? 'Not Found' : 'Internal Server Error',
      message: err.message || 'Failed to update case status.',
    });
  }
});

/**
 * PATCH /api/staff/cases/:id/assignment
 * Assigns or reassigns an operational staff member to a case.
 * Validates target staff role and authority/department scope.
 */
router.patch('/cases/:id/assignment', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const staff_id = req.body.staff_id || req.body.staff_user_id;

    const updatedCase = await caseService.assignCase(
      id,
      {
        staff_id,
        note,
      },
      req.user
    );

    const timeline = await caseService.getCaseTimeline(id, req.user);

    res.status(200).json({
      message: 'Case assignment updated successfully.',
      case: updatedCase,
      timeline,
    });
  } catch (err) {
    console.error(`[Staff API Error] Assignment failed for case ${req.params.id}:`, err);
    res.status(err.status || 500).json({
      error: err.status === 400 ? 'Bad Request' : err.status === 403 ? 'Forbidden' : err.status === 404 ? 'Not Found' : 'Internal Server Error',
      message: err.message || 'Failed to assign case.',
    });
  }
});

/**
 * POST /api/staff/cases/:id/notes
 * Appends an auditable operational note to the case timeline.
 */
router.post('/cases/:id/notes', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { note, is_internal = false } = req.body;

    const event = await caseService.addCaseNote(
      id,
      {
        note,
        is_internal,
      },
      req.user
    );

    res.status(201).json({
      message: 'Operational note added successfully.',
      event,
    });
  } catch (err) {
    console.error(`[Staff API Error] Adding note failed for case ${req.params.id}:`, err);
    res.status(err.status || 500).json({
      error: err.status === 400 ? 'Bad Request' : err.status === 403 ? 'Forbidden' : err.status === 404 ? 'Not Found' : 'Internal Server Error',
      message: err.message || 'Failed to add case note.',
    });
  }
});

/**
 * GET /api/staff/users
 * Lists available staff and admin users for assignment selection.
 */
router.get('/users', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res) => {
  try {
    const { authorityId, departmentId } = req.query;
    const users = await db.getStaffUsers({ authorityId, departmentId });
    res.status(200).json({
      users,
      staff: users,
    });
  } catch (err) {
    console.error('[Staff API Error] Failed to list staff users:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Failed to fetch staff users.',
    });
  }
});

module.exports = router;

