import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';
import { createPortalSession, isStripeConfigured } from '@/lib/stripe';

/**
 * POST /api/billing/portal
 */
export const POST = withAuth(async (_req, _ctx, session) => {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 });
  }

  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Only admins can manage billing' }, { status: 403 });

  const orgId = requireOrgId(session);
  if (isOrgError(orgId)) return orgId;

  const sub = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
  if (!sub?.stripeCustomerId) {
    return NextResponse.json({ error: 'No Stripe customer found. Please subscribe first.' }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const { url } = await createPortalSession(sub.stripeCustomerId, `${appUrl}/dashboard/settings/billing`);

  return NextResponse.json({ url });
});
