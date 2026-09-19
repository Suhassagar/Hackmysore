const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const responsibilityService = require('../services/responsibility');
const jurisdictionService = require('../services/jurisdiction');
const { db } = require('../config/db');

const router = express.Router();

/**
 * POST /api/routing/resolve
 * Preview / dry-run civic responsibility resolution without saving.
 * 
 * Supports either:
 * 1. { jurisdiction_id, category, report_time }
 * 2. { latitude, longitude, category, report_time } (spatially resolves jurisdiction first)
 */
router.post('/resolve', requireAuth, async (req, res) => {
  try {
    const {
      jurisdiction_id,
      latitude,
      longitude,
      category,
      report_time,
    } = req.body;

    if (!category) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Category is required for routing resolution.',
      });
    }

    const reportTime = report_time ? new Date(report_time) : new Date();
    if (isNaN(reportTime.getTime())) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid report_time format. Must be an ISO timestamp or parseable date string.',
      });
    }

    let jurisdiction = null;

    if (jurisdiction_id) {
      const jur = await db.getJurisdictionById(jurisdiction_id);
      if (!jur) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Jurisdiction with ID '${jurisdiction_id}' not found.`,
        });
      }
      jurisdiction = {
        id: jur.id,
        code: jur.code,
        name: jur.name,
        type: jur.type,
        match_status: 'MATCHED',
      };
    } else if (latitude !== undefined && longitude !== undefined) {
      const jurResolution = await jurisdictionService.resolveJurisdiction(latitude, longitude, reportTime);
      jurisdiction = {
        id: jurResolution.jurisdictionId,
        code: jurResolution.jurisdictionCode,
        name: jurResolution.jurisdictionName,
        type: jurResolution.jurisdictionType,
        boundary_id: jurResolution.jurisdictionBoundaryId,
        boundary_version: jurResolution.boundaryVersion,
        match_status: jurResolution.matchStatus,
        explanation: jurResolution.explanation,
      };
    } else {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Either jurisdiction_id or (latitude, longitude) must be provided.',
      });
    }

    const resolution = await responsibilityService.resolveResponsibility(
      jurisdiction,
      category,
      reportTime,
      null
    );

    res.status(200).json({
      jurisdiction,
      category: category.toUpperCase(),
      reportTime: reportTime.toISOString(),
      routing: resolution,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Failed to resolve responsibility routing.',
    });
  }
});

/**
 * GET /api/routing/authorities
 * Returns list of registered authorities.
 */
router.get('/authorities', requireAuth, async (req, res) => {
  try {
    const authorities = await db.getAllAuthorities();
    res.status(200).json({ authorities });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

/**
 * GET /api/routing/departments
 * Returns list of registered departments, optionally filtered by authority_id.
 */
router.get('/departments', requireAuth, async (req, res) => {
  try {
    const { authority_id } = req.query;
    if (authority_id) {
      const departments = await db.getDepartmentsByAuthorityId(authority_id);
      return res.status(200).json({ departments });
    }
    const authorities = await db.getAllAuthorities();
    const allDepartments = [];
    for (const auth of authorities) {
      const depts = await db.getDepartmentsByAuthorityId(auth.id);
      allDepartments.push(...depts);
    }
    res.status(200).json({ departments: allDepartments });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;

