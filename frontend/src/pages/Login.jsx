import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, AlertCircle, Activity, HelpCircle, X } from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const { login, loading, authError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!email.trim() || !password) {
      setLocalError('Please enter both email address and password.');
      return;
    }

    const result = await login(email.trim(), password);
    if (result.success) {
      navigate('/');
    }
  };

  const displayError = localError || authError;

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card">
        <div className="auth-header" style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'rgba(59, 130, 246, 0.1)',
              color: 'var(--primary)',
              marginBottom: '0.6rem',
            }}
          >
            <Activity size={24} />
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
            CivicFlow
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
            Smart Civic Issue Resolution
          </p>

          <div
            style={{
              height: '1px',
              background: 'var(--border-subtle)',
              margin: '1.25rem 0 1rem 0',
            }}
          />

          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Sign in to your account
          </h2>
        </div>

        {displayError && (
          <div className="alert alert-error" style={{ marginTop: '1rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{displayError}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} id="login-form" style={{ marginTop: '1rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="e.g. citizen@mysuru.civicflow.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" htmlFor="login-password" style={{ marginBottom: 0 }}>
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'none',
                }}
                id="link-forgot-password"
              >
                Forgot password?
              </button>
            </div>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
              style={{ marginTop: '0.4rem' }}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.75rem' }}
            disabled={loading}
            id="login-submit"
          >
            <LogIn size={16} />
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div
          style={{
            height: '1px',
            background: 'var(--border-subtle)',
            margin: '1.5rem 0 1rem 0',
          }}
        />

        <div className="form-footer" style={{ textAlign: 'center', fontSize: '0.88rem' }}>
          Don't have an account?{' '}
          <Link to="/register" id="link-register" style={{ fontWeight: 600 }}>
            Create a citizen account
          </Link>
        </div>

        {/* Development Helper: Collapsed accordion strictly in development mode */}
        {import.meta.env.DEV && (
          <details
            style={{
              marginTop: '1.25rem',
              fontSize: '0.78rem',
              color: 'var(--text-faint)',
              borderTop: '1px dashed var(--border-subtle)',
              paddingTop: '0.75rem',
            }}
          >
            <summary style={{ cursor: 'pointer', textAlign: 'center', opacity: 0.75 }}>
              ⚡ Developer Testing Credentials (Dev Mode)
            </summary>
            <div
              style={{
                marginTop: '0.6rem',
                padding: '0.6rem',
                background: 'rgba(0, 0, 0, 0.03)',
                borderRadius: '6px',
              }}
            >
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem' }}>
                Pre-seeded test password: <code>CivicFlow@2026</code>
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.35rem' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setEmail('citizen@mysuru.civicflow.in');
                    setPassword('CivicFlow@2026');
                  }}
                  id="fill-citizen-creds"
                >
                  Citizen
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setEmail('staff@mysuru.civicflow.in');
                    setPassword('CivicFlow@2026');
                  }}
                  id="fill-staff-creds"
                >
                  Staff
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setEmail('admin@mysuru.civicflow.in');
                    setPassword('CivicFlow@2026');
                  }}
                  id="fill-admin-creds"
                >
                  Admin
                </button>
              </div>
            </div>
          </details>
        )}
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <HelpCircle size={20} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Password Assistance</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              For citizen accounts, please contact your local ward civic assistance center with proof of identification.
            </p>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              For municipal Staff and Administrator accounts, password resets are processed strictly by the Department IT Security Officer.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '1rem' }}
              onClick={() => setShowForgotModal(false)}
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
