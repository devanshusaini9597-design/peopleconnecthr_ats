const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const mongoose = require('mongoose');
const { sendEmail } = require('../services/emailService');
const {
  getMaskedSettings,
  saveZohoSettings,
  saveSmtpSettings,
  testSmtpSettings,
  testZohoSettings,
} = require('../services/emailSettingsService');

function handleServiceError(res, err, fallbackLog) {
  if (err.statusCode && err.statusCode < 500) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }
  logger.error(fallbackLog || 'Email settings error:', err);
  return res.status(500).json({ success: false, message: err.message });
}

// GET — masked personal email settings
router.get('/', async (req, res) => {
  try {
    const User = mongoose.model('User');
    const user = await User.findById(req.user.id).select('emailSettings email name');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({
      success: true,
      settings: getMaskedSettings(user),
      userEmail: user.email,
      userName: user.name,
    });
  } catch (err) {
    handleServiceError(res, err, 'Get email settings error:');
  }
});

// PUT Zoho Zeptomail
router.put('/zoho-zeptomail', async (req, res) => {
  try {
    const result = await saveZohoSettings(req.user.id, req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    handleServiceError(res, err, 'Save Zoho Zeptomail settings error:');
  }
});

// PUT SMTP
router.put('/', async (req, res) => {
  try {
    const result = await saveSmtpSettings(req.user.id, req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    handleServiceError(res, err, 'Save email settings error:');
  }
});

// POST test SMTP
router.post('/test', async (req, res) => {
  try {
    const result = await testSmtpSettings(req.user.id, req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    handleServiceError(res, err, 'Test email settings error:');
  }
});

// POST test current (env or saved)
router.post('/test-current', async (req, res) => {
  try {
    const User = mongoose.model('User');
    const user = await User.findById(req.user.id).select('email name');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const toEmail = user.email || req.body.to;
    if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Your account has no email. Provide a valid "to" address in the request body.',
      });
    }
    await sendEmail(
      toEmail,
      '✅ Skillnix — ZeptoMail test (localhost)',
      '<p>If you got this, your current email config (Zoho from .env or Email Settings) is working.</p>',
      'If you got this, your current email config is working.',
      { userId: req.user.id }
    );
    res.json({ success: true, message: `Test email sent to ${toEmail}. Check your inbox.` });
  } catch (err) {
    logger.error('Test current email config error:', err);
    const msg =
      err.message === 'EMAIL_NOT_CONFIGURED'
        ? 'No email configured. Add ZOHO_ZEPTOMAIL_API_KEY and ZOHO_ZEPTOMAIL_FROM_EMAIL to backend/.env, or set Email Settings in the app.'
        : err.message;
    res.status(400).json({ success: false, message: msg });
  }
});

// POST test Zoho
router.post('/test-zoho', async (req, res) => {
  try {
    const result = await testZohoSettings(req.user.id, req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    handleServiceError(res, err, 'Test Zoho Zeptomail error:');
  }
});

// GET reveal password (eye toggle)
router.get('/reveal-password', async (req, res) => {
  try {
    const User = mongoose.model('User');
    const user = await User.findById(req.user.id).select('emailSettings');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const password = user.emailSettings?.smtpAppPassword || '';
    if (!password) {
      return res.status(404).json({ success: false, message: 'No password saved' });
    }
    res.json({ success: true, password });
  } catch (err) {
    handleServiceError(res, err, 'Reveal password error:');
  }
});

// DELETE personal settings
router.delete('/', async (req, res) => {
  try {
    const User = mongoose.model('User');
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.emailSettings = undefined;
    await user.save();
    res.json({ success: true, message: 'Personal email settings deleted' });
  } catch (err) {
    handleServiceError(res, err, 'Delete email settings error:');
  }
});

module.exports = router;
