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
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Camera,
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
  const [resolvePhoto, setResolvePhoto] = useState(null);
  const [submittingStatus, setSubmittingStatus] = useState(false);

  // Phase 8: Verification & Reopen State
  const [verification, setVerification] = useState(null);
  const [verificationHistory, setVerificationHistory] = useState([]);
  const [evidenceList, setEvidenceList] = useState([]);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenNote, setReopenNote] = useState('');
  const [reopening, setReopening] = useState(false);

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
        if (res.data.verification) {
          setVerification(res.data.verification);
        } else if (res.data.case?.current_verification) {
          setVerification(res.data.case.current_verification);
        }
        if (res.data.verification_history) {
          setVerificationHistory(res.data.verification_history);
        }
        if (res.data.evidence) {
          setEvidenceList(res.data.evidence);
        }
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

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!resolveNote.trim()) return;
    setSubmittingStatus(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const payload = {
        note: resolveNote.trim(),
      };
      if (resolvePhoto) {
        payload.photoData = resolvePhoto;
      }
      const res = await api.resolveCaseWithEvidence(id, payload, token);

      if (res.ok) {
        setActionSuccess('Case marked as RESOLVED with resolution evidence.');
        setShowResolveModal(false);
        setResolveNote('');
        setResolvePhoto(null);
        fetchCase();
      } else {
        setActionError(res.data?.message || 'Failed to resolve case.');
      }
    } catch (err) {
      setActionError(err.message || 'Error resolving case.');
    } finally {
      setSubmittingStatus(false);
    }
  };

  const handleReopenSubmit = async (e) => {
    e.preventDefault();
    if (!reopenNote.trim()) return;
    setReopening(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await api.reopenCase(id, { note: reopenNote.trim() }, token);

      if (res.ok) {
        setActionSuccess('Disputed case successfully reopened back to IN_PROGRESS under original case number.');
        setShowReopenModal(false);
        setReopenNote('');
        fetchCase();
      } else {
        setActionError(res.data?.message || 'Failed to reopen case.');
      }
    } catch (err) {
      setActionError(err.message || 'Error reopening case.');
    } finally {
      setReopening(false);
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '9999px',
                    background:
                      verification?.status === 'VERIFIED'
                        ? 'rgba(16, 185, 129, 0.25)'
                        : verification?.status === 'DISPUTED'
                        ? 'rgba(239, 68, 68, 0.25)'
                        : 'rgba(245, 158, 11, 0.25)',
                    color:
                      verification?.status === 'VERIFIED'
                        ? '#6ee7b7'
                        : verification?.status === 'DISPUTED'
                        ? '#fca5a5'
                        : '#fcd34d',
                    border: `1px solid ${
                      verification?.status === 'VERIFIED'
                        ? '#10b981'
                        : verification?.status === 'DISPUTED'
                        ? '#ef4444'
                        : '#f59e0b'
                    }`,
                  }}
                >
                  {verification?.status === 'VERIFIED'
                    ? '✓ VERIFIED BY CITIZEN'
                    : verification?.status === 'DISPUTED'
                    ? '⚠ DISPUTED BY CITIZEN'
                    : '● PENDING CITIZEN VERIFICATION'}
                </span>

                {verification?.status === 'DISPUTED' && (
                  <button
                    id="btn-reopen-case"
                    onClick={() => setShowReopenModal(true)}
                    className="btn"
                    style={{ background: '#d97706', color: '#fff', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <RotateCcw size={15} /> Reopen Case (Work Resumption)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Phase 8: Verification Banner */}
      {verification && (
        <div
          id="case-verification-status-card"
          className="card"
          style={{
            marginBottom: '1.5rem',
            padding: '1.25rem',
            borderRadius: 'var(--radius-md)',
            border:
              verification.status === 'VERIFIED'
                ? '1px solid rgba(16, 185, 129, 0.5)'
                : verification.status === 'DISPUTED'
                ? '1px solid rgba(239, 68, 68, 0.5)'
                : '1px solid rgba(245, 158, 11, 0.5)',
            background:
              verification.status === 'VERIFIED'
                ? 'linear-gradient(180deg, rgba(6, 78, 59, 0.35) 0%, rgba(2, 44, 34, 0.55) 100%)'
                : verification.status === 'DISPUTED'
                ? 'linear-gradient(180deg, rgba(127, 29, 29, 0.35) 0%, rgba(69, 10, 10, 0.55) 100%)'
                : 'linear-gradient(180deg, rgba(120, 53, 15, 0.3) 0%, rgba(69, 26, 3, 0.5) 100%)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              {verification.status === 'VERIFIED' ? (
                <ShieldCheck size={24} color="#10b981" />
              ) : verification.status === 'DISPUTED' ? (
                <AlertTriangle size={24} color="#ef4444" />
              ) : (
                <Clock size={24} color="#f59e0b" />
              )}
              <div>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                  {verification.status === 'VERIFIED'
                    ? 'Resolution Verified by Citizen'
                    : verification.status === 'DISPUTED'
                    ? 'Citizen Disputed Resolution — Remediation Incomplete'
                    : 'Awaiting Citizen Verification'}
                </h4>
                <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.2rem' }}>
                  Verification Cycle #{verification.cycle_number || 1} • Status: <strong>{verification.status}</strong>
                </div>

                {verification.status === 'DISPUTED' && verification.dispute_reason && (
                  <div style={{ marginTop: '0.75rem', background: 'rgba(0, 0, 0, 0.3)', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#fca5a5', fontWeight: 700 }}>
                      Citizen's Statement of Problem Persistence:
                    </div>
                    <div style={{ color: '#fee2e2', fontSize: '0.88rem', fontStyle: 'italic', marginTop: '0.25rem' }}>
                      "{verification.dispute_reason}"
                    </div>
                  </div>
                )}
              </div>
            </div>

            {verification.status === 'DISPUTED' && (
              <button
                id="btn-reopen-case-banner"
                onClick={() => setShowReopenModal(true)}
                className="btn"
                style={{ background: '#d97706', color: '#fff', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <RotateCcw size={15} /> Reopen Case For Work Resumption
              </button>
            )}
          </div>
        </div>
      )}

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

            {/* Phase 8: Resolution Evidence & Verification section */}
            {(caseItem.resolution_notes || evidenceList.length > 0 || verification) && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6ee7b7', textTransform: 'uppercase' }}>
                    Staff Resolution Evidence & Verification
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    Standard: RESOLVED ≠ VERIFIED
                  </span>
                </div>

                {caseItem.resolution_notes && (
                  <p style={{ fontSize: '0.85rem', color: '#d1fae5', margin: '0.25rem 0 0.5rem' }}>
                    "{caseItem.resolution_notes}"
                  </p>
                )}

                {/* Attached Resolution Photos */}
                {evidenceList.length > 0 && (
                  <div style={{ marginTop: '0.6rem' }}>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.35rem' }}>
                      Attached Remediation Evidence:
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {evidenceList.map((ev, idx) => (
                        <div key={ev.id || idx} style={{ borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                          <img
                            src={ev.media_url}
                            alt="Resolution Evidence"
                            style={{ height: '70px', width: '100px', objectFit: 'cover' }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Verification State */}
                <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: '#a7f3d0' }}>
                  Current Status:{' '}
                  <strong>
                    {verification?.status === 'VERIFIED'
                      ? 'Confirmed Fixed (VERIFIED)'
                      : verification?.status === 'DISPUTED'
                      ? 'Disputed by Citizen (DISPUTED)'
                      : 'Pending Citizen Inspection (PENDING)'}
                  </strong>
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

            <form onSubmit={handleResolveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label className="form-label">Mandatory Resolution Note</label>
                <textarea
                  id="input-resolution-note"
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="Describe the physical remediation performed (e.g. Pothole filled with bitumen and road surface restored)..."
                  rows={3}
                  required
                  className="form-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Camera size={15} /> Remediation Photo Evidence (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => setResolvePhoto(reader.result);
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="form-input"
                  style={{ width: '100%', padding: '0.4rem' }}
                />
                {resolvePhoto && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <img
                      src={resolvePhoto}
                      alt="Resolution Preview"
                      style={{ height: '60px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setResolvePhoto(null)}
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                    >
                      Remove Photo
                    </button>
                  </div>
                )}
              </div>

              <div style={{ fontSize: '0.78rem', color: '#a7f3d0', background: 'rgba(16, 185, 129, 0.1)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                <strong>Important Distinction:</strong> RESOLVED means staff claims the work is complete. It does NOT mean the fix has been independently verified. Independent verification is conducted by the affected citizen.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowResolveModal(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button id="btn-confirm-resolve" type="submit" disabled={submittingStatus || !resolveNote.trim()} className="btn" style={{ background: '#059669', color: '#fff' }}>
                  {submittingStatus ? 'Resolving...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Reopen Disputed Case */}
      {showReopenModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#d97706' }}>
                <RotateCcw size={20} /> Reopen Disputed Case
              </h3>
              <button onClick={() => setShowReopenModal(false)} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReopenSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Following the citizen's dispute, reopening this case returns it to <strong>IN_PROGRESS</strong> status under its original case number #{caseItem.case_number}. Full audit and dispute history are retained.
              </p>

              <div>
                <label className="form-label">Operational Reopening Note (Mandatory)</label>
                <textarea
                  id="input-reopen-note"
                  value={reopenNote}
                  onChange={(e) => setReopenNote(e.target.value)}
                  placeholder="Explain operational plan for resumption (e.g. Field inspection verified asphalt patch required)..."
                  rows={3}
                  required
                  className="form-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowReopenModal(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button
                  id="btn-submit-reopen"
                  type="submit"
                  disabled={reopening || !reopenNote.trim()}
                  className="btn"
                  style={{ background: '#d97706', color: '#fff' }}
                >
                  {reopening ? 'Reopening Case...' : 'Confirm Reopen'}
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
