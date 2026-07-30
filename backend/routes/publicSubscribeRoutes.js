/**
 * Public subscribe/unsubscribe routes – no auth.
 * Uses Zoho Campaigns list (ZOHO_CAMPAIGNS_LIST_KEY).
 * One-click links use HMAC sig to prevent abuse.
 */
const express = require('express');
const router = express.Router();
const { addContact, removeContact, isCampaignsConfigured } = require('../services/campaignService');
const { signEmail, verifySig } = require('../utils/subscribeSign');

const getListKey = () => (process.env.ZOHO_CAMPAIGNS_LIST_KEY || '').trim();
const getFrontendUrl = () => (process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');

// ─── POST /subscribe (form submit from subscribe page) ───
router.post('/subscribe', async (req, res) => {
  try {
    if (!isCampaignsConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Subscription service is not configured. Please try again later.'
      });
    }
    const listKey = getListKey();
    if (!listKey) {
      return res.status(503).json({
        success: false,
        message: 'Mailing list is not configured. Please try again later.'
      });
    }

    const { email, firstName, lastName } = req.body || {};
    const trim = (s) => (typeof s === 'string' ? s.trim() : '') || '';
    const emailTrim = trim(email).toLowerCase();

    if (!emailTrim || !emailTrim.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required.'
      });
    }

    await addContact(listKey, emailTrim, trim(firstName), trim(lastName));
    console.log('[Subscribe] Added contact to Zoho list:', emailTrim);

    res.status(200).json({
      success: true,
      message: 'You have been successfully subscribed. You will receive updates from us.'
    });
  } catch (err) {
    console.error('[Subscribe] Error:', err.message);
    const status = err.response?.status === 403 ? 403 : 500;
    res.status(status).json({
      success: false,
      message: err.message || 'Subscription failed. Please try again later.'
    });
  }
});

// ─── GET /subscribe/confirm?email=...&sig=... (one-click from email button) ───
router.get('/subscribe/confirm', async (req, res) => {
  const email = (req.query.email || '').trim().toLowerCase();
  const sig = (req.query.sig || '').trim();
  const frontend = getFrontendUrl();
  const thankYou = frontend ? `${frontend}/subscribe/thank-you` : null;

  if (!email || !email.includes('@')) {
    if (thankYou) return res.redirect(thankYou + '?error=invalid');
    return res.status(400).send('Invalid email.');
  }
  if (!verifySig(email, sig)) {
    if (thankYou) return res.redirect(thankYou + '?error=invalid_link');
    return res.status(400).send('Invalid or expired link.');
  }

  try {
    if (!isCampaignsConfigured()) {
      if (thankYou) return res.redirect(thankYou + '?error=unavailable');
      return res.status(503).send('Service unavailable.');
    }
    const listKey = getListKey();
    if (!listKey) {
      if (thankYou) return res.redirect(thankYou + '?error=unavailable');
      return res.status(503).send('Mailing list not configured.');
    }

    await addContact(listKey, email, '', '');
    console.log('[Subscribe] One-click added to Zoho list:', email);

    if (thankYou) return res.redirect(thankYou);
    res.status(200).send('You have been successfully added to our mailing list.');
  } catch (err) {
    console.error('[Subscribe confirm] Error:', err.message);
    if (thankYou) return res.redirect(thankYou + '?error=failed');
    res.status(500).send('Subscription failed. Please try again.');
  }
});

// ─── POST /unsubscribe (form or API) ───
router.post('/unsubscribe', async (req, res) => {
  try {
    if (!isCampaignsConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Unsubscribe service is not configured. Please try again later.'
      });
    }
    const listKey = getListKey();
    if (!listKey) {
      return res.status(503).json({
        success: false,
        message: 'Mailing list is not configured.'
      });
    }

    const { email } = req.body || {};
    const emailTrim = (typeof email === 'string' ? email.trim() : '').toLowerCase();

    if (!emailTrim || !emailTrim.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required.'
      });
    }

    await removeContact(listKey, emailTrim);
    console.log('[Unsubscribe] Removed from Zoho list:', emailTrim);

    res.status(200).json({
      success: true,
      message: 'You have been unsubscribed. You will no longer receive marketing emails from us.'
    });
  } catch (err) {
    console.error('[Unsubscribe] Error:', err.message);
    const status = err.response?.status === 403 ? 403 : 500;
    res.status(status).json({
      success: false,
      message: err.message || 'Unsubscribe failed. Please try again.'
    });
  }
});

// ─── GET /unsubscribe/confirm?email=...&sig=... (one-click from email link) ───
router.get('/unsubscribe/confirm', async (req, res) => {
  const email = (req.query.email || '').trim().toLowerCase();
  const sig = (req.query.sig || '').trim();
  const frontend = getFrontendUrl();
  const unsubThankYou = frontend ? `${frontend}/unsubscribe/thank-you` : null;

  if (!email || !email.includes('@')) {
    if (unsubThankYou) return res.redirect(unsubThankYou + '?error=invalid');
    return res.status(400).send('Invalid email.');
  }
  if (!verifySig(email, sig)) {
    if (unsubThankYou) return res.redirect(unsubThankYou + '?error=invalid_link');
    return res.status(400).send('Invalid or expired link.');
  }

  try {
    if (!isCampaignsConfigured()) {
      if (unsubThankYou) return res.redirect(unsubThankYou + '?error=unavailable');
      return res.status(503).send('Service unavailable.');
    }
    const listKey = getListKey();
    if (!listKey) {
      if (unsubThankYou) return res.redirect(unsubThankYou + '?error=unavailable');
      return res.status(503).send('Mailing list not configured.');
    }

    await removeContact(listKey, email);
    console.log('[Unsubscribe] One-click removed from Zoho list:', email);

    if (unsubThankYou) return res.redirect(unsubThankYou);
    res.status(200).send('You have been unsubscribed.');
  } catch (err) {
    console.error('[Unsubscribe confirm] Error:', err.message);
    if (unsubThankYou) return res.redirect(unsubThankYou + '?error=failed');
    res.status(500).send('Unsubscribe failed. Please try again.');
  }
});

module.exports = router;
