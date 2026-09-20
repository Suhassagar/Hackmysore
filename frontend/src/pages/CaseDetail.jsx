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
  History,
  X,
  ShieldAlert,
} from 'lucide-react';

export const CaseDetail = () => {
  const { id } = useParams();
  const { token, user, role } = useAuth();

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
        setActionSuccess(`Case successfully moved to ${toStatus}.`);
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
        setActionError(res.data?.message || 'Failed to record note.');
      }
    } catch (err) {
      setActionError(err.message || 'Error recording operational note.');
    } finally {
      setAddingNote(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'UNASSIGNED':
        return (
          <span className="status-pill status-pill-unassigned">
            <AlertCircle size={12} />
            Unassigned
          </span>
        );
      case 'ASSIGNED':
        return (
          <span className="status-pill status-pill-assigned">
            <UserCheck size={12} />
            Assigned
          </span>
        );
      case 'ACKNOWLEDGED':
        return (
          <span className="status-pill status-pill-acknowledged">
            <Clock size={12} />
            Acknowledged
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="status-pill status-pill-in-progress">
            <RefreshCw size={12} className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
            In Progress
          </span>
        );
      case 'ON_HOLD':
        return (
          <span className="status-pill status-pill-on-hold">
            <PauseCircle size={12} />
            On Hold
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="status-pill status-pill-resolved">
            <CheckCircle2 size={12} />
            Resolved
          </span>
        );
      case 'CLOSED':
        return (
          <span className="status-pill status-pill-closed">
            Closed
          </span>
        );
      default:
        return (
          <span className="status-pill" style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-main)' }}>
            {status}
          </span>
        );
    }
  };

  if (role !== 'STAFF' && role !== 'ADMIN') {
    return (
      <div className="cases-page-container">
        <div className="card" style={{ maxWidth: '540px', margin: '4rem auto', textAlign: 'center', padding: '2.5rem' }}>
          <ShieldAlert size={48} color="#ef4444" style={{ margin: '0 auto 1rem auto' }} />
          <h2>Access Restricted</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Only designated municipal staff and administrators have permission to access operational cases.
          </p>
          <div style={{ marginTop: '1.5rem' }}>
            <Link to="/" className="btn btn-primary">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="cases-page-container" style={{ textAlign: 'center', padding: '6rem 0' }}>
        <div className="spinner" style={{ margin: '0 auto 1rem auto' }} />
        <p style={{ color: 'var(--text-muted)' }}>Loading operational case details & timeline...</p>
      </div>
    );
  }

  if (error || !caseItem) {
    return (
      <div className="cases-page-container">
        <div className="card" style={{ maxWidth: '560px', margin: '4rem auto', textAlign: 'center', padding: '2.5rem' }}>
          <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 1rem auto' }} />
          <h2>Case Record Not Available</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>{error || 'Unable to retrieve case.'}</p>
          <div style={{ marginTop: '1.5rem' }}>
            <Link to="/staff/cases" className="btn btn-primary">
              <ArrowLeft size={16} /> Back to Case Queue
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cases-page-container">
      {/* Top Navigation & Header */}
      <div style={{ marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)' }}>
        <Link
          to="/staff/cases"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}
        >
          <ArrowLeft size={14} /> Back to Case Queue
        </Link>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'monospace', color: '#60a5fa', margin: 0 }}>
                {caseItem.case_number}
              </h1>
              {getStatusBadge(caseItem.status)}
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Created: {new Date(caseItem.created_at).toLocaleString()} • Incident ID: <span style={{ fontFamily: 'monospace' }}>{caseItem.id}</span>
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link
              to={`/reports/${caseItem.report_id}`}
              className="btn btn-outline"
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            >
              View Citizen Report
            </Link>
            <button
              onClick={fetchCase}
              className="btn btn-outline"
              style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Refresh Case"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {actionSuccess && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{actionError}</span>
        </div>
      )}

      {/* Operational Actions Toolbar */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(17, 24, 39, 0.95) 100%)',
          borderColor: 'rgba(59, 130, 246, 0.3)',
          marginBottom: '2rem',
          padding: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#60a5fa', marginBottom: '0.2rem' }}>
              Operational Actions Toolbar
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Current Status: {caseItem.status}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Department Ownership: <strong>{caseItem.department_name || caseItem.department_code || 'General'}</strong>
            </p>
          </div>

          {/* Action buttons matching status */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
            {caseItem.status === 'UNASSIGNED' && (
              <button onClick={openAssignModal} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                <UserPlus size={15} /> Assign Staff Member
              </button>
            )}

            {caseItem.status === 'ASSIGNED' && (
              <>
                <button
                  onClick={() => handleStatusTransition('ACKNOWLEDGED', { note: 'Staff acknowledged receipt of case.' })}
                  disabled={submittingStatus}
                  className="btn"
                  style={{ background: '#4f46e5', color: '#fff', fontSize: '0.85rem' }}
                >
                  <Clock size={15} /> Acknowledge Case
                </button>
                <button onClick={openAssignModal} className="btn btn-outline" style={{ fontSize: '0.85rem' }}>
                  <UserCheck size={15} /> Reassign
                </button>
              </>
            )}

            {caseItem.status === 'ACKNOWLEDGED' && (
              <>
                <button
                  onClick={() => handleStatusTransition('IN_PROGRESS', { note: 'Field team dispatched and active on site.' })}
                  disabled={submittingStatus}
                  className="btn"
                  style={{ background: '#d97706', color: '#fff', fontSize: '0.85rem' }}
                >
                  <PlayCircle size={15} /> Start Work (In Progress)
                </button>
                <button onClick={openAssignModal} className="btn btn-outline" style={{ fontSize: '0.85rem' }}>
                  <UserCheck size={15} /> Reassign
                </button>
              </>
            )}

            {caseItem.status === 'IN_PROGRESS' && (
              <>
                <button
                  onClick={() => setShowOnHoldModal(true)}
                  className="btn"
                  style={{ background: '#7c3aed', color: '#fff', fontSize: '0.85rem' }}
                >
                  <PauseCircle size={15} /> Put On Hold
                </button>
                <button
                  onClick={() => setShowResolveModal(true)}
                  className="btn"
                  style={{ background: '#059669', color: '#fff', fontSize: '0.85rem' }}
                >
                  <CheckCircle2 size={15} /> Mark Resolved
                </button>
                <button onClick={openAssignModal} className="btn btn-outline" style={{ fontSize: '0.85rem' }}>
                  <UserCheck size={15} /> Reassign
                </button>
              </>
            )}

            {caseItem.status === 'ON_HOLD' && (
              <>
                <button
                  onClick={() => handleStatusTransition('IN_PROGRESS', { note: 'Obstacle cleared; work resumed on site.' })}
                  disabled={submittingStatus}
                  className="btn"
                  style={{ background: '#d97706', color: '#fff', fontSize: '0.85rem' }}
                >
                  <PlayCircle size={15} /> Resume Work
                </button>
                <button onClick={openAssignModal} className="btn btn-outline" style={{ fontSize: '0.85rem' }}>
                  <UserCheck size={15} /> Reassign
                </button>
              </>
            )}

            {caseItem.status === 'RESOLVED' && (
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6ee7b7', background: 'rgba(16, 185, 129, 0.15)', padding: '0.45rem 0.9rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                ✓ Work complete by staff. Awaiting independent verification in Phase 8.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main 2-Column Content */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.75rem', alignItems: 'start' }}>
        {/* Column 1: Details & Notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Section: Problem Description & Location */}
          <div className="card">
            <h3 className="card-title">
              <FileText size={18} color="#3b82f6" /> Report Information
            </h3>

            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                  Citizen Description
                </span>
                <p style={{ marginTop: '0.35rem', background: 'var(--bg-primary)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  {caseItem.report_description || 'No description provided.'}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Category</span>
                  <div style={{ fontWeight: 700, color: '#60a5fa', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                    {caseItem.category || 'CIVIC ISSUE'}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Jurisdiction</span>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                    {caseItem.jurisdiction_name || 'Ward 42'}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Coordinates</span>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                    {caseItem.latitude?.toFixed(4)}, {caseItem.longitude?.toFixed(4)}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Priority</span>
                  <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                    {caseItem.priority || 'MEDIUM'}
                  </div>
                </div>
              </div>

              {caseItem.photo_url && (
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                    Citizen Photo Evidence
                  </span>
                  <div style={{ marginTop: '0.5rem' }}>
                    <img
                      src={caseItem.photo_url}
                      alt="Citizen evidence"
                      style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section: Operational Department & Assignment */}
          <div className="card">
            <h3 className="card-title">
              <Building2 size={18} color="#818cf8" /> Governance & Operating Unit
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', marginTop: '1rem' }}>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Responsible Authority</span>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                  {caseItem.authority_name || caseItem.authority_code}
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Operating Department</span>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                  {caseItem.department_name || caseItem.department_code}
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assigned Officer</span>
                <div style={{ fontWeight: 700, color: caseItem.assigned_to_name ? '#60a5fa' : '#f59e0b', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                  {caseItem.assigned_to_name || 'Awaiting assignment'}
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Timestamps</span>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontFamily: 'monospace', lineHeight: 1.4 }}>
                  {caseItem.assigned_at && <div>Assigned: {new Date(caseItem.assigned_at).toLocaleTimeString()}</div>}
                  {caseItem.acknowledged_at && <div>Ack: {new Date(caseItem.acknowledged_at).toLocaleTimeString()}</div>}
                  {caseItem.started_at && <div>Start: {new Date(caseItem.started_at).toLocaleTimeString()}</div>}
                  {caseItem.resolved_at && <div style={{ color: '#6ee7b7' }}>Resolved: {new Date(caseItem.resolved_at).toLocaleTimeString()}</div>}
                  {!caseItem.acknowledged_at && <div>No operational timestamps</div>}
                </div>
              </div>
            </div>

            {/* Hold Reason box */}
            {caseItem.on_hold_reason && (
              <div style={{ marginTop: '1rem', padding: '0.85rem', background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#d8b4fe', textTransform: 'uppercase' }}>
                  On-Hold Reason: {caseItem.on_hold_reason}
                </div>
                {caseItem.on_hold_notes && (
                  <p style={{ fontSize: '0.85rem', color: '#e9d5ff', marginTop: '0.25rem' }}>
                    "{caseItem.on_hold_notes}"
                  </p>
                )}
              </div>
            )}

            {/* Resolution note box */}
            {caseItem.resolution_notes && (
              <div style={{ marginTop: '1rem', padding: '0.85rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6ee7b7', textTransform: 'uppercase' }}>
                  Resolution Note (Staff Claim)
                </div>
                <p style={{ fontSize: '0.85rem', color: '#d1fae5', marginTop: '0.25rem' }}>
                  "{caseItem.resolution_notes}"
                </p>
                <div style={{ fontSize: '0.72rem', color: '#a7f3d0', marginTop: '0.25rem', fontStyle: 'italic' }}>
                  RESOLVED ≠ VERIFIED. Verification occurs in subsequent phase.
                </div>
              </div>
            )}
          </div>

          {/* Section: Add Operational Staff Note */}
          <div className="card">
            <h3 className="card-title">
              <Send size={18} color="#06b6d4" /> Add Auditable Field Note
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.2rem', marginBottom: '1rem' }}>
              Append timestamped field logs, inspection findings, or citizen-visible advisories.
            </p>

            <form onSubmit={handleAddNote}>
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="e.g., Road patching truck dispatched. Sub-base compaction underway."
                rows={3}
                required
                className="form-input"
                style={{ width: '100%', resize: 'vertical' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.85rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  <input
                    type="checkbox"
                    checked={isInternalNote}
                    onChange={(e) => setIsInternalNote(e.target.checked)}
                  />
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {isInternalNote ? <Lock size={13} color="#f59e0b" /> : <Globe size={13} color="#3b82f6" />}
                    {isInternalNote ? 'Internal only (hidden from citizen)' : 'Public update (visible to citizen)'}
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={addingNote || !noteContent.trim()}
                  className="btn btn-primary"
                  style={{ fontSize: '0.82rem', padding: '0.45rem 1rem' }}
                >
                  <Send size={13} />
                  {addingNote ? 'Recording...' : 'Record Note'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Column 2: Immutable Event Timeline */}
        <div>
          <div className="card" style={{ position: 'sticky', top: '90px' }}>
            <h3 className="card-title">
              <History size={18} color="#a855f7" /> Immutable Audit Timeline
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.2rem', marginBottom: '1.25rem' }}>
              Chronological log of every state transition, assignment change, and staff note.
            </p>

            {timeline.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-faint)', textAlign: 'center', padding: '2rem 0' }}>
                No events recorded yet.
              </p>
            ) : (
              <div className="timeline-stream">
                {timeline.map((ev, idx) => (
                  <div key={ev.id || idx} className="timeline-node">
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)' }}>
                          {ev.event_type.replace(/_/g, ' ')}
                        </span>
                        <span className="timeline-time">
                          {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {ev.from_status && ev.to_status && (
                        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                          <span>{ev.from_status}</span> &rarr; <strong style={{ color: '#60a5fa' }}>{ev.to_status}</strong>
                        </div>
                      )}

                      {ev.note && (
                        <p className="timeline-body" style={{ marginTop: '0.25rem' }}>
                          {ev.note}
                        </p>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                        <span>Actor: {ev.actor_name || 'System'}</span>
                        {ev.metadata?.is_internal && (
                          <span style={{ color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                            <Lock size={10} /> Internal
                          </span>
                        )}
                        {ev.metadata?.on_hold_reason && (
                          <span style={{ color: '#d8b4fe' }}>
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
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserCheck size={20} color="#3b82f6" /> Assign Operational Staff
              </h3>
              <button onClick={() => setShowAssignModal(false)} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label className="form-label">
                  Select Staff Member ({caseItem.department_code || 'MCC'})
                </label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="cases-filter-select"
                  style={{ width: '100%' }}
                  required
                >
                  {staffUsers.length === 0 ? (
                    <option value="">No staff members available</option>
                  ) : (
                    staffUsers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.department_code || 'Staff Officer'})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="form-label">Assignment Note (Optional)</label>
                <input
                  type="text"
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  placeholder="e.g., Assigned to Ward 42 sector officer"
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowAssignModal(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" disabled={assigning || !selectedStaffId} className="btn btn-primary">
                  {assigning ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Put On Hold */}
      {showOnHoldModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PauseCircle size={20} color="#a855f7" /> Put Case On Hold
              </h3>
              <button onClick={() => setShowOnHoldModal(false)} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleStatusTransition('ON_HOLD', {
                  on_hold_reason: onHoldReason,
                  on_hold_notes: onHoldNote.trim() || undefined,
                  note: `Case put on hold: ${onHoldReason}`,
                });
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
            >
              <div>
                <label className="form-label">Mandatory Hold Reason</label>
                <select
                  value={onHoldReason}
                  onChange={(e) => setOnHoldReason(e.target.value)}
                  className="cases-filter-select"
                  style={{ width: '100%' }}
                  required
                >
                  <option value="WAITING_FOR_MATERIAL">WAITING_FOR_MATERIAL — Awaiting supplies or equipment</option>
                  <option value="WEATHER">WEATHER — Adverse weather condition preventing work</option>
                  <option value="ACCESS_BLOCKED">ACCESS_BLOCKED — Site access restricted or blocked</option>
                  <option value="REQUIRES_EXTERNAL_TEAM">REQUIRES_EXTERNAL_TEAM — Specialized contractor needed</option>
                  <option value="OTHER">OTHER — Documented operational exception</option>
                </select>
              </div>

              <div>
                <label className="form-label">Detailed Explanation</label>
                <textarea
                  value={onHoldNote}
                  onChange={(e) => setOnHoldNote(e.target.value)}
                  placeholder="Explain why work cannot proceed right now..."
                  rows={3}
                  required
                  className="form-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowOnHoldModal(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" disabled={submittingStatus || !onHoldNote.trim()} className="btn" style={{ background: '#7c3aed', color: '#fff' }}>
                  {submittingStatus ? 'Updating...' : 'Put On Hold'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Mark Resolved */}
      {showResolveModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={20} color="#10b981" /> Mark Case Resolved
              </h3>
              <button onClick={() => setShowResolveModal(false)} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleStatusTransition('RESOLVED', {
                  note: resolveNote.trim(),
                });
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
            >
              <div>
                <label className="form-label">Mandatory Resolution Note</label>
                <textarea
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="Describe the physical remediation performed (e.g. Pothole filled and road surface restored)..."
                  rows={3}
                  required
                  className="form-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ fontSize: '0.78rem', color: '#a7f3d0', background: 'rgba(16, 185, 129, 0.1)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                <strong>Important Distinction:</strong> RESOLVED means staff claims the work is complete. It does NOT mean the fix has been independently verified. Independent verification occurs in Phase 8.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowResolveModal(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" disabled={submittingStatus || !resolveNote.trim()} className="btn" style={{ background: '#059669', color: '#fff' }}>
                  {submittingStatus ? 'Resolving...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseDetail;
