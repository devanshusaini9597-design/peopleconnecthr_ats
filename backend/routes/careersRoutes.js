/**
 * Public careers routes — thin wrappers. Domain logic in careersService.
 * Mounted at /api/careers (no auth). Single router export (no publicRouter).
 */
const express = require('express');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const svc = require('../services/careersService');
const { multerFileFilter } = require('../utils/uploadAllowlist');

function handle(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: error.message,
    ...(error.code ? { code: error.code } : {}),
  });
}

const applyUpload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.pdf';
      const uniqueName = `careers-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: multerFileFilter,
});

/**
 * GET /:orgSlug/jobs.xml
 * Indeed/Google-for-Jobs-compatible XML feed — plain-text errors (not JSON).
 */
router.get('/:orgSlug/jobs.xml', async (req, res) => {
  try {
    const xml = await svc.getJobsXmlFeed(req.params.orgSlug);
    res.set('Content-Type', 'application/xml').send(xml);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).send(error.message);
    }
    res.status(500).send('Failed to generate job feed');
  }
});

/**
 * GET /by-domain/:domain
 * Resolves a custom careers-page domain to the org's slug.
 */
router.get('/by-domain/:domain', async (req, res) => {
  try {
    const data = await svc.resolveByDomain(req.params.domain);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

/**
 * GET /:orgSlug
 * Get org public info + list of published jobs
 */
router.get('/:orgSlug', async (req, res) => {
  try {
    const data = await svc.getCareersPage(req.params.orgSlug);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

/**
 * GET /:orgSlug/jobs/:jobId
 * Get job detail for public view
 */
router.get('/:orgSlug/jobs/:jobId', async (req, res) => {
  try {
    const result = await svc.getPublicJob(req.params.orgSlug, req.params.jobId);
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error);
  }
});

/**
 * GET /:orgSlug/jobs/:jobId/application-status?email=
 * Check whether this email already applied (public, email required).
 */
router.get('/:orgSlug/jobs/:jobId/application-status', async (req, res) => {
  try {
    const data = await svc.checkAlreadyApplied(
      req.params.orgSlug,
      req.params.jobId,
      req.query.email,
    );
    res.json({ success: true, ...data });
  } catch (error) {
    handle(res, error);
  }
});

/**
 * POST /:orgSlug/jobs/:jobId/apply
 * Submit application (multipart: resume + ATS-aligned fields)
 */
router.post('/:orgSlug/jobs/:jobId/apply', (req, res) => {
  applyUpload.single('resume')(req, res, async (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Resume must be 10MB or smaller.'
        : (err.message || 'Invalid resume upload');
      return res.status(400).json({ success: false, message });
    }
    try {
      const result = await svc.submitApplication(
        req.params.orgSlug,
        req.params.jobId,
        req.body || {},
        req.file || null,
      );
      res.json({ success: true, ...result });
    } catch (error) {
      handle(res, error);
    }
  });
});

module.exports = router;
