import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, AlertCircle, ShieldCheck, Activity } from 'lucide-react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const { register, loading, authError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!name.trim()) {
      setLocalError('Full name is required.');
      return;
    }

    if (!email.trim() || !EMAIL_REGEX.test(email.trim())) {
      setLocalError('Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    // MANDATORY: No role is sent or selectable by the user. Backend strictly forces role = 'CITIZEN'
    const result = await register(name.trim(), email.trim(), password);
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
            Create a Citizen Account
          </h2>
        </div>

        {displayError && (
          <div className="alert alert-error" style={{ marginTop: '1rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{displayError}</div>
          </div>
        )}

        <div
          className="alert alert-info"
          style={{
            margin: '1rem 0',
            fontSize: '0.8rem',
            lineHeight: 1.45,
            display: 'flex',
            gap: '0.5rem',
          }}
        >
          <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            Public registration assigns the <strong>CITIZEN</strong> role. Staff and Administrative accounts are provisioned exclusively by municipal department administrators.
          </div>
        </div>

        <form onSubmit={handleSubmit} id="register-form">
          <div className="form-group">
            <label className="form-label" htmlFor="register-name">
              Full Name
            </label>
            <input
              id="register-name"
              type="text"
              className="form-input"
              placeholder="e.g. Ananya Rao"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              autoComplete="name"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-email">
              Email Address
            </label>
            <input
              id="register-email"
              type="email"
              className="form-input"
              placeholder="e.g. ananya@mysuru.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-password">
              Password
            </label>
            <input
              id="register-password"
              type="password"
              className="form-input"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-confirm-password">
              Confirm Password
            </label>
            <input
              id="register-confirm-password"
              type="password"
              className="form-input"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.75rem' }}
            disabled={loading}
            id="register-submit"
          >
            <UserPlus size={16} />
            {loading ? 'Creating account...' : 'Create Citizen Account'}
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
          Already have an account?{' '}
          <Link to="/login" id="link-login" style={{ fontWeight: 600 }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
