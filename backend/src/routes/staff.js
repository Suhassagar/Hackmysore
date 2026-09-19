const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { requireRole } = require('../middleware/requireRole');
const { db } = require('../config/db');

const router = express.Router();

/**
 * GET /api/staff/routing-review
 * Retrieves paginated queue of civic reports requiring human routing review.
 * 
 * Access: STAFF, ADMIN only.
 * CITIZEN requests receive 403 Forbidden.
 */
router.get('/routing-review', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = await db.getUnresolvedRoutingReviews({ page, limit });

    res.status(200).json({
      items: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  } catch (err) {
    console.error('[Staff API Error] Failed to fetch routing review queue:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Failed to fetch routing review queue.',
    });
  }
});

module.exports = router;
