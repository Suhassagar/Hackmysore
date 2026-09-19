import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RoleBadge } from './RoleBadge';
import { LogOut, Activity, PlusCircle, List, LayoutDashboard, ShieldAlert } from 'lucide-react';

export const Navbar = () => {
  const { user, role, logout, isAuthenticated } = useAuth();
  const location = useLocation();

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
            <nav style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Link
                to="/"
                className={`btn btn-sm ${location.pathname === '/' ? 'btn-primary' : 'btn-outline'}`}
                id="nav-link-dashboard"
              >
                <LayoutDashboard size={14} />
                Dashboard
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
                </>
              )}

              {(role === 'STAFF' || role === 'ADMIN') && (
                <Link
                  to="/staff/routing-review"
                  className={`btn btn-sm ${location.pathname === '/staff/routing-review' ? 'btn-primary' : 'btn-outline'}`}
                  id="nav-link-review-queue"
                >
                  <ShieldAlert size={14} />
                  Review Queue
                </Link>
              )}
            </nav>
          )}
        </div>

        {isAuthenticated && user && (
          <div className="nav-user">
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-email">{user.email}</span>
            </div>

            <RoleBadge role={role} />

            <button
              onClick={logout}
              className="btn btn-danger-outline"
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
