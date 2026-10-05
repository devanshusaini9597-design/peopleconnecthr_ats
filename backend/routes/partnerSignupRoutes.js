/**
 * Public freelance partner page — /api/partners (no auth).
 */
const express = require('express');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const svc = require('../services/partnerSignupService');
const { multerFileFilter } = require('../utils/uploadAllowlist');

function handle(res, error) {
  const status = error.statusCode || 500;
  const payload = { success: false, message: error.message };
  if (error.code) payload.code = error.code;
  if (error.referenceCode) payload.referenceCode = error.referenceCode;
  if (error.statusLabel) payload.statusLabel = error.statusLabel;
  return res.status(status).json(payload);
}

const applyUpload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.pdf';
      const uniqueName = `partner-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: multerFileFilter,
});

function clientRateKey(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
}

router.get('/:orgSlug', async (req, res) => {
  try {
    const data = await svc.getPartnerPage(req.params.orgSlug);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/:orgSlug/track', async (req, res) => {
  try {
    const data = await svc.trackApplication(
      req.params.orgSlug,
      req.query || {},
      clientRateKey(req),
    );
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/:orgSlug/check', async (req, res) => {
  try {
    const data = await svc.checkApplication(
      req.params.orgSlug,
      req.query || {},
      clientRateKey(req),
    );
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/:orgSlug/apply', (req, res) => {
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
        req.body || {},
        req.file || null,
        clientRateKey(req),
      );
      res.json({ success: true, ...result });
    } catch (error) {
      handle(res, error);
    }
  });
});

module.exports = router;
