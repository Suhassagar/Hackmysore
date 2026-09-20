/**
 * caseService.js
 * CivicFlow Phase 7 — Staff Case Workflow & Lifecycle Service
 *
 * Core Principle:
 *   ROUTING IS NOT THE END.
 *   routed -> acknowledged -> in progress -> resolved
 *   Every important state transition must be auditable.
 */

const { db } = require('../config/db');
const mediaStorage = require('./storage');

const CASE_STATUS = {
  UNASSIGNED: 'UNASSIGNED',
  ASSIGNED: 'ASSIGNED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  IN_PROGRESS: 'IN_PROGRESS',
  ON_HOLD: 'ON_HOLD',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
};

// Backend-enforced state transition rules
// Phase 8: RESOLVED can be reopened to IN_PROGRESS when a resolution dispute occurs
const VALID_CASE_TRANSITIONS = {
  UNASSIGNED: ['ASSIGNED'],
  ASSIGNED: ['ACKNOWLEDGED', 'ASSIGNED'], // Can be acknowledged or reassigned
  ACKNOWLEDGED: ['IN_PROGRESS', 'ASSIGNED'], // Can start work or be reassigned
  IN_PROGRESS: ['ON_HOLD', 'RESOLVED', 'ASSIGNED'],
  ON_HOLD: ['IN_PROGRESS', 'ASSIGNED'], // Can resume work or be reassigned
  RESOLVED: ['CLOSED', 'IN_PROGRESS'], // Operational closure or reopening upon citizen dispute
  CLOSED: [], // Terminal state
};

// Structured On-Hold reasons
const VALID_ON_HOLD_REASONS = [
  'WAITING_FOR_MATERIAL',
  'WEATHER',
  'ACCESS_BLOCKED',
  'REQUIRES_EXTERNAL_TEAM',
  'OTHER',
];

class CaseService {
  /**
   * Verify whether a user is authorized to view or act upon a case
   */
  canUserAccessCase(user, civicCase, isWriteAction = false) {
    if (!user) return false;

    // 1. ADMIN has global access across all authorities and departments
    if (user.role === 'ADMIN') {
      return true;
    }

    // 2. CITIZEN can only view their own report's case (no write actions)
    if (user.role === 'CITIZEN') {
      if (isWriteAction) return false;
      return civicCase.report_user_id === user.id;
    }

    // 3. STAFF permissions
    if (user.role === 'STAFF') {
      // If staff user is directly assigned to the case, they can always act
      if (civicCase.assigned_to && civicCase.assigned_to === user.id) {
        return true;
      }

      // Check authority scope
      if (user.authority_id && user.authority_id !== civicCase.authority_id) {
        return false;
      }

      // Check department scope
      if (user.department_id && user.department_id !== civicCase.department_id) {
        // Staff from another department cannot modify this case
        if (isWriteAction) return false;
      }

      return true;
    }

    return false;
  }

  /**
   * Automatically or manually create an operational case from a routed report.
   * Idempotent: duplicate calls for the same report return the existing case.
   */
  async createCaseForReport(reportId, routingSnapshot, options = {}) {
    if (!reportId) throw new Error('reportId is required to create a case');

    // Check if case already exists
    const existing = await db.getCaseByReportId(reportId);
    if (existing) {
      return existing;
    }

    // Case creation policy:
    // Only create operational cases if routing produced a valid route:
    // AUTO_ROUTED OR decision_source === 'HUMAN_REVIEW' OR route_status === 'ROUTED'
    const isAutoRouted = routingSnapshot?.routing_status === 'AUTO_ROUTED';
    const isHumanReviewed = routingSnapshot?.decision_source === 'HUMAN_REVIEW';
    const isStandardRouted = routingSnapshot?.route_status === 'ROUTED';

    if (!isAutoRouted && !isHumanReviewed && !isStandardRouted) {
      // Cannot create an operational case for unrouted / review-pending reports
      return null;
    }

    const authorityId = routingSnapshot.final_authority_id || routingSnapshot.authority_id;
    const departmentId = routingSnapshot.final_department_id || routingSnapshot.department_id;

    if (!authorityId || !departmentId) {
      return null;
    }

    // Determine initial priority
    const priority = options.priority || 'MEDIUM';

    const caseData = {
      report_id: reportId,
      routing_id: routingSnapshot.id || null,
      authority_id: authorityId,
      department_id: departmentId,
      jurisdiction_id: routingSnapshot.jurisdiction_id || null,
      jurisdiction_boundary_id: routingSnapshot.jurisdiction_boundary_id || null,
      responsibility_rule_id: routingSnapshot.responsibility_rule_id || null,
      priority,
      status: options.assigned_to ? CASE_STATUS.ASSIGNED : CASE_STATUS.UNASSIGNED,
      assigned_to: options.assigned_to || null,
      actor_user_id: options.actor_user_id || null,
      note: options.note || (isHumanReviewed ? 'Case created following human review approval.' : 'Case created automatically from deterministic route.'),
    };

    return await db.createCase(caseData);
  }

  /**
   * Retrieve a single case by ID with security checks
   */
  async getCaseById(caseId, user) {
    const civicCase = await db.getCaseById(caseId);
    if (!civicCase) {
      const err = new Error('Case not found');
      err.status = 404;
      throw err;
    }

    if (!this.canUserAccessCase(user, civicCase, false)) {
      const err = new Error('Access Denied: You do not have authorization to view this case.');
      err.status = 403;
      throw err;
    }

    return civicCase;
  }

  /**
   * Retrieve a case for a report ID with security checks
   */
  async getCaseByReportId(reportId, user) {
    const civicCase = await db.getCaseByReportId(reportId);
    if (!civicCase) return null;

    if (!this.canUserAccessCase(user, civicCase, false)) {
      const err = new Error('Access Denied: You do not have authorization to view this case.');
      err.status = 403;
      throw err;
    }

    return civicCase;
  }

  /**
   * Retrieve operational cases queue for staff/admin
   */
  async getCases(options, user) {
    if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
      const err = new Error('Access Denied: Staff or Administrator privileges required.');
      err.status = 403;
      throw err;
    }

    const filters = { ...options };

    // Scoping for non-admin staff
    if (user.role === 'STAFF') {
      if (user.authority_id && !filters.authority_id) {
        filters.authority_id = user.authority_id;
      }
      if (filters.view === 'my_cases') {
        filters.assigned_to = user.id;
      }
    }

    return await db.getCases(filters);
  }

  /**
   * Perform a controlled case status transition
   */
  async updateCaseStatus(caseId, transitionPayload, user) {
    if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
      const err = new Error('Access Denied: Only authorized staff or administrators may update case status.');
      err.status = 403;
      throw err;
    }

    const civicCase = await db.getCaseById(caseId);
    if (!civicCase) {
      const err = new Error('Case not found');
      err.status = 404;
      throw err;
    }

    // Authorization check for write action
    if (!this.canUserAccessCase(user, civicCase, true)) {
      const err = new Error("Access Denied: You are not authorized to modify another department's case.");
      err.status = 403;
      throw err;
    }

    const { status: toStatus, note, on_hold_reason, on_hold_notes } = transitionPayload;

    if (!toStatus || !Object.values(CASE_STATUS).includes(toStatus)) {
      const err = new Error(`Invalid status '${toStatus}'. Must be one of: ${Object.values(CASE_STATUS).join(', ')}`);
      err.status = 400;
      throw err;
    }

    // Idempotency: If already at target status, return cleanly without duplicating events
    if (civicCase.status === toStatus) {
      return civicCase;
    }

    // Enforce valid state transitions
    const allowed = VALID_CASE_TRANSITIONS[civicCase.status] || [];
    if (!allowed.includes(toStatus)) {
      const err = new Error(
        `Invalid status transition from '${civicCase.status}' to '${toStatus}'. Permitted transitions: ${allowed.length ? allowed.join(', ') : 'none (terminal state)'}`
      );
      err.status = 400;
      throw err;
    }

    // Validation for ON_HOLD
    if (toStatus === CASE_STATUS.ON_HOLD) {
      if (!on_hold_reason || !VALID_ON_HOLD_REASONS.includes(on_hold_reason)) {
        const err = new Error(`Setting case ON_HOLD requires a valid reason from: ${VALID_ON_HOLD_REASONS.join(', ')}`);
        err.status = 400;
        throw err;
      }
    }

    // Validation for RESOLVED (Resolution note is required)
    if (toStatus === CASE_STATUS.RESOLVED) {
      if (!note || !note.trim()) {
        const err = new Error('Marking a case as RESOLVED requires a resolution note explaining work completed.');
        err.status = 400;
        throw err;
      }
    }

    // Validation for reopening: can only reopen to IN_PROGRESS if previous resolution is DISPUTED
    if (civicCase.status === CASE_STATUS.RESOLVED && toStatus === CASE_STATUS.IN_PROGRESS) {
      const currentVer = await db.getCurrentVerificationByCaseId(caseId);
      if (!currentVer || currentVer.status !== 'DISPUTED') {
        const err = new Error('Case can only be reopened to IN_PROGRESS when resolution is in DISPUTED state.');
        err.status = 400;
        throw err;
      }
    }

    await db.updateCaseStatus(caseId, {
      toStatus,
      actorUserId: user.id,
      note: note ? note.trim() : null,
      onHoldReason: on_hold_reason || null,
      onHoldNotes: on_hold_notes ? on_hold_notes.trim() : null,
    });

    // Phase 8: When resolved, handle resolution evidence & create verification record
    if (toStatus === CASE_STATUS.RESOLVED) {
      let mediaUrl = transitionPayload.evidence?.media_url || transitionPayload.media_url || null;
      const photoData = transitionPayload.evidence?.photoData || transitionPayload.photoData || null;

      if (photoData) {
        try {
          mediaUrl = await mediaStorage.upload(photoData);
        } catch (uploadErr) {
          console.warn(`[CaseService] Evidence upload failed for case ${caseId}:`, uploadErr.message);
        }
      }

      let evidenceRecord = null;
      if (mediaUrl || note) {
        evidenceRecord = await db.createResolutionEvidence({
          caseId,
          submittedBy: user.id,
          evidenceType: mediaUrl ? 'PHOTO' : 'NOTE_ONLY',
          mediaUrl: mediaUrl || null,
          resolutionNote: note.trim(),
          latitude: transitionPayload.evidence?.latitude || transitionPayload.latitude || null,
          longitude: transitionPayload.evidence?.longitude || transitionPayload.longitude || null,
          metadata: transitionPayload.evidence?.metadata || {},
        });
      }

      const history = await db.getVerificationHistoryByCaseId(caseId);
      const cycleNumber = (history && history.length > 0) ? history[history.length - 1].cycle_number + 1 : 1;

      await db.createCaseVerification({
        caseId,
        resolutionEvidenceId: evidenceRecord ? evidenceRecord.id : null,
        resolutionNote: note.trim(),
        cycleNumber,
        status: 'PENDING',
      });

      await db.recordCaseEvent(caseId, {
        eventType: 'RESOLUTION_SUBMITTED',
        fromStatus: civicCase.status,
        toStatus: 'RESOLVED',
        actorUserId: user.id,
        note: note.trim(),
        metadata: {
          evidence_id: evidenceRecord ? evidenceRecord.id : null,
          media_url: mediaUrl || null,
          cycle_number: cycleNumber,
        },
      });
    }

    // Phase 8: When reopened from DISPUTED, update verification and emit CASE_REOPENED event
    if (civicCase.status === CASE_STATUS.RESOLVED && toStatus === CASE_STATUS.IN_PROGRESS) {
      const currentVer = await db.getCurrentVerificationByCaseId(caseId);
      if (currentVer && currentVer.status === 'DISPUTED') {
        await db.updateCaseVerification(currentVer.id, {
          reopened_by: user.id,
          reopened_at: new Date(),
          reopen_notes: note ? note.trim() : 'Case reopened for rework',
        });

        await db.recordCaseEvent(caseId, {
          eventType: 'CASE_REOPENED',
          fromStatus: 'RESOLVED',
          toStatus: 'IN_PROGRESS',
          actorUserId: user.id,
          note: note ? note.trim() : 'Case reopened following citizen dispute',
          metadata: { cycle_number: currentVer.cycle_number },
        });
      }
    }

    return await this.getCaseById(caseId, user);
  }

  /**
   * Assign or reassign a staff member to a case
   */
  async assignCase(caseId, assignPayload, user) {
    if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
      const err = new Error('Access Denied: Only authorized staff or administrators may assign cases.');
      err.status = 403;
      throw err;
    }

    const civicCase = await db.getCaseById(caseId);
    if (!civicCase) {
      const err = new Error('Case not found');
      err.status = 404;
      throw err;
    }

    if (!this.canUserAccessCase(user, civicCase, true)) {
      const err = new Error("Access Denied: You are not authorized to assign another department's case.");
      err.status = 403;
      throw err;
    }

    const staff_id = assignPayload.staff_id || assignPayload.staff_user_id;
    const note = assignPayload.note;
    if (!staff_id) {
      const err = new Error('staff_id is required for assignment');
      err.status = 400;
      throw err;
    }

    // Validate target staff user
    const targetUser = await db.getUserById(staff_id);
    if (!targetUser) {
      const err = new Error(`Staff user '${staff_id}' not found`);
      err.status = 404;
      throw err;
    }

    if (targetUser.role !== 'STAFF' && targetUser.role !== 'ADMIN') {
      const err = new Error('Cases can only be assigned to users with STAFF or ADMIN role');
      err.status = 400;
      throw err;
    }

    // Validate authority/department matching for target staff
    if (targetUser.role === 'STAFF') {
      if (targetUser.authority_id && targetUser.authority_id !== civicCase.authority_id) {
        const err = new Error('Cannot assign case to staff member of a different civic authority');
        err.status = 400;
        throw err;
      }
      if (targetUser.department_id && targetUser.department_id !== civicCase.department_id) {
        const err = new Error('Cannot assign case to staff member of a different department');
        err.status = 400;
        throw err;
      }
    }

    // Idempotency: If already assigned to this user, return cleanly
    if (civicCase.assigned_to === staff_id) {
      return civicCase;
    }

    await db.updateCaseAssignment(caseId, {
      assignedToUserId: staff_id,
      actorUserId: user.id,
      note: note ? note.trim() : null,
    });

    return await this.getCaseById(caseId, user);
  }

  /**
   * Add an operational staff note to the case audit timeline
   */
  async addCaseNote(caseId, notePayload, user) {
    if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
      const err = new Error('Access Denied: Only staff or administrators can add operational notes.');
      err.status = 403;
      throw err;
    }

    const civicCase = await db.getCaseById(caseId);
    if (!civicCase) {
      const err = new Error('Case not found');
      err.status = 404;
      throw err;
    }

    if (!this.canUserAccessCase(user, civicCase, true)) {
      const err = new Error("Access Denied: You are not authorized to add notes to another department's case.");
      err.status = 403;
      throw err;
    }

    const { note, is_internal = false } = notePayload;
    if (!note || !note.trim()) {
      const err = new Error('Note content cannot be empty');
      err.status = 400;
      throw err;
    }

    return await db.addCaseNote(caseId, {
      actorUserId: user.id,
      note: note.trim(),
      isInternal: Boolean(is_internal),
    });
  }

  /**
   * Get chronological events timeline for a case
   */
  async getCaseTimeline(caseId, user) {
    const civicCase = await db.getCaseById(caseId);
    if (!civicCase) {
      const err = new Error('Case not found');
      err.status = 404;
      throw err;
    }

    if (!this.canUserAccessCase(user, civicCase, false)) {
      const err = new Error('Access Denied');
      err.status = 403;
      throw err;
    }

    const events = await db.getCaseEventsByCaseId(caseId);

    // If citizen, filter out notes marked as internal
    if (user.role === 'CITIZEN') {
      return events.filter((e) => !e.metadata || !e.metadata.is_internal);
    }

    return events;
  }

  // =========================================================================
  // Phase 8: Resolution Verification Lifecycle Methods
  // =========================================================================

  /**
   * Resolve a case with mandatory resolution note and optional resolution evidence
   */
  async resolveCaseWithEvidence(caseId, payload, user) {
    const { note, evidence, photoData, media_url, latitude, longitude } = payload;
    return await this.updateCaseStatus(
      caseId,
      {
        status: CASE_STATUS.RESOLVED,
        note,
        evidence: evidence || {
          photoData,
          media_url,
          latitude,
          longitude,
        },
      },
      user
    );
  }

  /**
   * Citizen confirms resolution -> VERIFIED
   */
  async confirmResolution(reportIdOrCaseId, user) {
    if (!user) {
      const err = new Error('Authentication required.');
      err.status = 401;
      throw err;
    }

    if (user.role === 'STAFF') {
      const err = new Error('Access Denied: Staff cannot verify resolutions on behalf of citizens.');
      err.status = 403;
      throw err;
    }

    // Resolve case object
    let civicCase = null;
    if (isUuid(reportIdOrCaseId)) {
      civicCase = await db.getCaseById(reportIdOrCaseId);
      if (!civicCase) {
        civicCase = await db.getCaseByReportId(reportIdOrCaseId);
      }
    }
    if (!civicCase) {
      const err = new Error('Case not found.');
      err.status = 404;
      throw err;
    }

    // Ownership check: citizen must own original report
    if (user.role === 'CITIZEN' && civicCase.report_user_id !== user.id) {
      const err = new Error('Access Denied: You do not have authorization to verify another citizen\'s report.');
      err.status = 403;
      throw err;
    }

    if (civicCase.status !== CASE_STATUS.RESOLVED) {
      const err = new Error(`Cannot verify unresolved case. Current status: ${civicCase.status}`);
      err.status = 400;
      throw err;
    }

    const currentVer = await db.getCurrentVerificationByCaseId(civicCase.id);
    if (!currentVer || currentVer.status !== 'PENDING') {
      const err = new Error(
        `No pending verification available to confirm. Current state: ${currentVer ? currentVer.status : 'NONE'}`
      );
      err.status = 400;
      throw err;
    }

    // Update verification record to VERIFIED
    const updatedVer = await db.updateCaseVerification(currentVer.id, {
      status: 'VERIFIED',
      verified_by: user.id,
      verified_at: new Date(),
    });

    // Record immutable audit event
    await db.recordCaseEvent(civicCase.id, {
      eventType: 'RESOLUTION_VERIFIED',
      fromStatus: 'RESOLVED',
      toStatus: 'RESOLVED',
      actorUserId: user.id,
      note: 'Citizen confirmed physical resolution is complete.',
      metadata: {
        cycle_number: currentVer.cycle_number,
        verification_id: currentVer.id,
      },
    });

    return {
      case: await this.getCaseById(civicCase.id, user),
      verification: updatedVer,
      message: 'Resolution successfully verified.',
    };
  }

  /**
   * Citizen disputes resolution -> DISPUTED
   */
  async disputeResolution(reportIdOrCaseId, disputePayload, user) {
    if (!user) {
      const err = new Error('Authentication required.');
      err.status = 401;
      throw err;
    }

    if (user.role === 'STAFF') {
      const err = new Error('Access Denied: Staff cannot dispute resolutions on behalf of citizens.');
      err.status = 403;
      throw err;
    }

    const reason = disputePayload?.reason || disputePayload?.dispute_reason || disputePayload?.disputeReason;
    if (!reason || !reason.trim()) {
      const err = new Error('A valid dispute reason explaining why the issue still exists is mandatory.');
      err.status = 400;
      throw err;
    }

    let civicCase = null;
    if (isUuid(reportIdOrCaseId)) {
      civicCase = await db.getCaseById(reportIdOrCaseId);
      if (!civicCase) {
        civicCase = await db.getCaseByReportId(reportIdOrCaseId);
      }
    }
    if (!civicCase) {
      const err = new Error('Case not found.');
      err.status = 404;
      throw err;
    }

    if (user.role === 'CITIZEN' && civicCase.report_user_id !== user.id) {
      const err = new Error('Access Denied: You do not have authorization to dispute another citizen\'s report.');
      err.status = 403;
      throw err;
    }

    if (civicCase.status !== CASE_STATUS.RESOLVED) {
      const err = new Error(`Cannot dispute unresolved case. Current status: ${civicCase.status}`);
      err.status = 400;
      throw err;
    }

    const currentVer = await db.getCurrentVerificationByCaseId(civicCase.id);
    if (!currentVer || currentVer.status !== 'PENDING') {
      const err = new Error(
        `No pending verification available to dispute. Current state: ${currentVer ? currentVer.status : 'NONE'}`
      );
      err.status = 400;
      throw err;
    }

    // Update verification record to DISPUTED
    const updatedVer = await db.updateCaseVerification(currentVer.id, {
      status: 'DISPUTED',
      disputed_by: user.id,
      disputed_at: new Date(),
      dispute_reason: reason.trim(),
    });

    // Record immutable audit event
    await db.recordCaseEvent(civicCase.id, {
      eventType: 'RESOLUTION_DISPUTED',
      fromStatus: 'RESOLVED',
      toStatus: 'RESOLVED',
      actorUserId: user.id,
      note: reason.trim(),
      metadata: {
        cycle_number: currentVer.cycle_number,
        verification_id: currentVer.id,
      },
    });

    return {
      case: await this.getCaseById(civicCase.id, user),
      verification: updatedVer,
      message: 'Resolution dispute submitted successfully.',
    };
  }

  /**
   * Reopen a disputed case -> returns to IN_PROGRESS
   */
  async reopenDisputedCase(caseId, reopenPayload, user) {
    if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
      const err = new Error('Access Denied: Only authorized staff or administrators may reopen cases.');
      err.status = 403;
      throw err;
    }

    const civicCase = await db.getCaseById(caseId);
    if (!civicCase) {
      const err = new Error('Case not found');
      err.status = 404;
      throw err;
    }

    if (!this.canUserAccessCase(user, civicCase, true)) {
      const err = new Error("Access Denied: You are not authorized to reopen another department's case.");
      err.status = 403;
      throw err;
    }

    if (civicCase.status !== CASE_STATUS.RESOLVED) {
      const err = new Error(`Only RESOLVED cases can be reopened. Current case status: ${civicCase.status}`);
      err.status = 400;
      throw err;
    }

    const currentVer = await db.getCurrentVerificationByCaseId(caseId);
    if (!currentVer || currentVer.status !== 'DISPUTED') {
      const err = new Error('Case can only be reopened when resolution is in DISPUTED state.');
      err.status = 400;
      throw err;
    }

    const note = reopenPayload?.note || reopenPayload?.reopen_notes || 'Reopened following citizen dispute.';

    return await this.updateCaseStatus(
      caseId,
      {
        status: CASE_STATUS.IN_PROGRESS,
        note: note.trim(),
      },
      user
    );
  }

  /**
   * Retrieve verification details and historical cycles for a report or case
   */
  async getCaseVerification(reportIdOrCaseId, user) {
    let civicCase = null;
    if (isUuid(reportIdOrCaseId)) {
      civicCase = await db.getCaseById(reportIdOrCaseId);
      if (!civicCase) {
        civicCase = await db.getCaseByReportId(reportIdOrCaseId);
      }
    }
    if (!civicCase) {
      const err = new Error('Case not found');
      err.status = 404;
      throw err;
    }

    if (!this.canUserAccessCase(user, civicCase, false)) {
      const err = new Error('Access Denied');
      err.status = 403;
      throw err;
    }

    const current = await db.getCurrentVerificationByCaseId(civicCase.id);
    const history = await db.getVerificationHistoryByCaseId(civicCase.id);
    const evidence = await db.getResolutionEvidenceByCaseId(civicCase.id);

    return {
      case_id: civicCase.id,
      case_number: civicCase.case_number,
      current_verification: current,
      history,
      evidence,
    };
  }
}

function isUuid(val) {
  return typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

module.exports = new CaseService();
