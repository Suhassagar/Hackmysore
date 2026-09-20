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
  Compass,
  Layers,
  Cpu,
  ExternalLink,
  Eye,
  Check,
  Activity,
  Info,
  Calendar,
  Sparkles,
} from 'lucide-react';

export const CaseDetail = () => {
  const { id } = useParams();
  const { token, user, role } = useAuth();

  // Core Data
  const [caseItem, setCaseItem] = useState(null);
  const [report, setReport] = useState(null);
  const [routingSnapshot, setRoutingSnapshot] = useState(null);
  const [routingReviews, setRoutingReviews] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [verification, setVerification] = useState(null);
  const [verificationHistory, setVerificationHistory] = useState([]);
  const [evidenceList, setEvidenceList] = useState([]);

  // Page State
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

  // Status transition modals
  const [showOnHoldModal, setShowOnHoldModal] = useState(false);
  const [onHoldReason, setOnHoldReason] = useState('WAITING_FOR_MATERIAL');
  const [onHoldNote, setOnHoldNote] = useState('');

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [resolvePhoto, setResolvePhoto] = useState(null);

  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenNote, setReopenNote] = useState('');
  const [reopening, setReopening] = useState(false);

  // Confirmation modal for non-form transitions (Acknowledge, Start Work, Resume)
  const [confirmModal, setConfirmModal] = useState(null);
  const [submittingStatus, setSubmittingStatus] = useState(false);

  // Operational field note state
  const [noteContent, setNoteContent] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(true); // Default internal for staff console
  const [addingNote, setAddingNote] = useState(false);

  // Image Lightbox
  const [lightboxImg, setLightboxImg] = useState(null);

  // Fetch full case & routing context
  const fetchCase = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCaseById(id, token);
      if (res.ok && res.data) {
        const c = res.data.case;
        setCaseItem(c);
        setTimeline(res.data.timeline || []);

        const ver = res.data.verification || c?.current_verification || null;
        setVerification(ver);
        setVerificationHistory(res.data.verification_history || []);
        setEvidenceList(res.data.evidence || []);

        // Fetch secondary context: report, routing snapshot & review history
        if (c.report_id) {
          try {
            const [reportRes, reviewsRes] = await Promise.all([
              api.getReport(c.report_id, token).catch(() => null),
              api.getReportRoutingReviews(c.report_id, token).catch(() => null),
            ]);

            if (reportRes && reportRes.ok && reportRes.data) {
              setReport(reportRes.data);
              if (reportRes.data.routing) {
                setRoutingSnapshot(reportRes.data.routing);
              }
            }

            if (reviewsRes && reviewsRes.ok && reviewsRes.data) {
              setRoutingReviews(reviewsRes.data.reviews || []);
            }
          } catch (secErr) {
            console.warn('[CaseDetail] Secondary context fetch warning:', secErr.message);
          }
        }
      } else {
        setError(res.data?.message || 'Failed to fetch operational case details.');
      }
    } catch (err) {
      setError(err.message || 'Error loading case workspace.');
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
        if (list.length > 0 && !selectedStaffId) {
          setSelectedStaffId(list[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load authorized staff users:', err);
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
        setActionSuccess('Staff officer assigned successfully.');
        setShowAssignModal(false);
        setAssignNote('');
        fetchCase();
      } else {
        setActionError(res.data?.message || 'Failed to assign staff officer.');
      }
    } catch (err) {
      setActionError(err.message || 'Error executing assignment.');
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
        setActionSuccess(`Case successfully transitioned to ${toStatus.replace(/_/g, ' ')}.`);
        setShowOnHoldModal(false);
        setShowResolveModal(false);
        setConfirmModal(null);
        fetchCase();
      } else {
        setActionError(res.data?.message || `Failed to update case status to ${toStatus}.`);
      }
    } catch (err) {
      setActionError(err.message || 'Error executing status transition.');
    } finally {
      setSubmittingStatus(false);
    }
  };

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!resolveNote.trim()) {
      setActionError('A physical remediation note is required.');
      return;
    }
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
        setActionSuccess('Case marked as RESOLVED. Verification cycle initiated for citizen inspection.');
        setShowResolveModal(false);
        setResolveNote('');
        setResolvePhoto(null);
        fetchCase();
      } else {
        setActionError(res.data?.message || 'Failed to resolve case.');
      }
    } catch (err) {
      setActionError(err.message || 'Error recording case resolution.');
    } finally {
      setSubmittingStatus(false);
    }
  };

  const handleReopenSubmit = async (e) => {
    e.preventDefault();
    if (!reopenNote.trim()) {
      setActionError('An operational plan note is required for reopening.');
      return;
    }
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
      setActionError(err.message || 'Error reopening disputed case.');
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
        setActionSuccess('Operational note recorded to audit timeline.');
        setNoteContent('');
        fetchCase();
      } else {
        setActionError(res.data?.message || 'Failed to record note.');
      }
    } catch (err) {
      setActionError(err.message || 'Error appending operational note.');
    } finally {
      setAddingNote(false);
    }
  };

  // Status Badge Rendering
  const getStatusBadge = (status) => {
    switch (status) {
      case 'UNASSIGNED':
        return (
          <span className="status-pill status-pill-unassigned" style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}>
            <AlertCircle size={13} />
            Unassigned
          </span>
        );
      case 'ASSIGNED':
        return (
          <span className="status-pill status-pill-assigned" style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}>
            <UserCheck size={13} />
            Assigned
          </span>
        );
      case 'ACKNOWLEDGED':
        return (
          <span className="status-pill status-pill-acknowledged" style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}>
            <Clock size={13} />
            Acknowledged
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="status-pill status-pill-in-progress" style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}>
            <RefreshCw size={13} className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
            In Progress
          </span>
        );
      case 'ON_HOLD':
        return (
          <span className="status-pill status-pill-on-hold" style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}>
            <PauseCircle size={13} />
            On Hold
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="status-pill status-pill-resolved" style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}>
            <CheckCircle2 size={13} />
            Resolved
          </span>
        );
      case 'CLOSED':
        return (
          <span className="status-pill status-pill-closed" style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}>
            Closed
          </span>
        );
      default:
        return (
          <span className="status-pill" style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-main)', padding: '0.35rem 0.85rem' }}>
            {status}
          </span>
        );
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'HIGH':
      case 'URGENT':
        return <span className="priority-pill priority-pill-urgent">High Priority</span>;
      case 'MEDIUM':
        return <span className="priority-pill priority-pill-medium">Medium Priority</span>;
      default:
        return <span className="priority-pill priority-pill-low">Standard Priority</span>;
    }
  };

  // RBAC Access Control Guard
  if (role !== 'STAFF' && role !== 'ADMIN') {
    return (
      <div className="cases-page-container">
        <div className="card" style={{ maxWidth: '540px', margin: '4rem auto', textAlign: 'center', padding: '2.5rem' }}>
          <ShieldAlert size={48} color="#ef4444" style={{ margin: '0 auto 1rem auto' }} />
          <h2>Access Restricted</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Only designated municipal operations staff and administrators have permission to access the case management workspace.
          </p>
          <div style={{ marginTop: '1.5rem' }}>
            <Link to="/" className="btn btn-primary">
              Return to Citizen Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading State
  if (loading) {
    return (
      <div className="cases-page-container" style={{ textAlign: 'center', padding: '6rem 0' }}>
        <div className="spinner" style={{ margin: '0 auto 1.25rem auto', width: 36, height: 36 }} />
        <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
          Loading Operational Case Workspace...
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Retrieving case timeline, geospatial boundaries, and resolution verification state.
        </p>
      </div>
    );
  }

  // Error State
  if (error || !caseItem) {
    return (
      <div className="cases-page-container">
        <div className="card" style={{ maxWidth: '560px', margin: '4rem auto', textAlign: 'center', padding: '2.5rem' }}>
          <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 1rem auto' }} />
          <h2>We couldn't load the operational case.</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            {error || 'Case record not found or inaccessible.'}
          </p>
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button onClick={fetchCase} className="btn btn-primary">
              <RefreshCw size={15} /> Try Again
            </button>
            <Link to="/staff/cases" className="btn btn-outline">
              <ArrowLeft size={15} /> Back to Case Queue
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Determine Routing Decision Details
  const latestReview = routingReviews.length > 0 ? routingReviews[0] : null;
  const isHumanReviewed = Boolean(latestReview) || routingSnapshot?.decision_source === 'HUMAN_REVIEW';

  // Stepper State Calculations
  const isAssigned = Boolean(caseItem.assigned_to);
  const isAcknowledged = Boolean(caseItem.acknowledged_at) || ['ACKNOWLEDGED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED'].includes(caseItem.status);
  const isStarted = Boolean(caseItem.started_at) || ['IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED'].includes(caseItem.status);
  const isResolved = Boolean(caseItem.resolved_at) || ['RESOLVED', 'CLOSED'].includes(caseItem.status);
  const isVerified = verification?.status === 'VERIFIED';
  const isDisputed = verification?.status === 'DISPUTED';
  const isAwaitingVerification = isResolved && (!verification || verification?.status === 'PENDING');

  const steps = [
    {
      id: 'step-report',
      label: 'Report Received',
      sublabel: new Date(caseItem.report_created_at || caseItem.created_at).toLocaleDateString(),
      status: 'complete',
    },
    {
      id: 'step-routed',
      label: 'Routed',
      sublabel: isHumanReviewed ? 'Staff Adjudicated' : 'Auto-Routed',
      status: 'complete',
    },
    {
      id: 'step-assigned',
      label: 'Assigned',
      sublabel: caseItem.assigned_to_name ? caseItem.assigned_to_name : 'Pending',
      status: isAssigned ? 'complete' : caseItem.status === 'UNASSIGNED' ? 'active' : 'upcoming',
    },
    {
      id: 'step-acknowledged',
      label: 'Acknowledged',
      sublabel: caseItem.acknowledged_at ? new Date(caseItem.acknowledged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending',
      status: isAcknowledged ? 'complete' : caseItem.status === 'ASSIGNED' ? 'active' : 'upcoming',
    },
    {
      id: 'step-progress',
      label: 'Work in Progress',
      sublabel: caseItem.status === 'ON_HOLD' ? 'On Hold' : caseItem.started_at ? 'Active' : 'Pending',
      status: isStarted ? (caseItem.status === 'IN_PROGRESS' || caseItem.status === 'ON_HOLD' ? 'active' : 'complete') : 'upcoming',
    },
    {
      id: 'step-resolved',
      label: 'Resolved',
      sublabel: isResolved ? (caseItem.resolved_at ? new Date(caseItem.resolved_at).toLocaleDateString() : 'Staff Resolved') : 'Pending',
      status: isResolved ? 'complete' : caseItem.status === 'IN_PROGRESS' ? 'active' : 'upcoming',
    },
    {
      id: 'step-verified',
      label: 'Citizen Verified',
      sublabel: isVerified ? 'Confirmed' : isDisputed ? 'Disputed' : isAwaitingVerification ? 'Awaiting' : 'Pending',
      status: isVerified ? 'complete' : isDisputed ? 'disputed' : isAwaitingVerification ? 'active' : 'upcoming',
    },
  ];

  return (
    <div className="cases-page-container" style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.5rem 2rem 4rem' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <Link
          to="/staff/cases"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            textDecoration: 'none',
            padding: '0.35rem 0.65rem',
            borderRadius: '6px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <ArrowLeft size={14} /> Back to Staff Cases Queue
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link
            to={`/reports/${caseItem.report_id}`}
            className="btn btn-outline"
            style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <ExternalLink size={13} /> View Citizen Report
          </Link>
          <button
            onClick={fetchCase}
            className="btn btn-outline"
            style={{ padding: '0.4rem 0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Refresh Case Data"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* SECTION 4: OPERATIONAL HEADER */}
      <div
        className="card"
        style={{
          padding: '1.75rem 2rem',
          marginBottom: '1.5rem',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(23, 37, 84, 0.85) 100%)',
          borderColor: 'rgba(59, 130, 246, 0.25)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div style={{ flex: '1 1 500px' }}>
            {/* Primary Case Identifier & Status Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '1.85rem',
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                  color: '#93c5fd',
                  textShadow: '0 0 16px rgba(59, 130, 246, 0.4)',
                }}
              >
                {caseItem.case_number}
              </span>
              {getStatusBadge(caseItem.status)}
              {getPriorityBadge(caseItem.priority)}
            </div>

            {/* Problem Headline */}
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 0.65rem 0' }}>
              {caseItem.category?.replace(/_/g, ' ') || 'Civic Incident'}
              {caseItem.report_description ? ` — ${caseItem.report_description.slice(0, 60)}${caseItem.report_description.length > 60 ? '...' : ''}` : ''}
            </h2>

            {/* Administrative Scope */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.85rem', color: '#cbd5e1' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                <Building2 size={15} color="#60a5fa" />
                {caseItem.authority_name || caseItem.authority_code}
              </span>
              <span style={{ color: 'var(--text-faint)' }}>•</span>
              <span style={{ fontWeight: 600, color: '#e2e8f0' }}>
                {caseItem.department_name || caseItem.department_code}
              </span>
              <span style={{ color: 'var(--text-faint)' }}>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#93c5fd' }}>
                <MapPin size={14} />
                {caseItem.jurisdiction_name || 'Ward Area'}
              </span>
            </div>
          </div>

          {/* Quick Secondary Metadata */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              background: 'rgba(0, 0, 0, 0.25)',
              padding: '0.85rem 1.15rem',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div>
              <span style={{ color: 'var(--text-faint)' }}>Reported:</span>{' '}
              <strong style={{ color: 'var(--text-main)' }}>
                {new Date(caseItem.report_created_at || caseItem.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-faint)' }}>Assigned Officer:</span>{' '}
              <strong style={{ color: caseItem.assigned_to_name ? '#60a5fa' : '#f59e0b' }}>
                {caseItem.assigned_to_name || 'Unassigned'}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-faint)' }}>Routing Origin:</span>{' '}
              <strong style={{ color: isHumanReviewed ? '#c084fc' : '#34d399' }}>
                {isHumanReviewed ? 'Human Adjudicated' : 'Deterministic Route'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
          <AlertCircle size={18} />
          <span>{actionError}</span>
        </div>
      )}

      {/* SECTION 6: STATE MACHINE VISIBILITY STEPPER */}
      <div
        className="card"
        style={{
          padding: '1.5rem',
          marginBottom: '1.5rem',
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
            Operational Case Progression (State Machine Stepper)
          </div>
          <span style={{ fontSize: '0.75rem', color: '#6ee7b7', fontWeight: 600 }}>
            Standard: RESOLVED ≠ VERIFIED
          </span>
        </div>

        {/* Stepper Node Track */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '1rem',
            position: 'relative',
          }}
        >
          {steps.map((st, idx) => {
            const isCompleted = st.status === 'complete';
            const isActive = st.status === 'active';
            const isDisputeNode = st.status === 'disputed';

            return (
              <div
                key={st.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  padding: '0.75rem 0.5rem',
                  borderRadius: '8px',
                  background: isDisputeNode
                    ? 'rgba(239, 68, 68, 0.12)'
                    : isActive
                    ? 'rgba(59, 130, 246, 0.12)'
                    : isCompleted
                    ? 'rgba(16, 185, 129, 0.06)'
                    : 'rgba(255, 255, 255, 0.02)',
                  border: isDisputeNode
                    ? '1px solid rgba(239, 68, 68, 0.4)'
                    : isActive
                    ? '1px solid rgba(59, 130, 246, 0.5)'
                    : isCompleted
                    ? '1px solid rgba(16, 185, 129, 0.25)'
                    : '1px solid rgba(255, 255, 255, 0.04)',
                }}
              >
                {/* Node Icon Circle */}
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '0.5rem',
                    background: isDisputeNode
                      ? '#ef4444'
                      : isCompleted
                      ? '#10b981'
                      : isActive
                      ? '#3b82f6'
                      : 'rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    boxShadow: isActive ? '0 0 12px rgba(59, 130, 246, 0.6)' : isDisputeNode ? '0 0 12px rgba(239, 68, 68, 0.6)' : 'none',
                  }}
                >
                  {isDisputeNode ? (
                    <AlertTriangle size={16} />
                  ) : isCompleted ? (
                    <Check size={16} />
                  ) : (
                    <span style={{ fontSize: '0.78rem', fontWeight: 800 }}>{idx + 1}</span>
                  )}
                </div>

                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isDisputeNode ? '#fca5a5' : isCompleted ? '#6ee7b7' : isActive ? '#93c5fd' : 'var(--text-muted)' }}>
                  {st.label}
                </div>

                <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.2rem' }}>
                  {st.sublabel}
                </div>
              </div>
            );
          })}
        </div>

        {/* Stepper Principle Banner */}
        <div
          style={{
            marginTop: '1.25rem',
            padding: '0.65rem 1rem',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '6px',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Info size={14} color="#60a5fa" style={{ flexShrink: 0 }} />
          <span>
            <strong>Municipal Safety Rule:</strong> Work resolution is an operational claim by field staff. Official case verification occurs exclusively via citizen inspection confirmation or dispute resolution.
          </span>
        </div>
      </div>

      {/* SECTION 5: PRIMARY CONTEXTUAL ACTION BAR */}
      <div
        className="card"
        style={{
          padding: '1.35rem 1.75rem',
          marginBottom: '1.5rem',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(17, 24, 39, 0.95) 100%)',
          borderColor: 'rgba(59, 130, 246, 0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#60a5fa', marginBottom: '0.2rem' }}>
              Operational Actions Toolbar
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Current Status: {caseItem.status.replace(/_/g, ' ')}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Operating Department: <strong>{caseItem.department_name || caseItem.department_code}</strong>
            </p>
          </div>

          {/* Contextual Action Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center' }}>
            {/* UNASSIGNED */}
            {caseItem.status === 'UNASSIGNED' && (
              <button
                onClick={openAssignModal}
                disabled={assigning}
                className="btn btn-primary"
                style={{ fontSize: '0.88rem', padding: '0.55rem 1.25rem' }}
              >
                <UserPlus size={16} /> Assign Staff Member
              </button>
            )}

            {/* ASSIGNED */}
            {caseItem.status === 'ASSIGNED' && (
              <>
                <button
                  onClick={() =>
                    setConfirmModal({
                      title: 'Acknowledge Case Receipt?',
                      message: `Confirm that field team under ${caseItem.assigned_to_name || 'assigned officer'} has received and acknowledged this case for Ward ${caseItem.jurisdiction_name || '42'}.`,
                      actionLabel: 'Acknowledge Case',
                      onConfirm: () => handleStatusTransition('ACKNOWLEDGED', { note: 'Staff acknowledged receipt of case.' }),
                    })
                  }
                  disabled={submittingStatus}
                  className="btn"
                  style={{ background: '#4f46e5', color: '#fff', fontSize: '0.88rem', padding: '0.55rem 1.25rem' }}
                >
                  <Clock size={16} /> Acknowledge Case
                </button>
                <button onClick={openAssignModal} className="btn btn-outline" style={{ fontSize: '0.88rem' }}>
                  <UserCheck size={16} /> Reassign
                </button>
              </>
            )}

            {/* ACKNOWLEDGED */}
            {caseItem.status === 'ACKNOWLEDGED' && (
              <>
                <button
                  onClick={() =>
                    setConfirmModal({
                      title: 'Commence Field Work?',
                      message: 'Confirm that municipal field crew is mobilizing or active on site. Case status will advance to IN PROGRESS.',
                      actionLabel: 'Start Field Work',
                      onConfirm: () => handleStatusTransition('IN_PROGRESS', { note: 'Field team dispatched and work active on site.' }),
                    })
                  }
                  disabled={submittingStatus}
                  className="btn"
                  style={{ background: '#d97706', color: '#fff', fontSize: '0.88rem', padding: '0.55rem 1.25rem' }}
                >
                  <PlayCircle size={16} /> Start Work (In Progress)
                </button>
                <button onClick={openAssignModal} className="btn btn-outline" style={{ fontSize: '0.88rem' }}>
                  <UserCheck size={16} /> Reassign
                </button>
              </>
            )}

            {/* IN_PROGRESS */}
            {caseItem.status === 'IN_PROGRESS' && (
              <>
                <button
                  onClick={() => setShowOnHoldModal(true)}
                  disabled={submittingStatus}
                  className="btn"
                  style={{ background: '#7c3aed', color: '#fff', fontSize: '0.88rem', padding: '0.55rem 1.15rem' }}
                >
                  <PauseCircle size={16} /> Put On Hold
                </button>
                <button
                  onClick={() => setShowResolveModal(true)}
                  disabled={submittingStatus}
                  className="btn"
                  style={{ background: '#059669', color: '#fff', fontSize: '0.88rem', padding: '0.55rem 1.25rem' }}
                >
                  <CheckCircle2 size={16} /> Mark Resolved
                </button>
                <button onClick={openAssignModal} className="btn btn-outline" style={{ fontSize: '0.88rem' }}>
                  <UserCheck size={16} /> Reassign
                </button>
              </>
            )}

            {/* ON_HOLD */}
            {caseItem.status === 'ON_HOLD' && (
              <>
                <button
                  onClick={() =>
                    setConfirmModal({
                      title: 'Resume Field Work?',
                      message: 'Confirm that the obstacle has cleared and physical field work has resumed. Status will return to IN PROGRESS.',
                      actionLabel: 'Resume Work',
                      onConfirm: () => handleStatusTransition('IN_PROGRESS', { note: 'Obstacle cleared; physical field work resumed.' }),
                    })
                  }
                  disabled={submittingStatus}
                  className="btn"
                  style={{ background: '#d97706', color: '#fff', fontSize: '0.88rem', padding: '0.55rem 1.25rem' }}
                >
                  <PlayCircle size={16} /> Resume Work
                </button>
                <button onClick={openAssignModal} className="btn btn-outline" style={{ fontSize: '0.88rem' }}>
                  <UserCheck size={16} /> Reassign
                </button>
              </>
            )}

            {/* RESOLVED */}
            {caseItem.status === 'RESOLVED' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '0.45rem 0.95rem',
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
                    : '● AWAITING CITIZEN VERIFICATION'}
                </span>

                {verification?.status === 'DISPUTED' && (
                  <button
                    id="btn-reopen-case"
                    onClick={() => setShowReopenModal(true)}
                    disabled={reopening}
                    className="btn"
                    style={{
                      background: '#d97706',
                      color: '#fff',
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.5rem 1.15rem',
                    }}
                  >
                    <RotateCcw size={15} /> Reopen Case (Work Resumption)
                  </button>
                )}
              </div>
            )}

            {/* CLOSED */}
            {caseItem.status === 'CLOSED' && (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Case is officially closed. No further operational actions permitted.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 17: PHASE 8 RESOLUTION VERIFICATION BANNER */}
      {caseItem.status === 'RESOLVED' && verification && (
        <div
          id="case-verification-status-card"
          className="card"
          style={{
            marginBottom: '1.75rem',
            padding: '1.5rem',
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
            <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
              {verification.status === 'VERIFIED' ? (
                <ShieldCheck size={28} color="#10b981" />
              ) : verification.status === 'DISPUTED' ? (
                <AlertTriangle size={28} color="#ef4444" />
              ) : (
                <Clock size={28} color="#f59e0b" />
              )}
              <div>
                <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                  {verification.status === 'VERIFIED'
                    ? 'Resolution Verified by Citizen'
                    : verification.status === 'DISPUTED'
                    ? 'Citizen Disputed Remediation — Work Incomplete'
                    : 'Awaiting Citizen Verification'}
                </h4>
                <div style={{ fontSize: '0.84rem', color: '#cbd5e1', marginTop: '0.25rem' }}>
                  Verification Cycle #{verification.cycle_number || 1} • Status:{' '}
                  <strong>{verification.status}</strong>
                  {caseItem.resolved_at && ` • Resolved by staff: ${new Date(caseItem.resolved_at).toLocaleTimeString()}`}
                </div>

                {/* Staff Resolution Claim Note */}
                {(caseItem.resolution_notes || caseItem.resolution_note) && (
                  <div style={{ marginTop: '0.65rem', fontSize: '0.85rem', color: '#d1fae5' }}>
                    <span style={{ fontWeight: 700, color: '#a7f3d0' }}>Staff Claim:</span> "{caseItem.resolution_notes || caseItem.resolution_note}"
                  </div>
                )}

                {/* Citizen Dispute Statement */}
                {verification.status === 'DISPUTED' && verification.dispute_reason && (
                  <div
                    style={{
                      marginTop: '0.85rem',
                      background: 'rgba(0, 0, 0, 0.35)',
                      padding: '0.85rem 1.15rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#fca5a5', fontWeight: 800 }}>
                      Citizen's Statement of Problem Persistence:
                    </div>
                    <div style={{ color: '#fee2e2', fontSize: '0.92rem', fontStyle: 'italic', marginTop: '0.35rem' }}>
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
                disabled={reopening}
                className="btn"
                style={{
                  background: '#d97706',
                  color: '#fff',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 1rem',
                }}
              >
                <RotateCcw size={15} /> Reopen Case For Work Resumption
              </button>
            )}
          </div>
        </div>
      )}

      {/* MAIN 2-COLUMN OPERATIONAL WORKSPACE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.75rem', alignItems: 'start' }}>
        {/* ======================================================== */}
        {/* COLUMN 1: EVIDENCE & ROUTING CONTEXT (WHAT, WHERE, WHY, WHO) */}
        {/* ======================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* SECTION 7: WHAT (Issue Understanding & Citizen Narrative) */}
          <div className="card">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} color="#3b82f6" /> WHAT — Problem & Evidence
            </h3>

            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              {/* Citizen Narrative */}
              <div>
                <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.04em' }}>
                  Citizen Description
                </span>
                <p
                  style={{
                    marginTop: '0.4rem',
                    background: 'var(--bg-primary)',
                    padding: '0.95rem 1.15rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '0.92rem',
                    lineHeight: 1.55,
                    fontStyle: 'italic',
                  }}
                >
                  "{caseItem.report_description || report?.description || 'No citizen description provided.'}"
                </p>
              </div>

              {/* AI Issue Understanding (Phase 3) */}
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.5)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Cpu size={14} /> AI Issue Understanding
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                    Deterministically Assessed
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Classified Category</div>
                    <div style={{ fontWeight: 700, color: '#93c5fd', fontSize: '0.92rem', marginTop: '0.15rem' }}>
                      {caseItem.category || report?.category || 'POTHOLE'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Assessed Priority</div>
                    <div style={{ fontWeight: 700, color: '#fcd34d', fontSize: '0.92rem', marginTop: '0.15rem' }}>
                      {caseItem.priority || 'MEDIUM'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Routing Match</div>
                    <div style={{ fontWeight: 700, color: '#6ee7b7', fontSize: '0.92rem', marginTop: '0.15rem' }}>
                      {routingSnapshot?.match_method || 'RULE_BASED'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Photo Evidence */}
              {(caseItem.photo_url || report?.photoUrl) && (
                <div>
                  <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.04em' }}>
                    Citizen Uploaded Photo Evidence
                  </span>
                  <div style={{ marginTop: '0.45rem', position: 'relative' }}>
                    <img
                      src={caseItem.photo_url || report?.photoUrl}
                      alt="Citizen problem evidence"
                      onClick={() => setLightboxImg(caseItem.photo_url || report?.photoUrl)}
                      style={{
                        width: '100%',
                        maxHeight: '260px',
                        objectFit: 'cover',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px',
                        background: 'rgba(0, 0, 0, 0.65)',
                        color: '#fff',
                        padding: '0.25rem 0.55rem',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        cursor: 'pointer',
                      }}
                      onClick={() => setLightboxImg(caseItem.photo_url || report?.photoUrl)}
                    >
                      <Eye size={12} /> Click to Inspect
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 8: WHERE (Geospatial & Spatial Jurisdiction) */}
          <div className="card">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Compass size={18} color="#06b6d4" /> WHERE — Geospatial & Jurisdiction
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginTop: '1rem' }}>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Administrative Ward</span>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                  {caseItem.jurisdiction_name || 'Ward 42 — Jayalakshmipuram'}
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Civic Authority</span>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                  {caseItem.authority_name || 'Mysuru City Corporation (MCC)'}
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>GPS Coordinates</span>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#93c5fd', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                  {caseItem.latitude !== null && caseItem.latitude !== undefined ? Number(caseItem.latitude).toFixed(5) : '—'},{' '}
                  {caseItem.longitude !== null && caseItem.longitude !== undefined ? Number(caseItem.longitude).toFixed(5) : '—'}
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Location Match</span>
                <div style={{ fontWeight: 700, color: '#6ee7b7', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                  {caseItem.location_status || 'EXACT_MATCH'}
                </div>
              </div>
            </div>

            {/* Jurisdiction Policy Disclaimer */}
            <div
              style={{
                marginTop: '1rem',
                padding: '0.75rem 1rem',
                background: 'rgba(6, 182, 212, 0.08)',
                border: '1px solid rgba(6, 182, 212, 0.25)',
                borderRadius: '6px',
                fontSize: '0.78rem',
                color: '#a5f3fc',
                lineHeight: 1.45,
              }}
            >
              <strong>Jurisdiction Policy:</strong> This report was routed using the administrative jurisdiction boundaries valid when the report was filed ({new Date(caseItem.report_created_at || caseItem.created_at).toLocaleDateString()}).
            </div>
          </div>

          {/* SECTION 9: WHY THIS CASE WAS ROUTED HERE (Routing Decision Rationale) */}
          <div className="card">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} color="#818cf8" /> WHY THIS CASE WAS ROUTED HERE
            </h3>

            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div
                style={{
                  background: 'var(--bg-surface-elevated)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800 }}>
                    Routing Decision Source
                  </span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '4px',
                      background: isHumanReviewed ? 'rgba(168, 85, 247, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                      color: isHumanReviewed ? '#d8b4fe' : '#6ee7b7',
                      border: `1px solid ${isHumanReviewed ? '#a855f7' : '#10b981'}`,
                    }}
                  >
                    {isHumanReviewed ? 'STAFF ADJUDICATED' : 'DETERMINISTIC AUTO-ROUTE'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Designated Authority</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem', marginTop: '0.15rem' }}>
                      {caseItem.authority_name || caseItem.authority_code}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Operating Department</div>
                    <div style={{ fontWeight: 700, color: '#60a5fa', fontSize: '0.9rem', marginTop: '0.15rem' }}>
                      {caseItem.department_name || caseItem.department_code}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Target Ward</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem', marginTop: '0.15rem' }}>
                      {caseItem.jurisdiction_name || 'Ward 42'}
                    </div>
                  </div>
                </div>

                {/* Routing Reason Explanation */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Routing Rationale:
                  </div>
                  {isHumanReviewed && latestReview ? (
                    <div style={{ marginTop: '0.25rem', fontSize: '0.88rem', color: '#e2e8f0', lineHeight: 1.45 }}>
                      <p style={{ margin: 0 }}>
                        <strong>Adjudicated by {latestReview.reviewer_name || 'Municipal Reviewer'}:</strong> "{latestReview.review_notes || 'Assigned to operating department following routing review.'}"
                      </p>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.35rem' }}>
                        Adjudicated: {new Date(latestReview.reviewed_at).toLocaleString()}
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: '0.25rem', fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.45 }}>
                      {routingSnapshot?.explanation ||
                        `The reported location falls within ${caseItem.jurisdiction_name || 'Ward 42'} and the issue matches the ${caseItem.department_name || 'Road Maintenance'} responsibility rule.`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 10: WHO (Operating Unit & Assignment) */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <UserCheck size={18} color="#10b981" /> WHO — Responsibility & Assignment
              </h3>
              <button
                onClick={openAssignModal}
                className="btn btn-outline"
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
              >
                {caseItem.assigned_to ? 'Reassign' : 'Assign'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginTop: '1rem' }}>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assigned Officer</span>
                <div style={{ fontWeight: 700, color: caseItem.assigned_to_name ? '#60a5fa' : '#f59e0b', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                  {caseItem.assigned_to_name || 'Unassigned'}
                </div>
                {caseItem.assigned_to_email && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    {caseItem.assigned_to_email}
                  </div>
                )}
              </div>

              <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Operating Unit</span>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                  {caseItem.department_name || caseItem.department_code}
                </div>
              </div>
            </div>

            {/* Operational Milestones List */}
            <div style={{ marginTop: '1rem', background: 'rgba(0, 0, 0, 0.25)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '0.5rem' }}>
                Operational Milestones
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', fontSize: '0.78rem' }}>
                <div>
                  <span style={{ color: 'var(--text-faint)' }}>Assigned:</span>{' '}
                  <strong style={{ color: caseItem.assigned_at ? '#93c5fd' : 'var(--text-muted)' }}>
                    {caseItem.assigned_at ? new Date(caseItem.assigned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-faint)' }}>Acknowledged:</span>{' '}
                  <strong style={{ color: caseItem.acknowledged_at ? '#a5b4fc' : 'var(--text-muted)' }}>
                    {caseItem.acknowledged_at ? new Date(caseItem.acknowledged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-faint)' }}>Started:</span>{' '}
                  <strong style={{ color: caseItem.started_at ? '#fcd34d' : 'var(--text-muted)' }}>
                    {caseItem.started_at ? new Date(caseItem.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-faint)' }}>Resolved:</span>{' '}
                  <strong style={{ color: caseItem.resolved_at ? '#6ee7b7' : 'var(--text-muted)' }}>
                    {caseItem.resolved_at ? new Date(caseItem.resolved_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </strong>
                </div>
              </div>
            </div>

            {/* SECTION 13: ON-HOLD DETAIL BOX */}
            {caseItem.on_hold_reason && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '0.95rem 1.15rem',
                  background: 'rgba(168, 85, 247, 0.15)',
                  border: '1px solid rgba(168, 85, 247, 0.35)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', fontWeight: 800, color: '#d8b4fe', textTransform: 'uppercase' }}>
                  <PauseCircle size={15} /> Case Placed On Hold: {caseItem.on_hold_reason}
                </div>
                {caseItem.on_hold_notes && (
                  <p style={{ fontSize: '0.88rem', color: '#f3e8ff', marginTop: '0.35rem', margin: '0.35rem 0 0', lineHeight: 1.45 }}>
                    "{caseItem.on_hold_notes}"
                  </p>
                )}
              </div>
            )}

            {/* Remediation Evidence Photos (if attached by staff) */}
            {evidenceList.length > 0 && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, marginBottom: '0.5rem' }}>
                  Staff Remediation Evidence Photos:
                </div>
                <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                  {evidenceList.map((ev, idx) => (
                    <div
                      key={ev.id || idx}
                      onClick={() => setLightboxImg(ev.media_url)}
                      style={{
                        borderRadius: '6px',
                        overflow: 'hidden',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        cursor: 'pointer',
                      }}
                    >
                      <img
                        src={ev.media_url}
                        alt="Resolution Evidence"
                        style={{ height: '75px', width: '110px', objectFit: 'cover' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 2: AUDITABLE NOTES & IMMUTABLE TIMELINE */}
        {/* ======================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* SECTION 18: INTERNAL STAFF NOTES */}
          <div className="card">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Send size={18} color="#06b6d4" /> Internal Staff Notes
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.2rem', marginBottom: '1rem' }}>
              Record timestamped field inspection logs, dispatch advisories, or contractor coordination details.
            </p>

            <form onSubmit={handleAddNote}>
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="e.g. Dispatched bitumen road-roller crew to Ward 42 sector 4. Repair in progress."
                rows={3}
                required
                className="form-input"
                style={{ width: '100%', resize: 'vertical', fontSize: '0.88rem' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.85rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  <input
                    type="checkbox"
                    checked={isInternalNote}
                    onChange={(e) => setIsInternalNote(e.target.checked)}
                  />
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: isInternalNote ? '#f59e0b' : '#60a5fa', fontWeight: 600 }}>
                    {isInternalNote ? <Lock size={13} /> : <Globe size={13} />}
                    {isInternalNote ? 'Internal note — not visible to citizen' : 'Public note — visible to citizen'}
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={addingNote || !noteContent.trim()}
                  className="btn btn-primary"
                  style={{ fontSize: '0.84rem', padding: '0.45rem 1.15rem' }}
                >
                  <Send size={13} />
                  {addingNote ? 'Recording...' : 'Record Note'}
                </button>
              </div>
            </form>
          </div>

          {/* SECTIONS 19 & 20: IMMUTABLE AUDIT TIMELINE */}
          <div className="card" style={{ position: 'sticky', top: '90px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <History size={18} color="#a855f7" /> Immutable Audit Timeline
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                {timeline.length} {timeline.length === 1 ? 'event' : 'events'}
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem', marginBottom: '1.25rem' }}>
              Chronological log of every status transition, assignment change, and staff note.
            </p>

            {timeline.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-faint)', textAlign: 'center', padding: '2.5rem 0' }}>
                No audit events recorded yet.
              </p>
            ) : (
              <div className="timeline-stream" style={{ margin: '0.5rem 0 0.5rem 0.5rem' }}>
                {timeline.map((ev, idx) => (
                  <div key={ev.id || idx} className="timeline-node">
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <span style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-main)' }}>
                          {ev.event_type.replace(/_/g, ' ')}
                        </span>
                        <span className="timeline-time">
                          {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                          {new Date(ev.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>

                      {/* State transition indicator */}
                      {ev.from_status && ev.to_status && (
                        <div style={{ fontSize: '0.74rem', fontFamily: 'monospace', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          <span>{ev.from_status}</span> &rarr; <strong style={{ color: '#60a5fa' }}>{ev.to_status}</strong>
                        </div>
                      )}

                      {/* Note Content */}
                      {ev.note && (
                        <p className="timeline-body" style={{ marginTop: '0.3rem', fontSize: '0.85rem', color: '#e2e8f0' }}>
                          {ev.note}
                        </p>
                      )}

                      {/* Metadata badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', marginTop: '0.45rem', fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                        <span>Actor: <strong style={{ color: 'var(--text-muted)' }}>{ev.actor_name || 'System Engine'}</strong></span>
                        {ev.metadata?.is_internal && (
                          <span style={{ color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', background: 'rgba(245, 158, 11, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                            <Lock size={10} /> Internal Only
                          </span>
                        )}
                        {ev.metadata?.on_hold_reason && (
                          <span style={{ color: '#d8b4fe', background: 'rgba(168, 85, 247, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                            Reason: {ev.metadata.on_hold_reason}
                          </span>
                        )}
                        {ev.metadata?.cycle_number && (
                          <span style={{ color: '#6ee7b7' }}>
                            Cycle #{ev.metadata.cycle_number}
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

      {/* ======================================================== */}
      {/* MODALS */}
      {/* ======================================================== */}

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
                  Select Staff Member ({caseItem.department_code || caseItem.authority_code || 'MCC'})
                </label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="cases-filter-select"
                  style={{ width: '100%' }}
                  required
                >
                  {staffUsers.length === 0 ? (
                    <option value="">Loading authorized municipal staff...</option>
                  ) : (
                    staffUsers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.department_code || s.role || 'Staff Officer'})
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
                  placeholder="e.g., Assigned to Ward 42 sector lead officer"
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
                <label className="form-label">Detailed Explanation (Mandatory)</label>
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
                <button
                  type="submit"
                  disabled={submittingStatus || !onHoldNote.trim()}
                  className="btn"
                  style={{ background: '#7c3aed', color: '#fff' }}
                >
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>
                    Mandatory Physical Remediation Note <span style={{ color: '#ef4444', fontWeight: 700 }}>*</span>
                  </label>
                  <span style={{ fontSize: '0.72rem', color: resolveNote.trim() ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                    {resolveNote.trim() ? '✓ Note provided' : 'Required to proceed'}
                  </span>
                </div>
                <textarea
                  id="input-resolution-note"
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="Describe the physical remediation performed (e.g. Excavated pothole crater, filled with bitumen mix, and leveled surface with road roller)..."
                  rows={3}
                  required
                  className="form-input"
                  style={{ width: '100%', borderColor: !resolveNote.trim() ? 'rgba(245, 158, 11, 0.4)' : undefined }}
                />
                {!resolveNote.trim() && (
                  <p style={{ fontSize: '0.75rem', color: '#f59e0b', margin: '0.3rem 0 0 0' }}>
                    Type a brief description of the physical fix above to enable the "Confirm Resolution" button.
                  </p>
                )}
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

              {/* Critical Reminder Alert */}
              <div
                style={{
                  fontSize: '0.78rem',
                  color: '#a7f3d0',
                  background: 'rgba(16, 185, 129, 0.12)',
                  padding: '0.75rem 0.95rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  lineHeight: 1.45,
                }}
              >
                <strong>Critical Rule: RESOLVED ≠ VERIFIED</strong>
                <p style={{ margin: '0.25rem 0 0' }}>
                  Marking as resolved records a staff claim that field work is complete. The affected citizen will be prompted to independently verify or dispute the resolution under Phase 8 protocols.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowResolveModal(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button
                  id="btn-confirm-resolve"
                  type="submit"
                  disabled={submittingStatus || !resolveNote.trim()}
                  className="btn"
                  style={{
                    background: !resolveNote.trim() ? '#1e293b' : '#059669',
                    color: !resolveNote.trim() ? '#94a3b8' : '#fff',
                    border: !resolveNote.trim() ? '1px solid var(--border-subtle)' : 'none',
                    cursor: !resolveNote.trim() ? 'not-allowed' : 'pointer',
                  }}
                  title={!resolveNote.trim() ? 'Please enter a remediation note above to enable this button' : 'Confirm case resolution'}
                >
                  {submittingStatus
                    ? 'Resolving Case...'
                    : !resolveNote.trim()
                    ? 'Confirm Resolution (Note Required)'
                    : 'Confirm Resolution'}
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
                  placeholder="Detail remediation rework plan (e.g. Field inspection confirmed gravel washaway; dispatched resurfacing crew with bitumen seal)..."
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

      {/* MODAL 5: Action Confirmation Modal */}
      {confirmModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{confirmModal.title}</h3>
              <button onClick={() => setConfirmModal(null)} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 1.5rem 0' }}>
              {confirmModal.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" onClick={() => setConfirmModal(null)} className="btn btn-outline">
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                disabled={submittingStatus}
                className="btn btn-primary"
              >
                {submittingStatus ? 'Updating...' : confirmModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Photo Lightbox */}
      {lightboxImg && (
        <div className="modal-overlay" onClick={() => setLightboxImg(null)}>
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightboxImg(null)}
              style={{
                position: 'absolute',
                top: '-36px',
                right: '0',
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              <X size={24} />
            </button>
            <img
              src={lightboxImg}
              alt="Evidence preview"
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '8px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseDetail;
