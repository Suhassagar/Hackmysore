const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/requireAuth');
const { requireRole } = require('../middleware/requireRole');
const { createDevToken } = require('../config/firebase');
const { db, hashPassword, verifyPassword } = require('../config/db');

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/register
 * Production citizen registration endpoint.
 *
 * MANDATORY:
 * - Collects Full Name, Email, Password.
 * - Enforces minimum 8 characters for password.
 * - Server strictly forces role = 'CITIZEN'. Discards client-supplied role, authority_id, department_id.
 * - Automatically issues authenticated session token.
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Full name is required.',
      });
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'A valid email address is required.',
      });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Password must be at least 8 characters long.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check duplicate email
    const existing = await db.getUserByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'An account with this email already exists.',
      });
    }

    // Hash password and strictly assign role CITIZEN
    const passwordHash = hashPassword(password);
    const authUid = `usr_${uuidv4()}`;

    const newUser = await db.createUser({
      authUid,
      name: name.trim(),
      email: normalizedEmail,
      role: 'CITIZEN', // STRICT SERVER-DERIVED ROLE: Client can NEVER choose or escalate role
      passwordHash,
    });

    const token = createDevToken(newUser.auth_uid, newUser.email);

    res.status(201).json({
      message: 'Citizen account registered successfully',
      token,
      user: {
        id: newUser.id,
        authUid: newUser.auth_uid,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while creating your account. Please try again.',
    });
  }
});

/**
 * POST /api/auth/login
 * Production credentials login endpoint.
 *
 * MANDATORY:
 * - Requires Email and Password.
 * - Verifies password against hashed storage.
 * - Returns generic error on failure: "Email or password is incorrect."
 * - Server determines and returns user role, authority, and department.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password are required.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await db.getUserCredentialsByEmail(normalizedEmail);

    if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Email or password is incorrect.',
      });
    }

    // Issue signed JWT token
    const token = createDevToken(user.auth_uid, user.email);

    res.json({
      message: 'Authenticated successfully',
      token,
      user: {
        id: user.id,
        authUid: user.auth_uid,
        name: user.name,
        email: user.email,
        role: user.role,
        authority_id: user.authority_id || null,
        department_id: user.department_id || null,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected authentication error occurred. Please try again.',
    });
  }
});

/**
 * POST /api/auth/logout
 * Acknowledges session termination on backend.
 */
router.post('/logout', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Session closed successfully.',
  });
});

/**
 * POST /api/auth/register-sync
 * Syncs newly created auth user to PostgreSQL database.
 * 
 * SECURITY MANDATE:
 * Role is strictly defaulted to 'CITIZEN'.
 * Any client-supplied 'role' in the request body is intentionally discarded.
 */
router.post('/register-sync', async (req, res) => {
  try {
    const { authUid, name, email } = req.body;

    if (!authUid || !name || !email) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: authUid, name, email are required.',
      });
    }

    // Check if user already exists
    const existing = await db.getUserByAuthUid(authUid);
    if (existing) {
      return res.status(200).json({
        message: 'User already synchronized',
        user: {
          id: existing.id,
          authUid: existing.auth_uid,
          name: existing.name,
          email: existing.email,
          role: existing.role,
        },
      });
    }

    // Check if email already registered
    const existingEmail = await db.getUserByEmail(email);
    if (existingEmail) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Email is already associated with an existing account.',
      });
    }

    // Insert user into PostgreSQL with STRICT role: CITIZEN
    const newUser = await db.createUser({
      authUid,
      name,
      email,
      role: 'CITIZEN', // STRICT ENFORCEMENT: Never trust client-supplied role
    });

    res.status(201).json({
      message: 'Application user profile created successfully',
      user: {
        id: newUser.id,
        authUid: newUser.auth_uid,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Failed to create user record',
    });
  }
});

/**
 * POST /api/auth/dev-login
 * Development helper to obtain signed tokens for testing CITIZEN, STAFF, and ADMIN roles.
 */
router.post('/dev-login', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    let user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: `No application user found with email '${email}'. Please register first or use a seeded account.`,
      });
    }

    // Generate valid development token for this user
    const token = createDevToken(user.auth_uid, user.email);

    res.json({
      token,
      user: {
        id: user.id,
        authUid: user.auth_uid,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// ================================================================
// ROLE-SPECIFIC ACCESS TEST ENDPOINTS (Section 9 Requirement)
// ================================================================

/**
 * GET /api/auth/test/public
 * Unauthenticated test endpoint: verifies API reachability without credentials.
 */
router.get('/test/public', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Public test endpoint reached without credentials.',
  });
});

/**
 * GET /api/auth/test/citizen
 * Requires: CITIZEN, STAFF, or ADMIN (citizen access allowed)
 */
router.get('/test/citizen', requireAuth, requireRole('CITIZEN', 'STAFF', 'ADMIN'), (req, res) => {
  res.json({
    status: 'ok',
    message: 'Access granted: Citizen-level privileges confirmed.',
    user: req.user,
  });
});

/**
 * GET /api/auth/test/staff
 * Requires: STAFF or ADMIN
 */
router.get('/test/staff', requireAuth, requireRole('STAFF', 'ADMIN'), (req, res) => {
  res.json({
    status: 'ok',
    message: 'Access granted: Staff-level privileges confirmed.',
    user: req.user,
  });
});

/**
 * GET /api/auth/test/admin
 * Requires: ADMIN strictly
 */
router.get('/test/admin', requireAuth, requireRole('ADMIN'), (req, res) => {
  res.json({
    status: 'ok',
    message: 'Access granted: Administrator privileges confirmed.',
    user: req.user,
  });
});

module.exports = router;
