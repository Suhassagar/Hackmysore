import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { RoleBadge } from '../components/RoleBadge';
import { api } from '../services/api';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Terminal,
  RefreshCw,
  Clock,
  UserCheck,
  MapPin,
  FileText,
} from 'lucide-react';

export const Dashboard = () => {
  const { user, role, token, switchDevRole, refreshProfile } = useAuth();
  const [testResult, setTestResult] = useState(null);
  const [testingEndpoint, setTestingEndpoint] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  const runTest = async (endpointName, testFn) => {
    setIsTesting(true);
    setTestingEndpoint(endpointName);
    try {
      const res = await testFn(token);
      setTestResult({
        endpoint: endpointName,
        status: res.status,
        ok: res.ok,
        data: res.data,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      setTestResult({
        endpoint: endpointName,
        status: 500,
        ok: false,
        data: { error: 'Network Error', message: err.message },
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="main-content">
      {/* Header Banner */}
      <div className="dashboard-header">
        <h1 className="dashboard-title">Civic Accountability Dashboard</h1>
        <p className="dashboard-subtitle">
          Phase 1: Authenticated Session & Server-Side Role-Based Authorization
        </p>
      </div>

      {/* Dev Switcher for Hackathon Judges */}
      <div className="dev-role-switcher">
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
            🧪 Hackathon Role Switcher (Evaluation Console)
          </div>
          <div className="switcher-label">
            Switch test personas to immediately verify server-side 200 OK vs 403 Forbidden enforcement:
          </div>
        </div>
        <div className="switcher-buttons">
          <button
            type="button"
            className={`btn btn-sm ${role === 'CITIZEN' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => switchDevRole('citizen@mysuru.civicflow.in')}
            id="switch-to-citizen"
          >
            Citizen
          </button>
          <button
            type="button"
            className={`btn btn-sm ${role === 'STAFF' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => switchDevRole('staff@mysuru.civicflow.in')}
            id="switch-to-staff"
          >
            Staff
          </button>
          <button
            type="button"
            className={`btn btn-sm ${role === 'ADMIN' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => switchDevRole('admin@mysuru.civicflow.in')}
            id="switch-to-admin"
          >
            Admin
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="cards-grid">
        {/* Application User Profile Card */}
        <div className="card">
          <div className="card-title">
            <UserCheck size={20} color="#3b82f6" />
            <span>Authenticated Application Profile</span>
          </div>
          <p className="card-desc">
            Profile fetched via server-side <code>GET /api/users/me</code>. Role is authoritative from database.
          </p>

          <div className="detail-row">
            <span className="detail-key">Full Name</span>
            <span className="detail-val">{user?.name}</span>
          </div>
          <div className="detail-row">
            <span className="detail-key">Email</span>
            <span className="detail-val">{user?.email}</span>
          </div>
          <div className="detail-row">
            <span className="detail-key">Server-Verified Role</span>
            <span className="detail-val">
              <RoleBadge role={user?.role} />
            </span>
          </div>
          {user?.role === 'STAFF' && (
            <>
              <div className="detail-row">
                <span className="detail-key">Authority Scope</span>
                <span className="detail-val" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  {user?.authority_id ? user.authority_id : 'MCC (Mysuru City Corporation)'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Department Scope</span>
                <span className="detail-val" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  {user?.department_id ? user.department_id : 'Municipal Operations'}
                </span>
              </div>
            </>
          )}
          <div className="detail-row">
            <span className="detail-key">Internal User ID</span>
            <span className="detail-val" style={{ fontSize: '0.78rem' }}>
              {user?.id}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-key">Auth UID</span>
            <span className="detail-val" style={{ fontSize: '0.78rem' }}>
              {user?.authUid}
            </span>
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <button
              onClick={refreshProfile}
              className="btn btn-outline btn-sm"
              style={{ width: '100%' }}
              id="refresh-profile-button"
            >
              <RefreshCw size={14} /> Refresh Profile from Server
            </button>
          </div>
        </div>

        {/* Phase Boundary & Security Mandate */}
        <div className="card">
          <div className="card-title">
            <ShieldCheck size={20} color="#10b981" />
            <span>Security Architecture Mandate</span>
          </div>
          <p className="card-desc">
            Zero trust on client-side role parameters. All authorization decisions occur server-side.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
              <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Client-Role Agnostic:</strong> Client cannot alter role via request headers or body.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
              <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Default Citizen Policy:</strong> Public registration strictly provisions <code>CITIZEN</code>.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
              <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Protected Middleware:</strong> Reusable <code>requireAuth</code> & <code>requireRole</code> guards.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
              <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Session Persistence:</strong> Verified token stored in encrypted local storage.
              </div>
            </div>
          </div>
        </div>

        {/* Phase 2 Boundaries Notice */}
        <div className="card" style={{ borderStyle: 'dashed' }}>
          <div className="card-title">
            <Lock size={20} color="#94a3b8" />
            <span style={{ color: 'var(--text-muted)' }}>Phase 2 Boundary Guard</span>
          </div>
          <p className="card-desc">
            In compliance with hackathon Phase 1 guidelines, the following modules are deferred:
          </p>

          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.8' }}>
            <div>• Civic Incident Reporting & Photo Uploads (Phase 2)</div>
            <div>• Dynamic Jurisdiction Routing & PostGIS Lookup (Phase 2)</div>
            <div>• SLA Engine & Responsibility Rule Resolution (Phase 2)</div>
            <div>• AI Incident Classification with Gemini (Phase 3)</div>
          </div>
        </div>
      </div>

      {/* RBAC Verification Testing Console */}
      <div className="test-console-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Terminal size={22} color="#06b6d4" />
            <h2 style={{ fontSize: '1.25rem' }}>Role-Based Access Control (RBAC) Verification Console</h2>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Current Active Role: <strong>{role}</strong>
          </span>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
          Click the test buttons below to execute authenticated API calls directly to backend role-protected endpoints.
          The backend will verify the token, inspect the database role, and return <code>200 OK</code> or <code>403 Forbidden</code>.
        </p>

        <div className="console-actions">
          <button
            onClick={() => runTest('GET /api/auth/test/public', api.testPublic)}
            className="btn btn-outline btn-sm"
            disabled={isTesting}
            id="test-public-btn"
          >
            Test Public Endpoint
          </button>

          <button
            onClick={() => runTest('GET /api/users/me', (t) => api.getCurrentUser(t))}
            className="btn btn-outline btn-sm"
            disabled={isTesting}
            id="test-users-me-btn"
          >
            Test GET /api/users/me
          </button>

          <button
            onClick={() => runTest('GET /api/auth/test/citizen', (t) => api.testCitizen(t))}
            className="btn btn-outline btn-sm"
            style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}
            disabled={isTesting}
            id="test-citizen-btn"
          >
            Test Citizen Endpoint (All Roles)
          </button>

          <button
            onClick={() => runTest('GET /api/auth/test/staff', (t) => api.testStaff(t))}
            className="btn btn-outline btn-sm"
            style={{ borderColor: 'rgba(245, 158, 11, 0.4)' }}
            disabled={isTesting}
            id="test-staff-btn"
          >
            Test Staff Endpoint (STAFF, ADMIN)
          </button>

          <button
            onClick={() => runTest('GET /api/auth/test/admin', (t) => api.testAdmin(t))}
            className="btn btn-outline btn-sm"
            style={{ borderColor: 'rgba(139, 92, 246, 0.4)' }}
            disabled={isTesting}
            id="test-admin-btn"
          >
            Test Admin Endpoint (ADMIN Only)
          </button>
        </div>

        {testResult && (
          <div className="response-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div>
                <span
                  className={`response-status ${
                    testResult.status === 200
                      ? 'status-badge-200'
                      : testResult.status === 401
                      ? 'status-badge-401'
                      : 'status-badge-403'
                  }`}
                >
                  HTTP {testResult.status} {testResult.status === 200 ? 'OK' : testResult.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN'}
                </span>
                <span style={{ marginLeft: '0.75rem', color: 'var(--text-muted)' }}>
                  {testResult.endpoint}
                </span>
              </div>
              <span style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>
                {testResult.timestamp}
              </span>
            </div>

            <pre style={{ margin: 0, color: testResult.ok ? '#93c5fd' : '#fca5a5' }}>
              {JSON.stringify(testResult.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
