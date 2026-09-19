const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { db } = require('../config/db');

const router = express.Router();

/**
 * GET /api/users/me
 * Returns the current authenticated application user profile.
 * Authenticated via requireAuth.
 */
router.get('/me', requireAuth, async (req, res) => {
  // req.user has been sanitized and loaded from database by requireAuth
  res.json({
    id: req.user.id,
    authUid: req.user.authUid,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    createdAt: req.user.createdAt,
  });
});

/**
 * GET /api/users
 * Development / Admin helper to list all registered users (sanitized)
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const users = await db.listAllUsers();
    const sanitized = users.map(u => ({
      id: u.id,
      authUid: u.auth_uid,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.created_at,
    }));
    res.json({ users: sanitized });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;
