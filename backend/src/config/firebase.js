const jwt = require('jsonwebtoken');

let firebaseApp = null;
let firebaseAuth = null;

function initFirebase() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    try {
      const { initializeApp, cert, getApps } = require('firebase-admin/app');
      const { getAuth } = require('firebase-admin/auth');

      const apps = getApps();
      if (!apps.length) {
        firebaseApp = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        });
      } else {
        firebaseApp = apps[0];
      }
      firebaseAuth = getAuth(firebaseApp);
      console.log('[Firebase] Firebase Admin SDK initialized successfully.');
    } catch (err) {
      console.warn(`[Firebase] Could not initialize Firebase Admin SDK (${err.message}). Using local token verifier.`);
    }
  } else {
    console.log('[Firebase] No Firebase Admin service account provided. Running in dev-compatible token verification mode.');
  }
}

/**
 * Verify an authentication token.
 * Supports:
 * 1. Live Firebase ID tokens (via Firebase Admin if configured)
 * 2. Standard signed JWT tokens (for dev/test environments)
 */
async function verifyAuthToken(token) {
  if (!token) {
    throw new Error('No authentication token provided');
  }

  // 1. Try Firebase Admin if initialized
  if (firebaseAuth) {
    try {
      const decodedToken = await firebaseAuth.verifyIdToken(token);
      return {
        uid: decodedToken.uid,
        email: decodedToken.email,
        authProvider: 'firebase',
      };
    } catch (firebaseErr) {
      // If Firebase verification fails, continue to check dev tokens if in development
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Firebase token verification failed: ${firebaseErr.message}`);
      }
    }
  }

  // 2. Dev / Testing JWT verification
  try {
    const secret = process.env.JWT_SECRET || 'civicflow-hackmysuru-dev-secret-key-phase1-2026';
    const decoded = jwt.verify(token, secret);
    return {
      uid: decoded.uid || decoded.sub,
      email: decoded.email,
      authProvider: 'dev-jwt',
    };
  } catch (jwtErr) {
    throw new Error('Invalid or expired authentication token');
  }
}

/**
 * Helper to generate a development/test token for a given auth UID and email.
 */
function createDevToken(authUid, email) {
  const secret = process.env.JWT_SECRET || 'civicflow-hackmysuru-dev-secret-key-phase1-2026';
  return jwt.sign(
    {
      uid: authUid,
      email: email,
      iss: 'civicflow-auth-dev',
    },
    secret,
    { expiresIn: '7d' }
  );
}

module.exports = {
  initFirebase,
  verifyAuthToken,
  createDevToken,
};
