import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  User,
  Mail,
  Shield,
  FileText,
  CheckCircle2,
  Clock,
  PlusCircle,
  List,
  LogOut,
  MapPin,
  Calendar,
} from 'lucide-react';

export const Profile = () => {
  const { user, role, token, logout } = useAuth();
  const [stats, setStats] = useState({ total: 0, active: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.getMyReports(token);
        if (res.ok && Array.isArray(res.data?.reports)) {
          const reports = res.data.reports;
          const total = reports.length;
          const resolved = reports.filter((r) =>
            ['RESOLVED', 'CLOSED', 'VERIFIED'].includes(r.status)
          ).length;
          const active = total - resolved;
          setStats({ total, active, resolved });
        }
      } catch (err) {
        console.warn('Could not load profile statistics:', err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchStats();
    }
  }, [token]);

  const getRoleDisplayName = (r) => {
    switch (r) {
      case 'CITIZEN':
        return 'Verified Citizen';
      case 'STAFF':
        return 'Municipal Staff Member';
      case 'ADMIN':
        return 'System Administrator';
      default:
        return r || 'Citizen';
    }
  };

  return (
    <div className="main-content">
      <div style={{ maxWidth: '780px', margin: '0 auto', paddingBottom: '3rem' }}>
        
        {/* Profile Header Card */}
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 15, 30, 0.95) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            padding: '2rem',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {/* Avatar Circle */}
            <div
              style={{
                width: '76px',
                height: '76px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                fontWeight: 800,
                boxShadow: '0 4px 20px rgba(37, 99, 235, 0.4)',
                flexShrink: 0,
              }}
            >
              {user?.name ? user.name.charAt(0).toUpperCase() : 'C'}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  {user?.name || 'Citizen'}
                </h2>
                <span
                  style={{
                    padding: '0.2rem 0.65rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    background: role === 'CITIZEN' ? 'rgba(37, 99, 235, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    color: role === 'CITIZEN' ? '#93c5fd' : '#fcd34d',
                    border: `1px solid ${role === 'CITIZEN' ? '#3b82f6' : '#f59e0b'}`,
                  }}
                >
                  {getRoleDisplayName(role)}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Mail size={15} /> {user?.email}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <MapPin size={15} /> Mysuru, Karnataka
                </span>
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '1rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              paddingTop: '1.5rem',
            }}
          >
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>
                <FileText size={15} /> Total Reports
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ffffff', marginTop: '0.35rem' }}>
                {loading ? '—' : stats.total}
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#fcd34d', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>
                <Clock size={15} /> Active Cases
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#fcd34d', marginTop: '0.35rem' }}>
                {loading ? '—' : stats.active}
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#6ee7b7', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>
                <CheckCircle2 size={15} /> Resolved Cases
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#6ee7b7', marginTop: '0.35rem' }}>
                {loading ? '—' : stats.resolved}
              </div>
            </div>
          </div>
        </div>

        {/* Account Details & Preferences */}
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.75rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', margin: '0 0 1.25rem 0' }}>
            Account Information
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Full Legal / Display Name</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '0.9rem' }}>{user?.name}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Registered Email Address</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '0.9rem' }}>{user?.email}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Account Role</span>
              <span style={{ color: '#93c5fd', fontWeight: 600, fontSize: '0.9rem' }}>{getRoleDisplayName(role)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Jurisdiction Region</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '0.9rem' }}>Mysuru District, Karnataka</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Account Verification</span>
              <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <CheckCircle2 size={16} /> Active & Verified
              </span>
            </div>
          </div>
        </div>

        {/* Quick Navigation Actions */}
        <div className="card" style={{ padding: '1.75rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', margin: '0 0 1.25rem 0' }}>
            Actions & Settings
          </h3>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to="/report" className="btn btn-primary" id="profile-report-btn">
              <PlusCircle size={16} /> Report a Problem
            </Link>
            <Link to="/my-reports" className="btn btn-outline" id="profile-my-reports-btn">
              <List size={16} /> View My Reports
            </Link>
            <button onClick={logout} className="btn btn-danger-outline" id="profile-logout-btn">
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
