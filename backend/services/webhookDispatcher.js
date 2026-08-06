const logger = require('../utils/logger');
/**
 * Webhook Dispatcher — delivers outbound webhooks whenever eventBus emits
 * any event type, to every active WebhookEndpoint in that org subscribed to
 * that event.
 *
 * Delivery is enqueued via BullMQ when Redis is available (retryable),
 * otherwise runs inline so the product never depends on Redis.
 */
const crypto = require('crypto');
const axios = require('axios');
const mongoose = require('mongoose');
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');
const { enqueueWebhook } = require('../jobs/queue');

const MAX_CONSECUTIVE_FAILURES = 10;
const DELIVERY_TIMEOUT_MS = 10000;

const signPayload = (secret, rawBody) =>
  crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

/**
 * Deliver one webhook event to one endpoint and record the result.
 * Used by both the inline path and the BullMQ worker.
 */
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
        'X-SkillNix-Signature': `sha256=${signPayload(secret, body)}`,
      },
      timeout: DELIVERY_TIMEOUT_MS,
      validateStatus: () => true,
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
      durationMs: Date.now() - started,
    });
  } catch (logErr) {
    logger.error('[webhookDispatcher] Failed to record delivery log:', logErr.message);
  }

  endpoint.lastDeliveryAt = new Date();
  endpoint.lastDeliveryStatus = success ? 'success' : 'failed';
  endpoint.consecutiveFailures = success ? 0 : (endpoint.consecutiveFailures || 0) + 1;
  if (!success && endpoint.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    endpoint.isActive = false;
    logger.warn(
      `[webhookDispatcher] Disabling endpoint ${endpoint._id} after ${endpoint.consecutiveFailures} consecutive failures`
    );
  }
  await endpoint.save();
  return { success, responseStatus, errorMessage };
};

/**
 * Resolve endpoint by id and deliver. Used by the worker / queue fallback.
 */
const deliverByEndpointId = async ({ endpointId, eventType, data }) => {
  const WebhookEndpoint = mongoose.model('WebhookEndpoint');
  const endpoint = await WebhookEndpoint.findById(endpointId);
  if (!endpoint || !endpoint.isActive) {
    return { skipped: true, reason: 'endpoint_inactive_or_missing' };
  }
  return deliverToEndpoint(endpoint, eventType, data);
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
          events: eventType,
        });

        for (const endpoint of endpoints) {
          const jobData = {
            endpointId: endpoint._id.toString(),
            eventType,
            data,
          };
          // Queue when Redis is up; otherwise deliver inline (non-blocking).
          enqueueWebhook(jobData, deliverByEndpointId).catch((err) =>
            logger.error(
              `[webhookDispatcher] Unexpected error delivering to ${endpoint._id}:`,
              err.message
            )
          );
        }
      } catch (err) {
        logger.error(`[webhookDispatcher] Error handling event ${eventType}:`, err.message);
      }
    });
  });
};

module.exports = {
  initWebhookDispatcher,
  deliverToEndpoint,
  deliverByEndpointId,
  signPayload,
};
