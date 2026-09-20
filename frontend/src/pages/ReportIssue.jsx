import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { offlineQueue } from '../services/offlineQueue';
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
  Lightbulb,
  Trash2,
  Droplet,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Info,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react';

const CATEGORIES = [
  { id: 'POTHOLE', label: 'Pothole / Road Damage', description: 'Craters, road cave-ins, loose asphalt', icon: <AlertTriangle size={20} /> },
  { id: 'BLOCKED_DRAIN', label: 'Blocked Drain / Overflow', description: 'Clogged storm gutters, sewage water', icon: <Droplet size={20} /> },
  { id: 'GARBAGE_OVERFLOW', label: 'Garbage Overflow', description: 'Uncollected bins, roadside waste accumulation', icon: <Trash2 size={20} /> },
  { id: 'BROKEN_STREETLIGHT', label: 'Broken Streetlight', description: 'Dark lamp posts, flickering streetlamps', icon: <Lightbulb size={20} /> },
  { id: 'ILLEGAL_DUMPING', label: 'Illegal Dumping', description: 'Construction debris, unauthorized dump sites', icon: <AlertCircle size={20} /> },
  { id: 'OTHER', label: 'Other Civic Issue', description: 'Any other neighborhood infrastructure issue', icon: <FileText size={20} /> },
];

export const ReportIssue = () => {
  const { token, role } = useAuth();
  const navigate = useNavigate();

  // Wizard Step: 1 = What, 2 = Where, 3 = Evidence, 4 = Review, 5 = Confirmation
  const [currentStep, setCurrentStep] = useState(1);

  // Form State
  const [category, setCategory] = useState('POTHOLE');
  const [description, setDescription] = useState('');
  const [photoData, setPhotoData] = useState(null);
  const [photoName, setPhotoName] = useState('');

  // Location State
  const [locationMode, setLocationMode] = useState('gps'); // 'gps' | 'manual'
  const [location, setLocation] = useState(null); // { latitude, longitude, accuracy }
  const [locationStatus, setLocationStatus] = useState('UNSET'); // UNSET, DETECTING, DETECTED, DENIED
  const [locationError, setLocationError] = useState('');
  const [manualArea, setManualArea] = useState('');
  const [manualLat, setManualLat] = useState('12.3118');
  const [manualLng, setManualLng] = useState('76.6529');

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedReport, setSubmittedReport] = useState(null);

  // Phase 3B: Offline Queue State
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState('');

  useEffect(() => {
    const checkPending = async () => {
      try {
        const pending = await offlineQueue.getPendingReports();
        setPendingOfflineCount(pending.length);
      } catch (_) {}
    };

    checkPending();

    const handleOnline = () => {
      setIsOnline(true);
      checkPending();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const cleanupSync = offlineQueue.setupAutoSync(
      () => token,
      (res) => {
        checkPending();
        if (res && res.synced > 0) {
          setSyncFeedback(`Successfully synchronized ${res.synced} offline report(s)!`);
        }
      }
    );

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (cleanupSync) cleanupSync();
    };
  }, [token]);

  const handleManualSync = async () => {
    if (syncingOffline || !token) return;
    setSyncingOffline(true);
    setSyncFeedback('');
    try {
      const res = await offlineQueue.syncQueue(token);
      const pending = await offlineQueue.getPendingReports();
      setPendingOfflineCount(pending.length);
      if (res.synced > 0) {
        setSyncFeedback(`Synced ${res.synced} report(s) successfully.`);
      } else if (res.failed > 0) {
        setSyncFeedback(`Sync completed with ${res.failed} issues.`);
      } else {
        setSyncFeedback('All reports are up to date.');
      }
    } catch (err) {
      setSyncFeedback(`Sync failed: ${err.message}`);
    } finally {
      setSyncingOffline(false);
    }
  };

  // Handle Photo Selection
  const handlePhotoSelect = (e) => {
    setErrorMsg('');
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image file size exceeds the 5MB limit. Please choose a smaller photo.');
      return;
    }

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

  // Handle Geolocation Detection
  const handleDetectLocation = () => {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationStatus('DENIED');
      setLocationError("Geolocation is not supported by your browser. You can enter the location manually.");
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
          setLocationError("Location access was denied. Please enter the location manually below.");
        } else {
          setLocationError("We couldn't determine your location. Please enter it manually below.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Step 1 Validation
  const validateStep1 = () => {
    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      setErrorMsg('Please describe what you noticed so we can route the issue correctly.');
      return false;
    }
    if (trimmedDesc.length < 10) {
      setErrorMsg('Please provide a slightly more detailed description (at least 10 characters).');
      return false;
    }
    if (trimmedDesc.length > 1000) {
      setErrorMsg('Description must be 1000 characters or fewer.');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  // Step 2 Validation
  const validateStep2 = () => {
    setErrorMsg('');
    if (locationMode === 'manual') {
      const lat = parseFloat(manualLat);
      const lng = parseFloat(manualLng);
      if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
        setErrorMsg('Please enter valid coordinates or landmark in Mysuru.');
        return false;
      }
      setLocation({
        latitude: lat,
        longitude: lng,
        accuracy: 50,
      });
    } else {
      if (!location) {
        // Fallback default coordinates for Mysuru city center if GPS not granted
        setLocation({
          latitude: 12.3118,
          longitude: 76.6529,
          accuracy: 100,
        });
      }
    }
    return true;
  };

  // Handle Form Submission
  const handleSubmitReport = async () => {
    if (submitting) return;

    setErrorMsg('');
    setSubmitting(true);

    const payload = {
      category,
      description: description.trim(),
      photoData: photoData || null,
      latitude: location?.latitude ?? 12.3118,
      longitude: location?.longitude ?? 76.6529,
      accuracy: location?.accuracy ?? 50,
      locationStatus: 'VERIFIED_COORDINATES',
    };

    try {
      if (!navigator.onLine) {
        const queued = await offlineQueue.enqueueReport(payload);
        const pending = await offlineQueue.getPendingReports();
        setPendingOfflineCount(pending.length);
        setSubmittedReport({
          ...payload,
          id: queued.id,
          status: 'SAVED_LOCALLY',
          isOfflineQueued: true,
        });
        setCurrentStep(5);
        return;
      }

      const res = await api.createReport(payload, token);
      if (res.ok && res.data?.id) {
        setSubmittedReport(res.data);
        setCurrentStep(5);
      } else {
        setErrorMsg(res.data?.message || "We couldn't submit your report. Please check your information and try again.");
      }
    } catch (err) {
      try {
        const queued = await offlineQueue.enqueueReport(payload);
        const pending = await offlineQueue.getPendingReports();
        setPendingOfflineCount(pending.length);
        setSubmittedReport({
          ...payload,
          id: queued.id,
          status: 'SAVED_LOCALLY',
          isOfflineQueued: true,
        });
        setCurrentStep(5);
      } catch (queueErr) {
        setErrorMsg("Network error and local queue saving failed: " + queueErr.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCategoryObj = CATEGORIES.find((c) => c.id === category);

  // ==============================================================
  // STEP 5: CONFIRMATION & REAL-TIME PROCESSING EXPERIENCE
  // ==============================================================
  if (currentStep === 5 && submittedReport) {
    const isOffline = submittedReport.isOfflineQueued;
    const formattedId = isOffline
      ? `LOCAL-${String(submittedReport.id).slice(0, 8).toUpperCase()}`
      : submittedReport.case?.case_number || `CIV-2026-${String(submittedReport.id).slice(0, 8).toUpperCase()}`;

    return (
      <div className="main-content">
        <div className="card" style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center', padding: '2.5rem 2rem' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: isOffline ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              border: `2px solid ${isOffline ? '#f59e0b' : '#10b981'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto',
              color: isOffline ? '#f59e0b' : '#10b981',
            }}
          >
            {isOffline ? <WifiOff size={36} /> : <CheckCircle2 size={36} />}
          </div>

          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.4rem 0' }}>
            {isOffline ? 'Report Saved Offline' : 'Report Submitted Successfully'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
            {isOffline
              ? 'Your report is safely preserved in your browser and will automatically synchronize with municipal servers once your connection is restored.'
              : 'Your civic report has been received by CivicFlow and registered in the municipal resolution pipeline.'}
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
              <span className="detail-key">{isOffline ? 'Local Queue ID' : 'Report Tracking ID'}</span>
              <span className="detail-val" style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                {formattedId}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Identified Problem</span>
              <span className="detail-val">{selectedCategoryObj?.label}</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Current Status</span>
              <span className="detail-val" style={{ color: isOffline ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
                {isOffline ? 'Queued Locally (Pending Reconnect)' : 'Received & Processing'}
              </span>
            </div>
          </div>

          {/* Real-time automated workflow progress */}
          {!isOffline ? (
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.05)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                textAlign: 'left',
                marginBottom: '1.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                <Sparkles size={16} color="var(--primary)" />
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  Automated Processing Journey
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#10b981' }}>
                  <Check size={15} />
                  <span>Report received and securely stored in CivicFlow</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#10b981' }}>
                  <Check size={15} />
                  <span>Issue analyzed &amp; categorized by civic AI</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--accent-cyan)' }}>
                  <div className="spinner" style={{ width: '13px', height: '13px', borderWidth: '2px' }}></div>
                  <span>Determining responsible municipal department &amp; ward dispatch</span>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                textAlign: 'left',
                marginBottom: '1.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#f59e0b', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                <WifiOff size={16} /> Resilient Offline Storage
              </div>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8', lineHeight: '1.5' }}>
                No connection is required right now. CivicFlow will submit this report in the background with full duplicate detection and photos as soon as you are reconnected.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {!isOffline ? (
              <Link
                to={`/reports/${submittedReport.id}`}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                id="view-report-detail-btn"
              >
                Track Report Progress <ArrowRight size={15} />
              </Link>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setCurrentStep(1);
                  setDescription('');
                  setPhotoData(null);
                  setPhotoName('');
                  setSubmittedReport(null);
                }}
              >
                Submit Another Report
              </button>
            )}
            <Link to="/my-reports" className="btn btn-outline" id="view-all-my-reports-btn">
              View All My Reports
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        {/* Offline Banner & Queue Status */}
        {!isOnline && (
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1.15rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <WifiOff size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fbbf24' }}>
                Offline Mode Active
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                You are currently disconnected. You can still complete this report — it will be saved locally on your device and sent automatically when you are back online.
              </div>
            </div>
          </div>
        )}

        {isOnline && pendingOfflineCount > 0 && (
          <div
            style={{
              background: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1.15rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <RefreshCw size={18} color="#60a5fa" className={syncingOffline ? 'spin' : ''} />
              <div>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#93c5fd' }}>
                  {pendingOfflineCount} report(s) queued offline
                </span>
                {syncFeedback && (
                  <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>{syncFeedback}</div>
                )}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleManualSync}
              disabled={syncingOffline}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
            >
              {syncingOffline ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        )}
        {/* Step Progress Bar */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Step {currentStep} of 4
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {currentStep === 1 && 'What happened?'}
              {currentStep === 2 && 'Where is it?'}
              {currentStep === 3 && 'Add a photo'}
              {currentStep === 4 && 'Review & Submit'}
            </span>
          </div>

          <div style={{ height: '6px', background: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${(currentStep / 4) * 100}%`,
                background: 'linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)',
                transition: 'width 0.25s ease',
              }}
            />
          </div>
        </div>

        {errorMsg && (
          <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{errorMsg}</div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 1: WHAT HAPPENED?                                         */}
        {/* ============================================================== */}
        {currentStep === 1 && (
          <div className="card" style={{ padding: '2rem 1.75rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.35rem 0' }}>
              What problem are you reporting?
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Select the category that best matches what you observed.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '0.75rem',
                marginBottom: '1.75rem',
              }}
            >
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    style={{
                      background: isSelected ? 'rgba(37, 99, 235, 0.15)' : 'var(--bg-primary)',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        color: isSelected ? '#60a5fa' : 'var(--text-muted)',
                        marginTop: '2px',
                        flexShrink: 0,
                      }}
                    >
                      {cat.icon}
                    </div>
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: '0.92rem',
                          color: isSelected ? '#fff' : 'var(--text-main)',
                        }}
                      >
                        {cat.label}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {cat.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" htmlFor="issue-description" style={{ fontWeight: 600 }}>
                Describe the problem
              </label>
              <textarea
                id="issue-description"
                className="form-input"
                rows={4}
                placeholder="e.g. Large crater-like pothole in the left lane near the railway gate, forcing vehicles into oncoming traffic."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ resize: 'vertical', minHeight: '100px' }}
                required
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                <span>Minimum 10 characters</span>
                <span>{description.length} / 1000 characters</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (validateStep1()) setCurrentStep(2);
                }}
                id="btn-step1-next"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                Continue to Location <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 2: WHERE IS IT?                                           */}
        {/* ============================================================== */}
        {currentStep === 2 && (
          <div className="card" style={{ padding: '2rem 1.75rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.35rem 0' }}>
              Where is the problem located?
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Accurate location allows CivicFlow to match the issue to the correct ward and municipal department.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  setLocationMode('gps');
                  setLocationError('');
                }}
                className={`btn ${locationMode === 'gps' ? 'btn-primary' : 'btn-outline'}`}
                style={{ justifyContent: 'center' }}
              >
                <Navigation size={16} /> Use My Current Location
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocationMode('manual');
                  setLocationError('');
                }}
                className={`btn ${locationMode === 'manual' ? 'btn-primary' : 'btn-outline'}`}
                style={{ justifyContent: 'center' }}
              >
                <MapPin size={16} /> Enter Manually
              </button>
            </div>

            {locationMode === 'gps' && (
              <div
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.5rem',
                  textAlign: 'center',
                  marginBottom: '1.5rem',
                }}
              >
                {locationStatus === 'DETECTED' && location ? (
                  <div>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <CheckCircle2 size={24} />
                    </div>
                    <h4 style={{ margin: '0 0 0.35rem 0', color: '#10b981' }}>Location Captured</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                      Coordinates: {location.latitude}, {location.longitude} (Accuracy: ±{location.accuracy}m)
                    </p>
                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      className="btn btn-outline btn-sm"
                      style={{ marginTop: '1rem' }}
                    >
                      Refresh GPS
                    </button>
                  </div>
                ) : (
                  <div>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        background: 'rgba(59, 130, 246, 0.1)',
                        color: 'var(--primary)',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <Navigation size={22} />
                    </div>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                      Click the button below to automatically detect your coordinates in Mysuru.
                    </p>
                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      className="btn btn-primary btn-sm"
                      disabled={locationStatus === 'DETECTING'}
                    >
                      {locationStatus === 'DETECTING' ? 'Detecting Location...' : 'Detect Coordinates via GPS'}
                    </button>
                  </div>
                )}

                {locationError && (
                  <div className="alert alert-error" style={{ marginTop: '1rem', textAlign: 'left', fontSize: '0.84rem' }}>
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>{locationError}</div>
                  </div>
                )}
              </div>
            )}

            {locationMode === 'manual' && (
              <div
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Neighborhood / Area in Mysuru</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Sayyaji Rao Road, Jayalakshmipuram, Kuvempunagar"
                    value={manualArea}
                    onChange={(e) => setManualArea(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Latitude</label>
                    <input
                      type="text"
                      className="form-input"
                      value={manualLat}
                      onChange={(e) => setManualLat(e.target.value)}
                      placeholder="12.3118"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Longitude</label>
                    <input
                      type="text"
                      className="form-input"
                      value={manualLng}
                      onChange={(e) => setManualLng(e.target.value)}
                      placeholder="76.6529"
                    />
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setCurrentStep(1)}
              >
                <ArrowLeft size={16} /> Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (validateStep2()) setCurrentStep(3);
                }}
                id="btn-step2-next"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                Continue to Evidence <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 3: ADD EVIDENCE (PHOTO)                                   */}
        {/* ============================================================== */}
        {currentStep === 3 && (
          <div className="card" style={{ padding: '2rem 1.75rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.35rem 0' }}>
              Add a photo (Optional)
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              A clear photo helps civic staff understand the scale and exact nature of the problem.
            </p>

            {photoData ? (
              <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                  <img
                    src={photoData}
                    alt="Problem preview"
                    style={{
                      maxHeight: '260px',
                      width: 'auto',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      objectFit: 'cover',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      background: 'rgba(0, 0, 0, 0.7)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    title="Remove photo"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  {photoName}
                </div>
              </div>
            ) : (
              <div
                style={{
                  border: '2px dashed var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  marginBottom: '1.5rem',
                  background: 'var(--bg-primary)',
                }}
              >
                <Camera size={38} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem auto' }} />
                <h4 style={{ margin: '0 0 0.35rem 0' }}>Upload Photo of Incident</h4>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  JPEG, PNG, or WEBP up to 5MB
                </p>

                <label
                  className="btn btn-outline btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
                >
                  <Upload size={14} /> Select Photo
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoSelect}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setCurrentStep(2)}
              >
                <ArrowLeft size={16} /> Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setCurrentStep(4)}
                id="btn-step3-next"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                Continue to Review <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 4: REVIEW & SUBMIT                                        */}
        {/* ============================================================== */}
        {currentStep === 4 && (
          <div className="card" style={{ padding: '2rem 1.75rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.35rem 0' }}>
              Review your report
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Confirm details before submitting to the municipal resolution pipeline.
            </p>

            <div
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                marginBottom: '1.5rem',
              }}
            >
              <div className="detail-row">
                <span className="detail-key">Problem Category</span>
                <span className="detail-val" style={{ fontWeight: 600 }}>
                  {selectedCategoryObj?.label}
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-key">Description</span>
                <span className="detail-val" style={{ maxWidth: '400px', textAlign: 'right' }}>
                  {description}
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-key">Location</span>
                <span className="detail-val">
                  {locationMode === 'manual' && manualArea ? `${manualArea} · ` : ''}
                  {location ? `${location.latitude}, ${location.longitude}` : 'Mysuru'}
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-key">Photo</span>
                <span className="detail-val">
                  {photoData ? 'Attached (1 photo)' : 'None attached'}
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '0.6rem',
                alignItems: 'center',
                padding: '0.85rem 1rem',
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '1.75rem',
                fontSize: '0.84rem',
                color: 'var(--text-secondary)',
              }}
            >
              <Info size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
              <div>
                Once submitted, CivicFlow will automatically analyze the report and match it with the responsible civic authority in Mysuru.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setCurrentStep(3)}
                disabled={submitting}
              >
                <ArrowLeft size={16} /> Back
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmitReport}
                disabled={submitting}
                id="submit-report-btn"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem' }}
              >
                {submitting ? (
                  <>
                    <div className="spinner" style={{ width: '15px', height: '15px', borderWidth: '2px' }}></div>
                    Submitting Report...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={17} />
                    Submit Report
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
