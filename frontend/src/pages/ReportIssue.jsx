import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  AlertTriangle,
  Camera,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Upload,
  X,
  Navigation,
  FileText,
  HelpCircle,
  Lightbulb,
  Trash2,
  Droplet,
} from 'lucide-react';

const CATEGORIES = [
  { id: 'POTHOLE', label: 'Pothole / Damaged Road', icon: <AlertTriangle size={18} /> },
  { id: 'BLOCKED_DRAIN', label: 'Blocked Drain / Overflow', icon: <Droplet size={18} /> },
  { id: 'GARBAGE_OVERFLOW', label: 'Garbage Overflow', icon: <Trash2 size={18} /> },
  { id: 'BROKEN_STREETLIGHT', label: 'Broken Streetlight', icon: <Lightbulb size={18} /> },
  { id: 'ILLEGAL_DUMPING', label: 'Illegal Dumping', icon: <AlertCircle size={18} /> },
  { id: 'OTHER', label: 'Other Civic Issue', icon: <FileText size={18} /> },
];

export const ReportIssue = () => {
  const { token, role } = useAuth();
  const navigate = useNavigate();

  // Form State
  const [category, setCategory] = useState('POTHOLE');
  const [isUnsureCategory, setIsUnsureCategory] = useState(false);
  const [description, setDescription] = useState('');
  const [photoData, setPhotoData] = useState(null);
  const [photoName, setPhotoName] = useState('');

  // Location State
  const [location, setLocation] = useState(null); // { latitude, longitude, accuracy }
  const [locationStatus, setLocationStatus] = useState('UNSET'); // UNSET, DETECTING, DETECTED, DENIED, MANUAL
  const [locationError, setLocationError] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedReport, setSubmittedReport] = useState(null);

  // If user is not a CITIZEN, display notice
  if (role !== 'CITIZEN') {
    return (
      <div className="main-content">
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 1rem auto' }} />
          <h2>Citizen-Only Feature</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
            Only authenticated citizens are authorized to submit new civic issue reports.
            Your current role is <strong>{role}</strong>.
          </p>
          <Link to="/" className="btn btn-primary">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Handle Photo Selection
  const handlePhotoSelect = (e) => {
    setErrorMsg('');
    const file = e.target.files[0];
    if (!file) return;

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image file size exceeds the 5MB limit. Please choose a smaller photo.');
      return;
    }

    // Validate MIME
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setErrorMsg('Unsupported image format. Please attach a JPEG, PNG, or WEBP image.');
      return;
    }

    setPhotoName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoData(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoData(null);
    setPhotoName('');
  };

  // Handle Geolocation Capture
  const handleDetectLocation = () => {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationStatus('DENIED');
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setLocationStatus('DETECTING');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const detected = {
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          accuracy: Math.round(position.coords.accuracy),
        };
        setLocation(detected);
        setLocationStatus('DETECTED');
      },
      (error) => {
        setLocationStatus('DENIED');
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError('Location access was denied. You can manually enter coordinates below.');
        } else {
          setLocationError('Could not obtain location. Please enter coordinates manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Handle Manual Location Application
  const handleApplyManualLocation = (e) => {
    e.preventDefault();
    setLocationError('');
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setLocationError('Invalid latitude. Must be between -90 and 90.');
      return;
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      setLocationError('Invalid longitude. Must be between -180 and 180.');
      return;
    }

    setLocation({
      latitude: lat,
      longitude: lng,
      accuracy: 50, // estimated manual accuracy
    });
    setLocationStatus('MANUAL');
  };

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return; // Prevent double-clicks

    setErrorMsg('');

    // Description validation
    const trimmedDesc = description.trim();
    if (trimmedDesc.length < 10) {
      setErrorMsg('Please describe the problem in at least 10 characters.');
      return;
    }

    if (trimmedDesc.length > 1000) {
      setErrorMsg('Description must be 1000 characters or fewer.');
      return;
    }

    const finalCategory = isUnsureCategory ? 'OTHER' : category;

    const payload = {
      category: finalCategory,
      description: trimmedDesc,
      photoData: photoData || null,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      accuracy: location?.accuracy ?? null,
      locationStatus: location ? 'VERIFIED_COORDINATES' : 'LOCATION_MISSING',
    };

    setSubmitting(true);

    try {
      const res = await api.createReport(payload, token);
      if (res.ok && res.data?.id) {
        setSubmittedReport(res.data);
      } else {
        setErrorMsg(res.data?.message || 'Failed to submit report. Please try again.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error occurred while submitting.');
    } finally {
      setSubmitting(false);
    }
  };

  // If submitted successfully, show Confirmation Screen
  if (submittedReport) {
    return (
      <div className="main-content">
        <div className="card" style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center', padding: '2.5rem' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.2)',
              border: '2px solid var(--status-200)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem auto',
              color: 'var(--status-200)',
            }}
          >
            <CheckCircle2 size={32} />
          </div>

          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>✓ Report Submitted</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.75rem' }}>
            Your civic problem report has been recorded in the CivicFlow system.
          </p>

          <div
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              textAlign: 'left',
              marginBottom: '1.75rem',
            }}
          >
            <div className="detail-row">
              <span className="detail-key">Report ID</span>
              <span className="detail-val" style={{ fontFamily: 'monospace' }}>
                {submittedReport.id}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Category</span>
              <span className="detail-val">{submittedReport.category}</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Current Status</span>
              <span className="detail-val" style={{ color: 'var(--accent-cyan)' }}>
                {submittedReport.status} (Received)
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Coordinates</span>
              <span className="detail-val">
                {submittedReport.location?.latitude && submittedReport.location?.longitude
                  ? `${submittedReport.location.latitude}, ${submittedReport.location.longitude}`
                  : 'Coordinates Not Provided'}
              </span>
            </div>
          </div>

          <div
            className="alert alert-info"
            style={{ textAlign: 'left', marginBottom: '1.75rem', fontSize: '0.82rem' }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Auditable Journey Notice:</strong> Your report is currently recorded as an individual citizen
              submission. In subsequent phases, it will be automatically analyzed and routed to the responsible civic
              authority (MCC or Panchayat).
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <Link to={`/reports/${submittedReport.id}`} className="btn btn-primary" id="view-report-detail-btn">
              View Report Details
            </Link>
            <Link to="/my-reports" className="btn btn-outline" id="view-all-my-reports-btn">
              My Reports
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1.75rem' }}>
          <h1 style={{ fontSize: '1.85rem', marginBottom: '0.35rem' }}>Report a Civic Issue</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Submit a civic problem in Mysuru. Fill out the details below in under a minute.
          </p>
        </div>

        {errorMsg && (
          <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{errorMsg}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} id="citizen-report-form">
          {/* STEP 1: CATEGORY */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                  }}
                >
                  1
                </span>
                <h3 style={{ fontSize: '1.1rem' }}>What happened? (Issue Category)</h3>
              </div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isUnsureCategory}
                  onChange={(e) => setIsUnsureCategory(e.target.checked)}
                  id="category-unsure-checkbox"
                />
                Not sure (Map to Other)
              </label>
            </div>

            {!isUnsureCategory ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem' }}>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`btn ${category === cat.id ? 'btn-primary' : 'btn-outline'}`}
                    style={{ justifyContent: 'flex-start', padding: '0.75rem 1rem', fontSize: '0.85rem' }}
                    id={`category-btn-${cat.id.toLowerCase()}`}
                  >
                    {cat.icon}
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                ℹ️ Category will be recorded as <strong>OTHER</strong> and classified dynamically in future phases.
              </div>
            )}
          </div>

          {/* STEP 2: DESCRIPTION */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}
              >
                2
              </span>
              <h3 style={{ fontSize: '1.1rem' }}>Tell us what you saw (Description)</h3>
            </div>

            <textarea
              className="form-input"
              rows={4}
              placeholder="e.g. Large pothole near the college entrance. Two-wheelers are having difficulty passing through..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              required
              id="report-description"
              style={{ resize: 'vertical' }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
              <span>Minimum 10 characters required</span>
              <span>{description.length} / 1000 characters</span>
            </div>
          </div>

          {/* STEP 3: PHOTO EVIDENCE */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}
              >
                3
              </span>
              <h3 style={{ fontSize: '1.1rem' }}>Add a photo (Evidence)</h3>
            </div>

            {!photoData ? (
              <label
                style={{
                  border: '2px dashed var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                  background: 'rgba(255, 255, 255, 0.01)',
                }}
                id="photo-upload-label"
              >
                <Camera size={32} color="var(--primary)" />
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Click to capture or upload photo</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                  Accepts JPEG, PNG, WEBP (Max 5MB)
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={handlePhotoSelect}
                  style={{ display: 'none' }}
                  id="report-photo-input"
                />
              </label>
            ) : (
              <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                <img
                  src={photoData}
                  alt="Civic evidence preview"
                  style={{
                    width: '100%',
                    maxHeight: '260px',
                    objectFit: 'cover',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                  id="photo-preview"
                />
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="btn btn-danger-outline"
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'rgba(15, 23, 42, 0.85)',
                  }}
                  id="remove-photo-btn"
                >
                  <X size={14} /> Remove Photo
                </button>
                <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Attached: {photoName}
                </div>
              </div>
            )}
          </div>

          {/* STEP 4: LOCATION */}
          <div className="card" style={{ marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}
              >
                4
              </span>
              <h3 style={{ fontSize: '1.1rem' }}>Where is it? (Exact Location)</h3>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Accurate coordinates are essential for our upcoming Dynamic Routing Engine to identify whether MCC or a
              Panchayat is responsible.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleDetectLocation}
                disabled={locationStatus === 'DETECTING'}
                id="use-current-location-btn"
              >
                <Navigation size={16} />
                {locationStatus === 'DETECTING' ? 'Detecting GPS...' : 'Use my current location'}
              </button>

              {location && (
                <div
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: 'var(--role-citizen-bg)',
                    border: '1px solid var(--role-citizen-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--role-citizen)',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                  id="location-detected-badge"
                >
                  <MapPin size={14} />
                  <span>
                    Location detected: <strong>{location.latitude}, {location.longitude}</strong> (Accuracy: ~{location.accuracy}m)
                  </span>
                </div>
              )}
            </div>

            {/* Geolocation Denial or Fallback */}
            {locationStatus === 'DENIED' && (
              <div className="alert alert-error" style={{ marginBottom: '1rem', fontSize: '0.82rem' }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  {locationError} You may enter coordinates manually below.
                </div>
              </div>
            )}

            {/* Manual Coordinate Inputs */}
            <div
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
              }}
            >
              <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                📍 Or enter coordinates manually (Mysuru: ~12.30, ~76.65):
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.6rem' }}>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  placeholder="Latitude (e.g. 12.3051)"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  id="manual-lat-input"
                />
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  placeholder="Longitude (e.g. 76.6551)"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                  id="manual-lng-input"
                />
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleApplyManualLocation}
                  id="apply-manual-loc-btn"
                >
                  Set
                </button>
              </div>
            </div>
          </div>

          {/* STEP 5: SUBMIT */}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.9rem', fontSize: '1rem' }}
            disabled={submitting}
            id="submit-report-btn"
          >
            {submitting ? 'Submitting Civic Report...' : 'Submit Civic Report'}
          </button>
        </form>
      </div>
    </div>
  );
};
