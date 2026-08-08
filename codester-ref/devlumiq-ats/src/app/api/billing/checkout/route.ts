import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';
import { createCustomer, createCheckoutSession, isStripeConfigured } from '@/lib/stripe';

/**
 * POST /api/billing/checkout
 * Body: { priceId: string }
 */
export const POST = withAuth(async (req: NextRequest, _ctx, session) => {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to .env' }, { status: 503 });
  }

  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Only admins can manage billing' }, { status: 403 });

  const orgId = requireOrgId(session);
  if (isOrgError(orgId)) return orgId;

  const body = await req.json().catch(() => null);
  const priceId = body?.priceId;
  const addOn = typeof body?.addOn === 'string' ? body.addOn : undefined;
  if (!priceId) return NextResponse.json({ error: 'priceId is required' }, { status: 400 });

  let sub = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
  if (!sub) {
    sub = await prisma.subscription.create({
      data: { organizationId: orgId, plan: 'FREE', status: 'ACTIVE', seats: 3, addOns: {} },
    });
  }

  let customerId = sub.stripeCustomerId;
  if (!customerId) {
    const org = await prisma.company.findUnique({ where: { id: orgId } });
    customerId = await createCustomer(session.email + '@billing', org?.name ?? 'Org', orgId);
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const { url } = await createCheckoutSession({
    customerId,
    priceId,
    orgId,
    addOn,
    successUrl: `${appUrl}/dashboard/settings?tab=billing&success=true`,
    cancelUrl: `${appUrl}/dashboard/settings?tab=billing&canceled=true`,
  });

  return NextResponse.json({ url });
});
