import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  List,
  MapPin,
  Clock,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  Search,
  ArrowRight,
  Filter,
  RefreshCw,
  FileText,
  AlertTriangle,
  Lightbulb,
  Droplet,
  Trash2,
} from 'lucide-react';

const CATEGORY_ICONS = {
  POTHOLE: <AlertTriangle size={15} />,
  BLOCKED_DRAIN: <Droplet size={15} />,
  GARBAGE_OVERFLOW: <Trash2 size={15} />,
  BROKEN_STREETLIGHT: <Lightbulb size={15} />,
  ILLEGAL_DUMPING: <AlertCircle size={15} />,
  OTHER: <FileText size={15} />,
};

export const MyReports = () => {
  const { token } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'RESOLVED'
  const [searchQuery, setSearchQuery] = useState('');

  const fetchReports = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.getMyReports(token);
      if (res.ok && res.data?.reports) {
        setReports(res.data.reports);
      } else {
        setError(res.data?.message || "We couldn't connect to CivicFlow. Please check your connection and try again.");
      }
    } catch (err) {
      setError("We couldn't connect to CivicFlow. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [token]);

  // Helpers for human-friendly status
  const getStatusInfo = (status) => {
    switch (status) {
      case 'SUBMITTED':
        return { label: 'Received', color: 'var(--text-muted)', bg: 'rgba(148, 163, 184, 0.12)' };
      case 'NEEDS_REVIEW':
        return { label: 'Under Review', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' };
      case 'ROUTED':
      case 'UNASSIGNED':
        return { label: 'Queued for Dispatch', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' };
      case 'ASSIGNED':
      case 'ACKNOWLEDGED':
        return { label: 'Staff Acknowledged', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' };
      case 'IN_PROGRESS':
        return { label: 'Work in Progress', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.2)' };
      case 'ON_HOLD':
        return { label: 'On Hold', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' };
      case 'RESOLVED':
        return { label: 'Resolved (Confirm Needed)', color: '#10b981', bg: 'rgba(16, 185, 129, 0.18)' };
      case 'VERIFIED':
      case 'CLOSED':
        return { label: 'Verified & Closed', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' };
      default:
        return { label: status || 'Pending', color: 'var(--text-muted)', bg: 'rgba(255, 255, 255, 0.05)' };
    }
  };

  const isResolved = (status) => status === 'RESOLVED' || status === 'VERIFIED' || status === 'CLOSED';

  // Filter reports
  const filteredReports = reports.filter((report) => {
    // Tab filter
    if (activeTab === 'ACTIVE' && isResolved(report.status)) return false;
    if (activeTab === 'RESOLVED' && !isResolved(report.status)) return false;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const cat = (report.category || '').toLowerCase();
      const desc = (report.description || '').toLowerCase();
      return cat.includes(q) || desc.includes(q);
    }
    return true;
  });

  const activeCount = reports.filter((r) => !isResolved(r.status)).length;
  const resolvedCount = reports.filter((r) => isResolved(r.status)).length;

  return (
    <div className="main-content">
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.75rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 700, margin: '0 0 0.35rem 0' }}>
            My Civic Reports
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: 0 }}>
            Track the status, responsible department, and resolution verification of your reports.
          </p>
        </div>

        <Link
          to="/report"
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          id="btn-create-new-report"
        >
          <PlusCircle size={16} />
          Report a Problem
        </Link>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-surface)', padding: '0.3rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('ALL')}
            style={{ border: 'none' }}
            id="tab-all-reports"
          >
            All Reports ({reports.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'ACTIVE' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('ACTIVE')}
            style={{ border: 'none' }}
            id="tab-active-reports"
          >
            Active ({activeCount})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'RESOLVED' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('RESOLVED')}
            style={{ border: 'none' }}
            id="tab-resolved-reports"
          >
            Resolved ({resolvedCount})
          </button>
        </div>

        <div style={{ position: 'relative', minWidth: '240px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search your reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.2rem', height: '38px', fontSize: '0.85rem' }}
          />
          <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '12px' }} />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <div>{error}</div>
          </div>
          <button type="button" onClick={fetchReports} className="btn btn-sm btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
          Loading your civic reports...
        </div>
      ) : filteredReports.length === 0 ? (
        /* Empty State */
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(59, 130, 246, 0.1)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto',
            }}
          >
            <List size={28} />
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.4rem 0' }}>
            {searchQuery
              ? 'No reports match your search'
              : activeTab === 'ACTIVE'
              ? 'No active civic reports'
              : activeTab === 'RESOLVED'
              ? 'No resolved reports yet'
              : "You haven't reported any civic problems yet"}
          </h3>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 1.5rem auto' }}>
            {searchQuery
              ? 'Try using different keywords or clear the search filter.'
              : activeTab === 'ACTIVE'
              ? 'Great news! None of your reports are pending or under maintenance.'
              : activeTab === 'RESOLVED'
              ? 'Once municipal staff complete repair work on your issues, they will appear here for verification.'
              : 'Notice a pothole, broken streetlight, or garbage overflow? Help keep Mysuru clean and well-maintained.'}
          </p>

          {searchQuery ? (
            <button type="button" onClick={() => setSearchQuery('')} className="btn btn-outline btn-sm">
              Clear Search
            </button>
          ) : (
            <Link
              to="/report"
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              id="first-report-cta"
            >
              <PlusCircle size={15} /> Report a Problem
            </Link>
          )}
        </div>
      ) : (
        /* Reports Grid */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {filteredReports.map((report) => {
            const statusInfo = getStatusInfo(report.status);
            const trackingId = `CIV-2026-${String(report.id).slice(0, 8).toUpperCase()}`;

            return (
              <div
                key={report.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '1.35rem',
                  borderLeft: `4px solid ${statusInfo.color}`,
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        color: 'var(--accent-cyan)',
                      }}
                    >
                      {trackingId}
                    </span>

                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        padding: '0.2rem 0.6rem',
                        borderRadius: 'var(--radius-full)',
                        background: statusInfo.bg,
                        color: statusInfo.color,
                      }}
                    >
                      {statusInfo.label}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      background: 'rgba(37, 99, 235, 0.12)',
                      color: '#93c5fd',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.55rem',
                      borderRadius: '4px',
                      marginBottom: '0.75rem',
                    }}
                  >
                    {CATEGORY_ICONS[report.category] || <FileText size={14} />}
                    <span>{report.category}</span>
                  </div>

                  <p
                    style={{
                      fontSize: '0.9rem',
                      color: 'var(--text-main)',
                      lineHeight: 1.5,
                      marginBottom: '1rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {report.description}
                  </p>

                  {report.photoUrl && (
                    <div style={{ marginBottom: '1rem' }}>
                      <img
                        src={report.photoUrl}
                        alt="Civic evidence"
                        style={{
                          width: '100%',
                          height: '130px',
                          objectFit: 'cover',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      />
                    </div>
                  )}
                </div>

                <div
                  style={{
                    paddingTop: '0.75rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Clock size={13} />
                      <span>{new Date(report.reportedAt).toLocaleDateString()}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <MapPin size={13} />
                      <span>
                        {report.location?.status === 'VERIFIED_COORDINATES'
                          ? 'GPS Verified'
                          : 'Mysuru'}
                      </span>
                    </div>
                  </div>

                  <Link
                    to={`/reports/${report.id}`}
                    className="btn btn-outline btn-sm"
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      marginTop: '0.25rem',
                    }}
                  >
                    Track Case Details <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
