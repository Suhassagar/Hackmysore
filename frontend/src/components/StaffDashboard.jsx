import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import {
  Briefcase,
  AlertCircle,
  Clock,
  MapPin,
  Building2,
  RefreshCw,
  ChevronRight,
  UserCheck,
  PauseCircle,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  Inbox,
  Activity,
  Layers,
  Sparkles,
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

export const StaffDashboard = ({ user, token, role }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Operational metrics
  const [workload, setWorkload] = useState({
    needsReview: 0,
    unassigned: 0,
    inProgress: 0,
    onHold: 0,
    assignedToMe: 0,
    activeTotal: 0,
    resolvedTotal: 0,
  });

  // Action Queues
  const [attentionCases, setAttentionCases] = useState([]);
  const [reviewItems, setReviewItems] = useState([]);
  const [recentCases, setRecentCases] = useState([]);

  // Operational Scope
  const [scopeInfo, setScopeInfo] = useState({
    authorityName: 'Mysuru City Corporation',
    departmentName: 'Municipal Operations',
  });

  const fetchStaffDashboardData = useCallback(async (isManualRefresh = false) => {
    if (!token) return;
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      // 1. Fetch Authorities & Departments to resolve user's authoritative scope
      const [authRes, deptRes] = await Promise.all([
        api.getAuthorities(token).catch(() => ({ ok: false })),
        api.getDepartments(token).catch(() => ({ ok: false })),
      ]);

      let resolvedAuth = 'Mysuru City Corporation';
      let resolvedDept = role === 'ADMIN' ? 'Central Administration' : 'Municipal Operations';

      if (authRes.ok && Array.isArray(authRes.data?.authorities)) {
        const matchingAuth = authRes.data.authorities.find((a) => a.id === user?.authority_id);
        if (matchingAuth) resolvedAuth = matchingAuth.name;
      }
      if (deptRes.ok && Array.isArray(deptRes.data?.departments)) {
        const matchingDept = deptRes.data.departments.find((d) => d.id === user?.department_id);
        if (matchingDept) resolvedDept = matchingDept.name;
      }

      // 2. Fetch Review Queue (Needs Review count & sample items)
      const reviewRes = await api.getReviewQueue(token, { page: 1, limit: 3 }).catch(() => ({ ok: false }));
      const needsReviewCount = reviewRes.ok && reviewRes.data ? reviewRes.data.total || 0 : 0;
      const reviewSample = reviewRes.ok && reviewRes.data ? reviewRes.data.items || [] : [];

      // 3. Fetch Case counts by status and category in parallel
      const [
        unassignedRes,
        inProgressRes,
        onHoldRes,
        myCasesRes,
        activeRes,
        resolvedRes,
      ] = await Promise.all([
        api.getStaffCases(token, { status: 'UNASSIGNED', limit: 4 }).catch(() => ({ ok: false })),
        api.getStaffCases(token, { status: 'IN_PROGRESS', limit: 1 }).catch(() => ({ ok: false })),
        api.getStaffCases(token, { status: 'ON_HOLD', limit: 3 }).catch(() => ({ ok: false })),
        api.getStaffCases(token, { view: 'my_cases', limit: 1 }).catch(() => ({ ok: false })),
        api.getStaffCases(token, { view: 'active', limit: 6 }).catch(() => ({ ok: false })),
        api.getStaffCases(token, { status: 'RESOLVED', limit: 1 }).catch(() => ({ ok: false })),
      ]);

      const unassignedItems = unassignedRes.ok && unassignedRes.data ? unassignedRes.data.items || [] : [];
      const onHoldItems = onHoldRes.ok && onHoldRes.data ? onHoldRes.data.items || [] : [];
      const activeItems = activeRes.ok && activeRes.data ? activeRes.data.items || [] : [];

      // If active items provide rich department info, use that as secondary fallback
      if (activeItems.length > 0 && activeItems[0].authority_name) {
        resolvedAuth = activeItems[0].authority_name;
        if (activeItems[0].department_name && role !== 'ADMIN') {
          resolvedDept = activeItems[0].department_name;
        }
      }

      setScopeInfo({ authorityName: resolvedAuth, departmentName: resolvedDept });

      setWorkload({
        needsReview: needsReviewCount,
        unassigned: unassignedRes.ok && unassignedRes.data ? unassignedRes.data.total || 0 : 0,
        inProgress: inProgressRes.ok && inProgressRes.data ? inProgressRes.data.total || 0 : 0,
        onHold: onHoldRes.ok && onHoldRes.data ? onHoldRes.data.total || 0 : 0,
        assignedToMe: myCasesRes.ok && myCasesRes.data ? myCasesRes.data.total || 0 : 0,
        activeTotal: activeRes.ok && activeRes.data ? activeRes.data.total || 0 : 0,
        resolvedTotal: resolvedRes.ok && resolvedRes.data ? resolvedRes.data.total || 0 : 0,
      });

      // Attention queue: Combine unassigned and on-hold cases (max 5)
      setAttentionCases([...unassignedItems, ...onHoldItems].slice(0, 5));
      setReviewItems(reviewSample);
      setRecentCases(activeItems);
    } catch (err) {
      console.error('[StaffDashboard] Error fetching operational metrics:', err);
      setError('We could not load real-time operational metrics. Please check your connection and retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, user?.authority_id, user?.department_id, role]);

  useEffect(() => {
    fetchStaffDashboardData();
  }, [fetchStaffDashboardData]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const staffName = user?.name ? user.name : 'Officer';

  return (
    <div className="main-content">
      <div style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '3rem' }}>
        
        {/* ========================================================================= */}
        {/* HEADER: OPERATIONAL CONTEXT & SCOPE                                      */}
        {/* ========================================================================= */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.35) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            marginBottom: '2rem',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#60a5fa', background: 'rgba(37, 99, 235, 0.18)', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-full)', border: '1px solid rgba(59, 130, 246, 0.35)', marginBottom: '0.75rem' }}>
                <Activity size={13} /> CivicFlow Operations Console
              </div>

              <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.4rem 0', lineHeight: 1.2 }}>
                {getGreeting()}, {staffName}
              </h1>

              {/* Authoritative Scope */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', color: '#93c5fd', fontSize: '0.95rem', fontWeight: 600 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Building2 size={16} /> {scopeInfo.authorityName}
                </span>
                <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>•</span>
                <span style={{ color: '#6ee7b7' }}>{scopeInfo.departmentName}</span>
                {role === 'ADMIN' && (
                  <span style={{ fontSize: '0.72rem', background: 'rgba(245, 158, 11, 0.2)', color: '#fcd34d', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                    GLOBAL ADMIN ACCESS
                  </span>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => fetchStaffDashboardData(true)}
                disabled={refreshing || loading}
                className="btn btn-outline"
                id="staff-refresh-dashboard-btn"
                style={{ fontSize: '0.85rem' }}
                title="Refresh metrics from backend"
              >
                <RefreshCw size={14} className={refreshing ? 'spinner' : ''} style={refreshing ? { width: 14, height: 14, borderWidth: 2 } : {}} />
                {refreshing ? 'Updating...' : 'Refresh'}
              </button>

              <Link to="/staff/cases" className="btn btn-primary" id="staff-cases-nav-btn" style={{ fontSize: '0.85rem' }}>
                <Briefcase size={15} />
                Open Cases Queue →
              </Link>
            </div>
          </div>
        </div>

        {/* Error Alert if any */}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 1: YOUR WORKLOAD METRICS                                          */}
        {/* ========================================================================= */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Your Workload
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Active Department Queue: <strong style={{ color: '#fff' }}>{workload.activeTotal} cases</strong>
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            
            {/* Metric 1: Needs Review */}
            <Link
              to="/staff/routing-review"
              className="card"
              style={{
                textDecoration: 'none',
                background: workload.needsReview > 0 ? 'linear-gradient(180deg, rgba(245, 158, 11, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${workload.needsReview > 0 ? 'rgba(245, 158, 11, 0.5)' : 'var(--border-subtle)'}`,
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'var(--transition)',
              }}
              id="metric-card-needs-review"
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: workload.needsReview > 0 ? '#fcd34d' : 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Needs Review
                  </span>
                  <ShieldAlert size={18} color={workload.needsReview > 0 ? '#f59e0b' : 'var(--text-muted)'} />
                </div>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, color: workload.needsReview > 0 ? '#fef08a' : '#ffffff', lineHeight: 1 }}>
                  {loading ? '—' : workload.needsReview}
                </div>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Routing reviews pending</span>
                <span style={{ color: '#60a5fa', fontWeight: 600 }}>Open Queue →</span>
              </div>
            </Link>

            {/* Metric 2: Unassigned Cases */}
            <Link
              to="/staff/cases?filter=unassigned"
              className="card"
              style={{
                textDecoration: 'none',
                background: workload.unassigned > 0 ? 'linear-gradient(180deg, rgba(59, 130, 246, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${workload.unassigned > 0 ? 'rgba(59, 130, 246, 0.4)' : 'var(--border-subtle)'}`,
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'var(--transition)',
              }}
              id="metric-card-unassigned"
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: workload.unassigned > 0 ? '#93c5fd' : 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Unassigned
                  </span>
                  <AlertCircle size={18} color={workload.unassigned > 0 ? '#60a5fa' : 'var(--text-muted)'} />
                </div>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>
                  {loading ? '—' : workload.unassigned}
                </div>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Awaiting staff dispatch</span>
                <span style={{ color: '#60a5fa', fontWeight: 600 }}>Assign →</span>
              </div>
            </Link>

            {/* Metric 3: In Progress */}
            <Link
              to="/staff/cases?filter=in_progress"
              className="card"
              style={{
                textDecoration: 'none',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'var(--transition)',
              }}
              id="metric-card-in-progress"
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase' }}>
                    In Progress
                  </span>
                  <Clock size={18} color="#60a5fa" />
                </div>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>
                  {loading ? '—' : workload.inProgress}
                </div>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Active field work</span>
                <span style={{ color: '#60a5fa', fontWeight: 600 }}>View →</span>
              </div>
            </Link>

            {/* Metric 4: On Hold */}
            <Link
              to="/staff/cases?filter=on_hold"
              className="card"
              style={{
                textDecoration: 'none',
                background: workload.onHold > 0 ? 'linear-gradient(180deg, rgba(168, 85, 247, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${workload.onHold > 0 ? 'rgba(168, 85, 247, 0.4)' : 'var(--border-subtle)'}`,
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'var(--transition)',
              }}
              id="metric-card-on-hold"
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: workload.onHold > 0 ? '#d8b4fe' : 'var(--text-muted)', textTransform: 'uppercase' }}>
                    On Hold
                  </span>
                  <PauseCircle size={18} color={workload.onHold > 0 ? '#a855f7' : 'var(--text-muted)'} />
                </div>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>
                  {loading ? '—' : workload.onHold}
                </div>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Paused (material, weather)</span>
                <span style={{ color: '#60a5fa', fontWeight: 600 }}>Inspect →</span>
              </div>
            </Link>
          </div>

          {/* Secondary Stats Strip */}
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(0, 0, 0, 0.25)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <span>Assigned to You: <strong style={{ color: '#93c5fd' }}>{workload.assignedToMe}</strong></span>
            <span>•</span>
            <span>Total Resolved: <strong style={{ color: '#6ee7b7' }}>{workload.resolvedTotal}</strong></span>
            <span>•</span>
            <span>Department Scope: <strong style={{ color: '#e2e8f0' }}>{scopeInfo.departmentName}</strong></span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 2: ATTENTION REQUIRED                                             */}
        {/* ========================================================================= */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                Attention Required
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                Cases and reviews requiring immediate operational follow-through
              </p>
            </div>

            <Link to="/staff/cases?filter=needs_attention" style={{ fontSize: '0.85rem', color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}>
              View All Needs Attention →
            </Link>
          </div>

          {/* Review items banner if any */}
          {reviewItems.length > 0 && (
            <div
              style={{
                background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.15) 0%, rgba(180, 83, 9, 0.1) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <ShieldAlert size={22} color="#f59e0b" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fef3c7' }}>
                    {workload.needsReview} Report{workload.needsReview > 1 ? 's' : ''} Awaiting Routing Adjudication
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#fde68a', marginTop: '0.2rem' }}>
                    Spatial jurisdiction conflict or low AI confidence requires staff confirmation before case dispatch.
                  </div>
                </div>
              </div>

              <Link
                to="/staff/routing-review"
                className="btn"
                style={{
                  background: '#f59e0b',
                  color: '#000000',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  padding: '0.45rem 1rem',
                }}
              >
                Review Routing Queue →
              </Link>
            </div>
          )}

          {/* Attention Cases Grid */}
          {loading ? (
            <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 0.75rem auto' }} />
              <p style={{ fontSize: '0.85rem' }}>Checking operational queues...</p>
            </div>
          ) : attentionCases.length === 0 && reviewItems.length === 0 ? (
            <div className="card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', borderStyle: 'dashed' }}>
              <CheckCircle2 size={38} color="#10b981" style={{ margin: '0 auto 0.75rem auto' }} />
              <h3 style={{ fontSize: '1.05rem', color: '#ffffff', marginBottom: '0.35rem' }}>
                No cases currently require immediate attention
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '460px', margin: '0 auto' }}>
                All incoming reports in your department have been dispatched, and work items are progressing normally.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {attentionCases.map((c) => (
                <div
                  key={c.id}
                  className="card"
                  style={{
                    padding: '1.25rem',
                    border: c.status === 'UNASSIGNED' ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(168, 85, 247, 0.4)',
                    background: 'rgba(15, 23, 42, 0.75)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.85rem',
                  }}
                >
                  <div>
                    {/* Top Row: Case Number & Status Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#60a5fa', fontSize: '0.9rem' }}>
                        {c.case_number}
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '9999px',
                          background: c.status === 'UNASSIGNED' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                          color: c.status === 'UNASSIGNED' ? '#93c5fd' : '#d8b4fe',
                          border: `1px solid ${c.status === 'UNASSIGNED' ? '#3b82f6' : '#a855f7'}`,
                        }}
                      >
                        {c.status === 'UNASSIGNED' ? 'Waiting for Assignment' : `On Hold: ${c.on_hold_reason || 'Pending'}`}
                      </span>
                    </div>

                    {/* Category & Description */}
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.35rem' }}>
                      {c.category ? c.category.replace(/_/g, ' ') : 'Civic Problem'}
                    </div>

                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.45, margin: '0 0 0.75rem 0' }}>
                      {c.report_description
                        ? c.report_description.length > 80
                          ? `${c.report_description.substring(0, 80)}...`
                          : c.report_description
                        : 'Citizen report logged.'}
                    </p>

                    {/* Location & Department */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Building2 size={13} color="#94a3b8" />
                        <span>{c.department_name || c.department_code || 'Road Maintenance'}</span>
                      </div>
                      {c.jurisdiction_name && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <MapPin size={13} color="#94a3b8" />
                          <span>{c.jurisdiction_name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                      {getTimeAgo(c.created_at)}
                    </span>
                    <Link
                      to={`/staff/cases/${c.id}`}
                      className="btn btn-primary btn-sm"
                      style={{ padding: '0.35rem 0.8rem', fontSize: '0.78rem' }}
                    >
                      Open Case →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* SECTION 3: RECENT CASE ACTIVITY                                           */}
        {/* ========================================================================= */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                Recent Case Activity
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                Latest status updates and field operations in your jurisdiction
              </p>
            </div>

            <Link to="/staff/cases" style={{ fontSize: '0.85rem', color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}>
              View All Cases ({workload.activeTotal}) →
            </Link>
          </div>

          {loading ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 0.5rem auto' }} />
            </div>
          ) : recentCases.length === 0 ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              No operational cases recorded in the system yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {recentCases.map((c) => (
                <div
                  key={c.id}
                  className="card"
                  style={{
                    padding: '0.95rem 1.25rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '240px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: 'rgba(37, 99, 235, 0.15)',
                        color: '#60a5fa',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Briefcase size={18} />
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#60a5fa', fontSize: '0.85rem' }}>
                          {c.case_number}
                        </span>
                        <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff' }}>
                          {c.category ? c.category.replace(/_/g, ' ') : 'Civic Problem'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {c.department_name || c.department_code} • {c.jurisdiction_name || 'Mysuru District'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '9999px',
                          background:
                            c.status === 'RESOLVED'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : c.status === 'IN_PROGRESS'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : c.status === 'ON_HOLD'
                              ? 'rgba(168, 85, 247, 0.15)'
                              : 'rgba(59, 130, 246, 0.15)',
                          color:
                            c.status === 'RESOLVED'
                              ? '#6ee7b7'
                              : c.status === 'IN_PROGRESS'
                              ? '#fcd34d'
                              : c.status === 'ON_HOLD'
                              ? '#d8b4fe'
                              : '#93c5fd',
                          border: `1px solid ${
                            c.status === 'RESOLVED'
                              ? '#10b981'
                              : c.status === 'IN_PROGRESS'
                              ? '#f59e0b'
                              : c.status === 'ON_HOLD'
                              ? '#a855f7'
                              : '#3b82f6'
                          }`,
                        }}
                      >
                        {c.status.replace(/_/g, ' ')}
                      </span>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.2rem' }}>
                        {getTimeAgo(c.updated_at || c.created_at)}
                      </div>
                    </div>

                    <Link
                      to={`/staff/cases/${c.id}`}
                      className="btn btn-outline btn-sm"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                    >
                      Manage →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
