import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  RefreshCw,
  MapPin,
  Sparkles,
  Building2,
  Filter,
  Check,
  Edit3,
  X,
} from 'lucide-react';

export const ReviewQueue = () => {
  const { token, role } = useAuth();
  const [queue, setQueue] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Review Modal State
  const [selectedReport, setSelectedReport] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [reportDetails, setReportDetails] = useState(null);
  const [authorities, setAuthorities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedAuthorityId, setSelectedAuthorityId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewMode, setReviewMode] = useState('APPROVE'); // 'APPROVE' or 'OVERRIDE'
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  const fetchQueue = async (targetPage = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getReviewQueue(token, { page: targetPage, limit: 15 });
      if (res.ok && res.data) {
        setQueue(res.data.items || []);
        setTotal(res.data.total || 0);
        setPage(res.data.page || 1);
        setTotalPages(res.data.totalPages || 1);
      } else {
        setError(res.data?.message || 'Failed to load review queue');
      }
    } catch (err) {
      setError(err.message || 'Error fetching review queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue(1);
  }, [token]);

  const loadAuthoritiesAndDepts = async () => {
    try {
      const authRes = await api.getAuthorities(token);
      if (authRes.ok && authRes.data?.authorities) {
        setAuthorities(authRes.data.authorities);
      }
      const deptRes = await api.getDepartments(token);
      if (deptRes.ok && deptRes.data?.departments) {
        setDepartments(deptRes.data.departments);
      }
    } catch (err) {
      console.error('Failed to load routing authorities:', err);
    }
  };

  const openReviewModal = async (item) => {
    setSelectedReport(item);
    setModalLoading(true);
    setActionSuccess(null);
    setActionError(null);
    setReviewNotes('');
    setReviewMode('APPROVE');

    try {
      await loadAuthoritiesAndDepts();
      const [repRes, routRes, aiRes, jurRes] = await Promise.all([
        api.getReportById(item.reportId, token),
        api.getReportRouting(item.reportId, token),
        api.getReportAnalysis(item.reportId, token),
        api.getReportJurisdiction(item.reportId, token),
      ]);

      setReportDetails({
        report: repRes.data?.report,
        routing: routRes.data?.routing,
        analysis: aiRes.data?.analysis,
        jurisdiction: jurRes.data?.jurisdiction,
      });

      // If suggested route exists, default to APPROVE; otherwise default to OVERRIDE / Assign
      const hasSuggested = routRes.data?.routing?.suggested_authority_id || routRes.data?.routing?.authority_id;
      if (!hasSuggested) {
        setReviewMode('OVERRIDE');
      }
    } catch (err) {
      setActionError('Failed to fetch full report details: ' + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const closeReviewModal = () => {
    setSelectedReport(null);
    setReportDetails(null);
    setActionSuccess(null);
    setActionError(null);
  };

  const handleAuthorityChange = (authId) => {
    setSelectedAuthorityId(authId);
    setSelectedDepartmentId('');
  };

  const handleSubmitReview = async () => {
    if (!selectedReport) return;
    setSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    const payload = {
      action: reviewMode,
      review_notes: reviewNotes.trim() || undefined,
    };

    if (reviewMode === 'OVERRIDE') {
      if (!selectedAuthorityId) {
        setActionError('Please select a responsible Authority.');
        setSubmitting(false);
        return;
      }
      if (!selectedDepartmentId) {
        setActionError('Please select an operational Department.');
        setSubmitting(false);
        return;
      }
      payload.final_authority_id = selectedAuthorityId;
      payload.final_department_id = selectedDepartmentId;
    }

    try {
      const res = await api.submitRoutingReview(selectedReport.reportId, payload, token);
      if (res.ok) {
        setActionSuccess(
          reviewMode === 'APPROVE'
            ? 'Suggested route approved and case successfully routed!'
            : 'Route successfully assigned by human override!'
        );
        // Refresh queue
        setTimeout(() => {
          closeReviewModal();
          fetchQueue(page);
        }, 1200);
      } else {
        setActionError(res.data?.message || 'Failed to submit review');
      }
    } catch (err) {
      setActionError(err.message || 'Error submitting review');
    } finally {
      setSubmitting(false);
    }
  };

  const getReasonBadge = (reason) => {
    const style = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.3rem',
      padding: '0.2rem 0.6rem',
      borderRadius: 'var(--radius-full)',
      fontSize: '0.74rem',
      fontWeight: 600,
      marginRight: '0.4rem',
      marginBottom: '0.3rem',
    };

    switch (reason) {
      case 'AI_LOW_CONFIDENCE':
        return (
          <span key={reason} style={{ ...style, background: 'rgba(234, 179, 8, 0.15)', color: '#fde047', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
            <Sparkles size={11} /> AI Low Confidence (&lt;70%)
          </span>
        );
      case 'AI_NEEDS_REVIEW':
        return (
          <span key={reason} style={{ ...style, background: 'rgba(249, 115, 22, 0.15)', color: '#fdba74', border: '1px solid rgba(249, 115, 22, 0.3)' }}>
            <AlertTriangle size={11} /> AI Needs Review
          </span>
        );
      case 'NO_JURISDICTION_MATCH':
        return (
          <span key={reason} style={{ ...style, background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <MapPin size={11} /> No Jurisdiction Match
          </span>
        );
      case 'JURISDICTION_CONFLICT':
        return (
          <span key={reason} style={{ ...style, background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid #ef4444' }}>
            <ShieldAlert size={11} /> Spatial Boundary Conflict
          </span>
        );
      case 'NO_RESPONSIBILITY_RULE':
        return (
          <span key={reason} style={{ ...style, background: 'rgba(168, 85, 247, 0.15)', color: '#d8b4fe', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
            <Building2 size={11} /> No Responsibility Rule
          </span>
        );
      case 'RESPONSIBILITY_CONFLICT':
        return (
          <span key={reason} style={{ ...style, background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid #ef4444' }}>
            <ShieldAlert size={11} /> Competing Rules Conflict
          </span>
        );
      case 'INVALID_LOCATION':
        return (
          <span key={reason} style={{ ...style, background: 'rgba(148, 163, 184, 0.2)', color: '#cbd5e1', border: '1px solid rgba(148, 163, 184, 0.3)' }}>
            <MapPin size={11} /> Missing / Invalid Location
          </span>
        );
      default:
        return (
          <span key={reason} style={{ ...style, background: 'rgba(255, 255, 255, 0.1)', color: '#e2e8f0', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
            {reason}
          </span>
        );
    }
  };

  if (role !== 'STAFF' && role !== 'ADMIN') {
    return (
      <div className="main-content">
        <div className="card" style={{ maxWidth: '540px', margin: '3rem auto', textAlign: 'center', padding: '2.5rem' }}>
          <ShieldAlert size={48} color="#ef4444" style={{ margin: '0 auto 1rem auto' }} />
          <h2>Access Restricted</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Only designated municipal staff and administrators have permission to access the routing review queue.
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

  return (
    <div className="main-content">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShieldAlert size={26} color="#f59e0b" />
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Routing Review Queue</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem', fontSize: '0.92rem' }}>
            Human adjudication queue for reports requiring routing review. <strong>Automate when confident, escalate when uncertain, never guess responsibility.</strong>
          </p>
        </div>

        <button onClick={() => fetchQueue(page)} className="btn btn-outline btn-sm" disabled={loading} id="btn-refresh-queue">
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
          {loading ? 'Refreshing...' : 'Refresh Queue'}
        </button>
      </div>

      {/* Info Banner */}
      <div
        style={{
          background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.05) 100%)',
          borderLeft: '4px solid #f59e0b',
          borderTop: '1px solid rgba(245, 158, 11, 0.25)',
          borderRight: '1px solid rgba(245, 158, 11, 0.25)',
          borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
          padding: '1rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, color: '#fde047', fontSize: '0.95rem' }}>
            {total} Unresolved Routing {total === 1 ? 'Case' : 'Cases'}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#fef08a', marginTop: '0.2rem' }}>
            These cases triggered hard review conditions (AI uncertainty, spatial boundary overlaps, or unmapped civic rules).
          </div>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.3)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
          Queue Order: <strong>Oldest pending first</strong>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          <ShieldAlert size={16} />
          <div>{error}</div>
        </div>
      )}

      {/* Main Queue List */}
      {loading && queue.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
          Loading review queue...
        </div>
      ) : queue.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
          <CheckCircle size={52} color="#10b981" style={{ margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>Queue Clear — No Pending Reviews</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '480px', margin: '0.5rem auto 1.5rem auto', fontSize: '0.92rem' }}>
            All submitted civic reports have been deterministically auto-routed or already adjudicated by municipal staff.
          </p>
          <Link to="/" className="btn btn-outline btn-sm">
            Back to Dashboard
          </Link>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem' }}>
            {queue.map((item) => (
              <div
                key={item.reportId}
                className="card"
                style={{
                  padding: '1.15rem 1.35rem',
                  border: '1px solid rgba(245, 158, 11, 0.28)',
                  background: 'rgba(15, 23, 42, 0.7)',
                  transition: 'border-color 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem' }}>
                      <span
                        style={{
                          background: 'rgba(37, 99, 235, 0.25)',
                          color: '#93c5fd',
                          border: '1px solid rgba(37, 99, 235, 0.45)',
                          padding: '0.2rem 0.6rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                        }}
                      >
                        {item.category}
                      </span>
                      <span
                        style={{
                          background: 'rgba(245, 158, 11, 0.2)',
                          color: '#fde047',
                          border: '1px solid #f59e0b',
                          padding: '0.2rem 0.6rem',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                        }}
                      >
                        ⚡ NEEDS_REVIEW
                      </span>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        ID: {item.reportId.substring(0, 8)}...
                      </span>
                    </div>

                    <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
                      {(item.reviewReasons || []).map(getReasonBadge)}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', marginTop: '0.6rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Clock size={13} />
                        Submitted: {new Date(item.createdAt).toLocaleString()}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <MapPin size={13} color={item.locationAvailable ? '#34d399' : '#f87171'} />
                        Location: {item.locationAvailable ? 'Coordinates Available' : 'Missing'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <button
                      onClick={() => openReviewModal(item)}
                      className="btn btn-primary btn-sm"
                      id={`btn-adjudicate-${item.reportId}`}
                      style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem' }}
                    >
                      <Edit3 size={13} /> Review & Adjudicate
                    </button>
                    <Link
                      to={`/reports/${item.reportId}`}
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: '0.82rem', padding: '0.45rem 0.75rem' }}
                      title="View full report details"
                    >
                      Details <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
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
                className="btn btn-outline btn-sm"
                disabled={page >= totalPages || loading}
                onClick={() => fetchQueue(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* REVIEW & ADJUDICATION MODAL                                              */}
      {/* ========================================================================= */}
      {selectedReport && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) closeReviewModal();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '1.5rem',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '750px',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1px solid rgba(245, 158, 11, 0.5)',
              background: '#0d131f',
              padding: '1.75rem',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldAlert size={20} color="#f59e0b" />
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Civic Routing Adjudication</h2>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                  Report ID: {selectedReport.reportId}
                </div>
              </div>

              <button
                onClick={closeReviewModal}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X size={20} />
              </button>
            </div>

            {modalLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
                Loading report routing signals...
              </div>
            ) : reportDetails ? (
              <div>
                {/* Review Reasons Advisory */}
                <div
                  style={{
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fde047', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    ⚡ Triggered Hard Review Conditions
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {(selectedReport.reviewReasons || []).map(getReasonBadge)}
                  </div>
                </div>

                {/* Signals Comparison Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  {/* AI Understanding Signal */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#60a5fa', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.35rem' }}>
                      <Sparkles size={12} /> AI Issue Understanding (Suggestion)
                    </div>
                    {reportDetails.analysis ? (
                      <div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff' }}>
                          {reportDetails.analysis.category}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          Confidence: {Math.round((reportDetails.analysis.confidence || 0) * 100)}% ({reportDetails.analysis.status})
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#cbd5e1', marginTop: '0.35rem', fontStyle: 'italic', lineHeight: '1.3' }}>
                          &ldquo;{reportDetails.analysis.summary?.substring(0, 100)}...&rdquo;
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Analysis pending</div>
                    )}
                  </div>

                  {/* Jurisdiction Signal */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#34d399', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.35rem' }}>
                      <MapPin size={12} /> PostGIS Spatial Jurisdiction
                    </div>
                    {reportDetails.jurisdiction ? (
                      <div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff' }}>
                          {reportDetails.jurisdiction.boundary_name || reportDetails.jurisdiction.jurisdiction_id || 'No Match'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          Status: {reportDetails.jurisdiction.match_status}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#cbd5e1', marginTop: '0.35rem' }}>
                          Type: {reportDetails.jurisdiction.jurisdiction_type || 'N/A'} (v{reportDetails.jurisdiction.boundary_version || '1'})
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Jurisdiction not resolved</div>
                    )}
                  </div>
                </div>

                {/* Candidate / Suggested Route */}
                <div style={{ background: 'rgba(0,0,0,0.35)', padding: '0.9rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem' }}>
                    Deterministic Rule Engine Result
                  </div>
                  {reportDetails.routing?.suggested_authority_code || reportDetails.routing?.authority_code ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#34d399' }}>
                          {reportDetails.routing.suggested_authority_code || reportDetails.routing.authority_code} &rarr;{' '}
                          {reportDetails.routing.suggested_department_code || reportDetails.routing.department_code}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          Provisional / Candidate Route (Held for human review)
                        </div>
                      </div>
                      <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                        Candidate Available
                      </span>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.84rem', color: '#fca5a5' }}>
                      ⚠ No safe rule match found. System refuses to make an automated guess. Explicit assignment required.
                    </div>
                  )}
                </div>

                {/* Review Mode Selector */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>
                    Select Adjudication Action
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <button
                      type="button"
                      disabled={!(reportDetails.routing?.suggested_authority_id || reportDetails.routing?.authority_id)}
                      onClick={() => setReviewMode('APPROVE')}
                      className={`btn ${reviewMode === 'APPROVE' ? 'btn-primary' : 'btn-outline'}`}
                      style={{ justifyContent: 'center', padding: '0.65rem', opacity: !(reportDetails.routing?.suggested_authority_id || reportDetails.routing?.authority_id) ? 0.5 : 1 }}
                      id="btn-mode-approve"
                    >
                      <Check size={15} /> Approve Suggested Route
                    </button>

                    <button
                      type="button"
                      onClick={() => setReviewMode('OVERRIDE')}
                      className={`btn ${reviewMode === 'OVERRIDE' ? 'btn-primary' : 'btn-outline'}`}
                      style={{ justifyContent: 'center', padding: '0.65rem' }}
                      id="btn-mode-override"
                    >
                      <Edit3 size={15} /> Assign / Override Route
                    </button>
                  </div>
                </div>

                {/* Override Dropdowns (if OVERRIDE mode) */}
                {reviewMode === 'OVERRIDE' && (
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: '1.25rem' }}>
                    <div style={{ marginBottom: '0.85rem' }}>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                        Select Responsible Civic Authority *
                      </label>
                      <select
                        value={selectedAuthorityId}
                        onChange={(e) => handleAuthorityChange(e.target.value)}
                        className="form-control"
                        id="select-override-authority"
                        style={{ width: '100%', background: 'var(--bg-primary)', color: '#fff', border: '1px solid var(--border-subtle)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}
                      >
                        <option value="">-- Choose Authority --</option>
                        {authorities.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.code} • {a.jurisdiction_type})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                        Select Operational Department *
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
                )}

                {/* Review Notes */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Staff Adjudication Notes & Justification
                  </label>
                  <textarea
                    rows={2}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Enter audit justification (e.g., 'Inspected photographic evidence and confirmed municipal road maintenance authority')..."
                    className="form-control"
                    id="input-review-notes"
                    style={{ width: '100%', background: 'var(--bg-primary)', color: '#fff', border: '1px solid var(--border-subtle)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', resize: 'vertical' }}
                  />
                </div>

                {/* Feedback Alerts */}
                {actionError && (
                  <div className="alert alert-error" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                    <ShieldAlert size={15} />
                    <div>{actionError}</div>
                  </div>
                )}
                {actionSuccess && (
                  <div className="alert alert-success" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                    <CheckCircle size={15} />
                    <div>{actionSuccess}</div>
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                  <button type="button" onClick={closeReviewModal} className="btn btn-outline" disabled={submitting}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitReview}
                    className="btn btn-primary"
                    disabled={submitting}
                    id="btn-submit-routing-review"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw size={13} className="spin" /> Submitting...
                      </>
                    ) : reviewMode === 'APPROVE' ? (
                      <>
                        <Check size={15} /> Confirm Route Approval
                      </>
                    ) : (
                      <>
                        <Edit3 size={15} /> Confirm Route Override
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
