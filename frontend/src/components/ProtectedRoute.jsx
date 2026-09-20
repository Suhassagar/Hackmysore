import React from 'react';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft, UserCheck } from 'lucide-react';

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, loading, role, user, switchDevRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p style={{ color: 'var(--text-muted)' }}>Verifying civic authentication session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return (
      <div className="app-main" style={{ padding: '3rem 1.5rem', display: 'flex', justifyContent: 'center' }}>
        <div className="card" style={{ maxWidth: '520px', width: '100%', textAlign: 'center', padding: '2.5rem 2rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              marginBottom: '1rem',
            }}
          >
            <ShieldAlert size={32} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>Access Restricted</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: '1rem', lineHeight: 1.5 }}>
            This page requires <strong>{allowedRoles.join(' or ')}</strong> role permissions.
            <br />
            You are currently signed in as: <strong style={{ color: '#ffffff' }}>{user?.email || 'Citizen'}</strong> ({role || 'CITIZEN'}).
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.25rem' }}>
            {allowedRoles.includes('STAFF') && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ justifyContent: 'center' }}
                onClick={() => switchDevRole('staff@mysuru.civicflow.in')}
                id="btn-switch-to-staff"
              >
                <UserCheck size={16} /> Switch to Staff Account (staff@mysuru.civicflow.in)
              </button>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <Link to="/login" state={{ from: location }} className="btn btn-outline btn-sm">
                Sign In with Different Account
              </Link>
              <Link to="/" className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <ArrowLeft size={14} /> Return to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return children;
};
