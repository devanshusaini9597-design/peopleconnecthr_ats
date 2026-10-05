const express = require('express');
const rateLimit = require('express-rate-limit');
const { setAuthCookie, clearAuthCookie } = require('../utils/authCookies');
const {
  listDemoRoles,
  enterDemoRole,
  homePathForDemoRole,
} = require('../services/demoWorkspaceService');
const logger = require('../utils/logger');

const router = express.Router();

const demoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: { success: false, message: 'Too many demo attempts. Please wait a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function readDemoKey(req) {
  return (
    req.get('x-demo-key')
    || req.query?.k
    || req.body?.k
    || req.body?.accessKey
    || ''
  );
}

router.get('/roles', async (req, res) => {
  try {
    const data = await listDemoRoles(readDemoKey(req));
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }
});

router.post('/enter', demoLimiter, async (req, res) => {
  try {
    const result = await enterDemoRole(req.body?.role, req, readDemoKey(req));
    setAuthCookie(res, result.token);
    const role = result.payload?.user?.role;
    res.json({
      ...result.payload,
      redirectTo: homePathForDemoRole(role),
    });
  } catch (err) {
    if (err.statusCode && err.statusCode < 500) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        code: err.code,
      });
    }
    logger.error({ err }, 'DEMO ENTER ERROR');
    res.status(500).json({ success: false, message: 'Could not open the demo.' });
  }
});

router.post('/exit', async (req, res) => {
  try {
    clearAuthCookie(res);
  } catch (_) { /* still succeed */ }
  res.json({ success: true, message: 'Demo session closed', redirectTo: '/' });
});

module.exports = router;
