import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, AlertCircle, CheckCircle2 } from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const { login, switchDevRole, loading, authError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!email || !password) {
      setLocalError('Please enter both email address and password.');
      return;
    }

    const result = await login(email, password);
    if (result.success) {
      navigate('/');
    }
  };

  const handleQuickLogin = async (roleEmail) => {
    setLocalError('');
    await switchDevRole(roleEmail);
    navigate('/');
  };

  const displayError = localError || authError;

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <h1>CivicFlow</h1>
          <p>Report civic problems. Get them to the right authority.</p>
          <span className="auth-disclaimer">
            HackMysuru Prototype — Not affiliated with real MCC systems
          </span>
        </div>

        {displayError && (
          <div className="alert alert-error">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{displayError}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} id="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="e.g. citizen@mysuru.civicflow.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={loading}
            id="login-submit"
          >
            <LogIn size={16} />
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Quick evaluation shortcuts for hackathon judges & testers */}
        <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-faint)', marginBottom: '0.6rem', textAlign: 'center' }}>
            ⚡ Hackathon Quick Switcher (Pre-seeded Accounts):
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => handleQuickLogin('citizen@mysuru.civicflow.in')}
              id="quick-login-citizen"
            >
              Citizen
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => handleQuickLogin('staff@mysuru.civicflow.in')}
              id="quick-login-staff"
            >
              Staff
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => handleQuickLogin('admin@mysuru.civicflow.in')}
              id="quick-login-admin"
            >
              Admin
            </button>
          </div>
        </div>

        <div className="form-footer">
          Don't have an account?{' '}
          <Link to="/register" id="link-register">
            Register as a Citizen
          </Link>
        </div>
      </div>
    </div>
  );
};
