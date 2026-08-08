/**
 * Auth routes — thin wrappers. Logic in authService.
 * Mounted at /api in server.js.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { verifyToken } = require('../middleware/authMiddleware');
const { setAuthCookie, clearAuthCookie } = require('../utils/authCookies');
const logger = require('../utils/logger');
const auth = require('../services/authService');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function sendAuthError(res, err) {
  const status = err.statusCode || 500;
  const body = { message: err.message };
  if (err.displayMessage) body.displayMessage = err.displayMessage;
  if (err.success === false) body.success = false;
  return res.status(status).json(body);
}

router.post('/login', authLimiter, async (req, res) => {
  try {
    const result = await auth.login(req.body.email, req.body.password, req);
    if (result.kind === 'mfa_enrollment' || result.kind === 'mfa_pending') {
      return res.json(result.payload);
    }
    setAuthCookie(res, result.token);
    res.json(result.payload);
  } catch (err) {
    if (err.statusCode && err.statusCode < 500) return sendAuthError(res, err);
    logger.error({ err }, 'LOGIN ERROR');
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/demo-login', authLimiter, async (req, res) => {
  try {
    const result = await auth.demoLogin();
    setAuthCookie(res, result.token);
    res.json(result.payload);
  } catch (err) {
    logger.error({ err }, 'DEMO LOGIN ERROR');
    res.status(500).json({ message: 'Failed to create demo account.' });
  }
});

router.post('/register', authLimiter, async (req, res) => {
  try {
    const result = await auth.register(req.body);
    return res.status(201).json(result);
  } catch (err) {
    if (err.statusCode && err.statusCode < 500) return sendAuthError(res, err);
    logger.error({ err }, 'REGISTER ERROR');
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/auth/forgot-password', authLimiter, async (req, res) => {
  try {
    const result = await auth.forgotPassword(req.body.email);
    res.json(result);
  } catch (err) {
    if (err.statusCode && err.statusCode < 500) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    logger.error({ err }, 'PASSWORD-RESET Error');
    res.status(500).json({ success: false, message: 'Failed to process password reset request' });
  }
});

router.get('/auth/verify-reset-token', async (req, res) => {
  try {
    const result = auth.verifyResetToken(req.query.token);
    res.json(result);
  } catch (err) {
    return res.status(err.statusCode || 400).json({ success: false, message: err.message });
  }
});

router.post('/auth/reset-password', authLimiter, async (req, res) => {
  try {
    const result = await auth.resetPassword(req.body.token, req.body.newPassword);
    res.json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Logged out' });
});

router.post('/auth/refresh', verifyToken, async (req, res) => {
  try {
    const result = await auth.refreshSession(req.user.id, req);
    setAuthCookie(res, result.token);
    res.json(result.payload);
  } catch (err) {
    if (err.statusCode === 401) {
      return res.status(401).json({ success: false, message: err.message });
    }
    logger.error({ err }, 'Token refresh failed');
    res.status(401).json({ success: false, message: 'Refresh failed' });
  }
});

module.exports = router;
