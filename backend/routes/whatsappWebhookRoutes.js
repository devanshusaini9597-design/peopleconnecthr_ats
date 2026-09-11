/**
 * Public Meta WhatsApp webhook.
 * Mounted BEFORE express.json() so signature checks use the raw body.
 * Meta calls this directly — no Skillnix session cookie.
 */
const express = require('express');
const logger = require('../utils/logger');
const {
  verifyWebhookChallenge,
  verifyMetaSignature,
  handleWebhookPayload,
  parseHubQuery,
} = require('../services/whatsappCloudService');

const router = express.Router();

router.get('/', (req, res) => {
  const result = verifyWebhookChallenge(parseHubQuery(req.query));
  if (!result.ok) return res.sendStatus(403);
  return res.status(200).type('text/plain').send(result.challenge);
});

router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
  const signature = req.headers['x-hub-signature-256'];
  const appSecret = (process.env.META_APP_SECRET || '').trim();

  if (!verifyMetaSignature(rawBody, signature, appSecret)) {
    logger.warn('[whatsapp webhook] Invalid or missing signature');
    return res.sendStatus(403);
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8') || '{}');
  } catch (err) {
    logger.warn({ err: err.message }, '[whatsapp webhook] Invalid JSON');
    return res.sendStatus(400);
  }

  try {
    await handleWebhookPayload(payload);
  } catch (err) {
    logger.error({ err: err.message }, '[whatsapp webhook] Handler failed');
  }

  return res.sendStatus(200);
});

module.exports = router;
