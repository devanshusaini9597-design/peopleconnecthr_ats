/**
 * Public subscribe/unsubscribe routes – no auth.
 * Uses Zoho Campaigns list (ZOHO_CAMPAIGNS_LIST_KEY).
 * One-click links use HMAC sig to prevent abuse.
 */
const express = require('express');
const router = express.Router();
const svc = require('../services/publicSubscribeService');

function handleJson(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({ success: false, message: error.message });
}

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
  const result = await svc.confirmSubscribe(req.query.email, req.query.sig);
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
  const result = await svc.confirmUnsubscribe(req.query.email, req.query.sig);
  sendConfirm(res, result);
});

module.exports = router;
