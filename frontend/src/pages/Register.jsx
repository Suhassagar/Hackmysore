import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, AlertCircle, ShieldCheck } from 'lucide-react';

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

    if (!email.trim()) {
      setLocalError('Email address is required.');
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    // MANDATORY: No role is sent or selectable by the user. Backend forces role = 'CITIZEN'
    const result = await register(name.trim(), email.trim(), password);
    if (result.success) {
      navigate('/');
    }
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

        <div className="alert alert-info" style={{ marginBottom: '1.25rem', fontSize: '0.8rem' }}>
          <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            Public registration assigns the <strong>CITIZEN</strong> role. Staff and Admin accounts are provisioned exclusively via administrative authorization.
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
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
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
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={loading}
            id="register-submit"
          >
            <UserPlus size={16} />
            {loading ? 'Registering Citizen Profile...' : 'Create Citizen Account'}
          </button>
        </form>

        <div className="form-footer">
          Already have an account?{' '}
          <Link to="/login" id="link-login">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
