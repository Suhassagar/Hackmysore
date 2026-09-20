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

  // Phase 6 Staff Review State
  const [authorities, setAuthorities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [reviewMode, setReviewMode] = useState('APPROVE');
  const [selectedAuthorityId, setSelectedAuthorityId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState('');
  const [reviewError, setReviewError] = useState('');

  // Fetch Report & AI Analysis
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
          setError('Access Denied: You do not have authorization to view this citizen report (IDOR Protected).');
          setLoading(false);
          return;
        } else if (reportRes.status === 404) {
          setError(`Report ID '${id}' does not exist.`);
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

        // 3. Fetch Historical Jurisdiction Snapshot (Phase 4)
        if (reportRes.data?.jurisdiction) {
          setJurisdiction(reportRes.data.jurisdiction);
        } else {
          const jurRes = await api.getReportJurisdiction(id, token);
          if (jurRes.ok && jurRes.data?.jurisdiction) {
            setJurisdiction(jurRes.data.jurisdiction);
          }
        }

        // 4. Fetch Historical Routing Snapshot (Phase 5 & 6)
        if (reportRes.data?.routing) {
          setRouting(reportRes.data.routing);
        } else {
          const routRes = await api.getReportRouting(id, token);
          if (routRes.ok && routRes.data?.routing) {
            setRouting(routRes.data.routing);
          }
        }

        // 5. Fetch Phase 6 Routing Review Audit History
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

        // 7. Fetch Phase 7 Operational Case & Timeline
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

        // 8. Fetch Phase 8 Verification Snapshot & History
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
        setError(err.message || 'Network error.');
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
        setVerificationActionSuccess('Thank you! You have independently verified that this civic issue was resolved.');
        if (res.data?.verification) {
          setVerification(res.data.verification);
        }
        // Refresh case & timeline
        const caseRes = await api.getReportCase(id, token);
        if (caseRes.ok && caseRes.data?.case) {
          setCivicCase(caseRes.data.case);
          setCaseTimeline(caseRes.data.timeline || []);
        }
      } else {
        setVerificationActionError(res.data?.message || 'Failed to verify resolution.');
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
      setVerificationActionError('Dispute reason must be at least 10 characters detailing why the issue persists.');
      return;
    }
    setDisputeSubmitting(true);
    setVerificationActionError('');
    setVerificationActionSuccess('');
    try {
      const res = await api.disputeVerification(id, disputeReason.trim(), token);
      if (res.ok) {
        setVerificationActionSuccess('Dispute submitted. Municipal staff have been alerted to reinvestigate.');
        setShowDisputeModal(false);
        setDisputeReason('');
        if (res.data?.verification) {
          setVerification(res.data.verification);
        }
        // Refresh case & timeline
        const caseRes = await api.getReportCase(id, token);
        if (caseRes.ok && caseRes.data?.case) {
          setCivicCase(caseRes.data.case);
          setCaseTimeline(caseRes.data.timeline || []);
        }
      } else {
        setVerificationActionError(res.data?.message || 'Failed to submit dispute.');
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
            : 'Route successfully assigned by human override!'
        );
        // Refresh routing & review history
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

  // Handle Triggering / Reprocessing AI Analysis
  const handleTriggerAnalysis = async (force = false) => {
    setAnalyzing(true);
    setAnalysisError('');
    try {
      const res = await api.triggerReportAnalysis(id, token, force);
      if (res.ok && res.data?.analysis) {
        setAnalysis(res.data.analysis);
        // Refresh routing snapshot since AI category or status may have changed
        const routRes = await api.getReportRouting(id, token);
        if (routRes.ok && routRes.data?.routing) {
          setRouting(routRes.data.routing);
        }
      } else {
        setAnalysisError(res.data?.message || 'Failed to analyze report.');
      }
    } catch (err) {
      setAnalysisError(err.message || 'Network error during AI analysis.');
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
        // Also refresh routing
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

  const getSeverityBadgeColor = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return { bg: 'rgba(239, 68, 68, 0.2)', border: '#ef4444', text: '#fca5a5' };
      case 'HIGH':
        return { bg: 'rgba(249, 115, 22, 0.2)', border: '#f97316', text: '#fdba74' };
      case 'MEDIUM':
        return { bg: 'rgba(234, 179, 8, 0.2)', border: '#eab308', text: '#fde047' };
      default:
        return { bg: 'rgba(16, 185, 129, 0.2)', border: '#10b981', text: '#86efac' };
    }
  };

  if (loading) {
    return (
      <div className="main-content">
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
          Loading report details...
        </div>
      </div>
    );
  }

  if (isForbidden || error) {
    return (
      <div className="main-content">
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', padding: '2.5rem' }}>
          <ShieldAlert size={48} color="#ef4444" style={{ margin: '0 auto 1rem auto' }} />
          <h2>{isForbidden ? 'Unauthorized Access' : 'Report Not Found'}</h2>
          <p style={{ color: 'var(--text-muted)', margin: '0.75rem 0 1.5rem 0' }}>{error}</p>
          <Link to="/my-reports" className="btn btn-primary">
            Back to My Reports
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div style={{ maxWidth: '820px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            to="/my-reports"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}
            id="back-to-my-reports-link"
          >
            <ArrowLeft size={16} /> Back to My Reports
          </Link>
        </div>

        {/* ========================================================================= */}
        {/* PHASE 7: OPERATIONAL CIVIC CASE TRACKING & 5-STAGE CITIZEN JOURNEY        */}
        {/* ========================================================================= */}
        <div
          className="card"
          id="phase7-case-tracking-card"
          style={{
            marginBottom: '1.5rem',
            border: '1px solid #3b82f6',
            background: 'linear-gradient(180deg, #0d1a33 0%, #0a1122 100%)',
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          {/* Card Top: Case Identifier & Responsible Department */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Briefcase size={22} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '1.25rem', color: '#fff', margin: 0, fontFamily: 'monospace', fontWeight: 700 }}>
                    {civicCase ? civicCase.case_number : 'CIVIC CASE PENDING'}
                  </h3>
                  {civicCase && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.6rem',
                        borderRadius: '9999px',
                        textTransform: 'uppercase',
                        background:
                          civicCase.status === 'RESOLVED'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : civicCase.status === 'IN_PROGRESS'
                            ? 'rgba(245, 158, 11, 0.2)'
                            : civicCase.status === 'ON_HOLD'
                            ? 'rgba(168, 85, 247, 0.2)'
                            : civicCase.status === 'ACKNOWLEDGED'
                            ? 'rgba(99, 102, 241, 0.2)'
                            : civicCase.status === 'ASSIGNED'
                            ? 'rgba(59, 130, 246, 0.2)'
                            : 'rgba(148, 163, 184, 0.2)',
                        color:
                          civicCase.status === 'RESOLVED'
                            ? '#6ee7b7'
                            : civicCase.status === 'IN_PROGRESS'
                            ? '#fcd34d'
                            : civicCase.status === 'ON_HOLD'
                            ? '#d8b4fe'
                            : civicCase.status === 'ACKNOWLEDGED'
                            ? '#a5b4fc'
                            : civicCase.status === 'ASSIGNED'
                            ? '#93c5fd'
                            : '#cbd5e1',
                        border: `1px solid ${
                          civicCase.status === 'RESOLVED'
                            ? '#10b981'
                            : civicCase.status === 'IN_PROGRESS'
                            ? '#f59e0b'
                            : civicCase.status === 'ON_HOLD'
                            ? '#a855f7'
                            : '#3b82f6'
                        }`,
                      }}
                    >
                      {civicCase.status}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#93c5fd', marginTop: '0.2rem' }}>
                  {civicCase ? (
                    <>
                      Responsible: <strong>{civicCase.authority_code} • {civicCase.department_name || civicCase.department_code}</strong>
                    </>
                  ) : routing?.assessment?.status === 'NEEDS_REVIEW' ? (
                    <span style={{ color: '#fcd34d' }}>Routing under human review • Operational case pending adjudication</span>
                  ) : (
                    <span>Evaluating civic jurisdiction & routing snapshot...</span>
                  )}
                </div>
              </div>
            </div>

            {(role === 'STAFF' || role === 'ADMIN') && civicCase && (
              <Link
                to={`/staff/cases/${civicCase.id}`}
                className="btn btn-primary btn-sm"
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
              >
                Staff Case Workspace →
              </Link>
            )}
          </div>

          {/* 5-Stage Citizen Journey Stepper */}
          <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 255, 255, 0.07)', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
              Operational Civic Journey
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
              {/* Stage 1: Report Received */}
              <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#6ee7b7', fontSize: '0.8rem', fontWeight: 600 }}>
                  <Check size={14} /> Report Received
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                  {new Date(report.reportedAt || report.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* Stage 2: Routed */}
              {(() => {
                const isRouted = Boolean(civicCase || routing?.routing_status === 'ROUTED' || routing?.assessment?.status === 'AUTO_ROUTED' || routing?.decision_source === 'HUMAN_REVIEW');
                const isReview = routing?.assessment?.status === 'NEEDS_REVIEW' && !civicCase;
                return (
                  <div
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: isRouted ? 'rgba(16, 185, 129, 0.12)' : isReview ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${isRouted ? 'rgba(16, 185, 129, 0.3)' : isReview ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: isRouted ? '#6ee7b7' : isReview ? '#fcd34d' : '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
                      {isRouted ? <Check size={14} /> : isReview ? <AlertTriangle size={14} /> : '○'} {isReview ? 'Routing Review' : 'Department Routed'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {civicCase ? civicCase.department_code : isReview ? 'Requires review' : 'Evaluating route...'}
                    </div>
                  </div>
                );
              })()}

              {/* Stage 3: Staff Acknowledged */}
              {(() => {
                const isAck = Boolean(civicCase?.acknowledged_at || ['ACKNOWLEDGED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED'].includes(civicCase?.status));
                const isAssigned = civicCase?.status === 'ASSIGNED';
                return (
                  <div
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: isAck ? 'rgba(16, 185, 129, 0.12)' : isAssigned ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${isAck ? 'rgba(16, 185, 129, 0.3)' : isAssigned ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: isAck ? '#6ee7b7' : isAssigned ? '#93c5fd' : '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
                      {isAck ? <Check size={14} /> : isAssigned ? '●' : '○'} Staff Acknowledged
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                      {isAck ? 'Acknowledged' : isAssigned ? 'Staff assigned' : 'Awaiting assignment'}
                    </div>
                  </div>
                );
              })()}

              {/* Stage 4: Work In Progress */}
              {(() => {
                const isResolved = ['RESOLVED', 'CLOSED'].includes(civicCase?.status);
                const isInProgress = civicCase?.status === 'IN_PROGRESS';
                const isOnHold = civicCase?.status === 'ON_HOLD';
                return (
                  <div
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: isResolved ? 'rgba(16, 185, 129, 0.12)' : isInProgress ? 'rgba(245, 158, 11, 0.15)' : isOnHold ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${isResolved ? 'rgba(16, 185, 129, 0.3)' : isInProgress ? 'rgba(245, 158, 11, 0.4)' : isOnHold ? 'rgba(168, 85, 247, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: isResolved ? '#6ee7b7' : isInProgress ? '#fcd34d' : isOnHold ? '#d8b4fe' : '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
                      {isResolved ? <Check size={14} /> : isInProgress ? '●' : isOnHold ? <PauseCircle size={14} /> : '○'} Work Status
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                      {isResolved ? 'Work completed' : isInProgress ? 'Active on site' : isOnHold ? `Paused: ${civicCase.on_hold_reason || 'Pending'}` : 'Pending start'}
                    </div>
                  </div>
                );
              })()}

              {/* Stage 5: Staff Resolution */}
              {(() => {
                const isResolved = ['RESOLVED', 'CLOSED'].includes(civicCase?.status);
                return (
                  <div
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: isResolved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${isResolved ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: isResolved ? '#6ee7b7' : '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
                      {isResolved ? <Check size={14} /> : '○'} Staff Resolved
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                      {isResolved ? 'Claimed by staff' : 'Resolution pending'}
                    </div>
                  </div>
                );
              })()}

              {/* Stage 6: Citizen Verification (RESOLVED != VERIFIED) */}
              {(() => {
                const isVerified = verification?.status === 'VERIFIED';
                const isDisputed = verification?.status === 'DISPUTED';
                const isPendingVer = verification?.status === 'PENDING';
                const isReopened = civicCase?.status === 'IN_PROGRESS' && caseTimeline.some((e) => e.event_type === 'CASE_REOPENED');

                const bg = isVerified
                  ? 'rgba(16, 185, 129, 0.18)'
                  : isDisputed
                  ? 'rgba(239, 68, 68, 0.18)'
                  : isReopened
                  ? 'rgba(168, 85, 247, 0.18)'
                  : isPendingVer
                  ? 'rgba(245, 158, 11, 0.18)'
                  : 'rgba(255, 255, 255, 0.04)';

                const border = isVerified
                  ? 'rgba(16, 185, 129, 0.4)'
                  : isDisputed
                  ? 'rgba(239, 68, 68, 0.4)'
                  : isReopened
                  ? 'rgba(168, 85, 247, 0.4)'
                  : isPendingVer
                  ? 'rgba(245, 158, 11, 0.4)'
                  : 'rgba(255, 255, 255, 0.08)';

                const color = isVerified
                  ? '#6ee7b7'
                  : isDisputed
                  ? '#fca5a5'
                  : isReopened
                  ? '#d8b4fe'
                  : isPendingVer
                  ? '#fcd34d'
                  : '#94a3b8';

                return (
                  <div
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: bg,
                      border: `1px solid ${border}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color, fontSize: '0.8rem', fontWeight: 600 }}>
                      {isVerified ? (
                        <ShieldCheck size={14} />
                      ) : isDisputed ? (
                        <AlertTriangle size={14} />
                      ) : isReopened ? (
                        <RotateCcw size={14} />
                      ) : isPendingVer ? (
                        '●'
                      ) : (
                        '○'
                      )}{' '}
                      Citizen Verification
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                      {isVerified
                        ? 'Citizen Confirmed ✓'
                        : isDisputed
                        ? 'Disputed by Citizen ⚠'
                        : isReopened
                        ? 'Reopened for Rework'
                        : isPendingVer
                        ? 'Awaiting Confirmation'
                        : 'Awaiting Fix'}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Phase 8: Citizen Resolution Verification Card */}
          {(civicCase?.status === 'RESOLVED' || verification) && (
            <div
              id="citizen-resolution-verification-card"
              style={{
                marginBottom: '1.25rem',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
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
              }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {verification?.status === 'VERIFIED' ? (
                    <ShieldCheck size={22} color="#10b981" />
                  ) : verification?.status === 'DISPUTED' ? (
                    <AlertTriangle size={22} color="#ef4444" />
                  ) : (
                    <Clock size={22} color="#f59e0b" />
                  )}
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                      {verification?.status === 'VERIFIED'
                        ? 'Resolution Independently Verified by Citizen'
                        : verification?.status === 'DISPUTED'
                        ? 'Resolution Disputed by Citizen'
                        : 'Staff Claimed Resolution — Citizen Verification Required'}
                    </h3>
                    <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '0.15rem' }}>
                      Phase 8 Verification Standard: <strong>RESOLVED ≠ VERIFIED</strong>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <span
                  style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
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

              {/* Action Error or Success Banner */}
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
              <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                  Municipal Staff Remediation Claim
                </div>
                <div style={{ fontSize: '0.92rem', color: '#e2e8f0', lineHeight: 1.5 }}>
                  "{verification?.resolution_note || civicCase?.resolution_notes || 'Remediation completed by field team.'}"
                </div>

                {/* Evidence Photo if attached */}
                {(verificationEvidence?.media_url || civicCase?.latest_evidence?.media_url) && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                      Staff Resolution Evidence Photo:
                    </div>
                    <img
                      src={verificationEvidence?.media_url || civicCase?.latest_evidence?.media_url}
                      alt="Staff Resolution Evidence"
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

              {/* Citizen Dispute Record (if DISPUTED) */}
              {verification?.status === 'DISPUTED' && (
                <div style={{ background: 'rgba(239, 68, 68, 0.15)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, color: '#fca5a5', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                    Citizen Dispute Reason
                  </div>
                  <div style={{ fontSize: '0.92rem', color: '#fee2e2', fontStyle: 'italic', lineHeight: 1.5 }}>
                    "{verification.dispute_reason}"
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '0.5rem' }}>
                    Awaiting municipal staff review and work resumption.
                  </div>
                </div>
              )}

              {/* Citizen Confirmation Record (if VERIFIED) */}
              {verification?.status === 'VERIFIED' && (
                <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.85rem', color: '#6ee7b7', fontWeight: 600 }}>
                    ✓ The reporting citizen confirmed the problem is fully resolved. Case is closed with full verification accountability.
                  </div>
                </div>
              )}

              {/* Verification Interactive Choice for Citizen Owner */}
              {verification?.status === 'PENDING' && (
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#fcd34d', marginBottom: '0.85rem', lineHeight: 1.5 }}>
                    <strong>Citizen Verification Notice:</strong> Municipal staff have reported this issue as resolved. Please inspect the location and confirm whether the physical issue has been satisfactorily fixed.
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      id="btn-confirm-verification"
                      onClick={handleConfirmVerification}
                      disabled={confirmingVerification}
                      className="btn"
                      style={{
                        background: '#059669',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.88rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <Check size={16} />
                      {confirmingVerification ? 'Confirming...' : 'Confirm Resolved'}
                    </button>

                    <button
                      id="btn-dispute-verification"
                      onClick={() => setShowDisputeModal(true)}
                      disabled={confirmingVerification}
                      className="btn"
                      style={{
                        background: '#dc2626',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.88rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <AlertTriangle size={16} />
                      Issue Still Exists (Dispute)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Citizen-Safe Operational Activity Timeline */}
          {caseTimeline.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                Operational Activity Timeline
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {caseTimeline.map((ev, i) => (
                  <div
                    key={ev.id || i}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '0.75rem',
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.02)',
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', color: '#64748b', fontSize: '0.75rem', flexShrink: 0 }}>
                      {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ fontWeight: 600, color: '#e2e8f0' }}>
                      {ev.event_type.replace(/_/g, ' ')}
                    </span>
                    {ev.note && <span style={{ color: '#94a3b8' }}>— {ev.note}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* PHASE 4: LOCATION & ADMINISTRATIVE JURISDICTION ENGINE                     */}
        {/* ========================================================================= */}
        <div
          className="card"
          id="jurisdiction-engine-card"
          style={{
            marginBottom: '1.5rem',
            border: '1px solid #8b5cf6',
            background: 'linear-gradient(180deg, #18112e 0%, #0f0c1d 100%)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Layers size={22} color="#a78bfa" />
              <div>
                <h3 style={{ fontSize: '1.2rem', color: '#fff' }}>Geospatial & Administrative Jurisdiction</h3>
                <span style={{ fontSize: '0.75rem', color: '#c4b5fd' }}>
                  PostGIS ST_Covers point-in-polygon • Temporal boundary versioning
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {jurisdiction && (
                <span
                  id="jurisdiction-match-badge"
                  style={{
                    padding: '0.25rem 0.65rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    background:
                      jurisdiction.match_status === 'MATCHED'
                        ? 'rgba(16, 185, 129, 0.2)'
                        : jurisdiction.match_status === 'NO_JURISDICTION_MATCH'
                        ? 'rgba(234, 179, 8, 0.2)'
                        : 'rgba(239, 68, 68, 0.2)',
                    color:
                      jurisdiction.match_status === 'MATCHED'
                        ? '#6ee7b7'
                        : jurisdiction.match_status === 'NO_JURISDICTION_MATCH'
                        ? '#fde047'
                        : '#fca5a5',
                    border: `1px solid ${
                      jurisdiction.match_status === 'MATCHED'
                        ? '#10b981'
                        : jurisdiction.match_status === 'NO_JURISDICTION_MATCH'
                        ? '#eab308'
                        : '#ef4444'
                    }`,
                  }}
                >
                  {jurisdiction.match_status === 'MATCHED' && '✓ MATCHED'}
                  {jurisdiction.match_status === 'NO_JURISDICTION_MATCH' && '⚠ NO JURISDICTION MATCH'}
                  {jurisdiction.match_status === 'JURISDICTION_CONFLICT' && '✕ JURISDICTION CONFLICT'}
                </span>
              )}

              {report?.location?.status === 'VERIFIED_COORDINATES' && (
                <button
                  onClick={handleResolveJurisdiction}
                  disabled={resolvingJur}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                  title="Re-run spatial resolution"
                >
                  <RefreshCw size={12} className={resolvingJur ? 'spin' : ''} />
                  {resolvingJur ? 'Resolving...' : 'Re-resolve'}
                </button>
              )}
            </div>
          </div>

          {jurisdiction ? (
            <div>
              {/* Jurisdiction Details Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '0.75rem',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Jurisdiction Name</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#fff', marginTop: '0.2rem' }}>
                    {jurisdiction.jurisdiction_name || 'Unincorporated / Unassigned'}
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Administrative Type</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#c4b5fd', marginTop: '0.2rem' }}>
                    {jurisdiction.jurisdiction_type || 'N/A'}
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Boundary Version</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#a78bfa', marginTop: '0.2rem', fontFamily: 'monospace' }}>
                    {jurisdiction.jurisdiction_version || 'N/A'}
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Match Method</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 500, color: '#94a3b8', marginTop: '0.2rem', fontFamily: 'monospace' }}>
                    {jurisdiction.match_method}
                  </div>
                </div>
              </div>

              {/* Conflict Advisory if Overlapping Boundaries */}
              {jurisdiction.match_status === 'JURISDICTION_CONFLICT' && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fca5a5', fontWeight: 600, marginBottom: '0.5rem' }}>
                    <AlertTriangle size={16} />
                    <span>Overlapping Administrative Boundaries Detected ({jurisdiction.candidate_matches?.length || 0} Candidate Jurisdictions)</span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#fca5a5', marginBottom: '0.75rem' }}>
                    The report coordinates fall inside multiple intersecting administrative polygons simultaneously. This report requires manual jurisdiction adjudication.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {(jurisdiction.candidate_matches || []).map((cand, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: 'rgba(0,0,0,0.3)',
                          padding: '0.5rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.82rem',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: '#fff' }}>{cand.jurisdiction_name}</span>
                        <span style={{ color: '#cbd5e1', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                          {cand.jurisdiction_type} • {cand.version}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Match Advisory */}
              {jurisdiction.match_status === 'NO_JURISDICTION_MATCH' && (
                <div
                  style={{
                    background: 'rgba(234, 179, 8, 0.12)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    fontSize: '0.84rem',
                    color: '#fde047',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Boundary Gap:</strong> Coordinates fall outside all registered administrative polygons for the report timestamp. Flagged for manual boundary review.
                  </div>
                </div>
              )}

              {/* Explanation Note */}
              <div
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  lineHeight: '1.5',
                  padding: '0.75rem',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: '3px solid #8b5cf6',
                }}
              >
                {jurisdiction.explanation}
              </div>

              {/* Scope Boundary Notice */}
              <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                ℹ Phase 4 determines spatial administrative coverage. Department responsibility rules (MCC vs Panchayat) are computed in Phase 5.
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1.25rem 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              {report?.location?.status === 'VERIFIED_COORDINATES' ? (
                <div>
                  No jurisdiction snapshot recorded yet.
                  <div style={{ marginTop: '0.5rem' }}>
                    <button
                      onClick={handleResolveJurisdiction}
                      disabled={resolvingJur}
                      className="btn btn-secondary btn-sm"
                    >
                      <Compass size={14} /> Resolve Jurisdiction Now
                    </button>
                  </div>
                </div>
              ) : (
                'Location coordinates were not provided with this report. Administrative jurisdiction cannot be resolved spatially.'
              )}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* PHASE 3: AI ISSUE UNDERSTANDING CARD                                     */}
        {/* ========================================================================= */}
        <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid #3b82f6', background: 'linear-gradient(180deg, #111a2e 0%, #0d1322 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Sparkles size={22} color="#60a5fa" />
              <div>
                <h3 style={{ fontSize: '1.2rem', color: '#fff' }}>AI Issue Understanding</h3>
                <span style={{ fontSize: '0.75rem', color: '#93c5fd' }}>
                  AI-assisted analysis (Decision Support Only • Does not assign authority)
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {analysis && (
                <span
                  style={{
                    padding: '0.25rem 0.65rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    background:
                      analysis.status === 'COMPLETED'
                        ? 'rgba(16, 185, 129, 0.2)'
                        : analysis.status === 'NEEDS_REVIEW'
                        ? 'rgba(234, 179, 8, 0.2)'
                        : 'rgba(239, 68, 68, 0.2)',
                    color:
                      analysis.status === 'COMPLETED'
                        ? '#6ee7b7'
                        : analysis.status === 'NEEDS_REVIEW'
                        ? '#fde047'
                        : '#fca5a5',
                    border: `1px solid ${
                      analysis.status === 'COMPLETED'
                        ? '#10b981'
                        : analysis.status === 'NEEDS_REVIEW'
                        ? '#eab308'
                        : '#ef4444'
                    }`,
                  }}
                >
                  {analysis.status}
                </span>
              )}

              <button
                onClick={() => handleTriggerAnalysis(role === 'ADMIN')}
                className="btn btn-outline btn-sm"
                disabled={analyzing}
                id="btn-trigger-ai-analysis"
                title={role === 'ADMIN' ? 'Force reprocess analysis' : 'Refresh / analyze'}
              >
                <RefreshCw size={13} className={analyzing ? 'spinner' : ''} />
                {analyzing ? 'Analyzing...' : analysis ? 'Re-analyze' : 'Run AI Analysis'}
              </button>
            </div>
          </div>

          {analysisError && (
            <div className="alert alert-error" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <div>{analysisError}</div>
            </div>
          )}

          {analysis ? (
            <div>
              {/* Category Comparison: AI vs Citizen */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                    🤖 AI Predicted Category
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#60a5fa' }}>
                    {analysis.category}
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                    👤 Citizen-Reported Category
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {report.category}
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                    ⚠️ Estimated Severity
                  </div>
                  {(() => {
                    const colors = getSeverityBadgeColor(analysis.severity);
                    return (
                      <div
                        style={{
                          display: 'inline-block',
                          padding: '0.15rem 0.55rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.9rem',
                          fontWeight: 800,
                          background: colors.bg,
                          color: colors.text,
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        {analysis.severity}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Summary */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Factual Summary
                </div>
                <div style={{ fontSize: '0.95rem', color: '#e2e8f0', background: 'var(--bg-primary)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  {analysis.summary}
                </div>
              </div>

              {/* Risk Factors */}
              {Array.isArray(analysis.risk_factors) && analysis.risk_factors.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Identified Public Risk Factors
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                    {analysis.risk_factors.map((risk, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#fca5a5',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          padding: '0.2rem 0.6rem',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.78rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <AlertTriangle size={12} />
                        {risk}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Confidence Score */}
              <div style={{ marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  <span>Model Confidence</span>
                  <span style={{ fontWeight: 700, color: analysis.confidence >= 0.7 ? 'var(--status-200)' : 'var(--status-401)' }}>
                    {Math.round(analysis.confidence * 100)}% ({analysis.confidence})
                  </span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.round(analysis.confidence * 100)}%`,
                      height: '100%',
                      background: analysis.confidence >= 0.7 ? 'var(--status-200)' : 'var(--status-401)',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>

              {/* Notice for Needs Review */}
              {analysis.status === 'NEEDS_REVIEW' && (
                <div className="alert alert-info" style={{ marginTop: '1rem', fontSize: '0.8rem', background: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.3)', color: '#fde047' }}>
                  <Info size={16} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Human Review Advisory:</strong> The AI confidence score is below the 70% threshold. This report requires manual verification before final automated case creation.
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              AI analysis has not yet been processed for this report.
              <div style={{ marginTop: '0.75rem' }}>
                <button
                  onClick={() => handleTriggerAnalysis(false)}
                  className="btn btn-primary btn-sm"
                  disabled={analyzing}
                  id="btn-run-first-ai-analysis"
                >
                  <Sparkles size={14} /> Run AI Understanding Now
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* PHASE 5: CIVIC RESPONSIBILITY & AUTHORITY ROUTING CARD                   */}
        {/* ========================================================================= */}
        <div
          className="card"
          id="civic-responsibility-card"
          style={{
            marginBottom: '1.5rem',
            border: '1px solid #10b981',
            background: 'linear-gradient(180deg, #09261d 0%, #061812 100%)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Building2 size={22} color="#34d399" />
              <div>
                <h3 style={{ fontSize: '1.2rem', color: '#fff' }}>Civic Responsibility & Authority Routing</h3>
                <span style={{ fontSize: '0.75rem', color: '#a7f3d0' }}>
                  Dynamic Rule Engine • Versioned policy mapping WHERE + WHAT + WHEN &rarr; WHO
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {routing && (
                <span
                  id="routing-status-badge"
                  style={{
                    padding: '0.25rem 0.65rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    background:
                      routing.decision_source === 'HUMAN_REVIEW'
                        ? 'rgba(59, 130, 246, 0.2)'
                        : (routing.routing_status === 'AUTO_ROUTED' || routing.route_status === 'ROUTED')
                        ? 'rgba(16, 185, 129, 0.2)'
                        : (routing.routing_status === 'NEEDS_REVIEW' || routing.route_status === 'NEEDS_REVIEW')
                        ? 'rgba(245, 158, 11, 0.2)'
                        : 'rgba(239, 68, 68, 0.2)',
                    color:
                      routing.decision_source === 'HUMAN_REVIEW'
                        ? '#93c5fd'
                        : (routing.routing_status === 'AUTO_ROUTED' || routing.route_status === 'ROUTED')
                        ? '#6ee7b7'
                        : (routing.routing_status === 'NEEDS_REVIEW' || routing.route_status === 'NEEDS_REVIEW')
                        ? '#fde047'
                        : '#fca5a5',
                    border: `1px solid ${
                      routing.decision_source === 'HUMAN_REVIEW'
                        ? '#3b82f6'
                        : (routing.routing_status === 'AUTO_ROUTED' || routing.route_status === 'ROUTED')
                        ? '#10b981'
                        : (routing.routing_status === 'NEEDS_REVIEW' || routing.route_status === 'NEEDS_REVIEW')
                        ? '#f59e0b'
                        : '#ef4444'
                    }`,
                  }}
                >
                  {routing.decision_source === 'HUMAN_REVIEW' && '✓ HUMAN ADJUDICATED'}
                  {routing.decision_source !== 'HUMAN_REVIEW' && (routing.routing_status === 'AUTO_ROUTED' || routing.route_status === 'ROUTED') && '✓ AUTO ROUTED'}
                  {routing.decision_source !== 'HUMAN_REVIEW' && (routing.routing_status === 'NEEDS_REVIEW' || routing.route_status === 'NEEDS_REVIEW') && '⚡ REQUIRES HUMAN REVIEW'}
                  {routing.routing_status === 'ROUTING_FAILED' && '✕ ROUTING FAILED'}
                  {!routing.routing_status && routing.route_status === 'NO_RESPONSIBLE_RULE' && '⚠ NO RESPONSIBLE RULE'}
                  {!routing.routing_status && routing.route_status === 'RESPONSIBILITY_CONFLICT' && '✕ RESPONSIBILITY CONFLICT'}
                </span>
              )}

              <button
                onClick={handleResolveRouting}
                disabled={resolvingRouting}
                className="btn btn-secondary btn-sm"
                id="btn-re-resolve-routing"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                title="Re-run responsibility rule evaluation"
              >
                <RefreshCw size={12} className={resolvingRouting ? 'spin' : ''} />
                {resolvingRouting ? 'Resolving...' : 'Re-route'}
              </button>
            </div>
          </div>

          {routing ? (
            <div>
              {/* Operational Assignment Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '0.75rem',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ background: 'rgba(0,0,0,0.28)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Responsible Authority</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginTop: '0.2rem' }}>
                    {routing.authority_name || 'Unassigned'}
                  </div>
                  {routing.authority_code && (
                    <div style={{ fontSize: '0.75rem', color: '#6ee7b7', fontFamily: 'monospace', marginTop: '0.15rem' }}>
                      {routing.authority_code} • {routing.authority_type || 'Civic Body'}
                    </div>
                  )}
                </div>

                <div style={{ background: 'rgba(0,0,0,0.28)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Operational Department</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#a7f3d0', marginTop: '0.2rem' }}>
                    {routing.department_name || 'Unassigned'}
                  </div>
                  {routing.department_code && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '0.15rem' }}>
                      Dept Code: {routing.department_code}
                    </div>
                  )}
                </div>

                <div style={{ background: 'rgba(0,0,0,0.28)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Policy Rule Version</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#34d399', marginTop: '0.2rem', fontFamily: 'monospace' }}>
                    {routing.rule_version || 'N/A'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    Method: {routing.match_method}
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.28)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Routed Issue Category</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#60a5fa', marginTop: '0.2rem' }}>
                    {routing.issue_category_used || report.category}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    Source: {routing.category_source === 'AI_ANALYSIS' ? 'AI Understanding' : 'Citizen Submission'}
                  </div>
                </div>
              </div>

              {/* Responsibility Conflict Box */}
              {routing.route_status === 'RESPONSIBILITY_CONFLICT' && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fca5a5', fontWeight: 600, marginBottom: '0.5rem' }}>
                    <AlertTriangle size={16} />
                    <span>Competing Administrative Responsibilities ({routing.candidate_rules?.length || 0} Matching Rules)</span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#fca5a5', marginBottom: '0.75rem' }}>
                    Multiple rules with identical priority match this issue in this jurisdiction. CivicFlow refuses to make an arbitrary guess. Flagged for administrative assignment.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {(routing.candidate_rules || []).map((cand, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: 'rgba(0,0,0,0.3)',
                          padding: '0.5rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.82rem',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: '#fff' }}>
                          {cand.authority_name} &bull; {cand.department_name}
                        </span>
                        <span style={{ color: '#cbd5e1', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                          Rule {cand.rule_version} (Priority: {cand.priority})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Responsible Rule Box */}
              {routing.route_status === 'NO_RESPONSIBLE_RULE' && (
                <div
                  style={{
                    background: 'rgba(234, 179, 8, 0.12)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    fontSize: '0.84rem',
                    color: '#fde047',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Unmapped Civic Problem:</strong> No responsibility rule covers category &apos;{routing.issue_category_used}&apos; in this jurisdiction at the report timestamp. Flagged for administrative allocation.
                  </div>
                </div>
              )}

              {/* AI Uncertainty Notice */}
              {routing.route_status === 'NEEDS_REVIEW' && (
                <div
                  style={{
                    background: 'rgba(168, 85, 247, 0.12)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    fontSize: '0.84rem',
                    color: '#d8b4fe',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <Info size={16} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Provisional Authority Route:</strong> Routed to {routing.authority_name} ({routing.department_name}), but marked for human verification because AI issue confidence was below 70%.
                  </div>
                </div>
              )}

              {/* Explainability Summary Box */}
              <div
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  lineHeight: '1.5',
                  padding: '0.85rem',
                  background: 'rgba(0,0,0,0.22)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: '3px solid #10b981',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: '#6ee7b7', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '0.04em' }}>
                  Auditable Explainability Trace
                </div>
                {routing.explanation}
              </div>

              {/* Phase 6: Review Reasons (if review required or reasons exist) */}
              {Array.isArray(routing.review_reasons) && routing.review_reasons.length > 0 && (
                <div
                  style={{
                    marginTop: '1rem',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fde047', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <ShieldAlert size={14} /> Triggered Routing Review Conditions
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {routing.review_reasons.map((r, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: 'rgba(0,0,0,0.3)',
                          color: '#fef08a',
                          padding: '0.2rem 0.55rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          fontFamily: 'monospace',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                        }}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Phase 6: Human Adjudication Audit Banner (if decision_source === 'HUMAN_REVIEW') */}
              {routing.decision_source === 'HUMAN_REVIEW' && (
                <div
                  style={{
                    marginTop: '1rem',
                    background: 'rgba(59, 130, 246, 0.12)',
                    border: '1px solid rgba(59, 130, 246, 0.35)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#93c5fd', fontWeight: 700, fontSize: '0.85rem' }}>
                      <UserCheck size={16} /> Human Review Adjudication Record
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {routing.reviewed_at ? new Date(routing.reviewed_at).toLocaleString() : 'Recently'}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.82rem', color: '#e2e8f0', marginBottom: '0.5rem' }}>
                    <strong>Reviewer ID:</strong> <span style={{ fontFamily: 'monospace' }}>{routing.reviewed_by}</span>
                  </div>

                  {routing.review_notes && (
                    <div style={{ fontSize: '0.82rem', color: '#cbd5e1', background: 'rgba(0,0,0,0.25)', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem' }}>
                      <strong>Staff Justification:</strong> &ldquo;{routing.review_notes}&rdquo;
                    </div>
                  )}

                  <div style={{ fontSize: '0.78rem', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>Original Route: {routing.authority_code || 'None'}</span>
                    <span>&rarr;</span>
                    <strong>Final Route: {routing.final_authority_name || routing.authority_name} ({routing.final_department_name || routing.department_name})</strong>
                  </div>
                </div>
              )}

              {/* Phase 6: Inline Staff Adjudication Action Form (STAFF / ADMIN ONLY when NEEDS_REVIEW) */}
              {(role === 'STAFF' || role === 'ADMIN') && routing.routing_status === 'NEEDS_REVIEW' && (
                <div
                  style={{
                    marginTop: '1.25rem',
                    background: 'rgba(15, 23, 42, 0.85)',
                    border: '1px solid rgba(245, 158, 11, 0.5)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                  }}
                  id="staff-inline-review-box"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                    <Edit3 size={18} color="#f59e0b" />
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
                      Staff Adjudication Action
                    </h4>
                  </div>

                  {/* Mode Toggles */}
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

                  {/* Override Dropdowns */}
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

                  {/* Review Notes */}
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
                        <RefreshCw size={13} className="spin" /> Submitting Review...
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

              {/* Review History Audit Trail */}
              {Array.isArray(reviewsHistory) && reviewsHistory.length > 0 && (
                <div style={{ marginTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6ee7b7', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                    <History size={13} /> Complete Review Audit Trail ({reviewsHistory.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {reviewsHistory.map((rev) => (
                      <div
                        key={rev.id}
                        style={{
                          background: 'rgba(0,0,0,0.25)',
                          padding: '0.65rem 0.85rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.78rem',
                          border: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                          <span style={{ fontWeight: 700, color: '#fff' }}>
                            Action: {rev.action} by {rev.reviewer_name || rev.reviewed_by?.substring(0, 8)} ({rev.reviewer_role})
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {new Date(rev.created_at).toLocaleString()}
                          </span>
                        </div>
                        {rev.review_notes && (
                          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Notes: &ldquo;{rev.review_notes}&rdquo;
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Core Principle Notice */}
              <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#6ee7b7', opacity: 0.8 }}>
                ⚖ <strong>Product Principle:</strong> Gemini understands WHAT &bull; PostGIS determines WHERE &bull; Rule Engine determines WHO
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1.25rem 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Responsibility routing snapshot has not yet been computed for this report.
              <div style={{ marginTop: '0.5rem' }}>
                <button
                  onClick={handleResolveRouting}
                  disabled={resolvingRouting}
                  className="btn btn-secondary btn-sm"
                >
                  <Building2 size={14} /> Resolve Responsibility Now
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Citizen Report Card */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
            <div>
              <span
                style={{
                  background: 'rgba(37, 99, 235, 0.2)',
                  color: '#93c5fd',
                  border: '1px solid rgba(37, 99, 235, 0.4)',
                  padding: '0.25rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {report.category}
              </span>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.4rem', fontFamily: 'monospace' }}>
                Report ID: {report.id}
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Clock size={14} />
              <span>{new Date(report.reportedAt).toLocaleString()}</span>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Original Citizen Description
            </h4>
            <p style={{ fontSize: '1.05rem', lineHeight: '1.6', color: 'var(--text-main)', background: 'var(--bg-primary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              {report.description}
            </p>
          </div>

          {/* Photo Evidence */}
          {report.photoUrl && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Attached Evidence Photo
              </h4>
              <img
                src={report.photoUrl}
                alt="Civic evidence"
                style={{
                  width: '100%',
                  maxHeight: '400px',
                  objectFit: 'contain',
                  background: '#000',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              />
            </div>
          )}

          {/* Location Details */}
          <div>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Captured Location
            </h4>
            <div
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
              }}
            >
              <div className="detail-row">
                <span className="detail-key">Location Status</span>
                <span className="detail-val" style={{ color: report.location?.status === 'VERIFIED_COORDINATES' ? 'var(--status-200)' : 'var(--status-401)' }}>
                  {report.location?.status}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-key">GPS Latitude</span>
                <span className="detail-val">{report.location?.latitude ?? 'Not Provided'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-key">GPS Longitude</span>
                <span className="detail-val">{report.location?.longitude ?? 'Not Provided'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Accuracy Estimate</span>
                <span className="detail-val">
                  {report.location?.accuracy ? `~${report.location.accuracy} meters` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Phase 8: Citizen Dispute Modal */}
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
                Please explain why the civic issue is not resolved. Your feedback will be recorded in the public accountability audit log and dispatched to the municipal team.
              </p>

              <div>
                <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                  Reason for Dispute (Mandatory, min 10 chars)
                </label>
                <textarea
                  id="input-dispute-reason"
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="e.g., Pothole is still present, only dirt was poured without asphalt sealant..."
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
