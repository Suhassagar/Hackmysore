/**
 * CivicFlow — Phase 3B: Comprehensive Automated Verification Suite
 * 
 * Verifies all Phase 3B requirements:
 * 1. Offline Report Queue & Idempotency Key Replay Protection
 * 2. Multi-Citizen Spatiotemporal Duplicate Incident Clustering (50m, 48h)
 * 3. Deterministic Abusive Text Moderation & Civic Criticism Protection
 * 4. Pure-JS Photo EXIF Validation & Location Mismatch Human Review Flagging
 * 5. Full End-to-End API Integration
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const API_BASE = 'http://localhost:5000/api';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    testsPassed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    testsFailed++;
  }
}

// Synthetic JPEG generator helper for EXIF GPS testing
function buildSyntheticJpegWithGps(latDeg, latMin, latSec, lonDeg, lonMin, lonSec) {
  const tiff = Buffer.alloc(200);
  tiff.write('II', 0);
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);

  // IFD0 at offset 8: 1 entry
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x8825, 10);
  tiff.writeUInt16LE(4, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt32LE(26, 18);
  tiff.writeUInt32LE(0, 22);

  // GPS IFD at offset 26: 4 entries
  tiff.writeUInt16LE(4, 26);
  tiff.writeUInt16LE(1, 28); tiff.writeUInt16LE(2, 30); tiff.writeUInt32LE(2, 32); tiff.write('N\0\0\0', 36);
  tiff.writeUInt16LE(2, 40); tiff.writeUInt16LE(5, 42); tiff.writeUInt32LE(3, 44); tiff.writeUInt32LE(80, 48);
  tiff.writeUInt16LE(3, 52); tiff.writeUInt16LE(2, 54); tiff.writeUInt32LE(2, 56); tiff.write('E\0\0\0', 60);
  tiff.writeUInt16LE(4, 64); tiff.writeUInt16LE(5, 66); tiff.writeUInt32LE(3, 68); tiff.writeUInt32LE(104, 72);
  tiff.writeUInt32LE(0, 76);

  tiff.writeUInt32LE(latDeg, 80); tiff.writeUInt32LE(1, 84);
  tiff.writeUInt32LE(latMin, 88); tiff.writeUInt32LE(1, 92);
  tiff.writeUInt32LE(Math.round(latSec * 100), 96); tiff.writeUInt32LE(100, 100);

  tiff.writeUInt32LE(lonDeg, 104); tiff.writeUInt32LE(1, 108);
  tiff.writeUInt32LE(lonMin, 112); tiff.writeUInt32LE(1, 116);
  tiff.writeUInt32LE(Math.round(lonSec * 100), 120); tiff.writeUInt32LE(100, 124);

  const tiffSlice = tiff.slice(0, 140);
  const app1Length = 2 + 6 + tiffSlice.length;
  const header = Buffer.from([0xFF, 0xD8, 0xFF, 0xE1, (app1Length >> 8) & 0xFF, app1Length & 0xFF]);
  const exifTag = Buffer.from('Exif\0\0', 'ascii');
  const eoi = Buffer.from([0xFF, 0xD9]);
  return Buffer.concat([header, exifTag, tiffSlice, eoi]);
}

async function run() {
  console.log('====================================================');
  console.log(' CIVICFLOW PHASE 3B COMPREHENSIVE VERIFICATION SUITE');
  console.log('====================================================\n');

  // Login tokens
  const citizenRes = await fetch(`${API_BASE}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'citizen@mysuru.civicflow.in' }),
  });
  const citizenData = await citizenRes.json();
  const citizenToken = citizenData.token;

  const citizen2Res = await fetch(`${API_BASE}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'citizen2@mysuru.civicflow.in' }),
  });
  const citizen2Data = await citizen2Res.json();
  const citizen2Token = citizen2Data.token;

  const staffRes = await fetch(`${API_BASE}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'staff@mysuru.civicflow.in' }),
  });
  const staffData = await staffRes.json();
  const staffToken = staffData.token;

  // ----------------------------------------------------
  // SECTION 1: Service Worker & Offline Queue Assets
  // ----------------------------------------------------
  console.log('\n--- SECTION 1: Static Offline Assets & IndexedDB Queue ---');
  const swPath = path.join(__dirname, '../../../frontend/public/sw.js');
  assert(fs.existsSync(swPath), 'Service Worker sw.js exists in frontend/public');
  const swContent = fs.readFileSync(swPath, 'utf8');
  assert(swContent.includes('/api'), 'sw.js explicitly checks and bypasses /api routes');
  assert(swContent.includes('civicflow-v1'), 'sw.js defines cache version');

  const offlineQueuePath = path.join(__dirname, '../../../frontend/src/services/offlineQueue.js');
  assert(fs.existsSync(offlineQueuePath), 'offlineQueue.js exists in frontend services');
  const queueContent = fs.readFileSync(offlineQueuePath, 'utf8');
  assert(queueContent.includes('civicflow_offline_db'), 'offlineQueue uses civicflow_offline_db IndexedDB');
  assert(queueContent.includes('enqueueReport'), 'offlineQueue implements enqueueReport');
  assert(queueContent.includes('syncQueue'), 'offlineQueue implements syncQueue');
  assert(!queueContent.includes('store.put(token'), 'offlineQueue adheres to zero-token security principle');

  // ----------------------------------------------------
  // SECTION 2: Idempotency Replay Protection
  // ----------------------------------------------------
  console.log('\n--- SECTION 2: Client Idempotency Key & Replay Protection ---');
  const idempotencyKey = `idem-${uuidv4()}`;

  const reportPayload = {
    category: 'POTHOLE',
    description: `Hazardous pothole on Vinoba Road near DC Office #${uuidv4().slice(0, 6)}`,
    latitude: 12.3051,
    longitude: 76.6551,
    accuracy: 10,
    idempotencyKey,
  };

  const initialSubmit = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${citizenToken}`,
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(reportPayload),
  });

  const initialData = await initialSubmit.json();
  assert(initialSubmit.status === 201, `Initial report submission succeeds (Status: ${initialSubmit.status})`);
  assert(Boolean(initialData.id), `Report created with ID: ${initialData.id}`);

  // Re-submit identical payload with identical idempotency key
  const replaySubmit = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${citizenToken}`,
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(reportPayload),
  });

  const replayData = await replaySubmit.json();
  assert(replaySubmit.status === 200, `Replay submission returns HTTP 200 (Status: ${replaySubmit.status})`);
  assert(replayData.id === initialData.id, `Replay returns exact same report ID (${replayData.id})`);
  assert(replayData.idempotentReplay === true, 'Response contains idempotentReplay: true flag');

  // ----------------------------------------------------
  // SECTION 3: Deterministic Content Moderation Filter
  // ----------------------------------------------------
  console.log('\n--- SECTION 3: Abusive Text Moderation & Civic Criticism Protection ---');
  const moderationService = require('../services/contentModeration');

  // Direct profanity
  const profanityTest = moderationService.moderateContent('Fix this fucking road right now');
  assert(!profanityTest.isAcceptable, 'Direct profanity is rejected');
  assert(profanityTest.reason === 'PROFANITY_DETECTED', 'Rejection reason is PROFANITY_DETECTED');
  assert(profanityTest.politePrompt === 'Please rewrite your report using respectful language.', 'Polite rewrite prompt returned');

  // Punctuated/obfuscated profanity
  const obfuscatedTest = moderationService.moderateContent('F.u.c.k this garbage overflow');
  assert(!obfuscatedTest.isAcceptable, 'Punctuated obfuscation (F.u.c.k) is rejected');

  // Violent threats
  const threatTest = moderationService.moderateContent('I will kill officials if this is not fixed');
  assert(!threatTest.isAcceptable, 'Violent threat is rejected');
  assert(threatTest.reason === 'VIOLENT_THREAT_DETECTED', 'Rejection reason is VIOLENT_THREAT_DETECTED');

  // False positive guard: Civic Criticism must be ACCEPTED
  const criticismTest1 = moderationService.moderateContent('MCC ignored this pothole for months and the administration is completely incompetent');
  assert(criticismTest1.isAcceptable, 'Civic criticism ("incompetent administration") is accepted');

  const criticismTest2 = moderationService.moderateContent('Corrupt officials taking bribes for fixing broken drainage on main road');
  assert(criticismTest2.isAcceptable, 'Civic criticism ("corrupt officials taking bribes") is accepted');

  const criticismTest3 = moderationService.moderateContent('Worst road in Mysuru, shame on municipal corporation');
  assert(criticismTest3.isAcceptable, 'Strong citizen dissatisfaction ("Worst road", "shame on") is accepted');

  // Live API test: Abusive submission rejected with 400
  const abusiveApiSubmit = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${citizenToken}`,
    },
    body: JSON.stringify({
      category: 'POTHOLE',
      description: 'You bloody motherfucker fix this road right now',
      latitude: 12.3051,
      longitude: 76.6551,
    }),
  });
  const abusiveData = await abusiveApiSubmit.json();
  assert(abusiveApiSubmit.status === 400, `Abusive submission rejected by API with HTTP 400 (Status: ${abusiveApiSubmit.status})`);
  assert(abusiveData.message === 'Please rewrite your report using respectful language.', 'Polite error message returned to client');

  // Live API test: Legitimate harsh civic criticism accepted with 201
  const criticismApiSubmit = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${citizenToken}`,
    },
    body: JSON.stringify({
      category: 'POTHOLE',
      description: 'MCC ignored this deep pothole for months and the local engineers are completely negligent',
      latitude: 12.3051,
      longitude: 76.6551,
    }),
  });
  assert(criticismApiSubmit.status === 201, `Legitimate civic criticism accepted with HTTP 201 (Status: ${criticismApiSubmit.status})`);

  // ----------------------------------------------------
  // SECTION 4: Photo Evidence Validation & EXIF GPS
  // ----------------------------------------------------
  console.log('\n--- SECTION 4: Photo Evidence & EXIF Authenticity Signals ---');
  const exifParser = require('../services/exifParser');

  // Standard upload without metadata
  const standardUpload = exifParser.inspectPhoto(Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9]));
  assert(standardUpload.status === 'VALID_NO_METADATA', 'Image without EXIF recognized as VALID_NO_METADATA');

  // Matching GPS in Mysuru
  const matchingJpeg = buildSyntheticJpegWithGps(12, 18, 18.36, 76, 39, 18.36); // 12.3051, 76.6551
  const matchingResult = exifParser.inspectPhoto(matchingJpeg, { reportedLatitude: 12.3051, reportedLongitude: 76.6551 });
  assert(matchingResult.status === 'VALID', 'Photo with matching GPS is VALID');
  assert(matchingResult.distanceMeters <= 10, `Distance within threshold (${matchingResult.distanceMeters}m)`);

  // Mismatch GPS (Photo taken in Bengaluru 12.9716, 77.5946 but reported in Mysuru 12.3051, 76.6551)
  const mismatchJpeg = buildSyntheticJpegWithGps(12, 58, 17.76, 77, 35, 40.56);
  const mismatchResult = exifParser.inspectPhoto(mismatchJpeg, { reportedLatitude: 12.3051, reportedLongitude: 76.6551 });
  assert(mismatchResult.status === 'LOCATION_MISMATCH', 'Photo taken >500m away flagged as LOCATION_MISMATCH');
  assert(mismatchResult.distanceMeters > 100000, `Large distance correctly detected (${mismatchResult.distanceMeters}m)`);

  // Routing Assessment Integration
  const routingAssessor = require('../services/routingAssessment');
  const reportWithMismatch = {
    category: 'POTHOLE',
    description: 'Pothole with mismatched photo evidence',
    latitude: 12.3051,
    longitude: 76.6551,
    location_status: 'VERIFIED_COORDINATES',
    photo_status: 'LOCATION_MISMATCH',
  };
  const jurMock = { match_status: 'MATCHED', jurisdiction_id: uuidv4() };
  const respMock = { route_status: 'ROUTED', authority: { id: uuidv4() }, department: { id: uuidv4() } };
  const assessment = routingAssessor.assessRouting(reportWithMismatch, null, jurMock, respMock);
  assert(assessment.status === 'NEEDS_REVIEW', 'Location mismatch escalates routing to NEEDS_REVIEW');
  assert(assessment.reviewReasons.includes('PHOTO_LOCATION_MISMATCH'), 'PHOTO_LOCATION_MISMATCH included in reviewReasons');

  // Live API Photo Mismatch Submission
  const mismatchBase64 = `data:image/jpeg;base64,${mismatchJpeg.toString('base64')}`;
  const photoMismatchSubmit = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${citizenToken}`,
    },
    body: JSON.stringify({
      category: 'POTHOLE',
      description: 'Pothole on Sayyaji Rao Road with remote photo',
      latitude: 12.3051,
      longitude: 76.6551,
      photoData: mismatchBase64,
    }),
  });
  const photoMismatchData = await photoMismatchSubmit.json();
  assert(photoMismatchSubmit.status === 201, `Photo mismatch report created successfully (Status: ${photoMismatchSubmit.status})`);
  assert(photoMismatchData.photoStatus === 'LOCATION_MISMATCH', `Photo status persisted as LOCATION_MISMATCH (${photoMismatchData.photoStatus})`);

  // ----------------------------------------------------
  // SECTION 5: Multi-Citizen Incident Clustering
  // ----------------------------------------------------
  console.log('\n--- SECTION 5: Multi-Citizen Spatiotemporal Duplicate Incident Clustering ---');
  // Unique coordinates in Mysuru for isolated cluster test
  const clusterLat = 12.3150 + ((Date.now() % 500) / 100000);
  const clusterLng = 76.6600 + ((Date.now() % 500) / 100000);

  // Citizen 1 submits Report 1
  const report1Res = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${citizenToken}`,
    },
    body: JSON.stringify({
      category: 'GARBAGE_OVERFLOW',
      description: 'Severe garbage overflow outside market building on Ashoka Road',
      latitude: clusterLat,
      longitude: clusterLng,
    }),
  });
  const report1 = await report1Res.json();
  assert(report1Res.status === 201, `Citizen 1 report created (Status: ${report1Res.status})`);
  assert(Boolean(report1.incidentId), `Report 1 associated with incident ID: ${report1.incidentId}`);
  assert(report1.isCluster === false, 'First report initialized as cluster primary');

  // Citizen 2 submits Report 2 (~15m away, same category GARBAGE_OVERFLOW within 48h)
  const report2Res = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${citizen2Token}`,
    },
    body: JSON.stringify({
      category: 'GARBAGE_OVERFLOW',
      description: 'Same waste accumulation overflowing onto pedestrian walkway',
      latitude: clusterLat + 0.0001, // ~11 meters away
      longitude: clusterLng + 0.0001,
    }),
  });
  const report2 = await report2Res.json();
  assert(report2Res.status === 201, `Citizen 2 report created (Status: ${report2Res.status})`);
  assert(report2.isCluster === true, 'Second report within 50m recognized as cluster duplicate (isCluster: true)');
  assert(report2.incidentId === report1.incidentId, `Second report linked to same incident (${report2.incidentId})`);
  assert(report2.clusterReportCount >= 2, `Incident cluster report count incremented (${report2.clusterReportCount})`);

  // Citizen 1 submits Report 3 at same location but DIFFERENT category (BROKEN_STREETLIGHT)
  const diffCategoryRes = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${citizenToken}`,
    },
    body: JSON.stringify({
      category: 'BROKEN_STREETLIGHT',
      description: 'Streetlight pole not functioning at same corner',
      latitude: clusterLat,
      longitude: clusterLng,
    }),
  });
  const diffCategoryReport = await diffCategoryRes.json();
  assert(diffCategoryRes.status === 201, 'Different category report created');
  assert(diffCategoryReport.incidentId !== report1.incidentId, 'Different category creates separate incident');

  // Citizen 1 submits Report 4 far away (>50m, 3km away)
  const farAwayRes = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${citizenToken}`,
    },
    body: JSON.stringify({
      category: 'GARBAGE_OVERFLOW',
      description: 'Garbage dump at Hebbal industrial area 4km away',
      latitude: clusterLat + 0.035, // ~3.8 km away
      longitude: clusterLng + 0.035,
    }),
  });
  const farAwayReport = await farAwayRes.json();
  assert(farAwayRes.status === 201, 'Far away report created');
  assert(farAwayReport.incidentId !== report1.incidentId, 'Location >50m creates separate incident');

  // Verify GET /api/reports/:id returns incident cluster metadata
  const detailRes = await fetch(`${API_BASE}/reports/${report2.id}`, {
    headers: { 'Authorization': `Bearer ${citizen2Token}` },
  });
  const detailData = await detailRes.json();
  assert(Boolean(detailData.incident), 'Report detail includes incident cluster object');
  assert(detailData.incident.reportCount >= 2, `Incident report count confirmed via GET API (${detailData.incident.reportCount})`);

  console.log('\n====================================================');
  console.log(` PHASE 3B VERIFICATION COMPLETE`);
  console.log(` Tests Passed: ${testsPassed}`);
  console.log(` Tests Failed: ${testsFailed}`);
  console.log('====================================================');

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
