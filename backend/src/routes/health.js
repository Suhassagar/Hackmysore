const express = require('express');
const { db } = require('../config/db');

const router = express.Router();

/**
 * GET /api/health
 * Phase 0 System Health Check Endpoint
 */
router.get('/health', async (req, res) => {
  res.json({
    status: 'ok',
    service: 'CivicFlow Unified Civic Incident & Accountability Platform API',
    version: '1.0.0',
    phase: 'Phase 1 — Authentication & Role-Based Access Control (RBAC)',
    timestamp: new Date().toISOString(),
    database: {
      connected: db.isConnected,
      engine: db.isConnected ? 'PostgreSQL' : 'Embedded In-Memory Store (Dev Fallback)',
    },
  });
});

module.exports = router;
