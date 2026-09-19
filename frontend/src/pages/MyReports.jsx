import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  List,
  MapPin,
  Clock,
  PlusCircle,
  ExternalLink,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export const MyReports = () => {
  const { token } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        const res = await api.getMyReports(token);
        if (res.ok && res.data?.reports) {
          setReports(res.data.reports);
        } else {
          setError(res.data?.message || 'Failed to load your civic reports.');
        }
      } catch (err) {
        setError(err.message || 'Network error fetching reports.');
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [token]);

  return (
    <div className="main-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', marginBottom: '0.35rem' }}>My Civic Reports</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Track the status of your reported civic problems in Mysuru.
          </p>
        </div>

        <Link to="/report" className="btn btn-primary" id="btn-create-new-report">
          <PlusCircle size={16} />
          New Report
        </Link>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div>{error}</div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
          Loading your submitted civic reports...
        </div>
      ) : reports.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <List size={40} color="var(--text-muted)" style={{ margin: '0 auto 1rem auto' }} />
          <h3>No Civic Reports Yet</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
            You have not submitted any civic incident reports yet.
          </p>
          <Link to="/report" className="btn btn-primary" id="first-report-cta">
            Report Your First Civic Issue
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {reports.map((report) => (
            <div key={report.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <span
                    style={{
                      background: 'rgba(37, 99, 235, 0.15)',
                      color: '#93c5fd',
                      border: '1px solid rgba(37, 99, 235, 0.3)',
                      padding: '0.2rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}
                  >
                    {report.category}
                  </span>

                  <span
                    style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: 'var(--status-200)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      padding: '0.2rem 0.6rem',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                    }}
                  >
                    {report.status}
                  </span>
                </div>

                <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '1rem', lineHeight: '1.5' }}>
                  {report.description.length > 120
                    ? `${report.description.slice(0, 120)}...`
                    : report.description}
                </p>

                {report.photoUrl && (
                  <div style={{ marginBottom: '1rem' }}>
                    <img
                      src={report.photoUrl}
                      alt="Civic evidence"
                      style={{
                        width: '100%',
                        height: '140px',
                        objectFit: 'cover',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    />
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Clock size={13} />
                    <span>Reported: {new Date(report.reportedAt).toLocaleDateString()} at {new Date(report.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <MapPin size={13} />
                    <span>
                      {report.location?.status === 'VERIFIED_COORDINATES'
                        ? `GPS: ${report.location.latitude}, ${report.location.longitude}`
                        : 'Location: Not Provided'}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <Link
                    to={`/reports/${report.id}`}
                    className="btn btn-outline btn-sm"
                    style={{ width: '100%' }}
                    id={`view-report-${report.id}`}
                  >
                    <ExternalLink size={14} />
                    View Report Details
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
