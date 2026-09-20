import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RoleBadge } from './RoleBadge';
import {
  LogOut,
  Activity,
  PlusCircle,
  List,
  LayoutDashboard,
  ShieldAlert,
  Briefcase,
  User,
  Bell,
  CheckCircle2,
} from 'lucide-react';

export const Navbar = () => {
  const { user, role, logout, isAuthenticated, switchDevRole } = useAuth();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <Link to="/" className="nav-brand" style={{ textDecoration: 'none' }}>
            <div className="brand-icon">
              <Activity size={20} />
            </div>
            <div className="brand-text">
              <span className="brand-name">CivicFlow</span>
              <span className="brand-tagline">Mysuru Civic Accountability</span>
            </div>
          </Link>

          {isAuthenticated && (
            <nav style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Link
                to="/"
                className={`btn btn-sm ${location.pathname === '/' ? 'btn-primary' : 'btn-outline'}`}
                id="nav-link-dashboard"
              >
                <LayoutDashboard size={14} />
                {role === 'STAFF' || role === 'ADMIN' ? 'Operations' : 'Home'}
              </Link>

              {role === 'CITIZEN' && (
                <>
                  <Link
                    to="/report"
                    className={`btn btn-sm ${location.pathname === '/report' ? 'btn-primary' : 'btn-outline'}`}
                    id="nav-link-report"
                  >
                    <PlusCircle size={14} />
                    Report Issue
                  </Link>
                  <Link
                    to="/my-reports"
                    className={`btn btn-sm ${location.pathname === '/my-reports' ? 'btn-primary' : 'btn-outline'}`}
                    id="nav-link-my-reports"
                  >
                    <List size={14} />
                    My Reports
                  </Link>
                  <Link
                    to="/profile"
                    className={`btn btn-sm ${location.pathname === '/profile' ? 'btn-primary' : 'btn-outline'}`}
                    id="nav-link-profile"
                  >
                    <User size={14} />
                    Profile
                  </Link>
                </>
              )}

              {(role === 'STAFF' || role === 'ADMIN') && (
                <>
                  <Link
                    to="/staff/cases"
                    className={`btn btn-sm ${location.pathname.startsWith('/staff/cases') ? 'btn-primary' : 'btn-outline'}`}
                    id="nav-link-staff-cases"
                  >
                    <Briefcase size={14} />
                    Cases
                  </Link>
                  <Link
                    to="/staff/routing-review"
                    className={`btn btn-sm ${location.pathname === '/staff/routing-review' ? 'btn-primary' : 'btn-outline'}`}
                    id="nav-link-review-queue"
                  >
                    <ShieldAlert size={14} />
                    Review Queue
                  </Link>
                  <Link
                    to="/profile"
                    className={`btn btn-sm ${location.pathname === '/profile' ? 'btn-primary' : 'btn-outline'}`}
                    id="nav-link-profile"
                  >
                    <User size={14} />
                    Profile
                  </Link>
                </>
              )}
            </nav>
          )}
        </div>

        {isAuthenticated && user && (
          <div className="nav-user" style={{ position: 'relative' }}>
            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="btn btn-outline btn-sm"
                style={{
                  padding: '0.45rem',
                  borderRadius: '50%',
                  color: showNotifications ? 'var(--primary)' : 'var(--text-muted)',
                  borderColor: showNotifications ? 'var(--primary)' : 'var(--border-subtle)',
                }}
                title="Notifications"
                id="navbar-notifications-btn"
              >
                <Bell size={16} />
              </button>

              {/* Notification Popover */}
              {showNotifications && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '300px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)',
                    zIndex: 100,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Notifications</span>
                    <span style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <CheckCircle2 size={12} /> Live Connected
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45, margin: 0 }}>
                    Real-time status alerts and citizen resolution verification requests appear automatically on your report tracking pages.
                  </p>
                  <div style={{ marginTop: '0.85rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', textAlign: 'right' }}>
                    <Link
                      to="/my-reports"
                      onClick={() => setShowNotifications(false)}
                      style={{ fontSize: '0.75rem', color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}
                    >
                      View All Reports →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <Link to="/profile" style={{ textDecoration: 'none' }} title="View Profile">
              <div className="user-info">
                <span className="user-name" style={{ color: 'var(--text-main)', cursor: 'pointer' }}>{user.name}</span>
                <span className="user-email">{user.email}</span>
              </div>
            </Link>

            <RoleBadge role={role} />

            {import.meta.env.DEV && (
              role === 'CITIZEN' ? (
                <button
                  type="button"
                  onClick={() => switchDevRole('staff@mysuru.civicflow.in')}
                  className="btn btn-outline btn-sm"
                  style={{ borderColor: 'rgba(245, 158, 11, 0.5)', color: '#fcd34d', fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
                  title="Switch session to Staff (Dev)"
                  id="nav-switch-staff"
                >
                  ⚡ Staff Mode
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => switchDevRole('citizen@mysuru.civicflow.in')}
                  className="btn btn-outline btn-sm"
                  style={{ borderColor: 'rgba(59, 130, 246, 0.5)', color: '#93c5fd', fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
                  title="Switch session to Citizen (Dev)"
                  id="nav-switch-citizen"
                >
                  ⚡ Citizen Mode
                </button>
              )
            )}

            <button
              onClick={logout}
              className="btn btn-danger-outline btn-sm"
              title="Sign out of CivicFlow"
              id="logout-button"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
