import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  ArrowLeft,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Info,
  Layers,
  Compass,
  Building2,
  GitBranch,
  UserCheck,
  Check,
  Edit3,
  History,
  Briefcase,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  X,
  FileText,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

export const ReportDetail = () => {
  const { id } = useParams();
  const { token, user, role } = useAuth();
  const [report, setReport] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [jurisdiction, setJurisdiction] = useState(null);
  const [routing, setRouting] = useState(null);
  const [reviewsHistory, setReviewsHistory] = useState([]);
  const [civicCase, setCivicCase] = useState(null);
  const [caseTimeline, setCaseTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [resolvingJur, setResolvingJur] = useState(false);
  const [resolvingRouting, setResolvingRouting] = useState(false);
  const [error, setError] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  const [isForbidden, setIsForbidden] = useState(false);

  // Phase 8 Resolution Verification State
  const [verification, setVerification] = useState(null);
  const [verificationEvidence, setVerificationEvidence] = useState(null);
  const [verificationHistory, setVerificationHistory] = useState([]);
  const [confirmingVerification, setConfirmingVerification] = useState(false);
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [verificationActionError, setVerificationActionError] = useState('');
  const [verificationActionSuccess, setVerificationActionSuccess] = useState('');

  // Staff Review State (Staff/Admin only)
  const [authorities, setAuthorities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [reviewMode, setReviewMode] = useState('APPROVE');
  const [selectedAuthorityId, setSelectedAuthorityId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState('');
  const [reviewError, setReviewError] = useState('');

  // Fetch Report & Associated Context
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      setIsForbidden(false);

      try {
        // 1. Fetch Report
        const reportRes = await api.getReportById(id, token);
        if (reportRes.status === 403) {
          setIsForbidden(true);
          setError('Access Denied: You do not have authorization to view this citizen report.');
          setLoading(false);
          return;
        } else if (reportRes.status === 404) {
          setError(`Report #${id} does not exist or has been removed.`);
          setLoading(false);
          return;
        } else if (reportRes.ok && reportRes.data) {
          setReport(reportRes.data);
        }

        // 2. Fetch AI Analysis
        const analysisRes = await api.getReportAnalysis(id, token);
        if (analysisRes.ok && analysisRes.data?.analysis) {
          setAnalysis(analysisRes.data.analysis);
        }

        // 3. Fetch Historical Jurisdiction Snapshot
        if (reportRes.data?.jurisdiction) {
          setJurisdiction(reportRes.data.jurisdiction);
        } else {
          const jurRes = await api.getReportJurisdiction(id, token);
          if (jurRes.ok && jurRes.data?.jurisdiction) {
            setJurisdiction(jurRes.data.jurisdiction);
          }
        }

        // 4. Fetch Historical Routing Snapshot
        if (reportRes.data?.routing) {
          setRouting(reportRes.data.routing);
        } else {
          const routRes = await api.getReportRouting(id, token);
          if (routRes.ok && routRes.data?.routing) {
            setRouting(routRes.data.routing);
          }
        }

        // 5. Fetch Routing Review Audit History (for staff or review records)
        if (role === 'STAFF' || role === 'ADMIN' || reportRes.data?.routing?.decision_source === 'HUMAN_REVIEW') {
          const revRes = await api.getReportRoutingReviews(id, token);
          if (revRes.ok && revRes.data?.reviews) {
            setReviewsHistory(revRes.data.reviews);
          }
        }

        // 6. Preload authorities & departments for staff/admin adjudication
        if (role === 'STAFF' || role === 'ADMIN') {
          const [authRes, deptRes] = await Promise.all([
            api.getAuthorities(token),
            api.getDepartments(token),
          ]);
          if (authRes.ok && authRes.data?.authorities) setAuthorities(authRes.data.authorities);
          if (deptRes.ok && deptRes.data?.departments) setDepartments(deptRes.data.departments);
        }

        // 7. Fetch Operational Case & Timeline
        try {
          const caseRes = await api.getReportCase(id, token);
          if (caseRes.ok && caseRes.data?.case) {
            setCivicCase(caseRes.data.case);
            setCaseTimeline(caseRes.data.timeline || []);
            if (caseRes.data.verification) {
              setVerification(caseRes.data.verification);
            }
            if (caseRes.data.evidence) {
              setVerificationEvidence(caseRes.data.evidence);
            }
          }
        } catch (cErr) {
          console.warn('[ReportDetail] Could not load case for report:', cErr.message);
        }

        // 8. Fetch Verification Snapshot & History
        try {
          const vRes = await api.getReportVerification(id, token);
          if (vRes.ok && vRes.data) {
            if (vRes.data.current_verification) {
              setVerification(vRes.data.current_verification);
            }
            if (vRes.data.evidence) {
              setVerificationEvidence(vRes.data.evidence);
            }
            if (vRes.data.verification_history) {
              setVerificationHistory(vRes.data.verification_history);
            }
          }
        } catch (vErr) {
          // Verification may not exist yet if case is not resolved
        }
      } catch (err) {
        setError(err.message || 'We could not connect to CivicFlow. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, token, role]);

  const handleConfirmVerification = async () => {
    setConfirmingVerification(true);
    setVerificationActionError('');
    setVerificationActionSuccess('');
    try {
      const res = await api.confirmVerification(id, token);
      if (res.ok) {
        setVerificationActionSuccess('Thank you! You have confirmed that this issue has been resolved. The case is now officially closed.');
        if (res.data?.verification) {
          setVerification(res.data.verification);
        }
        const caseRes = await api.getReportCase(id, token);
        if (caseRes.ok && caseRes.data?.case) {
          setCivicCase(caseRes.data.case);
          setCaseTimeline(caseRes.data.timeline || []);
        }
      } else {
        setVerificationActionError(res.data?.message || 'We could not complete your confirmation. Please try again.');
      }
    } catch (err) {
      setVerificationActionError(err.message || 'Error submitting confirmation.');
    } finally {
      setConfirmingVerification(false);
    }
  };

  const handleDisputeSubmit = async (e) => {
    e.preventDefault();
    if (!disputeReason.trim() || disputeReason.trim().length < 10) {
      setVerificationActionError('Please provide at least 10 characters explaining why the issue is still not resolved.');
      return;
    }
    setDisputeSubmitting(true);
    setVerificationActionError('');
    setVerificationActionSuccess('');
    try {
      const res = await api.disputeVerification(id, disputeReason.trim(), token);
      if (res.ok) {
        setVerificationActionSuccess('Your feedback has been recorded. Municipal staff have been alerted to reinvestigate and reopen the case.');
        setShowDisputeModal(false);
        setDisputeReason('');
        if (res.data?.verification) {
          setVerification(res.data.verification);
        }
        const caseRes = await api.getReportCase(id, token);
        if (caseRes.ok && caseRes.data?.case) {
          setCivicCase(caseRes.data.case);
          setCaseTimeline(caseRes.data.timeline || []);
        }
      } else {
        setVerificationActionError(res.data?.message || 'We could not submit your dispute. Please try again.');
      }
    } catch (err) {
      setVerificationActionError(err.message || 'Error submitting dispute.');
    } finally {
      setDisputeSubmitting(false);
    }
  };

  const handleReviewSubmit = async () => {
    setReviewSubmitting(true);
    setReviewError('');
    setReviewSuccess('');

    const payload = {
      action: reviewMode,
      review_notes: reviewNotes.trim() || undefined,
    };

    if (reviewMode === 'OVERRIDE') {
      if (!selectedAuthorityId) {
        setReviewError('Please select a responsible Authority.');
        setReviewSubmitting(false);
        return;
      }
      if (!selectedDepartmentId) {
        setReviewError('Please select an operational Department.');
        setReviewSubmitting(false);
        return;
      }
      payload.final_authority_id = selectedAuthorityId;
      payload.final_department_id = selectedDepartmentId;
    }

    try {
      const res = await api.submitRoutingReview(id, payload, token);
      if (res.ok) {
        setReviewSuccess(
          reviewMode === 'APPROVE'
            ? 'Suggested route successfully approved!'
            : 'Route successfully assigned by staff override!'
        );
        const [routRes, revRes] = await Promise.all([
          api.getReportRouting(id, token),
          api.getReportRoutingReviews(id, token),
        ]);
        if (routRes.ok && routRes.data?.routing) {
          setRouting(routRes.data.routing);
        }
        if (revRes.ok && revRes.data?.reviews) {
          setReviewsHistory(revRes.data.reviews);
        }
      } else {
        setReviewError(res.data?.message || 'Failed to submit review.');
      }
    } catch (err) {
      setReviewError(err.message || 'Error submitting review.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleTriggerAnalysis = async (force = false) => {
    setAnalyzing(true);
    setAnalysisError('');
    try {
      const res = await api.triggerReportAnalysis(id, token, force);
      if (res.ok && res.data?.analysis) {
        setAnalysis(res.data.analysis);
        const routRes = await api.getReportRouting(id, token);
        if (routRes.ok && routRes.data?.routing) {
          setRouting(routRes.data.routing);
        }
      } else {
        setAnalysisError(res.data?.message || 'Failed to analyze report.');
      }
    } catch (err) {
      setAnalysisError(err.message || 'Network error during analysis.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleResolveJurisdiction = async () => {
    setResolvingJur(true);
    try {
      const res = await api.resolveReportJurisdiction(id, token);
      if (res.ok && res.data?.jurisdiction) {
        setJurisdiction(res.data.jurisdiction);
        const routRes = await api.getReportRouting(id, token);
        if (routRes.ok && routRes.data?.routing) {
          setRouting(routRes.data.routing);
        }
      }
    } catch (err) {
      console.error('Failed to re-resolve jurisdiction:', err);
    } finally {
      setResolvingJur(false);
    }
  };

  const handleResolveRouting = async () => {
    setResolvingRouting(true);
    try {
      const res = await api.resolveReportRouting(id, token);
      if (res.ok && res.data?.routing) {
        setRouting(res.data.routing);
      }
    } catch (err) {
      console.error('Failed to re-resolve routing:', err);
    } finally {
      setResolvingRouting(false);
    }
  };

  // Helper for human-readable event labels
  const formatEventName = (eventType) => {
    switch (eventType) {
      case 'REPORT_SUBMITTED':
        return 'Report Submitted by Citizen';
      case 'AUTO_ROUTED':
      case 'ROUTED':
        return 'CivicFlow Identified Responsible Department';
      case 'CASE_CREATED':
        return 'Official Civic Case Created';
      case 'CASE_ACKNOWLEDGED':
      case 'STAFF_ACKNOWLEDGED':
        return 'Staff Acknowledged the Case';
      case 'WORK_STARTED':
        return 'Field Work Started';
      case 'WORK_PAUSED':
        return 'Work Paused by Staff';
      case 'RESOLUTION_SUBMITTED':
        return 'Remediation Completed by Field Team';
      case 'RESOLUTION_VERIFIED':
        return 'Resolution Confirmed by Citizen';
      case 'RESOLUTION_DISPUTED':
        return 'Resolution Disputed by Citizen';
      case 'CASE_REOPENED':
        return 'Case Reopened for Rework';
      case 'HUMAN_REVIEW_SUBMITTED':
        return 'Routing Assigned by Staff Review';
      default:
        return eventType.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
    }
  };

  // Human-readable status mapping
  const getDisplayStatus = () => {
    if (verification?.status === 'VERIFIED') return { label: 'VERIFIED', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
    if (verification?.status === 'DISPUTED') return { label: 'DISPUTED', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' };
    if (civicCase?.status === 'RESOLVED') return { label: 'RESOLVED', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
    if (civicCase?.status === 'IN_PROGRESS') return { label: 'IN PROGRESS', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' };
    if (civicCase?.status === 'ON_HOLD') return { label: 'ON HOLD', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' };
    if (civicCase?.status === 'ACKNOWLEDGED') return { label: 'ACKNOWLEDGED', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' };
    if (civicCase?.status === 'ASSIGNED') return { label: 'ASSIGNED', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)' };
    if (routing?.assessment?.status === 'NEEDS_REVIEW' || routing?.routing_status === 'NEEDS_REVIEW') {
      return { label: 'UNDER REVIEW', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' };
    }
    return { label: report?.status?.replace(/_/g, ' ') || 'SUBMITTED', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' };
  };

  const currentStatus = getDisplayStatus();
  const caseNumber = civicCase?.case_number || (report?.id ? `CIV-2026-${report.id.substring(0, 6).toUpperCase()}` : 'CIV-PENDING');

  // Loading state
  if (loading) {
    return (
      <div className="main-content">
        <div style={{ maxWidth: '840px', margin: '0 auto', textAlign: 'center', padding: '4rem 1rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1.5rem auto' }}></div>
          <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Loading Report Details...</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Retrieving case updates, municipal routing, and resolution status.
          </p>
        </div>
      </div>
    );
  }

  // Error / Forbidden State
  if (isForbidden || error) {
    return (
      <div className="main-content">
        <div className="card" style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center', padding: '3rem 2rem' }}>
          <ShieldAlert size={52} color="#ef4444" style={{ margin: '0 auto 1.25rem auto' }} />
          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.75rem' }}>
            {isForbidden ? 'Private Report' : 'Report Unavailable'}
          </h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '2rem' }}>
            {error || 'This report cannot be found or you do not have permission to view it.'}
          </p>
          <Link to="/my-reports" className="btn btn-primary" id="error-back-btn">
            <ArrowLeft size={16} /> Return to My Reports
          </Link>
        </div>
      </div>
    );
  }

  const isNeedsReview = (routing?.assessment?.status === 'NEEDS_REVIEW' || routing?.routing_status === 'NEEDS_REVIEW') && !civicCase;

  return (
    <div className="main-content">
      <div style={{ maxWidth: '860px', margin: '0 auto', paddingBottom: '3rem' }}>
        
        {/* Navigation Breadcrumb */}
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            to="/my-reports"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.9rem',
              color: 'var(--text-muted)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
            id="back-to-my-reports-link"
          >
            <ArrowLeft size={16} /> Back to My Reports
          </Link>
        </div>

        {/* ========================================================================= */}
        {/* HERO CARD: WHAT HAPPENED & CURRENT CASE STATUS                            */}
        {/* ========================================================================= */}
        <div
          className="card"
          id="phase7-case-tracking-card"
          style={{
            marginBottom: '1.5rem',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 15, 30, 0.95) 100%)',
            padding: '1.75rem',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Header Row: Title & Status */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#60a5fa',
                    letterSpacing: '0.04em',
                    background: 'rgba(59, 130, 246, 0.15)',
                    padding: '0.2rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                  }}
                >
                  {caseNumber}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Reported on {new Date(report.reportedAt || report.created_at || Date.now()).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ffffff', margin: 0, lineHeight: 1.2 }}>
                {report.category || 'Civic Problem'}
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span
                style={{
                  padding: '0.4rem 0.9rem',
                  borderRadius: '9999px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: currentStatus.color,
                  backgroundColor: currentStatus.bg,
                  border: `1px solid ${currentStatus.color}`,
                }}
              >
                {currentStatus.label}
              </span>

              {(role === 'STAFF' || role === 'ADMIN') && civicCase && (
                <Link
                  to={`/staff/cases/${civicCase.id}`}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                >
                  Staff Workspace →
                </Link>
              )}
            </div>
          </div>

          {/* Citizen Description Quote */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 'var(--radius-md)',
              padding: '1.15rem',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
              Citizen Description
            </div>
            <p style={{ fontSize: '1rem', color: 'var(--text-main)', lineHeight: '1.6', margin: 0 }}>
              &ldquo;{report.description}&rdquo;
            </p>
          </div>

          {/* Phase 3B: Multi-Citizen Incident Cluster Notice */}
          {(report.incident || report.incidentId) && (
            <div
              style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1.15rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <Layers size={20} color="#818cf8" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#c7d2fe' }}>
                  Multi-Citizen Incident Cluster
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  This problem was also reported by other citizens nearby. All {report.incident?.reportCount || 2} reports are linked to this single incident for unified field resolution.
                </div>
              </div>
            </div>
          )}

          {/* Attached Citizen Photo Evidence */}
          {report.photoUrl && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Citizen Evidence Photo
                </div>
                {/* Photo Authenticity Signal Badge (Phase 3B) */}
                {report.photoStatus === 'VALID' && (
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '9999px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Check size={12} /> Verified Location Metadata
                  </span>
                )}
                {report.photoStatus === 'LOCATION_MISMATCH' && (
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '9999px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <AlertTriangle size={12} /> Location Mismatch Detected (&gt;500m)
                  </span>
                )}
                {(!report.photoStatus || report.photoStatus === 'VALID_NO_METADATA') && (
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '9999px', background: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.2)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Info size={12} /> Standard Upload
                  </span>
                )}
              </div>
              <img
                src={report.photoUrl}
                alt="Civic issue evidence"
                style={{
                  maxWidth: '100%',
                  maxHeight: '340px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </div>
          )}

          {/* ===================================================================== */}
          {/* CASE PROGRESS: 6-STAGE CITIZEN JOURNEY STEPPER                         */}
          {/* ===================================================================== */}
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.25rem', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.85rem' }}>
              Case Progress
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: '0.6rem' }}>
              {/* Step 1: Report Received */}
              <div style={{ padding: '0.75rem 0.6rem', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', color: '#6ee7b7', fontSize: '0.8rem', fontWeight: 700 }}>
                  <Check size={14} /> Report Received
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                  Logged in system
                </div>
              </div>

              {/* Step 2: Routed */}
              {(() => {
                const isRouted = Boolean(civicCase || routing?.routing_status === 'ROUTED' || routing?.assessment?.status === 'AUTO_ROUTED' || routing?.decision_source === 'HUMAN_REVIEW');
                const isReview = isNeedsReview;
                return (
                  <div
                    style={{
                      padding: '0.75rem 0.6rem',
                      borderRadius: '8px',
                      background: isRouted ? 'rgba(16, 185, 129, 0.12)' : isReview ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isRouted ? 'rgba(16, 185, 129, 0.3)' : isReview ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', color: isRouted ? '#6ee7b7' : isReview ? '#fcd34d' : '#94a3b8', fontSize: '0.8rem', fontWeight: 700 }}>
                      {isRouted ? <Check size={14} /> : isReview ? <AlertTriangle size={14} /> : '○'} Routed
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {civicCase?.department_code || (isReview ? 'Staff review' : 'Identified')}
                    </div>
                  </div>
                );
              })()}

              {/* Step 3: Staff Acknowledged */}
              {(() => {
                const isAck = Boolean(civicCase?.acknowledged_at || ['ACKNOWLEDGED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED'].includes(civicCase?.status));
                const isAssigned = civicCase?.status === 'ASSIGNED';
                return (
                  <div
                    style={{
                      padding: '0.75rem 0.6rem',
                      borderRadius: '8px',
                      background: isAck ? 'rgba(16, 185, 129, 0.12)' : isAssigned ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isAck ? 'rgba(16, 185, 129, 0.3)' : isAssigned ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', color: isAck ? '#6ee7b7' : isAssigned ? '#93c5fd' : '#94a3b8', fontSize: '0.8rem', fontWeight: 700 }}>
                      {isAck ? <Check size={14} /> : isAssigned ? '●' : '○'} Acknowledged
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                      {isAck ? 'Confirmed by dept' : isAssigned ? 'Staff assigned' : 'Pending'}
                    </div>
                  </div>
                );
              })()}

              {/* Step 4: Work in Progress */}
              {(() => {
                const isResolved = ['RESOLVED', 'CLOSED'].includes(civicCase?.status);
                const isInProgress = civicCase?.status === 'IN_PROGRESS';
                const isOnHold = civicCase?.status === 'ON_HOLD';
                return (
                  <div
                    style={{
                      padding: '0.75rem 0.6rem',
                      borderRadius: '8px',
                      background: isResolved ? 'rgba(16, 185, 129, 0.12)' : isInProgress ? 'rgba(245, 158, 11, 0.15)' : isOnHold ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isResolved ? 'rgba(16, 185, 129, 0.3)' : isInProgress ? 'rgba(245, 158, 11, 0.4)' : isOnHold ? 'rgba(168, 85, 247, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', color: isResolved ? '#6ee7b7' : isInProgress ? '#fcd34d' : isOnHold ? '#d8b4fe' : '#94a3b8', fontSize: '0.8rem', fontWeight: 700 }}>
                      {isResolved ? <Check size={14} /> : isInProgress ? '●' : isOnHold ? <PauseCircle size={14} /> : '○'} Work Progress
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                      {isResolved ? 'Work done' : isInProgress ? 'Active on site' : isOnHold ? 'Temporarily paused' : 'Pending'}
                    </div>
                  </div>
                );
              })()}

              {/* Step 5: Resolved */}
              {(() => {
                const isResolved = ['RESOLVED', 'CLOSED'].includes(civicCase?.status);
                return (
                  <div
                    style={{
                      padding: '0.75rem 0.6rem',
                      borderRadius: '8px',
                      background: isResolved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isResolved ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', color: isResolved ? '#6ee7b7' : '#94a3b8', fontSize: '0.8rem', fontWeight: 700 }}>
                      {isResolved ? <Check size={14} /> : '○'} Resolved
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                      {isResolved ? 'Fixed by staff' : 'Awaiting fix'}
                    </div>
                  </div>
                );
              })()}

              {/* Step 6: Citizen Verified */}
              {(() => {
                const isVerified = verification?.status === 'VERIFIED';
                const isDisputed = verification?.status === 'DISPUTED';
                const isPendingVer = verification?.status === 'PENDING';
                return (
                  <div
                    style={{
                      padding: '0.75rem 0.6rem',
                      borderRadius: '8px',
                      background: isVerified ? 'rgba(16, 185, 129, 0.2)' : isDisputed ? 'rgba(239, 68, 68, 0.18)' : isPendingVer ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isVerified ? 'rgba(16, 185, 129, 0.4)' : isDisputed ? 'rgba(239, 68, 68, 0.4)' : isPendingVer ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', color: isVerified ? '#6ee7b7' : isDisputed ? '#fca5a5' : isPendingVer ? '#fcd34d' : '#94a3b8', fontSize: '0.8rem', fontWeight: 700 }}>
                      {isVerified ? <ShieldCheck size={14} /> : isDisputed ? <AlertTriangle size={14} /> : isPendingVer ? '●' : '○'} Citizen Verified
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                      {isVerified ? 'Confirmed ✓' : isDisputed ? 'Disputed ⚠' : isPendingVer ? 'Awaiting you' : 'Pending fix'}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* UNDER REVIEW ADVISORY (NON-ERROR STATE)                                   */}
        {/* ========================================================================= */}
        {isNeedsReview && (
          <div
            style={{
              marginBottom: '1.5rem',
              background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.1) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1rem',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.2)',
                color: '#fcd34d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Info size={22} />
            </div>
            <div>
              <h4 style={{ color: '#fef3c7', margin: '0 0 0.35rem 0', fontSize: '1rem', fontWeight: 700 }}>
                Routing Review in Progress
              </h4>
              <p style={{ color: '#fde68a', fontSize: '0.88rem', margin: '0 0 0.5rem 0', lineHeight: 1.5 }}>
                CivicFlow could not confidently determine the responsible civic authority for this location automatically. Your report has been dispatched to civic staff for a quick manual review.
              </p>
              <div style={{ fontSize: '0.78rem', color: '#fcd34d', fontWeight: 600 }}>
                Status: UNDER REVIEW &bull; You will be notified as soon as a department acknowledges your case.
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* THE THREE CIVIC PILLARS: WHAT + WHERE + WHO                               */}
        {/* ========================================================================= */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          
          {/* PILLAR 1: WHAT WE UNDERSTOOD (AI Analysis) */}
          <div
            className="card"
            style={{
              background: 'linear-gradient(180deg, #111a2e 0%, #0c1220 100%)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#60a5fa', fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <Sparkles size={16} /> What We Understood
                </div>
                {analysis?.confidence && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#93c5fd', background: 'rgba(59, 130, 246, 0.15)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                    AI confidence: {Math.round(analysis.confidence * 100)}%
                  </span>
                )}
              </div>

              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.4rem' }}>
                {analysis?.category || report.category}
              </div>

              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 0.85rem 0' }}>
                {analysis?.summary || 'Problem identified and registered from citizen report.'}
              </p>

              {Array.isArray(analysis?.risk_factors) && analysis.risk_factors.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.85rem' }}>
                  {analysis.risk_factors.map((risk, idx) => (
                    <span
                      key={idx}
                      style={{
                        background: 'rgba(239, 68, 68, 0.12)',
                        color: '#fca5a5',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                      }}
                    >
                      {risk}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ fontSize: '0.72rem', color: '#64748b', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.6rem' }}>
              CivicFlow uses AI to assist in understanding issues, not to make municipal decisions.
            </div>
          </div>

          {/* PILLAR 2: WHERE IT IS (Geospatial Jurisdiction) */}
          <div
            className="card"
            id="jurisdiction-engine-card"
            style={{
              background: 'linear-gradient(180deg, #161226 0%, #0f0c1c 100%)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#a78bfa', fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <MapPin size={16} /> Where It Is
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#c4b5fd', background: 'rgba(139, 92, 246, 0.15)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                  {report.location?.status === 'VERIFIED_COORDINATES' ? 'GPS Verified' : 'Manual Address'}
                </span>
              </div>

              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.4rem' }}>
                {jurisdiction?.jurisdiction_name || 'Mysuru District'}
              </div>

              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '0.85rem' }}>
                {jurisdiction ? (
                  <>
                    Administrative Area: <strong style={{ color: '#e2e8f0' }}>{jurisdiction.jurisdiction_name}</strong>
                    <br />
                    Type: {jurisdiction.jurisdiction_type || 'Municipal Ward'}
                  </>
                ) : (
                  <span>Evaluating municipal jurisdiction boundaries...</span>
                )}
              </div>

              {report.location?.latitude != null && (
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', background: 'rgba(0, 0, 0, 0.25)', padding: '0.45rem 0.6rem', borderRadius: '6px', fontFamily: 'monospace' }}>
                  Coordinates: {Number(report.location.latitude).toFixed(5)}, {Number(report.location.longitude).toFixed(5)}
                </div>
              )}
            </div>

            <div style={{ fontSize: '0.72rem', color: '#64748b', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.6rem', marginTop: '0.85rem' }}>
              Jurisdiction determined spatially through municipal boundary maps.
            </div>
          </div>

          {/* PILLAR 3: WHO IS RESPONSIBLE (Authority & Department) */}
          <div
            className="card"
            id="civic-responsibility-card"
            style={{
              background: 'linear-gradient(180deg, #0a221a 0%, #061611 100%)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#34d399', fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <Building2 size={16} /> Responsible Authority
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6ee7b7', background: 'rgba(16, 185, 129, 0.15)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                  {routing?.decision_source === 'HUMAN_REVIEW' ? 'Staff Adjudicated' : 'Automatically Routed'}
                </span>
              </div>

              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.2rem' }}>
                {routing?.authority_name || civicCase?.authority_code || 'Mysuru City Corporation'}
              </div>

              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#6ee7b7', marginBottom: '0.6rem' }}>
                Department: {routing?.department_name || civicCase?.department_name || 'Road Maintenance'}
              </div>

              <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.45', background: 'rgba(0, 0, 0, 0.25)', padding: '0.65rem 0.75rem', borderRadius: '6px', marginBottom: '0.85rem' }}>
                <span style={{ color: '#a7f3d0', fontWeight: 600, display: 'block', marginBottom: '0.2rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  Why it was routed here:
                </span>
                {routing?.explanation
                  ? routing.explanation.replace(/rule\s+id\s*:\s*\d+/gi, '').replace(/\(priority:\s*\d+\)/gi, '')
                  : `Your reported location falls within the current municipal jurisdiction and matches the responsibility for this department.`}
              </div>
            </div>

            <div style={{ fontSize: '0.72rem', color: '#64748b', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.6rem' }}>
              Responsibility routed via published city charter governance rules.
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PHASE 8: CITIZEN RESOLUTION VERIFICATION CARD                             */}
        {/* ========================================================================= */}
        {(civicCase?.status === 'RESOLVED' || verification) && (
          <div
            id="citizen-resolution-verification-card"
            style={{
              marginBottom: '1.5rem',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              border:
                verification?.status === 'VERIFIED'
                  ? '1px solid rgba(16, 185, 129, 0.5)'
                  : verification?.status === 'DISPUTED'
                  ? '1px solid rgba(239, 68, 68, 0.5)'
                  : '1px solid rgba(245, 158, 11, 0.5)',
              background:
                verification?.status === 'VERIFIED'
                  ? 'linear-gradient(180deg, rgba(6, 78, 59, 0.35) 0%, rgba(2, 44, 34, 0.55) 100%)'
                  : verification?.status === 'DISPUTED'
                  ? 'linear-gradient(180deg, rgba(127, 29, 29, 0.35) 0%, rgba(69, 10, 10, 0.55) 100%)'
                  : 'linear-gradient(180deg, rgba(120, 53, 15, 0.3) 0%, rgba(69, 26, 3, 0.5) 100%)',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {verification?.status === 'VERIFIED' ? (
                  <ShieldCheck size={26} color="#10b981" />
                ) : verification?.status === 'DISPUTED' ? (
                  <AlertTriangle size={26} color="#ef4444" />
                ) : (
                  <Clock size={26} color="#f59e0b" />
                )}
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                    {verification?.status === 'VERIFIED'
                      ? 'Resolution Independently Verified'
                      : verification?.status === 'DISPUTED'
                      ? 'Resolution Disputed by Citizen'
                      : 'Staff Reported Fixed — Please Verify the Resolution'}
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '0.15rem' }}>
                    Civic Accountability: Cases are only fully closed after the reporting citizen verifies the work.
                  </div>
                </div>
              </div>

              <span
                style={{
                  padding: '0.3rem 0.8rem',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
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
                {verification?.status || 'PENDING VERIFICATION'}
              </span>
            </div>

            {/* Banners for actions */}
            {verificationActionError && (
              <div style={{ padding: '0.75rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {verificationActionError}
              </div>
            )}
            {verificationActionSuccess && (
              <div style={{ padding: '0.75rem', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#6ee7b7', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {verificationActionSuccess}
              </div>
            )}

            {/* Staff Resolution Notes & Attached Evidence */}
            <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '1.15rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                Municipal Staff Completion Note
              </div>
              <div style={{ fontSize: '0.95rem', color: '#e2e8f0', lineHeight: 1.5 }}>
                &ldquo;{verification?.resolution_note || civicCase?.resolution_notes || 'Remediation completed by field team.'}&rdquo;
              </div>

              {(verificationEvidence?.media_url || civicCase?.latest_evidence?.media_url) && (
                <div style={{ marginTop: '0.85rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.4rem' }}>
                    Staff Work Completion Photo:
                  </div>
                  <img
                    src={verificationEvidence?.media_url || civicCase?.latest_evidence?.media_url}
                    alt="Staff Completion Evidence"
                    style={{
                      maxHeight: '220px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      objectFit: 'cover',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Citizen Dispute View */}
            {verification?.status === 'DISPUTED' && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, color: '#fca5a5', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                  Citizen Dispute Explanation
                </div>
                <div style={{ fontSize: '0.92rem', color: '#fee2e2', fontStyle: 'italic', lineHeight: 1.5 }}>
                  &ldquo;{verification.dispute_reason}&rdquo;
                </div>
                <div style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '0.5rem' }}>
                  Municipal staff have been alerted to reinvestigate and perform rework on site.
                </div>
              </div>
            )}

            {/* Citizen Confirmed View */}
            {verification?.status === 'VERIFIED' && (
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.9rem', color: '#6ee7b7', fontWeight: 600 }}>
                  ✓ You confirmed that this problem is fully resolved. Case is closed with full civic accountability.
                </div>
              </div>
            )}

            {/* Action Buttons for Pending Verification */}
            {verification?.status === 'PENDING' && (
              <div>
                <p style={{ fontSize: '0.88rem', color: '#fcd34d', margin: '0 0 1rem 0', lineHeight: 1.5 }}>
                  Please inspect the location. Did the municipal team satisfactorily fix the reported problem?
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    id="btn-confirm-verification"
                    onClick={handleConfirmVerification}
                    disabled={confirmingVerification}
                    className="btn"
                    style={{
                      background: '#059669',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.65rem 1.25rem',
                    }}
                  >
                    <Check size={16} />
                    {confirmingVerification ? 'Confirming...' : 'Yes, It Is Fixed'}
                  </button>

                  <button
                    id="btn-dispute-verification"
                    onClick={() => setShowDisputeModal(true)}
                    disabled={confirmingVerification}
                    className="btn"
                    style={{
                      background: '#dc2626',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.65rem 1.25rem',
                    }}
                  >
                    <AlertTriangle size={16} />
                    No, Issue Still Exists
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* CASE ACTIVITY TIMELINE                                                    */}
        {/* ========================================================================= */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History size={16} color="#60a5fa" /> Activity Timeline
          </div>

          {caseTimeline && caseTimeline.length > 0 ? (
            <div className="timeline-stream" style={{ margin: '0.5rem 0 0.5rem 0.5rem' }}>
              {caseTimeline.map((ev, idx) => (
                <div key={ev.id || idx} className="timeline-node">
                  <div className="timeline-dot"></div>
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <span className="timeline-actor">
                        {formatEventName(ev.event_type)}
                      </span>
                      <span className="timeline-time">
                        {new Date(ev.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} at{' '}
                        {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {ev.note && (
                      <div className="timeline-body">
                        {ev.note}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Case has been submitted and is currently moving through the civic workflow.
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* STAFF ADJUDICATION & ADMIN TOOLS (STAFF / ADMIN ONLY)                      */}
        {/* ========================================================================= */}
        {(role === 'STAFF' || role === 'ADMIN') && (
          <div
            className="card"
            style={{
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fcd34d', fontWeight: 700, fontSize: '0.95rem' }}>
                <Edit3 size={18} /> Staff Adjudication & Administrative Tools
              </div>
              <span style={{ fontSize: '0.75rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                Staff View Only
              </span>
            </div>

            {/* Inline Staff Adjudication Form (if NEEDS_REVIEW) */}
            {routing?.routing_status === 'NEEDS_REVIEW' && (
              <div
                id="staff-inline-review-box"
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setReviewMode('APPROVE')}
                    disabled={!routing.suggested_authority_id && !routing.authority_id}
                    className={`btn btn-sm ${reviewMode === 'APPROVE' ? 'btn-primary' : 'btn-outline'}`}
                    id="btn-inline-mode-approve"
                  >
                    <Check size={13} /> Approve Suggested Route
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewMode('OVERRIDE')}
                    className={`btn btn-sm ${reviewMode === 'OVERRIDE' ? 'btn-primary' : 'btn-outline'}`}
                    id="btn-inline-mode-override"
                  >
                    <Edit3 size={13} /> Override / Assign Route
                  </button>
                </div>

                {reviewMode === 'OVERRIDE' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                        Authority *
                      </label>
                      <select
                        value={selectedAuthorityId}
                        onChange={(e) => {
                          setSelectedAuthorityId(e.target.value);
                          setSelectedDepartmentId('');
                        }}
                        className="form-control"
                        id="inline-select-authority"
                        style={{ width: '100%', background: 'var(--bg-primary)', color: '#fff', border: '1px solid var(--border-subtle)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}
                      >
                        <option value="">-- Choose Authority --</option>
                        {authorities.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                        Department *
                      </label>
                      <select
                        value={selectedDepartmentId}
                        onChange={(e) => setSelectedDepartmentId(e.target.value)}
                        className="form-control"
                        id="inline-select-department"
                        style={{ width: '100%', background: 'var(--bg-primary)', color: '#fff', border: '1px solid var(--border-subtle)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}
                      >
                        <option value="">-- Choose Department --</option>
                        {departments
                          .filter((d) => !selectedAuthorityId || d.authority_id === selectedAuthorityId)
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} ({d.code})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                    Adjudication Notes / Audit Justification
                  </label>
                  <input
                    type="text"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="e.g., Confirmed road maintenance authority under MCC..."
                    className="form-control"
                    id="inline-input-notes"
                    style={{ width: '100%', background: 'var(--bg-primary)', color: '#fff', border: '1px solid var(--border-subtle)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}
                  />
                </div>

                {reviewError && (
                  <div className="alert alert-error" style={{ marginBottom: '0.75rem', fontSize: '0.82rem' }}>
                    <AlertCircle size={14} />
                    <div>{reviewError}</div>
                  </div>
                )}
                {reviewSuccess && (
                  <div className="alert alert-success" style={{ marginBottom: '0.75rem', fontSize: '0.82rem' }}>
                    <CheckCircle2 size={14} />
                    <div>{reviewSuccess}</div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleReviewSubmit}
                  disabled={reviewSubmitting}
                  className="btn btn-primary btn-sm"
                  id="btn-inline-submit-review"
                >
                  {reviewSubmitting ? (
                    <>
                      <RefreshCw size={13} className="spin" /> Submitting...
                    </>
                  ) : reviewMode === 'APPROVE' ? (
                    <>
                      <Check size={14} /> Confirm Route Approval
                    </>
                  ) : (
                    <>
                      <Edit3 size={14} /> Confirm Route Override
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Admin Reprocess Actions */}
            {role === 'ADMIN' && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <button
                  onClick={() => handleTriggerAnalysis(true)}
                  disabled={analyzing}
                  className="btn btn-outline btn-sm"
                  id="btn-trigger-ai-analysis"
                >
                  <RefreshCw size={12} className={analyzing ? 'spin' : ''} />
                  {analyzing ? 'Reprocessing AI...' : 'Reprocess AI'}
                </button>

                <button
                  onClick={handleResolveJurisdiction}
                  disabled={resolvingJur}
                  className="btn btn-outline btn-sm"
                >
                  <Compass size={12} className={resolvingJur ? 'spin' : ''} />
                  {resolvingJur ? 'Resolving Boundary...' : 'Re-resolve Boundary'}
                </button>

                <button
                  onClick={handleResolveRouting}
                  disabled={resolvingRouting}
                  className="btn btn-outline btn-sm"
                  id="btn-re-resolve-routing"
                >
                  <Building2 size={12} className={resolvingRouting ? 'spin' : ''} />
                  {resolvingRouting ? 'Re-routing...' : 'Re-route Authority'}
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* PHASE 8: CITIZEN DISPUTE MODAL                                            */}
      {/* ========================================================================= */}
      {showDisputeModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-card" style={{ maxWidth: '520px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
                <AlertTriangle size={20} /> Dispute Municipal Resolution
              </h3>
              <button onClick={() => setShowDisputeModal(false)} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDisputeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Please explain why the civic problem is not resolved. Your feedback will be dispatched directly to the municipal team to reopen the case and resume work.
              </p>

              <div>
                <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                  Reason for Dispute (Minimum 10 characters)
                </label>
                <textarea
                  id="input-dispute-reason"
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="e.g., Pothole is still present, only loose gravel was placed without asphalt sealant..."
                  rows={4}
                  required
                  className="form-input"
                  style={{ width: '100%' }}
                />
                <div style={{ fontSize: '0.75rem', color: disputeReason.trim().length >= 10 ? '#10b981' : '#94a3b8', marginTop: '0.35rem' }}>
                  {disputeReason.trim().length}/10 characters minimum
                </div>
              </div>

              {verificationActionError && (
                <div style={{ padding: '0.65rem 0.85rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', fontSize: '0.82rem' }}>
                  {verificationActionError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowDisputeModal(false);
                    setVerificationActionError('');
                  }}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-dispute"
                  type="submit"
                  disabled={disputeSubmitting || disputeReason.trim().length < 10}
                  className="btn"
                  style={{ background: '#dc2626', color: '#fff' }}
                >
                  {disputeSubmitting ? 'Submitting Dispute...' : 'Submit Dispute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
