import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Briefcase,
  Clock,
  ArrowRight,
  RefreshCw,
  MapPin,
  Sparkles,
  Building2,
  Check,
  Edit3,
  X,
  Compass,
  FileText,
  User,
  History,
  Info,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

function getTimeAgo(dateInput) {
  if (!dateInput) return 'Recently';
  const date = new Date(dateInput);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr${diffHr > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Section 5: Human-readable review reason mapping
function translateReviewReason(reason) {
  switch (reason) {
    case 'AI_LOW_CONFIDENCE':
      return {
        title: 'Uncertain Classification',
        description: 'The issue classification is uncertain (<70% AI confidence). Staff verification is required.',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.15)',
        border: 'rgba(245, 158, 11, 0.4)',
      };
    case 'AI_NEEDS_REVIEW':
      return {
        title: 'AI Verification Required',
        description: 'The automated issue model flagged this problem for human verification.',
        color: '#f97316',
        bg: 'rgba(249, 115, 22, 0.15)',
        border: 'rgba(249, 115, 22, 0.4)',
      };
    case 'NO_JURISDICTION_MATCH':
      return {
        title: 'Outside Known Jurisdiction',
        description: 'The reported location does not fall within a known civic jurisdiction boundary.',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.15)',
        border: 'rgba(239, 68, 68, 0.4)',
      };
    case 'JURISDICTION_CONFLICT':
      return {
        title: 'Boundary Conflict',
        description: 'The location matches multiple overlapping jurisdiction boundaries. Manual assignment is required.',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.18)',
        border: '#ef4444',
      };
    case 'NO_RESPONSIBILITY_RULE':
      return {
        title: 'No Matching Responsibility Rule',
        description: 'No current municipal responsibility rule matched this issue category and location.',
        color: '#a855f7',
        bg: 'rgba(168, 85, 247, 0.15)',
        border: 'rgba(168, 85, 247, 0.4)',
      };
    case 'RESPONSIBILITY_CONFLICT':
      return {
        title: 'Competing Responsibility Rules',
        description: 'Multiple responsibility rules produced competing results. CivicFlow refused to guess.',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.18)',
        border: '#ef4444',
      };
    case 'INVALID_LOCATION':
      return {
        title: 'Unvalidated Location',
        description: 'The reported location could not be validated or coordinates were not provided.',
        color: '#94a3b8',
        bg: 'rgba(148, 163, 184, 0.15)',
        border: 'rgba(148, 163, 184, 0.35)',
      };
    case 'ROUTING_DATA_ERROR':
      return {
        title: 'Routing Data Inconsistency',
        description: 'A data inconsistency occurred during automated routing assessment.',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.15)',
        border: 'rgba(245, 158, 11, 0.4)',
      };
    case 'PHOTO_LOCATION_MISMATCH':
      return {
        title: 'Photo Location Discrepancy',
        description: 'Photo GPS metadata differs from reported coordinates by more than 500 meters.',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.15)',
        border: 'rgba(245, 158, 11, 0.4)',
      };
    default:
      return {
        title: reason.replace(/_/g, ' '),
        description: 'This case triggered an automated review condition requiring staff adjudication.',
        color: '#60a5fa',
        bg: 'rgba(59, 130, 246, 0.15)',
        border: 'rgba(59, 130, 246, 0.3)',
      };
  }
}

export const ReviewQueue = () => {
  const { user, token, role, switchDevRole } = useAuth();
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'adjudicated'
  const [queue, setQueue] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Session audit trail of reviews performed
  const [sessionAudits, setSessionAudits] = useState([]);

  // Adjudication Modal State
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalMode, setModalMode] = useState(null); // 'APPROVE' | 'OVERRIDE'
  const [modalLoading, setModalLoading] = useState(false);
  const [itemDetails, setItemDetails] = useState(null);
  const [authorities, setAuthorities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedAuthorityId, setSelectedAuthorityId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  const fetchQueue = useCallback(async (targetPage = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getReviewQueue(token, { page: targetPage, limit: 10 });
      if (res.ok && res.data) {
        setQueue(res.data.items || []);
        setTotal(res.data.total || 0);
        setPage(res.data.page || 1);
        setTotalPages(res.data.totalPages || 1);
      } else {
        setError(res.data?.message || 'We could not load the routing review queue.');
      }
    } catch (err) {
      setError('We could not load the routing review queue. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchQueue(1);
    }
  }, [fetchQueue, token]);

  const loadAuthoritiesAndDepts = async () => {
    try {
      const [authRes, deptRes] = await Promise.all([
        api.getAuthorities(token).catch(() => ({ ok: false })),
        api.getDepartments(token).catch(() => ({ ok: false })),
      ]);
      if (authRes.ok && Array.isArray(authRes.data?.authorities)) {
        setAuthorities(authRes.data.authorities);
      }
      if (deptRes.ok && Array.isArray(deptRes.data?.departments)) {
        setDepartments(deptRes.data.departments);
      }
    } catch (err) {
      console.warn('Failed to load routing authorities list:', err);
    }
  };

  // Open Modal for Approve or Override
  const openAdjudicationModal = async (item, mode = 'APPROVE') => {
    setSelectedItem(item);
    setModalMode(mode);
    setModalLoading(true);
    setActionSuccess(null);
    setActionError(null);
    setReviewNotes('');
    setSelectedAuthorityId('');
    setSelectedDepartmentId('');

    try {
      await loadAuthoritiesAndDepts();
      // Fetch comprehensive signals: Report, AI Analysis, Jurisdiction, Routing
      const [repRes, routRes, aiRes, jurRes] = await Promise.all([
        api.getReportById(item.reportId, token).catch(() => ({ ok: false })),
        api.getReportRouting(item.reportId, token).catch(() => ({ ok: false })),
        api.getReportAnalysis(item.reportId, token).catch(() => ({ ok: false })),
        api.getReportJurisdiction(item.reportId, token).catch(() => ({ ok: false })),
      ]);

      setItemDetails({
        report: repRes.data || null,
        routing: routRes.data?.routing || null,
        analysis: aiRes.data?.analysis || null,
        jurisdiction: jurRes.data?.jurisdiction || null,
      });

      // If opening override mode, try to pre-select candidate if valid
      if (mode === 'OVERRIDE' && routRes.data?.routing?.suggested_authority_id) {
        setSelectedAuthorityId(routRes.data.routing.suggested_authority_id);
      }
    } catch (err) {
      setActionError('Failed to fetch full report signals: ' + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const closeAdjudicationModal = () => {
    setSelectedItem(null);
    setModalMode(null);
    setItemDetails(null);
    setActionSuccess(null);
    setActionError(null);
    setReviewNotes('');
  };

  const handleSubmitAdjudication = async () => {
    if (!selectedItem) return;
    setSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    const payload = {
      action: modalMode,
      review_notes: reviewNotes.trim() || undefined,
    };

    if (modalMode === 'OVERRIDE') {
      if (!selectedAuthorityId) {
        setActionError('Please select a responsible Civic Authority.');
        setSubmitting(false);
        return;
      }
      if (!selectedDepartmentId) {
        setActionError('Please select an operational Department.');
        setSubmitting(false);
        return;
      }
      // Mandatory override reason (Section 10)
      if (!reviewNotes.trim() || reviewNotes.trim().length < 10) {
        setActionError('Override requires a meaningful explanation (minimum 10 characters) for the operational audit trail.');
        setSubmitting(false);
        return;
      }
      payload.final_authority_id = selectedAuthorityId;
      payload.final_department_id = selectedDepartmentId;
    }

    try {
      const res = await api.submitRoutingReview(selectedItem.reportId, payload, token);
      if (res.ok) {
        const resultingCaseNumber = res.data?.case?.case_number || 'CIVIC CASE CREATED';
        const successMsg =
          modalMode === 'APPROVE'
            ? `Route approved successfully! Case created: ${resultingCaseNumber}`
            : `Route successfully overridden and assigned! Case created: ${resultingCaseNumber}`;

        setActionSuccess(successMsg);

        // Record in session audit log (Section 11 & 13)
        const auditEntry = {
          reportId: selectedItem.reportId,
          category: selectedItem.category,
          action: modalMode,
          caseNumber: res.data?.case?.case_number,
          caseId: res.data?.case?.id,
          reviewedBy: user?.name || 'Staff Officer',
          reviewedAt: new Date().toISOString(),
          notes: reviewNotes.trim() || (modalMode === 'APPROVE' ? 'Automated candidate route approved' : 'Route overridden by staff'),
        };
        setSessionAudits((prev) => [auditEntry, ...prev]);

        // Auto close and refresh after 1.5 seconds
        setTimeout(() => {
          closeAdjudicationModal();
          fetchQueue(page);
        }, 1500);
      } else {
        setActionError(res.data?.message || 'We could not complete your review. Please try again.');
      }
    } catch (err) {
      setActionError('Network error submitting review decision. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (role !== 'STAFF' && role !== 'ADMIN') {
    return (
      <div className="main-content">
        <div className="card" style={{ maxWidth: '540px', margin: '4rem auto', textAlign: 'center', padding: '2.5rem' }}>
          <ShieldAlert size={48} color="#f59e0b" style={{ margin: '0 auto 1rem auto' }} />
          <h2>Staff Authorization Required</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: 1.5 }}>
            Only designated municipal staff officers and administrators are authorized to access the routing review queue.
          </p>
          <div style={{ margin: '1.25rem 0', padding: '0.75rem 1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}>
            Current session: <strong style={{ color: '#ffffff' }}>{user?.email || 'Citizen'}</strong> ({role || 'NONE'})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ justifyContent: 'center' }}
              onClick={() => switchDevRole('staff@mysuru.civicflow.in')}
              id="btn-switch-to-staff-queue"
            >
              ⚡ Switch to Staff Account (staff@mysuru.civicflow.in)
            </button>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <Link to="/login" className="btn btn-outline btn-sm">
                Sign In With Different Account
              </Link>
              <Link to="/" className="btn btn-outline btn-sm">
                Return to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '3rem' }}>
        
        {/* ========================================================================= */}
        {/* HEADER & CORE SAFETY PRINCIPLE BANNER                                    */}
        {/* ========================================================================= */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: 'rgba(245, 158, 11, 0.2)',
                    color: '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Routing Review Queue
                  </h1>
                  <p style={{ color: 'var(--text-muted)', margin: '0.2rem 0 0 0', fontSize: '0.9rem' }}>
                    These reports require human review before a civic case can be created.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => fetchQueue(page)}
                disabled={loading}
                className="btn btn-outline btn-sm"
                id="btn-refresh-review-queue"
                title="Refresh routing queue"
              >
                <RefreshCw size={13} className={loading ? 'spin' : ''} />
                {loading ? 'Refreshing...' : 'Refresh Queue'}
              </button>

              <Link to="/staff/cases" className="btn btn-primary btn-sm">
                <Briefcase size={14} /> Cases Queue →
              </Link>
            </div>
          </div>

          {/* Core Principle Callout (Section 1 & 26) */}
          <div
            style={{
              background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.12) 0%, rgba(30, 58, 138, 0.15) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Compass size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '0.85rem', color: '#fef3c7', lineHeight: 1.45 }}>
                <strong style={{ color: '#fcd34d' }}>CivicFlow Safety Mandate:</strong> Automation handles clear cases. People handle uncertain cases.
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem', marginTop: '0.15rem' }}>
                  AI understands WHAT • Spatial engine determines WHERE • Responsibility rules determine WHO • Review Queue arbitrates uncertainty.
                </span>
              </div>
            </div>

            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: total > 0 ? '#fcd34d' : '#6ee7b7',
                background: total > 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                padding: '0.3rem 0.75rem',
                borderRadius: '9999px',
                border: `1px solid ${total > 0 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
              }}
            >
              {total} {total === 1 ? 'Report Pending Review' : 'Reports Pending Review'}
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TABS: PENDING QUEUE vs ADJUDICATED AUDIT                                 */}
        {/* ========================================================================= */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.75rem' }}>
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`cases-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
            id="tab-pending-reviews"
          >
            <AlertCircle size={15} color="#f59e0b" />
            Pending Reviews ({total})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('adjudicated')}
            className={`cases-tab-btn ${activeTab === 'adjudicated' ? 'active' : ''}`}
            id="tab-adjudicated-audit"
          >
            <History size={15} color="#60a5fa" />
            Session Decisions ({sessionAudits.length})
          </button>
        </div>

        {/* Global Error Alert */}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
            <button
              onClick={() => fetchQueue(page)}
              className="btn btn-outline btn-sm"
              style={{ marginLeft: 'auto', padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 1: PENDING ROUTING REVIEWS                                           */}
        {/* ========================================================================= */}
        {activeTab === 'pending' && (
          <>
            {loading && queue.length === 0 ? (
              <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div className="spinner" style={{ margin: '0 auto 1rem auto' }} />
                <p style={{ fontSize: '0.9rem' }}>Loading routing reviews...</p>
              </div>
            ) : queue.length === 0 ? (
              /* Empty State (Section 14) */
              <div className="card" style={{ textAlign: 'center', padding: '4rem 1.5rem', borderStyle: 'dashed' }}>
                <CheckCircle size={52} color="#10b981" style={{ margin: '0 auto 1rem auto' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.4rem' }}>
                  All routing decisions are currently clear.
                </h3>
                <p style={{ color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 1.5rem auto', fontSize: '0.9rem' }}>
                  New reports that cannot be safely routed automatically will appear here for staff review.
                </p>
                <Link to="/staff/cases" className="btn btn-outline btn-sm">
                  View Cases Work Queue →
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {queue.map((item) => {
                  const hasCandidate = item.authoritySuggested && item.departmentSuggested;
                  const reasons = Array.isArray(item.reviewReasons) ? item.reviewReasons : [];

                  return (
                    <div
                      key={item.reportId}
                      className="card"
                      style={{
                        padding: '1.5rem',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        background: 'rgba(15, 23, 42, 0.85)',
                        borderRadius: 'var(--radius-lg)',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                      }}
                      id={`review-card-${item.reportId}`}
                    >
                      {/* Top Bar: Card Header & Identification */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '9999px',
                                background: 'rgba(245, 158, 11, 0.2)',
                                color: '#fcd34d',
                                border: '1px solid rgba(245, 158, 11, 0.4)',
                                letterSpacing: '0.04em',
                              }}
                            >
                              Routing Review Required
                            </span>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#93c5fd', fontWeight: 600 }}>
                              Report #{item.reportId ? String(item.reportId).substring(0, 8) : '—'}...
                            </span>
                          </div>

                          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                            {item.category ? String(item.category).replace(/_/g, ' ') : 'Civic Problem'}
                          </h3>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          <Clock size={13} />
                          <span>Submitted {getTimeAgo(item.createdAt)}</span>
                        </div>
                      </div>

                      {/* WHY REVIEW IS REQUIRED (Section 5 & 6) */}
                      <div
                        style={{
                          background: 'rgba(245, 158, 11, 0.1)',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                          borderRadius: 'var(--radius-md)',
                          padding: '0.9rem 1.15rem',
                          marginBottom: '1.25rem',
                        }}
                      >
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fde047', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <ShieldAlert size={14} /> Why Human Review is Required
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {reasons.length > 0 ? (
                            reasons.map((r, idx) => {
                              const trans = translateReviewReason(r);
                              return (
                                <div key={idx} style={{ fontSize: '0.86rem', color: '#fef08a', display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                                  <span style={{ color: trans.color }}>•</span>
                                  <span>
                                    <strong>{trans.title}:</strong> {trans.description}
                                  </span>
                                </div>
                              );
                            })
                          ) : (
                            <div style={{ fontSize: '0.86rem', color: '#fef08a' }}>
                              Automated confidence was below safety thresholds. Staff adjudication required.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Citizen Description Snippet */}
                      <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '0.9rem 1.15rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 255, 255, 0.06)', marginBottom: '1.25rem' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.3rem' }}>
                          Citizen Reported Description
                        </div>
                        <p style={{ fontSize: '0.92rem', color: 'var(--text-main)', lineHeight: 1.5, margin: 0 }}>
                          &ldquo;{item.description}&rdquo;
                        </p>
                      </div>

                      {/* 3-PILLAR EVIDENCE GRID: WHAT + WHERE + WHO (Section 7) */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
                        
                        {/* Evidence 1: WHAT (AI Classification) */}
                        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.9rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                          <div style={{ fontSize: '0.72rem', color: '#60a5fa', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
                            <Sparkles size={13} /> WHAT (AI Understanding)
                          </div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                            {item.category ? item.category.replace(/_/g, ' ') : 'Uncertain'}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            {reasons.includes('AI_LOW_CONFIDENCE') ? 'Classification uncertain (<70%)' : 'Identified from report text'}
                          </div>
                        </div>

                        {/* Evidence 2: WHERE (Location & Jurisdiction) */}
                        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.9rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                          <div style={{ fontSize: '0.72rem', color: '#34d399', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
                            <MapPin size={13} /> WHERE (Jurisdiction)
                          </div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                            {item.jurisdictionName || 'Boundary Ambiguity'}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            {item.coordinates?.latitude != null && item.coordinates?.longitude != null
                              ? `GPS: ${Number(item.coordinates.latitude).toFixed(4)}, ${Number(item.coordinates.longitude).toFixed(4)}`
                              : 'No GPS coordinates provided'}
                          </div>
                        </div>

                        {/* Evidence 3: WHO (Candidate Route) */}
                        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.9rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                          <div style={{ fontSize: '0.72rem', color: '#a78bfa', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
                            <Building2 size={13} /> WHO (Current Result)
                          </div>
                          {hasCandidate && item.authoritySuggested ? (
                            <div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0' }}>
                                {item.authoritySuggested.code} • {item.departmentSuggested?.name || item.departmentSuggested?.code || 'Department'}
                              </div>
                              <div style={{ fontSize: '0.76rem', color: '#6ee7b7', marginTop: '0.2rem' }}>
                                Provisional candidate route available
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fca5a5' }}>
                                Not Determined
                              </div>
                              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                Manual assignment required
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Decision Controls (Section 8 & 9) */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1rem' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Adjudication will create an official civic case for department follow-through.
                        </div>

                        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                          <Link
                            to={`/reports/${item.reportId}`}
                            className="btn btn-outline btn-sm"
                            style={{ fontSize: '0.8rem', padding: '0.45rem 0.8rem' }}
                            title="Inspect complete incident report"
                          >
                            Full Report <ExternalLink size={12} />
                          </Link>

                          {hasCandidate && (
                            <button
                              type="button"
                              onClick={() => openAdjudicationModal(item, 'APPROVE')}
                              className="btn btn-sm"
                              style={{ background: '#059669', color: '#ffffff', fontWeight: 700, fontSize: '0.82rem', padding: '0.45rem 0.95rem' }}
                              id={`btn-approve-review-${item.reportId}`}
                            >
                              <Check size={14} /> Approve Suggested Route
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => openAdjudicationModal(item, 'OVERRIDE')}
                            className="btn btn-primary btn-sm"
                            style={{ fontWeight: 700, fontSize: '0.82rem', padding: '0.45rem 0.95rem' }}
                            id={`btn-override-review-${item.reportId}`}
                          >
                            <Edit3 size={14} /> {hasCandidate ? 'Override Route' : 'Assign Responsible Route'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '2rem' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={page <= 1 || loading}
                  onClick={() => fetchQueue(page - 1)}
                >
                  Previous
                </button>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => fetchQueue(page + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: ADJUDICATED AUDIT HISTORY (Section 11, 12, 13)                    */}
        {/* ========================================================================= */}
        {activeTab === 'adjudicated' && (
          <div>
            <div style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Immutable human routing decisions executed during this operational session.
            </div>

            {sessionAudits.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1rem', borderStyle: 'dashed' }}>
                <History size={40} color="var(--text-faint)" style={{ margin: '0 auto 0.75rem auto' }} />
                <h3 style={{ fontSize: '1.1rem', color: '#ffffff', marginBottom: '0.35rem' }}>No decisions made yet this session</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '440px', margin: '0 auto' }}>
                  When you approve or override pending reviews, an auditable record with the resulting Case Number will be cataloged here.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {sessionAudits.map((aud, idx) => (
                  <div
                    key={idx}
                    className="card"
                    style={{
                      padding: '1.25rem',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.6rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '9999px',
                            background: aud.action === 'APPROVE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                            color: aud.action === 'APPROVE' ? '#6ee7b7' : '#93c5fd',
                            border: `1px solid ${aud.action === 'APPROVE' ? '#10b981' : '#3b82f6'}`,
                          }}
                        >
                          {aud.action === 'APPROVE' ? 'Route Approved' : 'Route Overridden'}
                        </span>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                          {aud.category ? aud.category.replace(/_/g, ' ') : 'Civic Problem'}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Reviewed by <strong style={{ color: '#e2e8f0' }}>{aud.reviewedBy}</strong> at {new Date(aud.reviewedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1', background: 'rgba(0,0,0,0.25)', padding: '0.65rem 0.85rem', borderRadius: '6px', marginBottom: '0.75rem' }}>
                      <strong>Audit Note:</strong> &ldquo;{aud.notes}&rdquo;
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span>Report #{aud.reportId.substring(0, 8)}...</span>
                      {aud.caseNumber && (
                        <Link
                          to={`/staff/cases/${aud.caseId}`}
                          style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          Case: {aud.caseNumber} <ChevronRight size={13} />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* ADJUDICATION MODAL (Approve & Override Flows - Sections 8, 9, 10)         */}
        {/* ========================================================================= */}
        {selectedItem && (
          <div
            className="modal-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget && !submitting) closeAdjudicationModal();
            }}
            style={{ zIndex: 1000 }}
          >
            <div
              className="modal-card"
              style={{
                maxWidth: '680px',
                width: '95%',
                background: '#0d131f',
                border: modalMode === 'APPROVE' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
              }}
            >
              {/* Modal Header */}
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {modalMode === 'APPROVE' ? (
                    <CheckCircle size={22} color="#10b981" />
                  ) : (
                    <Edit3 size={22} color="#f59e0b" />
                  )}
                  <h3 className="modal-title" style={{ margin: 0, fontSize: '1.25rem', color: '#ffffff' }}>
                    {modalMode === 'APPROVE' ? 'Confirm Routing Approval' : 'Override & Assign Route'}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={closeAdjudicationModal}
                  disabled={submitting}
                  className="modal-close-btn"
                >
                  <X size={18} />
                </button>
              </div>

              {modalLoading ? (
                <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div className="spinner" style={{ margin: '0 auto 0.75rem auto' }} />
                  Loading report evidence...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  
                  {/* APPROVE CONFIRMATION VIEW (Section 8) */}
                  {modalMode === 'APPROVE' && (
                    <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
                      <div style={{ fontSize: '0.85rem', color: '#a7f3d0', marginBottom: '0.85rem', lineHeight: 1.45 }}>
                        You are formally approving the automated candidate route. An official municipal case will be generated for department mobilization.
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'rgba(0, 0, 0, 0.3)', padding: '0.85rem', borderRadius: '6px' }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Responsible Authority</span>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', marginTop: '0.15rem' }}>
                            {selectedItem.authoritySuggested?.name || selectedItem.authoritySuggested?.code || 'Designated Authority'}
                          </div>
                        </div>

                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Operational Department</span>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#6ee7b7', marginTop: '0.15rem' }}>
                            {selectedItem.departmentSuggested?.name || selectedItem.departmentSuggested?.code || 'Operational Department'}
                          </div>
                        </div>

                        <div style={{ gridColumn: 'span 2', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Jurisdiction Boundary</span>
                          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#cbd5e1' }}>
                            {selectedItem.jurisdictionName || 'City Center / Ward 42'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* OVERRIDE ADJUDICATION VIEW (Section 9) */}
                  {modalMode === 'OVERRIDE' && (
                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        Select the designated authority and operational department according to municipal policy.
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1rem' }}>
                        {/* Authority Selector */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                            Designated Authority *
                          </label>
                          <select
                            value={selectedAuthorityId}
                            onChange={(e) => {
                              setSelectedAuthorityId(e.target.value);
                              setSelectedDepartmentId('');
                            }}
                            className="form-control"
                            id="select-override-authority"
                            style={{ width: '100%', background: 'var(--bg-primary)', color: '#fff', border: '1px solid var(--border-subtle)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}
                          >
                            <option value="">-- Choose Authority --</option>
                            {authorities.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name} ({a.code})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Department Selector */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                            Operational Department *
                          </label>
                          <select
                            value={selectedDepartmentId}
                            onChange={(e) => setSelectedDepartmentId(e.target.value)}
                            className="form-control"
                            id="select-override-department"
                            style={{ width: '100%', background: 'var(--bg-primary)', color: '#fff', border: '1px solid var(--border-subtle)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}
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
                    </div>
                  )}

                  {/* Review Notes (Section 10: Mandatory for Override, recommended for Approve) */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                      {modalMode === 'OVERRIDE' ? 'Reason for Override (Mandatory, min 10 chars) *' : 'Adjudication Notes (Optional audit comment)'}
                    </label>
                    <textarea
                      rows={3}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder={
                        modalMode === 'OVERRIDE'
                          ? "e.g., 'Inspected coordinates near railway crossing; falls under MCC Road Maintenance charter rather than Panchayat.'"
                          : "e.g., 'Confirmed automated candidate route matches Ward 42 road maintenance responsibility.'"
                      }
                      className="form-input"
                      id="input-review-notes"
                      style={{ width: '100%' }}
                    />
                    {modalMode === 'OVERRIDE' && (
                      <div style={{ fontSize: '0.75rem', color: reviewNotes.trim().length >= 10 ? '#10b981' : '#94a3b8', marginTop: '0.3rem' }}>
                        {reviewNotes.trim().length}/10 characters minimum
                      </div>
                    )}
                  </div>

                  {/* Feedback Banners */}
                  {actionError && (
                    <div className="alert alert-error" style={{ fontSize: '0.85rem' }}>
                      <AlertCircle size={15} />
                      <div>{actionError}</div>
                    </div>
                  )}
                  {actionSuccess && (
                    <div className="alert alert-success" style={{ fontSize: '0.85rem' }}>
                      <CheckCircle size={15} />
                      <div>{actionSuccess}</div>
                    </div>
                  )}

                  {/* Modal Action Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '1rem' }}>
                    <button
                      type="button"
                      onClick={closeAdjudicationModal}
                      disabled={submitting}
                      className="btn btn-outline"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={handleSubmitAdjudication}
                      disabled={submitting || (modalMode === 'OVERRIDE' && (!selectedAuthorityId || !selectedDepartmentId || reviewNotes.trim().length < 10))}
                      className="btn btn-primary"
                      id="btn-confirm-review-adjudication"
                      style={{
                        background: modalMode === 'APPROVE' ? '#059669' : 'var(--primary)',
                      }}
                    >
                      {submitting ? (
                        <>
                          <RefreshCw size={13} className="spin" /> Submitting Decision...
                        </>
                      ) : modalMode === 'APPROVE' ? (
                        <>
                          <Check size={14} /> Confirm Routing Approval
                        </>
                      ) : (
                        <>
                          <Edit3 size={14} /> Confirm Route Override
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ReviewQueue;
