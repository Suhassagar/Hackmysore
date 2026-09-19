const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const jurisdictionService = require('../services/jurisdiction');

const router = express.Router();

/**
 * POST /api/jurisdictions/resolve
 * Public or authenticated endpoint to preview jurisdiction resolution for any coordinate & timestamp.
 */
router.post('/resolve', async (req, res) => {
  try {
    const { latitude, longitude, timestamp } = req.body;
    const targetTime = timestamp ? new Date(timestamp) : new Date();

    const result = await jurisdictionService.resolveJurisdiction(latitude, longitude, targetTime);
    res.status(200).json(result);
  } catch (err) {
    if (err.code === 'INVALID_COORDINATES' || err.status === 400) {
      return res.status(400).json({
        error: 'Bad Request',
        message: err.message,
      });
    }
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Failed to resolve jurisdiction',
    });
  }
});

module.exports = router;
