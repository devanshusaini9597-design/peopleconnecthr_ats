/**
 * Stripe billing helpers.
 *
 * All Stripe calls go through this module so route handlers stay thin.
 * Requires: STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET env vars.
 */

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY ?? '';
const STRIPE_API = 'https://api.stripe.com/v1';

/* ---------- low-level helpers ---------- */

function isConfigured(): boolean {
  return STRIPE_SECRET.length > 0;
}

async function stripePost(path: string, body: Record<string, string>): Promise<any> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  });
  return res.json();
}

async function stripeGet(path: string): Promise<any> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
  });
  return res.json();
}

async function stripeDelete(path: string): Promise<any> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
  });
  return res.json();
}

/* ---------- public API ---------- */

/**
 * Returns whether Stripe keys are configured
 */
export function isStripeConfigured(): boolean {
  return isConfigured();
}

/**
 * Create a Stripe Customer for an org
 */
export async function createCustomer(email: string, orgName: string, orgId: string): Promise<string> {
  const customer = await stripePost('/customers', {
    email,
    name: orgName,
    'metadata[orgId]': orgId,
  });
  return customer.id as string;
}

/**
 * Create a Checkout Session for plan upgrade
 */
export async function createCheckoutSession(opts: {
  customerId: string;
  priceId: string;
  orgId: string;
  successUrl: string;
  cancelUrl: string;
  addOn?: string;
}): Promise<{ url: string }> {
  const body: Record<string, string> = {
    customer: opts.customerId,
    'line_items[0][price]': opts.priceId,
    'line_items[0][quantity]': '1',
    mode: 'subscription',
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    'metadata[orgId]': opts.orgId,
    'subscription_data[metadata][orgId]': opts.orgId,
  };
  if (opts.addOn) {
    body['metadata[addOn]'] = opts.addOn;
    body['subscription_data[metadata][addOn]'] = opts.addOn;
  }
  const session = await stripePost('/checkout/sessions', body);
  return { url: session.url };
}

/**
 * Create a Customer Portal session for managing billing
 */
export async function createPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
  const session = await stripePost('/billing_portal/sessions', {
    customer: customerId,
    return_url: returnUrl,
  });
  return { url: session.url };
}

/**
 * Retrieve a subscription from Stripe
 */
export async function getSubscription(subId: string): Promise<any> {
  return stripeGet(`/subscriptions/${subId}`);
}

/**
 * Cancel subscription at period end
 */
export async function cancelSubscription(subId: string): Promise<any> {
  return stripePost(`/subscriptions/${subId}`, {
    cancel_at_period_end: 'true',
  });
}

/**
 * Reactivate a canceled subscription (remove cancel_at_period_end)
 */
export async function reactivateSubscription(subId: string): Promise<any> {
  return stripePost(`/subscriptions/${subId}`, {
    cancel_at_period_end: 'false',
  });
}

/**
 * Construct and verify a Stripe webhook event from raw body + signature header.
 * Uses HMAC-SHA256 per Stripe v1 signature scheme.
 */
export async function constructWebhookEvent(
  rawBody: string,
  sigHeader: string
): Promise<{ type: string; data: { object: any } } | null> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
  if (!secret) return null;

  const elements = sigHeader.split(',');
  const tsPart = elements.find((e) => e.startsWith('t='));
  const sigPart = elements.find((e) => e.startsWith('v1='));
  if (!tsPart || !sigPart) return null;

  const timestamp = tsPart.slice(2);
  const expectedSig = sigPart.slice(3);

  // Compute expected signature
  const { createHmac } = await import('crypto');
  const payload = `${timestamp}.${rawBody}`;
  const computed = createHmac('sha256', secret).update(payload).digest('hex');

  if (computed !== expectedSig) return null;

  // Check timestamp tolerance (5 min)
  const age = Math.abs(Date.now() / 1000 - parseInt(timestamp));
  if (age > 300) return null;

  return JSON.parse(rawBody);
}
