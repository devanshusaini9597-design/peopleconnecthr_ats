/**
 * Public org brand assets for email clients (Gmail image proxy, no auth).
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const s3Service = require('../services/s3Service');

const router = express.Router();
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

router.get('/org-logo/:orgId', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.orgId)) {
      return res.status(404).end();
    }
    const org = await Organization.findById(req.params.orgId).select('logo').lean();
    const logo = String(org?.logo || '').trim();
    if (!logo) return res.status(404).end();

    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    const dataMatch = logo.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (dataMatch) {
      const buf = Buffer.from(dataMatch[2], 'base64');
      res.setHeader('Content-Type', dataMatch[1]);
      return res.send(buf);
    }

    if (logo.startsWith('/uploads/')) {
      const rel = logo.replace(/^\/uploads\//, '').replace(/\\/g, '/');
      if (!rel || rel.includes('..')) return res.status(404).end();
      const filePath = path.join(UPLOADS_DIR, rel);
      if (fs.existsSync(filePath)) return res.sendFile(filePath);
      const asset = await s3Service.getAssetBuffer(rel);
      if (asset) {
        res.setHeader('Content-Type', asset.contentType);
        return res.send(asset.buffer);
      }
      return res.status(404).end();
    }

    if (/^https?:\/\//i.test(logo)) {
      // Do not open-redirect to a recruiter-controlled URL (phishing / SSRF).
      return res.status(404).end();
    }

    return res.status(404).end();
  } catch (_) {
    return res.status(404).end();
  }
});

module.exports = router;
