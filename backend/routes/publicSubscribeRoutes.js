/**
 * Public subscribe/unsubscribe routes – no auth.
 * Uses Zoho Campaigns list (ZOHO_CAMPAIGNS_LIST_KEY).
 * One-click links use HMAC sig to prevent abuse.
 * Also serves short-lived campaign HTML for Zoho content_url.
 */
const express = require('express');
const router = express.Router();
const svc = require('../services/publicSubscribeService');
const { getCampaignHtml } = require('../services/campaignContentStore');

function handleJson(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({ success: false, message: error.message });
}

/** Zoho Campaigns fetches this URL when importing campaign HTML (content_url). */
router.get('/campaign-content/:id', (req, res) => {
  const html = getCampaignHtml(req.params.id);
  if (!html) return res.status(404).type('text').send('Campaign content not found or expired');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).type('html').send(html);
});

function sendConfirm(res, result) {
  if (result.redirect) return res.redirect(result.redirect);
  return res.status(result.status || 200).send(result.body);
}

router.post('/subscribe', async (req, res) => {
  try {
    const result = await svc.subscribe(req.body);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    handleJson(res, error);
  }
});

router.get('/subscribe/confirm', async (req, res) => {
  const result = await svc.confirmSubscribe(
    req.query.email,
    req.query.sig,
    req.query.org || req.query.orgSlug,
    req.query.orgId
  );
  sendConfirm(res, result);
});

router.post('/unsubscribe', async (req, res) => {
  try {
    const result = await svc.unsubscribe(req.body);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    handleJson(res, error);
  }
});

router.get('/unsubscribe/confirm', async (req, res) => {
  const result = await svc.confirmUnsubscribe(
    req.query.email,
    req.query.sig,
    req.query.org || req.query.orgSlug,
    req.query.orgId
  );
  sendConfirm(res, result);
});

module.exports = router;
