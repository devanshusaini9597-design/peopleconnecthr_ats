const express = require('express');
const rateLimit = require('express-rate-limit');
const { submitDemoLead } = require('../services/demoLeadService');

const router = express.Router();

const demoLeadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: { success: false, message: 'Too many requests. Please wait a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/demo-request', demoLeadLimiter, async (req, res) => {
  try {
    const result = await submitDemoLead(req.body);
    res.status(200).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Could not send that request.',
      code: err.code,
    });
  }
});

module.exports = router;
