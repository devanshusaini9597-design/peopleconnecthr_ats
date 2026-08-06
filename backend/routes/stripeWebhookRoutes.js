/**
 * Stripe webhook — mounted BEFORE express.json()/verifyToken in server.js.
 *
 * Stripe signature verification requires the exact raw request bytes, and the
 * webhook is called by Stripe itself (no Authorization header), so this must
 * live outside both the global JSON body parser and the auth middleware.
 */
const express = require('express');
const router = express.Router();
const Organization = require('../models/Organization');
const stripeService = require('../services/stripeService');
const { applyPlanLimits } = require('../config/planLimits');
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');

router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    event = stripeService.constructWebhookEvent(req.body, req.headers['stripe-signature']);
  } catch (err) {
    console.error('[Stripe webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const organizationId = session.metadata?.organizationId;
        const planId = session.metadata?.planId;
        if (organizationId && planId) {
          const org = await Organization.findById(organizationId);
          if (org) {
            const previousPlan = org.plan;
            org.plan = planId;
            org.billingCustomerId = session.customer || org.billingCustomerId;
            org.billingSubscriptionId = session.subscription || org.billingSubscriptionId;
            org.planExpiresAt = undefined;
            applyPlanLimits(org, planId);
            await org.save();
            eventBus.emit(eventTypes.ORG_PLAN_CHANGED, { organizationId, previousPlan, newPlan: planId, source: 'stripe_checkout' });
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const organizationId = subscription.metadata?.organizationId;
        const priceId = subscription.items?.data?.[0]?.price?.id;
        const planFromPrice = stripeService.PLAN_BY_PRICE()[priceId];
        if (organizationId) {
          const org = await Organization.findById(organizationId);
          if (org) {
            const previousPlan = org.plan;
            if (planFromPrice && planFromPrice !== org.plan) {
              org.plan = planFromPrice;
              applyPlanLimits(org, planFromPrice);
            }
            org.billingSubscriptionId = subscription.id;
            await org.save();
            if (planFromPrice && planFromPrice !== previousPlan) {
              eventBus.emit(eventTypes.ORG_PLAN_CHANGED, { organizationId, previousPlan, newPlan: planFromPrice, source: 'stripe_subscription_updated' });
            }
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const organizationId = subscription.metadata?.organizationId;
        if (organizationId) {
          const org = await Organization.findById(organizationId);
          if (org) {
            const previousPlan = org.plan;
            org.plan = 'starter';
            org.billingSubscriptionId = '';
            applyPlanLimits(org, 'starter');
            await org.save();
            eventBus.emit(eventTypes.ORG_PLAN_CHANGED, { organizationId, previousPlan, newPlan: 'starter', source: 'stripe_subscription_cancelled' });
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.warn(`[Stripe webhook] Payment failed for customer ${invoice.customer} (invoice ${invoice.id})`);
        break;
      }

      default:
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error(`[Stripe webhook] Error handling event ${event.type}:`, err);
    res.status(200).json({ received: true, processingError: err.message });
  }
});

module.exports = router;
