import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  ArrowLeft,
  Briefcase,
  AlertCircle,
  Clock,
  MapPin,
  Building2,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  UserCheck,
  UserPlus,
  Send,
  Lock,
  Globe,
  RefreshCw,
  FileText,
  AlertTriangle,
  History,
  Check,
  X,
} from 'lucide-react';

export const CaseDetail = () => {
  const { id } = useParams();
  const { token, user } = useAuth();

  const [caseItem, setCaseItem] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Modals & Action States
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [staffUsers, setStaffUsers] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Status transition state
  const [showOnHoldModal, setShowOnHoldModal] = useState(false);
  const [onHoldReason, setOnHoldReason] = useState('WAITING_FOR_MATERIAL');
  const [onHoldNote, setOnHoldNote] = useState('');

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [submittingStatus, setSubmittingStatus] = useState(false);

  // Operational note state
  const [noteContent, setNoteContent] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [addingNote, setAddingNote] = useState(false);

  const fetchCase = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCaseById(id, token);
      if (res.ok && res.data) {
        setCaseItem(res.data.case);
        setTimeline(res.data.timeline || []);
      } else {
        setError(res.data?.message || 'Failed to fetch case details');
      }
    } catch (err) {
      setError(err.message || 'Error loading case');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  // Load staff members for assignment
  const openAssignModal = async () => {
    setActionError(null);
    setShowAssignModal(true);
    try {
      const res = await api.getStaffUsers(token);
      if (res.ok && res.data) {
        const list = res.data.users || res.data.staff || [];
        setStaffUsers(list);
        if (list.length > 0) {
          setSelectedStaffId(list[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load staff list:', err);
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaffId) return;
    setAssigning(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await api.assignCase(
        id,
        {
          staff_id: selectedStaffId,
          note: assignNote.trim() || undefined,
        },
        token
      );

      if (res.ok) {
        setActionSuccess('Staff assigned successfully.');
        setShowAssignModal(false);
        setAssignNote('');
        fetchCase();
      } else {
        setActionError(res.data?.message || 'Failed to assign staff.');
      }
    } catch (err) {
      setActionError(err.message || 'Error performing assignment.');
    } finally {
      setAssigning(false);
    }
  };

  const handleStatusTransition = async (toStatus, payload = {}) => {
    setSubmittingStatus(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await api.updateCaseStatus(
        id,
        {
          status: toStatus,
          ...payload,
        },
        token
      );

      if (res.ok) {
        setActionSuccess(`Case successfully updated to ${toStatus}.`);
        setShowOnHoldModal(false);
        setShowResolveModal(false);
        fetchCase();
      } else {
        setActionError(res.data?.message || `Failed to update status to ${toStatus}.`);
      }
    } catch (err) {
      setActionError(err.message || 'Error updating case status.');
    } finally {
      setSubmittingStatus(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    setAddingNote(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await api.addCaseNote(
        id,
        {
          note: noteContent.trim(),
          is_internal: isInternalNote,
        },
        token
      );

      if (res.ok) {
        setActionSuccess('Operational note recorded to timeline.');
        setNoteContent('');
        fetchCase();
      } else {
        setActionError(res.data?.message || 'Failed to add note.');
      }
    } catch (err) {
      setActionError(err.message || 'Error adding note.');
    } finally {
      setAddingNote(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'UNASSIGNED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
            <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
            Unassigned
          </span>
        );
      case 'ASSIGNED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800">
            <UserCheck className="w-3.5 h-3.5 text-blue-500" />
            Assigned
          </span>
        );
      case 'ACKNOWLEDGED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            Acknowledged
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800">
            <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin-slow" />
            In Progress
          </span>
        );
      case 'ON_HOLD':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800">
            <PauseCircle className="w-3.5 h-3.5 text-purple-500" />
            On Hold
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Resolved
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 border border-gray-300 dark:bg-gray-800 dark:text-gray-300">
            Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-3" />
        <p className="text-gray-500">Loading case details and audit history...</p>
      </div>
    );
  }

  if (error || !caseItem) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Case Not Available</h2>
        <p className="text-gray-500 mt-2">{error || 'Case record could not be loaded.'}</p>
        <Link
          to="/staff/cases"
          className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Case Queue
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <Link
            to="/staff/cases"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Case Queue
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono text-gray-900 dark:text-white">
              {caseItem.case_number}
            </h1>
            {getStatusBadge(caseItem.status)}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Created: {new Date(caseItem.created_at).toLocaleString()} • Operational Incident ID: {caseItem.id}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to={`/reports/${caseItem.report_id}`}
            className="px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors shadow-sm"
          >
            View Citizen Report
          </Link>
          <button
            onClick={fetchCase}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
            title="Refresh Case"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Operational Actions Toolbar */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 border border-blue-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Operational Actions
            </span>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">
              Current Workflow Status: {caseItem.status}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Only authorized staff in {caseItem.department_name || caseItem.department_code} may execute state transitions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* UNASSIGNED -> ASSIGN */}
            {caseItem.status === 'UNASSIGNED' && (
              <button
                onClick={openAssignModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
              >
                <UserPlus className="w-4 h-4" />
                Assign Staff
              </button>
            )}

            {/* ASSIGNED -> ACKNOWLEDGE */}
            {caseItem.status === 'ASSIGNED' && (
              <>
                <button
                  onClick={() => handleStatusTransition('ACKNOWLEDGED', { note: 'Staff acknowledged receipt of case.' })}
                  disabled={submittingStatus}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm disabled:opacity-50"
                >
                  <Clock className="w-4 h-4" />
                  Acknowledge Case
                </button>
                <button
                  onClick={openAssignModal}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm"
                >
                  <UserCheck className="w-4 h-4" />
                  Reassign
                </button>
              </>
            )}

            {/* ACKNOWLEDGED -> START WORK */}
            {caseItem.status === 'ACKNOWLEDGED' && (
              <>
                <button
                  onClick={() => handleStatusTransition('IN_PROGRESS', { note: 'Field team dispatched and active on site.' })}
                  disabled={submittingStatus}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 shadow-sm disabled:opacity-50"
                >
                  <PlayCircle className="w-4 h-4" />
                  Start Work (In Progress)
                </button>
                <button
                  onClick={openAssignModal}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm"
                >
                  <UserCheck className="w-4 h-4" />
                  Reassign
                </button>
              </>
            )}

            {/* IN_PROGRESS -> ON_HOLD or RESOLVED */}
            {caseItem.status === 'IN_PROGRESS' && (
              <>
                <button
                  onClick={() => setShowOnHoldModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 shadow-sm"
                >
                  <PauseCircle className="w-4 h-4" />
                  Put On Hold
                </button>
                <button
                  onClick={() => setShowResolveModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mark Resolved
                </button>
                <button
                  onClick={openAssignModal}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm"
                >
                  <UserCheck className="w-4 h-4" />
                  Reassign
                </button>
              </>
            )}

            {/* ON_HOLD -> RESUME WORK */}
            {caseItem.status === 'ON_HOLD' && (
              <>
                <button
                  onClick={() => handleStatusTransition('IN_PROGRESS', { note: 'Obstacle cleared, work resumed by crew.' })}
                  disabled={submittingStatus}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 shadow-sm disabled:opacity-50"
                >
                  <PlayCircle className="w-4 h-4" />
                  Resume Work
                </button>
                <button
                  onClick={openAssignModal}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm"
                >
                  <UserCheck className="w-4 h-4" />
                  Reassign
                </button>
              </>
            )}

            {/* RESOLVED */}
            {caseItem.status === 'RESOLVED' && (
              <div className="text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Work completed by staff. Awaiting verification in later phase.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Details + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Case Information & Operational Notes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Problem & Location Details */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              Report & Operational Context
            </h2>

            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Citizen Problem Description</span>
                <p className="mt-1 text-sm text-gray-800 dark:text-gray-200 leading-relaxed bg-gray-50 dark:bg-gray-750 p-3.5 rounded-xl border border-gray-100 dark:border-gray-700">
                  {caseItem.report_description || 'No description provided.'}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                <div>
                  <span className="text-[11px] font-semibold text-gray-400 uppercase">Category</span>
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                    {caseItem.category || 'POTHOLE'}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-gray-400 uppercase">Jurisdiction</span>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">
                    {caseItem.jurisdiction_name || 'Ward 42'}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-gray-400 uppercase">Coordinates</span>
                  <p className="text-sm font-mono text-gray-800 dark:text-gray-200 mt-0.5">
                    {caseItem.latitude?.toFixed(4)}, {caseItem.longitude?.toFixed(4)}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-gray-400 uppercase">Location Status</span>
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                    {caseItem.location_status || 'VERIFIED'}
                  </p>
                </div>
              </div>

              {/* Photo thumbnail if present */}
              {caseItem.photo_url && (
                <div className="pt-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Citizen Photo Evidence</span>
                  <div className="mt-2">
                    <img
                      src={caseItem.photo_url}
                      alt="Citizen report visual evidence"
                      className="w-full max-h-64 object-cover rounded-xl border border-gray-200 dark:border-gray-700"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Department Ownership & Staff Assignment */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              Ownership & Staff Assignment
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-750 border border-gray-100 dark:border-gray-700">
                <span className="text-[11px] font-semibold text-gray-400 uppercase">Responsible Authority</span>
                <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">
                  {caseItem.authority_name} ({caseItem.authority_code})
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Primary civic governance authority</p>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-750 border border-gray-100 dark:border-gray-700">
                <span className="text-[11px] font-semibold text-gray-400 uppercase">Operating Department</span>
                <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">
                  {caseItem.department_name} ({caseItem.department_code})
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Assigned civic maintenance team</p>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-750 border border-gray-100 dark:border-gray-700">
                <span className="text-[11px] font-semibold text-gray-400 uppercase">Assigned Staff Officer</span>
                <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">
                  {caseItem.assigned_to_name ? (
                    <span className="text-blue-600 dark:text-blue-400">{caseItem.assigned_to_name}</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 font-normal">Unassigned</span>
                  )}
                </p>
                {caseItem.assigned_at && (
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Assigned: {new Date(caseItem.assigned_at).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-750 border border-gray-100 dark:border-gray-700">
                <span className="text-[11px] font-semibold text-gray-400 uppercase">Timestamps</span>
                <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1 mt-1 font-mono">
                  {caseItem.acknowledged_at && <div>Ack: {new Date(caseItem.acknowledged_at).toLocaleTimeString()}</div>}
                  {caseItem.started_at && <div>Start: {new Date(caseItem.started_at).toLocaleTimeString()}</div>}
                  {caseItem.resolved_at && <div className="text-emerald-600">Resolved: {new Date(caseItem.resolved_at).toLocaleTimeString()}</div>}
                  {!caseItem.acknowledged_at && <div className="text-gray-400">No operational actions yet</div>}
                </div>
              </div>
            </div>

            {/* If On Hold reason exists */}
            {caseItem.on_hold_reason && (
              <div className="mt-4 p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300">
                <div className="flex items-center gap-2 font-semibold text-xs uppercase tracking-wider">
                  <PauseCircle className="w-4 h-4 text-purple-600" />
                  On-Hold Reason: {caseItem.on_hold_reason}
                </div>
                {caseItem.on_hold_notes && (
                  <p className="text-xs mt-1 text-purple-800 dark:text-purple-200">
                    "{caseItem.on_hold_notes}"
                  </p>
                )}
              </div>
            )}

            {/* If Resolution note exists */}
            {caseItem.resolution_notes && (
              <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300">
                <div className="flex items-center gap-2 font-semibold text-xs uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Resolution Note (Work Claimed by Staff)
                </div>
                <p className="text-xs mt-1 text-emerald-800 dark:text-emerald-200">
                  "{caseItem.resolution_notes}"
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 italic">
                  Note: RESOLVED ≠ VERIFIED. Independent verification will occur in subsequent phase.
                </p>
              </div>
            )}
          </div>

          {/* Section 3: Add Operational Note */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-600" />
              Add Auditable Staff Note
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Add operational updates, field team dispatch logs, inspection notes, or citizen-visible advisories.
            </p>

            <form onSubmit={handleAddNote} className="space-y-3">
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="e.g. Inspection completed. Road surface patching team scheduled for 10:30 AM."
                rows={3}
                required
                className="w-full p-3 text-sm bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
              />

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInternalNote}
                    onChange={(e) => setIsInternalNote(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="flex items-center gap-1">
                    {isInternalNote ? <Lock className="w-3 h-3 text-amber-500" /> : <Globe className="w-3 h-3 text-blue-500" />}
                    {isInternalNote ? 'Internal staff only (hidden from citizen)' : 'Public update (visible to citizen)'}
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={addingNote || !noteContent.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-sm disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {addingNote ? 'Recording...' : 'Record Note'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Chronological Audit Event Timeline */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm sticky top-6">
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <History className="w-4 h-4 text-purple-600" />
              Case Event Timeline
            </h2>
            <p className="text-xs text-gray-500 mb-6">
              Immutable, server-recorded history of every state transition and staff action.
            </p>

            {timeline.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No case events recorded yet.</p>
            ) : (
              <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-750">
                {timeline.map((ev, idx) => (
                  <div key={ev.id || idx} className="relative">
                    {/* Circle marker */}
                    <div className="absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full bg-white dark:bg-gray-800 border-2 border-blue-600 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-gray-900 dark:text-white">
                          {ev.event_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {ev.from_status && ev.to_status && (
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-mono">
                          <span className="text-gray-400">{ev.from_status}</span>
                          <span className="text-gray-400">→</span>
                          <span className="font-bold text-blue-600 dark:text-blue-400">{ev.to_status}</span>
                        </div>
                      )}

                      {ev.note && (
                        <p className="mt-1 text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-750 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                          {ev.note}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                        <span>Actor: {ev.actor_name || 'System'}</span>
                        {ev.metadata?.is_internal && (
                          <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                            <Lock className="w-2.5 h-2.5" /> Internal
                          </span>
                        )}
                        {ev.metadata?.on_hold_reason && (
                          <span className="text-purple-600 dark:text-purple-400">
                            Reason: {ev.metadata.on_hold_reason}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL 1: Assign / Reassign Staff */}
      {showAssignModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              background: '#0f172a',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
              border: '1px solid #334155',
              color: '#fff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid #334155' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
                <UserCheck className="w-5 h-5 text-blue-500" />
                Assign Operational Staff
              </h3>
              <button
                onClick={() => setShowAssignModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  Select Staff Member ({caseItem.department_code || 'MCC'})
                </label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff', fontSize: '0.88rem' }}
                  required
                >
                  {staffUsers.length === 0 ? (
                    <option value="">No staff members available</option>
                  ) : (
                    staffUsers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.department_code || 'General Staff'})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  Assignment Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Assigned to morning sector patrol"
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || !selectedStaffId}
                  style={{ padding: '0.55rem 1.2rem', fontSize: '0.8rem', fontWeight: 700, color: '#fff', background: '#2563eb', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: assigning || !selectedStaffId ? 0.6 : 1 }}
                >
                  {assigning ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Put Case On Hold */}
      {showOnHoldModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              background: '#0f172a',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
              border: '1px solid #a855f7',
              color: '#fff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid #334155' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
                <PauseCircle className="w-5 h-5 text-purple-400" />
                Place Case On Hold
              </h3>
              <button
                onClick={() => setShowOnHoldModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  Structured Reason (Mandatory)
                </label>
                <select
                  value={onHoldReason}
                  onChange={(e) => setOnHoldReason(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff', fontSize: '0.88rem' }}
                >
                  <option value="WAITING_FOR_MATERIAL">Waiting for Material / Supplies</option>
                  <option value="WEATHER">Inclement Weather (Rain/Storm)</option>
                  <option value="ACCESS_BLOCKED">Access to Site Blocked</option>
                  <option value="REQUIRES_EXTERNAL_TEAM">Requires Specialized External Team</option>
                  <option value="OTHER">Other Operational Obstacle</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  Reason Explanation
                </label>
                <textarea
                  value={onHoldNote}
                  onChange={(e) => setOnHoldNote(e.target.value)}
                  placeholder="Explain why work cannot proceed right now..."
                  rows={3}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
                <button
                  type="button"
                  onClick={() => setShowOnHoldModal(false)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleStatusTransition('ON_HOLD', {
                      on_hold_reason: onHoldReason,
                      on_hold_notes: onHoldNote.trim() || undefined,
                      note: `Placed on hold: ${onHoldReason}. ${onHoldNote}`.trim(),
                    })
                  }
                  disabled={submittingStatus}
                  style={{ padding: '0.55rem 1.2rem', fontSize: '0.8rem', fontWeight: 700, color: '#fff', background: '#9333ea', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                >
                  {submittingStatus ? 'Updating...' : 'Put On Hold'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Mark Case Resolved */}
      {showResolveModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              background: '#0f172a',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
              border: '1px solid #10b981',
              color: '#fff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid #334155' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Resolve Operational Case
              </h3>
              <button
                onClick={() => setShowResolveModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '0.75rem', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', color: '#fcd34d', fontSize: '0.78rem' }}>
                <strong>Important Principle:</strong> Marking RESOLVED signifies that staff claims the work is complete. It does not mean the fix is independently verified yet (verification happens in a subsequent phase).
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  Resolution Note (Required) *
                </label>
                <textarea
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="e.g. Pothole filled and road surface restored with hot asphalt mix."
                  rows={3}
                  required
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleStatusTransition('RESOLVED', {
                      note: resolveNote.trim(),
                    })
                  }
                  disabled={submittingStatus || !resolveNote.trim()}
                  style={{ padding: '0.55rem 1.2rem', fontSize: '0.8rem', fontWeight: 700, color: '#fff', background: '#059669', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: submittingStatus || !resolveNote.trim() ? 0.6 : 1 }}
                >
                  {submittingStatus ? 'Resolving...' : 'Confirm Resolution'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseDetail;
