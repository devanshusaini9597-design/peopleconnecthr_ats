/**
 * Webhook Dispatcher — delivers outbound webhooks whenever eventBus emits
 * any event type, to every active WebhookEndpoint in that org subscribed to
 * that event.
 *
 * Plan gating: which event *categories* an org may subscribe to at all is
 * enforced in routes/webhookRoutes.js (requireFeature) when the endpoint is
 * created/updated — this dispatcher just delivers whatever's already stored,
 * trusting that boundary the same way getAdapter() trusts IntegrationConfig.
 *
 * Signing: HMAC-SHA256 over the raw JSON body using the endpoint's secret,
 * sent as `X-SkillNix-Signature: sha256=<hex>` — the same verification
 * pattern as Stripe/GitHub webhooks, so customers can verify authenticity.
 */
const crypto = require('crypto');
const axios = require('axios');
const mongoose = require('mongoose');
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');

const MAX_CONSECUTIVE_FAILURES = 10; // auto-disable a dead endpoint after this many failures in a row
const DELIVERY_TIMEOUT_MS = 10000;

const signPayload = (secret, rawBody) =>
  crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

const deliverToEndpoint = async (endpoint, eventType, data) => {
  const WebhookDelivery = mongoose.model('WebhookDelivery');
  const started = Date.now();
  const body = JSON.stringify({ event: eventType, data, timestamp: new Date().toISOString() });
  const secret = endpoint.getDecryptedSecret();

  let success = false;
  let responseStatus = null;
  let errorMessage = null;

  try {
    const response = await axios.post(endpoint.url, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-SkillNix-Event': eventType,
        'X-SkillNix-Signature': `sha256=${signPayload(secret, body)}`
      },
      timeout: DELIVERY_TIMEOUT_MS,
      validateStatus: () => true // we want to record non-2xx as a failed delivery, not throw
    });
    responseStatus = response.status;
    success = response.status >= 200 && response.status < 300;
    if (!success) errorMessage = `Endpoint responded with HTTP ${response.status}`;
  } catch (err) {
    errorMessage = err.message;
  }

  try {
    await WebhookDelivery.create({
      organizationId: endpoint.organizationId,
      endpointId: endpoint._id,
      eventType,
      payload: data,
      success,
      responseStatus,
      errorMessage,
      durationMs: Date.now() - started
    });
  } catch (logErr) {
    console.error('[webhookDispatcher] Failed to record delivery log:', logErr.message);
  }

  endpoint.lastDeliveryAt = new Date();
  endpoint.lastDeliveryStatus = success ? 'success' : 'failed';
  endpoint.consecutiveFailures = success ? 0 : (endpoint.consecutiveFailures || 0) + 1;
  if (!success && endpoint.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    endpoint.isActive = false;
    console.warn(`[webhookDispatcher] Disabling endpoint ${endpoint._id} after ${endpoint.consecutiveFailures} consecutive failures`);
  }
  await endpoint.save();
};

const initWebhookDispatcher = () => {
  Object.values(eventTypes).forEach((eventType) => {
    eventBus.on(eventType, async (data) => {
      try {
        if (!data || !data.organizationId) return;

        const WebhookEndpoint = mongoose.model('WebhookEndpoint');
        const endpoints = await WebhookEndpoint.find({
          organizationId: data.organizationId,
          isActive: true,
          events: eventType
        });

        for (const endpoint of endpoints) {
          // Fire-and-forget per endpoint so a slow/dead endpoint never blocks others.
          deliverToEndpoint(endpoint, eventType, data).catch((err) =>
            console.error(`[webhookDispatcher] Unexpected error delivering to ${endpoint._id}:`, err.message)
          );
        }
      } catch (err) {
        console.error(`[webhookDispatcher] Error handling event ${eventType}:`, err.message);
      }
    });
  });
};

module.exports = { initWebhookDispatcher };
