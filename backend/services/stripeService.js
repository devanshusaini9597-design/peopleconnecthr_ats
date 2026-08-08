/**
 * Stripe billing service.
 *
 * Requires env vars (see backend/.env.example):
 *   STRIPE_SECRET_KEY        — sk_live_... / sk_test_...
 *   STRIPE_WEBHOOK_SECRET    — whsec_... (from the Stripe Dashboard webhook endpoint)
 *   STRIPE_PRICE_STARTER     — price_... (recurring price for the Starter plan)
 *   STRIPE_PRICE_PROFESSIONAL — price_... (recurring price for the Professional plan)
 *
 * Enterprise has no self-serve checkout (custom/quoted pricing) — those orgs
 * are moved to 'enterprise' manually or via a sales-assisted Stripe invoice.
 */

let stripeClient = null;

const getStripe = () => {
  if (stripeClient) return stripeClient;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured. Add it to backend/.env to enable billing.');
  }
  // Lazy require so the app still boots without the `stripe` package installed
  // in environments that don't need billing yet.
  const Stripe = require('stripe');
  stripeClient = new Stripe(secretKey, { apiVersion: '2024-06-20' });
  return stripeClient;
};

const isStripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;

const PRICE_BY_PLAN = {
  starter: process.env.STRIPE_PRICE_STARTER,
  professional: process.env.STRIPE_PRICE_PROFESSIONAL
};

const PLAN_BY_PRICE = () => {
  const map = {};
  if (process.env.STRIPE_PRICE_STARTER) map[process.env.STRIPE_PRICE_STARTER] = 'starter';
  if (process.env.STRIPE_PRICE_PROFESSIONAL) map[process.env.STRIPE_PRICE_PROFESSIONAL] = 'professional';
  return map;
};

/**
 * Ensures the org has a Stripe Customer, creating one if needed.
 */
const ensureCustomer = async (org, user) => {
  const stripe = getStripe();
  if (org.billingCustomerId) return org.billingCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    name: org.name,
    metadata: { organizationId: String(org._id) }
  });

  org.billingCustomerId = customer.id;
  await org.save();
  return customer.id;
};

/**
 * Creates a Stripe Checkout session (subscription mode) for the given plan.
 * @returns {Promise<string>} checkout URL
 */
const createCheckoutSession = async ({ org, user, planId, successUrl, cancelUrl }) => {
  const priceId = PRICE_BY_PLAN[planId];
  if (!priceId) {
    throw new Error(`No Stripe price configured for plan '${planId}'. Set STRIPE_PRICE_${planId.toUpperCase()} in backend/.env.`);
  }

  const stripe = getStripe();
  const customerId = await ensureCustomer(org, user);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { organizationId: String(org._id), planId },
    subscription_data: { metadata: { organizationId: String(org._id), planId } },
    allow_promotion_codes: true
  });

  return session.url;
};

/**
 * Creates a Stripe Billing Portal session so the org can manage/cancel/update
 * payment methods themselves.
 */
const createPortalSession = async ({ org, returnUrl }) => {
  if (!org.billingCustomerId) {
    throw new Error('This organization has no Stripe customer yet — subscribe to a plan first.');
  }
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: org.billingCustomerId,
    return_url: returnUrl
  });
  return session.url;
};

/**
 * Schedules cancellation at the end of the current billing period.
 */
const cancelSubscription = async (org) => {
  if (!org.billingSubscriptionId) {
    throw new Error('This organization has no active subscription to cancel.');
  }
  const stripe = getStripe();
  return stripe.subscriptions.update(org.billingSubscriptionId, { cancel_at_period_end: true });
};

/**
 * Lightweight subscription snapshot for the Billing UI.
 */
const getSubscriptionSummary = async (org) => {
  if (!org.billingSubscriptionId || !isStripeConfigured()) return null;
  try {
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(org.billingSubscriptionId);
    return {
      status: sub.status,
      cancelAtPeriodEnd: !!sub.cancel_at_period_end,
      currentPeriodEnd: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
    };
  } catch (err) {
    console.warn('[billing] getSubscriptionSummary:', err.message);
    return null;
  }
};

/**
 * Recent invoices for the org's Stripe customer (newest first).
 */
const listInvoices = async (org, { limit = 8 } = {}) => {
  if (!org.billingCustomerId || !isStripeConfigured()) return [];
  const stripe = getStripe();
  const list = await stripe.invoices.list({
    customer: org.billingCustomerId,
    limit: Math.min(20, Math.max(1, limit)),
  });
  return (list.data || []).map((inv) => ({
    id: inv.id,
    number: inv.number,
    status: inv.status,
    amountDue: inv.amount_due,
    amountPaid: inv.amount_paid,
    currency: inv.currency,
    created: inv.created ? new Date(inv.created * 1000).toISOString() : null,
    hostedInvoiceUrl: inv.hosted_invoice_url || null,
    invoicePdf: inv.invoice_pdf || null,
  }));
};

/**
 * Verifies and parses a Stripe webhook payload.
 * @param {Buffer} rawBody
 * @param {string} signature — the `stripe-signature` header
 */
const constructWebhookEvent = (rawBody, signature) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
  }
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
};

module.exports = {
  getStripe,
  isStripeConfigured,
  PRICE_BY_PLAN,
  PLAN_BY_PRICE,
  ensureCustomer,
  createCheckoutSession,
  createPortalSession,
  cancelSubscription,
  getSubscriptionSummary,
  listInvoices,
  constructWebhookEvent
};
