import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  Briefcase,
  AlertCircle,
  Clock,
  MapPin,
  Building2,
  Filter,
  Search,
  RefreshCw,
  ChevronRight,
  UserCheck,
  PauseCircle,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  X,
  Compass,
  ArrowRight,
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

export const StaffCases = () => {
  const { token, user, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [cases, setCases] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active filter tab: 'all' | 'needs_attention' | 'my_cases' | 'unassigned' | 'in_progress' | 'on_hold' | 'resolved'
  const initialFilter = searchParams.get('filter') || 'all';
  const [activeFilter, setActiveFilter] = useState(initialFilter);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

  // Scope context
  const [scopeInfo, setScopeInfo] = useState({
    authorityName: 'Mysuru City Corporation',
    departmentName: 'Municipal Operations',
  });

  // Resolve Authority and Department names
  useEffect(() => {
    const resolveScope = async () => {
      if (!token) return;
      try {
        const [authRes, deptRes] = await Promise.all([
          api.getAuthorities(token).catch(() => ({ ok: false })),
          api.getDepartments(token).catch(() => ({ ok: false })),
        ]);
        let authName = 'Mysuru City Corporation';
        let deptName = role === 'ADMIN' ? 'All Departments' : 'Municipal Operations';

        if (authRes.ok && Array.isArray(authRes.data?.authorities)) {
          const matched = authRes.data.authorities.find((a) => a.id === user?.authority_id);
          if (matched) authName = matched.name;
        }
        if (deptRes.ok && Array.isArray(deptRes.data?.departments)) {
          const matched = deptRes.data.departments.find((d) => d.id === user?.department_id);
          if (matched) deptName = matched.name;
        }
        setScopeInfo({ authorityName: authName, departmentName: deptName });
      } catch (err) {
        // Fallback scope
      }
    };
    resolveScope();
  }, [token, user?.authority_id, user?.department_id, role]);

  // Sync state if URL searchParams change
  useEffect(() => {
    const urlFilter = searchParams.get('filter');
    if (urlFilter && urlFilter !== activeFilter) {
      setActiveFilter(urlFilter);
    }
  }, [searchParams]);

  const fetchCases = useCallback(
    async (targetPage = 1, currentFilter = activeFilter, query = searchQuery) => {
      setLoading(true);
      setError(null);

      // Map filter tab to backend query parameters
      let view = 'active';
      let status = undefined;
      let assignedTo = undefined;

      switch (currentFilter) {
        case 'needs_attention':
          view = 'needs_attention';
          break;
        case 'my_cases':
          view = 'my_cases';
          assignedTo = user?.id;
          break;
        case 'unassigned':
          status = 'UNASSIGNED';
          break;
        case 'in_progress':
          status = 'IN_PROGRESS';
          break;
        case 'on_hold':
          status = 'ON_HOLD';
          break;
        case 'resolved':
          status = 'RESOLVED';
          view = undefined;
          break;
        case 'all':
        default:
          view = 'active';
          break;
      }

      try {
        const res = await api.getStaffCases(token, {
          page: targetPage,
          limit: 12,
          view,
          status,
          assignedTo,
          search: query.trim() || undefined,
        });

        if (res.ok && res.data) {
          setCases(res.data.items || []);
          setTotal(res.data.total || 0);
          setPage(res.data.page || 1);
          setTotalPages(res.data.totalPages || 1);

          // Update scope info from real case if not set yet
          if (res.data.items && res.data.items.length > 0 && res.data.items[0].authority_name) {
            setScopeInfo((prev) => ({
              authorityName: res.data.items[0].authority_name || prev.authorityName,
              departmentName: role === 'ADMIN' ? 'All Departments' : res.data.items[0].department_name || prev.departmentName,
            }));
          }
        } else {
          setError(res.data?.message || 'We could not load your cases. Please try again.');
        }
      } catch (err) {
        setError('We could not load your cases. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    },
    [token, user?.id, activeFilter, searchQuery, role]
  );

  useEffect(() => {
    fetchCases(1, activeFilter, searchQuery);
  }, [fetchCases, activeFilter]);

  const handleFilterChange = (newFilter) => {
    setActiveFilter(newFilter);
    setSearchParams(newFilter === 'all' ? {} : { filter: newFilter });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCases(1, activeFilter, searchQuery);
  };

  const clearSearch = () => {
    setSearchQuery('');
    fetchCases(1, activeFilter, '');
  };

  // Human-readable status mapping (Section 10)
  const getStatusBadge = (status, onHoldReason, verification) => {
    switch (status) {
      case 'UNASSIGNED':
        return (
          <span className="status-pill" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
            <AlertCircle size={12} />
            Waiting for assignment
          </span>
        );
      case 'ASSIGNED':
        return (
          <span className="status-pill" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.4)' }}>
            <UserCheck size={12} />
            Assigned
          </span>
        );
      case 'ACKNOWLEDGED':
        return (
          <span className="status-pill" style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#7dd3fc', border: '1px solid rgba(14, 165, 233, 0.4)' }}>
            <Clock size={12} />
            Acknowledged
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="status-pill" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
            <Clock size={12} />
            Work in progress
          </span>
        );
      case 'ON_HOLD':
        return (
          <span className="status-pill" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#d8b4fe', border: '1px solid rgba(168, 85, 247, 0.4)' }}>
            <PauseCircle size={12} />
            On hold{onHoldReason ? `: ${onHoldReason.replace(/_/g, ' ')}` : ''}
          </span>
        );
      case 'RESOLVED':
        if (verification?.status === 'VERIFIED') {
          return (
            <span className="status-pill" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', border: '1px solid #10b981' }}>
              <ShieldCheck size={12} />
              Citizen Verified ✓
            </span>
          );
        }
        if (verification?.status === 'DISPUTED') {
          return (
            <span className="status-pill" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid #ef4444' }}>
              <AlertTriangle size={12} />
              Disputed by Citizen ⚠
            </span>
          );
        }
        return (
          <span className="status-pill" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
            <CheckCircle2 size={12} />
            Resolved
          </span>
        );
      case 'CLOSED':
        return (
          <span className="status-pill" style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#cbd5e1', border: '1px solid rgba(148, 163, 184, 0.3)' }}>
            Closed
          </span>
        );
      default:
        return (
          <span className="status-pill" style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)' }}>
            {status}
          </span>
        );
    }
  };

  // Priority badge (Section 8)
  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'CRITICAL':
      case 'URGENT':
        return <span className="priority-pill priority-pill-urgent">CRITICAL</span>;
      case 'HIGH':
        return <span className="priority-pill priority-pill-high">HIGH</span>;
      case 'LOW':
        return <span className="priority-pill priority-pill-low">LOW</span>;
      case 'MEDIUM':
      default:
        return <span className="priority-pill priority-pill-medium">MEDIUM</span>;
    }
  };

  if (role !== 'STAFF' && role !== 'ADMIN') {
    return (
      <div className="cases-page-container">
        <div className="card" style={{ maxWidth: '540px', margin: '4rem auto', textAlign: 'center', padding: '2.5rem' }}>
          <ShieldAlert size={48} color="#ef4444" style={{ margin: '0 auto 1rem auto' }} />
          <h2>Access Restricted</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Only authorized municipal staff and administrators can access the operational case workflow.
          </p>
          <div style={{ marginTop: '1.5rem' }}>
            <Link to="/" className="btn btn-primary">
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cases-page-container">
      {/* Header with Department Scope */}
      <div className="cases-header">
        <div className="cases-header-left">
          <div className="cases-header-icon">
            <Briefcase size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
              <h1 className="cases-title" style={{ margin: 0 }}>Staff Cases</h1>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#93c5fd', background: 'rgba(59, 130, 246, 0.15)', padding: '0.2rem 0.65rem', borderRadius: 'var(--radius-full)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                {scopeInfo.authorityName} • {scopeInfo.departmentName}
              </span>
            </div>
            <p className="cases-subtitle" style={{ margin: 0 }}>
              Primary work queue for incident dispatch, field remediation, and resolution follow-through.
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchCases(page, activeFilter, searchQuery)}
          disabled={loading}
          className="btn btn-outline"
          style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
          title="Refresh case queue"
        >
          <RefreshCw size={15} className={loading ? 'spinner' : ''} style={loading ? { width: 14, height: 14, borderWidth: 2 } : {}} />
          Refresh
        </button>
      </div>

      {/* Filter Tabs (Section 7) */}
      <div className="cases-nav-tabs" style={{ gap: '0.35rem' }}>
        <button
          onClick={() => handleFilterChange('all')}
          className={`cases-tab-btn ${activeFilter === 'all' ? 'active' : ''}`}
          id="filter-tab-all"
        >
          All
        </button>

        <button
          onClick={() => handleFilterChange('needs_attention')}
          className={`cases-tab-btn ${activeFilter === 'needs_attention' ? 'active' : ''}`}
          id="filter-tab-needs-attention"
        >
          <AlertCircle size={14} color="#f59e0b" />
          Needs Attention
        </button>

        <button
          onClick={() => handleFilterChange('my_cases')}
          className={`cases-tab-btn ${activeFilter === 'my_cases' ? 'active' : ''}`}
          id="filter-tab-my-cases"
        >
          <UserCheck size={14} color="#818cf8" />
          Assigned to Me
        </button>

        <button
          onClick={() => handleFilterChange('unassigned')}
          className={`cases-tab-btn ${activeFilter === 'unassigned' ? 'active' : ''}`}
          id="filter-tab-unassigned"
        >
          Unassigned
        </button>

        <button
          onClick={() => handleFilterChange('in_progress')}
          className={`cases-tab-btn ${activeFilter === 'in_progress' ? 'active' : ''}`}
          id="filter-tab-in-progress"
        >
          In Progress
        </button>

        <button
          onClick={() => handleFilterChange('on_hold')}
          className={`cases-tab-btn ${activeFilter === 'on_hold' ? 'active' : ''}`}
          id="filter-tab-on-hold"
        >
          On Hold
        </button>

        <button
          onClick={() => handleFilterChange('resolved')}
          className={`cases-tab-btn ${activeFilter === 'resolved' ? 'active' : ''}`}
          id="filter-tab-resolved"
        >
          Resolved
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.04)', padding: '0.25rem 0.65rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)' }}>
            Showing: <strong style={{ color: '#ffffff' }}>{total}</strong> cases
          </span>
        </div>
      </div>

      {/* Search Bar (Section 9) */}
      <div className="cases-filter-bar">
        <form onSubmit={handleSearchSubmit} className="cases-search-box" style={{ maxWidth: '480px' }}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by Case # (CIV-2026-...), issue keyword, ward, or staff..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="cases-search-input"
            id="staff-cases-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.2rem',
              }}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </form>

        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Active Filter:{' '}
          <strong style={{ color: '#60a5fa', textTransform: 'capitalize' }}>
            {activeFilter.replace(/_/g, ' ')}
          </strong>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Case Cards Grid */}
      {loading ? (
        <div style={{ padding: '5rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }} />
          <p style={{ fontSize: '0.9rem' }}>Loading operational case queue...</p>
        </div>
      ) : cases.length === 0 ? (
        <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center', borderStyle: 'dashed' }}>
          <Briefcase size={44} color="var(--text-faint)" style={{ margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.1rem', color: '#ffffff', marginBottom: '0.4rem' }}>
            {activeFilter === 'needs_attention'
              ? 'No cases currently require your attention'
              : activeFilter === 'my_cases'
              ? 'No cases are currently assigned to you'
              : activeFilter === 'unassigned'
              ? 'All operational cases have been assigned'
              : searchQuery
              ? `No cases found matching "${searchQuery}"`
              : 'No operational cases found in this queue'}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '440px', margin: '0 auto 1.5rem auto' }}>
            {searchQuery
              ? 'Try searching with a different case number, keyword, or clear your search.'
              : 'Incoming civic reports will appear here automatically as soon as they are routed.'}
          </p>
          {searchQuery && (
            <button onClick={clearSearch} className="btn btn-outline btn-sm">
              Clear Search Query
            </button>
          )}
        </div>
      ) : (
        <div className="cases-grid">
          {cases.map((c) => (
            <div key={c.id} className="case-card" id={`case-card-${c.id}`}>
              <div>
                {/* Header: Case #, Priority, Status (Section 12) */}
                <div className="case-card-header">
                  <span className="case-number">{c.case_number}</span>
                  <div className="case-badges">
                    {getPriorityBadge(c.priority)}
                    {getStatusBadge(c.status, c.on_hold_reason, c.current_verification || c.verification)}
                  </div>
                </div>

                {/* What? Category & Description */}
                <div style={{ marginTop: '0.85rem' }}>
                  <div style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#60a5fa', background: 'rgba(37, 99, 235, 0.12)', padding: '0.15rem 0.55rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.4rem' }}>
                    {c.category ? c.category.replace(/_/g, ' ') : 'CIVIC PROBLEM'}
                  </div>
                  <h4 className="case-card-title" style={{ fontSize: '1rem', color: '#ffffff', margin: '0 0 0.35rem 0', lineHeight: 1.3 }}>
                    {c.report_description ? (
                      c.report_description.length > 90
                        ? `${c.report_description.substring(0, 90)}...`
                        : c.report_description
                    ) : (
                      'Citizen civic incident'
                    )}
                  </h4>
                </div>

                {/* Where? & Who? Metadata List */}
                <div className="case-meta-list" style={{ marginTop: '0.85rem' }}>
                  {/* Who? Department & Authority */}
                  <div className="case-meta-row">
                    <Building2 size={13} color="#94a3b8" />
                    <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                      {c.authority_code || 'MCC'}
                    </span>
                    <span style={{ color: 'var(--text-faint)' }}>•</span>
                    <span style={{ color: '#6ee7b7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.department_name || c.department_code || 'Road Maintenance'}
                    </span>
                  </div>

                  {/* Where? Jurisdiction / Ward */}
                  <div className="case-meta-row">
                    <MapPin size={13} color="#94a3b8" />
                    <span style={{ color: '#cbd5e1' }}>
                      {c.jurisdiction_name || 'Mysuru District Jurisdiction'}
                    </span>
                  </div>

                  {/* Assigned to? */}
                  <div className="case-meta-row">
                    <UserCheck size={13} color="#94a3b8" />
                    <span>
                      {c.assigned_to_name ? (
                        <>Assigned: <strong style={{ color: '#93c5fd' }}>{c.assigned_to_name}</strong></>
                      ) : (
                        <em style={{ color: '#f59e0b' }}>Awaiting staff assignment</em>
                      )}
                    </span>
                  </div>
                </div>

                {/* Routing Intelligence (Section 15) */}
                <div
                  style={{
                    marginTop: '0.85rem',
                    padding: '0.5rem 0.65rem',
                    background: 'rgba(0, 0, 0, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#a7f3d0' }}>
                    <Compass size={12} />
                    {c.routing_id ? 'Automatically Routed' : 'Department Assignment'}
                  </span>
                  <span style={{ color: 'var(--text-faint)', fontSize: '0.7rem' }}>
                    {c.jurisdiction_name ? `${c.jurisdiction_name} Rule` : 'Charter Rule'}
                  </span>
                </div>
              </div>

              {/* Footer: Updated & Open Case button (Section 13) */}
              <div className="case-card-footer" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.85rem', marginTop: '0.75rem' }}>
                <div className="case-card-footer-time" style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                  <Clock size={12} />
                  <span>Updated {getTimeAgo(c.updated_at || c.created_at)}</span>
                </div>

                <Link
                  to={`/staff/cases/${c.id}`}
                  className="btn btn-primary"
                  style={{ padding: '0.45rem 0.95rem', fontSize: '0.82rem', borderRadius: 'var(--radius-md)', fontWeight: 600 }}
                  id={`open-case-btn-${c.case_number}`}
                >
                  Open Case
                  <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
          <button
            onClick={() => fetchCases(page - 1, activeFilter, searchQuery)}
            disabled={page <= 1}
            className="btn btn-outline"
            style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
          >
            Previous
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => fetchCases(page + 1, activeFilter, searchQuery)}
            disabled={page >= totalPages}
            className="btn btn-outline"
            style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default StaffCases;
