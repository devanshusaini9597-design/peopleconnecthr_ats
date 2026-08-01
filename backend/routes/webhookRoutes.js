/**
 * Outbound Webhooks — org-configured subscriptions delivered by
 * services/webhookDispatcher.js whenever an internal event fires.
 *
 * Professional ('integrations.webhooksReadOnly'): may subscribe to
 * informational/read-oriented events only (candidate/application/job/
 * interview/scorecard lifecycle).
 * Enterprise ('integrations.webhooksFull'): may subscribe to every event
 * type, including team/org/integration changes.
 */
const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { planHasFeature } = require('../config/planFeatures');
const eventTypes = require('../events/eventTypes');
const WebhookEndpoint = require('../models/WebhookEndpoint');
const WebhookDelivery = require('../models/WebhookDelivery');
const Organization = require('../models/Organization');

const READ_ONLY_EVENTS = [
  eventTypes.CANDIDATE_CREATED, eventTypes.CANDIDATE_UPDATED, eventTypes.CANDIDATE_DELETED,
  eventTypes.APPLICATION_CREATED, eventTypes.APPLICATION_STAGE_CHANGED, eventTypes.APPLICATION_REJECTED, eventTypes.CANDIDATE_HIRED,
  eventTypes.JOB_CREATED, eventTypes.JOB_PUBLISHED, eventTypes.JOB_CLOSED,
  eventTypes.INTERVIEW_SCHEDULED, eventTypes.INTERVIEW_COMPLETED, eventTypes.INTERVIEW_CANCELLED, eventTypes.SCORECARD_SUBMITTED
];

const allowedEventsForPlan = (plan) => (
  planHasFeature(plan, 'integrations.webhooksFull') ? Object.values(eventTypes) : READ_ONLY_EVENTS
);

router.use(verifyToken, requireOrganization, tenantScope, requireAdmin, requireFeature('integrations.webhooksReadOnly'));

// GET the list of event types this org's plan is allowed to subscribe to.
router.get('/available-events', async (req, res) => {
  const org = await Organization.findById(req.user.organizationId).select('plan');
  res.json({ success: true, data: allowedEventsForPlan(org?.plan) });
});

router.get('/', async (req, res) => {
  try {
    const endpoints = await WebhookEndpoint.find({ organizationId: req.user.organizationId }).sort({ createdAt: -1 }).select('-secret');
    res.json({ success: true, data: endpoints });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { url, description, events } = req.body;
    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ success: false, message: 'A valid http(s) URL is required' });
    }
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ success: false, message: 'Select at least one event to subscribe to' });
    }

    const org = await Organization.findById(req.user.organizationId).select('plan');
    const allowed = allowedEventsForPlan(org?.plan);
    const disallowed = events.filter((e) => !allowed.includes(e));
    if (disallowed.length > 0) {
      return res.status(403).json({
        success: false,
        code: 'UPGRADE_REQUIRED',
        message: `Your plan doesn't include these webhook events: ${disallowed.join(', ')}. Upgrade to Enterprise for full event access.`
      });
    }

    const secret = WebhookEndpoint.generateSecret();
    const endpoint = await WebhookEndpoint.create({
      organizationId: req.user.organizationId,
      url: url.trim(),
      description: description?.trim() || '',
      events,
      secret,
      createdBy: req.user.id
    });

    // Return the plaintext secret exactly once, at creation time — never again after this.
    res.status(201).json({ success: true, data: { ...endpoint.toObject({ getters: true }), secret: undefined }, plaintextSecret: secret });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { url, description, events, isActive } = req.body;
    const endpoint = await WebhookEndpoint.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!endpoint) return res.status(404).json({ success: false, message: 'Webhook endpoint not found' });

    if (events !== undefined) {
      const org = await Organization.findById(req.user.organizationId).select('plan');
      const allowed = allowedEventsForPlan(org?.plan);
      const disallowed = events.filter((e) => !allowed.includes(e));
      if (disallowed.length > 0) {
        return res.status(403).json({ success: false, code: 'UPGRADE_REQUIRED', message: `Your plan doesn't include these webhook events: ${disallowed.join(', ')}.` });
      }
      endpoint.events = events;
    }
    if (url !== undefined) {
      if (!/^https?:\/\//i.test(url)) return res.status(400).json({ success: false, message: 'A valid http(s) URL is required' });
      endpoint.url = url.trim();
    }
    if (description !== undefined) endpoint.description = description.trim();
    if (isActive !== undefined) {
      endpoint.isActive = !!isActive;
      if (endpoint.isActive) endpoint.consecutiveFailures = 0;
    }

    await endpoint.save();
    res.json({ success: true, data: { ...endpoint.toObject(), secret: undefined } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/rotate-secret', async (req, res) => {
  try {
    const endpoint = await WebhookEndpoint.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!endpoint) return res.status(404).json({ success: false, message: 'Webhook endpoint not found' });

    const secret = WebhookEndpoint.generateSecret();
    endpoint.secret = secret;
    await endpoint.save();
    res.json({ success: true, plaintextSecret: secret });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await WebhookEndpoint.deleteOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, message: 'Webhook endpoint not found' });
    res.json({ success: true, message: 'Webhook endpoint deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id/deliveries', async (req, res) => {
  try {
    const endpoint = await WebhookEndpoint.findOne({ _id: req.params.id, organizationId: req.user.organizationId }).select('_id');
    if (!endpoint) return res.status(404).json({ success: false, message: 'Webhook endpoint not found' });

    const deliveries = await WebhookDelivery.find({ endpointId: endpoint._id }).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: deliveries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
