const { verifyAuthToken } = require('../config/firebase');
const { db } = require('../config/db');

/**
 * Authentication Middleware
 * 1. Extracts Bearer token from Authorization header.
 * 2. Verifies token integrity and expiration.
 * 3. Extracts authenticated UID.
 * 4. Queries database for the application user record matching that UID.
 * 5. Attaches authenticated user profile (with server-determined role) to req.user.
 *
 * Rejects any unauthenticated or unrecognized identity with 401 Unauthorized.
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token missing. Expected Authorization: Bearer <token>',
      });
    }

    const token = authHeader.split(' ')[1].trim();
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token is empty',
      });
    }

    // Step 1: Verify token authenticity (Firebase Admin or Dev JWT)
    const tokenPayload = await verifyAuthToken(token);
    const authUid = tokenPayload.uid;

    if (!authUid) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token verification failed: no valid UID in payload',
      });
    }

    // Step 2: Fetch application user record from database by auth_uid
    const appUser = await db.getUserByAuthUid(authUid);
    if (!appUser) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No registered application user profile found for this authenticated identity.',
      });
    }

    // Step 3: Attach verified identity and server-side role to req.user
    // Strictly sanitized: id, authUid, name, email, role, createdAt
    req.user = {
      id: appUser.id,
      authUid: appUser.auth_uid,
      name: appUser.name,
      email: appUser.email,
      role: appUser.role, // Determined strictly from database, NEVER from client request
      createdAt: appUser.created_at,
    };

    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: err.message || 'Invalid or expired authentication session',
    });
  }
}

module.exports = { requireAuth };
