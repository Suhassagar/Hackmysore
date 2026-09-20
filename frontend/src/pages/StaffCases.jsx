import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
} from 'lucide-react';

export const StaffCases = () => {
  const { token, user, role } = useAuth();
  const [cases, setCases] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'needs_attention' | 'my_cases'
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCases = useCallback(
    async (targetPage = 1) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getStaffCases(token, {
          page: targetPage,
          limit: 12,
          view: activeTab,
          status: statusFilter || undefined,
          assignedTo: activeTab === 'my_cases' ? user?.id : undefined,
          search: searchQuery.trim() || undefined,
        });

        if (res.ok && res.data) {
          setCases(res.data.items || []);
          setTotal(res.data.total || 0);
          setPage(res.data.page || 1);
          setTotalPages(res.data.totalPages || 1);
        } else {
          setError(res.data?.message || 'Failed to load operational cases.');
        }
      } catch (err) {
        setError(err.message || 'Error fetching cases.');
      } finally {
        setLoading(false);
      }
    },
    [token, user?.id, activeTab, statusFilter, searchQuery]
  );

  useEffect(() => {
    fetchCases(1);
  }, [fetchCases]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCases(1);
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

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'URGENT':
        return <span className="priority-pill priority-pill-urgent">URGENT</span>;
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
            Only municipal staff officers and administrators are authorized to access the operational case workflow.
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
    <div className="cases-page-container">
      {/* Header */}
      <div className="cases-header">
        <div className="cases-header-left">
          <div className="cases-header-icon">
            <Briefcase size={24} />
          </div>
          <div>
            <h1 className="cases-title">Staff Case Operations</h1>
            <p className="cases-subtitle">
              Operational civic work lifecycle, department assignment, follow-through, and resolution audit.
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchCases(page)}
          disabled={loading}
          className="btn btn-outline"
          style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
        >
          <RefreshCw size={15} className={loading ? 'spinner' : ''} style={loading ? { width: 14, height: 14, borderWidth: 2 } : {}} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="cases-nav-tabs">
        <button
          onClick={() => {
            setActiveTab('active');
            setStatusFilter('');
          }}
          className={`cases-tab-btn ${activeTab === 'active' ? 'active' : ''}`}
        >
          <Briefcase size={16} />
          Active Cases
        </button>

        <button
          onClick={() => {
            setActiveTab('needs_attention');
            setStatusFilter('');
          }}
          className={`cases-tab-btn ${activeTab === 'needs_attention' ? 'active' : ''}`}
        >
          <AlertCircle size={16} color="#f59e0b" />
          Needs Attention
        </button>

        <button
          onClick={() => {
            setActiveTab('my_cases');
            setStatusFilter('');
          }}
          className={`cases-tab-btn ${activeTab === 'my_cases' ? 'active' : ''}`}
        >
          <UserCheck size={16} color="#818cf8" />
          My Cases
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--bg-surface-elevated)', padding: '0.25rem 0.65rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)' }}>
            Total Cases: <strong>{total}</strong>
          </span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="cases-filter-bar">
        <form onSubmit={handleSearchSubmit} className="cases-search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by Case # (CIV-2026-...) or issue keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="cases-search-input"
          />
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <Filter size={15} />
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="cases-filter-select"
          >
            <option value="">All Statuses</option>
            <option value="UNASSIGNED">Unassigned</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Case Grid */}
      {loading ? (
        <div style={{ padding: '5rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }} />
          <p style={{ fontSize: '0.9rem' }}>Loading operational case queue...</p>
        </div>
      ) : cases.length === 0 ? (
        <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center', borderStyle: 'dashed' }}>
          <Briefcase size={44} color="var(--text-faint)" style={{ margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.4rem' }}>No operational cases found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '440px', margin: '0 auto' }}>
            {searchQuery || statusFilter
              ? 'No cases match your active search keyword or status filter.'
              : activeTab === 'needs_attention'
              ? 'Great news! No unassigned or on-hold cases require immediate attention.'
              : activeTab === 'my_cases'
              ? 'You do not have any cases assigned to your account right now.'
              : 'There are currently no active operational cases in this municipal queue.'}
          </p>
        </div>
      ) : (
        <div className="cases-grid">
          {cases.map((c) => (
            <div key={c.id} className="case-card">
              <div>
                {/* Header: Case # & Status & Priority */}
                <div className="case-card-header">
                  <span className="case-number">{c.case_number}</span>
                  <div className="case-badges">
                    {getPriorityBadge(c.priority)}
                    {getStatusBadge(c.status)}
                  </div>
                </div>

                {/* Category & Description */}
                <div style={{ marginTop: '0.85rem' }}>
                  <div style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#60a5fa', background: 'rgba(37, 99, 235, 0.12)', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.4rem' }}>
                    {c.category ? c.category.replace(/_/g, ' ') : 'CIVIC ISSUE'}
                  </div>
                  <h4 className="case-card-title" style={{ fontSize: '0.98rem' }}>
                    {c.report_description ? (
                      c.report_description.length > 85
                        ? `${c.report_description.substring(0, 85)}...`
                        : c.report_description
                    ) : (
                      'Citizen civic incident'
                    )}
                  </h4>
                </div>

                {/* Metadata List */}
                <div className="case-meta-list">
                  <div className="case-meta-row">
                    <Building2 size={13} />
                    <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                      {c.authority_code || 'MCC'}
                    </span>
                    <span style={{ color: 'var(--text-faint)' }}>/</span>
                    <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.department_name || c.department_code || 'General Operations'}
                    </span>
                  </div>

                  {c.jurisdiction_name && (
                    <div className="case-meta-row">
                      <MapPin size={13} />
                      <span>{c.jurisdiction_name}</span>
                    </div>
                  )}

                  <div className="case-meta-row">
                    <UserCheck size={13} />
                    <span>
                      {c.assigned_to_name ? (
                        <>Assigned: <strong style={{ color: 'var(--text-main)' }}>{c.assigned_to_name}</strong></>
                      ) : (
                        <em style={{ color: '#f59e0b' }}>Awaiting staff assignment</em>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="case-card-footer">
                <div className="case-card-footer-time">
                  <Clock size={12} />
                  <span>{new Date(c.created_at).toLocaleDateString()}</span>
                </div>

                <Link
                  to={`/staff/cases/${c.id}`}
                  className="btn btn-primary"
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', borderRadius: 'var(--radius-md)' }}
                >
                  Manage Case
                  <ChevronRight size={13} />
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
            onClick={() => fetchCases(page - 1)}
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
            onClick={() => fetchCases(page + 1)}
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
