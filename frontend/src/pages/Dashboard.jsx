import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ArrowRight,
  ShieldCheck,
  Building2,
  MapPin,
  Sparkles,
  Activity,
  Briefcase,
  Layers,
} from 'lucide-react';
import { StaffDashboard } from '../components/StaffDashboard';

export const Dashboard = () => {
  const { user, role, token } = useAuth();

  if (role === 'STAFF' || role === 'ADMIN') {
    return <StaffDashboard user={user} token={token} role={role} />;
  }

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCitizenReports = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await api.getMyReports(token);
        if (res.ok && res.data?.reports) {
          setReports(res.data.reports);
        } else {
          setError(res.data?.message || 'Could not load your recent reports.');
        }
      } catch (err) {
        setError('Unable to load reports. Please check your network connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchCitizenReports();
  }, [token]);

  // Compute citizen statistics from real reports
  const totalReports = reports.length;
  const resolvedReports = reports.filter(
    (r) => r.status === 'RESOLVED' || r.status === 'VERIFIED' || r.status === 'CLOSED'
  ).length;
  const activeReports = totalReports - resolvedReports;

  // Helper for human-friendly status badge
  const getStatusDisplay = (status) => {
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
        return { label: 'Temporarily on Hold', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' };
      case 'RESOLVED':
        return { label: 'Resolved (Confirm Needed)', color: '#10b981', bg: 'rgba(16, 185, 129, 0.18)' };
      case 'VERIFIED':
      case 'CLOSED':
        return { label: 'Verified & Closed', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' };
      default:
        return { label: status || 'Pending', color: 'var(--text-muted)', bg: 'rgba(255, 255, 255, 0.05)' };
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = user?.name ? user.name.split(' ')[0] : 'Citizen';

  return (
    <div className="main-content">
      {/* Citizen Welcome Hero */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(6, 182, 212, 0.08) 100%)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem 1.75rem',
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
        }}
      >
        <div>
          <span
            style={{
              fontSize: '0.82rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--accent-cyan)',
              marginBottom: '0.35rem',
              display: 'block',
            }}
          >
            Mysuru Civic Accountability Portal
          </span>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 700, margin: '0 0 0.4rem 0' }}>
            {getGreeting()}, {firstName}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.98rem', margin: 0 }}>
            Report problems in your neighborhood and track them until work is verified.
          </p>
        </div>

        <Link
          to="/report"
          className="btn btn-primary"
          style={{
            padding: '0.85rem 1.6rem',
            fontSize: '1rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 15px rgba(37, 99, 235, 0.35)',
          }}
          id="btn-hero-report-issue"
        >
          <PlusCircle size={20} />
          Report a Problem
        </Link>
      </div>

      {/* Staff Operational Banner (Displayed exclusively if logged in as Staff/Admin) */}
      {(role === 'STAFF' || role === 'ADMIN') && (
        <div
          className="card"
          style={{
            marginBottom: '1.75rem',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            background: 'rgba(245, 158, 11, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            padding: '1.25rem 1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Briefcase size={22} color="#f59e0b" />
            <div>
              <div style={{ fontWeight: 600, color: '#f59e0b', fontSize: '0.95rem' }}>
                Municipal Personnel Portal
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                You are signed in with <strong>{role}</strong> privileges. You can manage assigned cases and reviews.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <Link to="/staff/cases" className="btn btn-sm btn-primary">
              View Staff Cases
            </Link>
            <Link to="/staff/routing-review" className="btn btn-sm btn-outline">
              Review Queue
            </Link>
          </div>
        </div>
      )}

      {/* Citizen Report Summary Counters */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2rem',
        }}
      >
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Active Reports</span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Activity size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0 0.1rem 0' }}>
            {activeReports}
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Being processed or repaired
          </span>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Resolved & Verified</span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0 0.1rem 0' }}>
            {resolvedReports}
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Completed civic issues
          </span>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Reported</span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(139, 92, 246, 0.15)',
                color: '#8b5cf6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0 0.1rem 0' }}>
            {totalReports}
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            All-time neighborhood issues
          </span>
        </div>
      </div>

      {/* Main Sections: Recent Reports & How CivicFlow Works */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.75rem' }}>
        {/* Left Column: Recent Reports */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Your Recent Reports</h2>
            {reports.length > 0 && (
              <Link to="/my-reports" style={{ fontSize: '0.88rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                View all ({reports.length}) <ArrowRight size={14} />
              </Link>
            )}
          </div>

          {loading ? (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
              Loading your reports...
            </div>
          ) : reports.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem auto',
                }}
              >
                <FileText size={24} />
              </div>
              <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.4rem 0' }}>No reports submitted yet</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.5rem', maxWidth: '360px', margin: '0 auto 1.5rem auto' }}>
                Notice a pothole, overflow of garbage, or dark street? File a report in seconds.
              </p>
              <Link to="/report" className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <PlusCircle size={15} />
                Report a Problem
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {reports.slice(0, 4).map((report) => {
                const statusInfo = getStatusDisplay(report.status);
                return (
                  <Link
                    key={report.id}
                    to={`/reports/${report.id}`}
                    className="card"
                    style={{
                      textDecoration: 'none',
                      color: 'inherit',
                      padding: '1.1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem',
                      transition: 'all 0.15s ease',
                      borderLeft: `4px solid ${statusInfo.color}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '0.76rem',
                          color: '#93c5fd',
                          background: 'rgba(37, 99, 235, 0.12)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                        }}
                      >
                        {report.category}
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

                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.9rem',
                        color: 'var(--text-main)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {report.description}
                    </p>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)',
                        paddingTop: '0.4rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Clock size={13} />
                        <span>{new Date(report.reportedAt).toLocaleDateString()}</span>
                      </div>
                      <span style={{ color: 'var(--primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                        View Details <ArrowRight size={12} />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: How CivicFlow Works */}
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
            How CivicFlow Works
          </h2>

          <div className="card" style={{ padding: '1.5rem' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              CivicFlow eliminates municipal runaround by automatically matching issues to the exact responsible authority.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#3b82f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    flexShrink: 0,
                  }}
                >
                  1
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>You Report a Problem</h4>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Add a description, optional photo, and location in under two minutes.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(6, 182, 212, 0.15)',
                    color: 'var(--accent-cyan)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    flexShrink: 0,
                  }}
                >
                  2
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>We Identify What & Where</h4>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    AI understands the issue severity while our spatial engine detects the ward boundary.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    flexShrink: 0,
                  }}
                >
                  3
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Responsible Department Dispatched</h4>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Matched directly to MCC or local Panchayat according to municipal responsibility rules.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    flexShrink: 0,
                  }}
                >
                  4
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>You Verify the Resolution</h4>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    When staff marks the job finished, you confirm before the case is officially closed.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
              <Link to="/report" className="btn btn-outline btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
                Start a New Report
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
