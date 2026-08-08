import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { PLAN_LIMITS, PLAN_DISPLAY, parseAddOns, type PlanId, hasFeature } from '@/lib/plan-limits';

function freePayload() {
  const plan: PlanId = 'FREE';
  return {
    subscription: {
      id: 'local-free',
      plan,
      status: 'ACTIVE',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      seats: PLAN_LIMITS.FREE.seats,
      stripeCustomerId: false,
      addOns: {},
    },
    limits: PLAN_LIMITS.FREE,
    entitlements: {
      advancedAnalytics: false,
      whiteLabel: false,
      sso: false,
    },
    display: PLAN_DISPLAY.FREE,
  };
}

/**
 * GET /api/billing/subscription
 * Returns the current org subscription info + plan limits + add-ons.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const orgId = session.organizationId;
    if (!orgId) {
      // Session without org — still return a usable Free plan so Settings → Billing is never blank
      return NextResponse.json(freePayload());
    }

    let sub = await prisma.subscription.findUnique({ where: { organizationId: orgId } });

    if (!sub) {
      try {
        sub = await prisma.subscription.create({
          data: { organizationId: orgId, plan: 'FREE', status: 'ACTIVE', seats: 3, addOns: {} },
        });
      } catch {
        // Race or missing migration — fall back to Free payload
        return NextResponse.json(freePayload());
      }
    }

    const plan = (Object.keys(PLAN_LIMITS).includes(sub.plan) ? sub.plan : 'FREE') as PlanId;
    const limits = PLAN_LIMITS[plan];
    const display = PLAN_DISPLAY[plan];
    const addOns = parseAddOns(sub.addOns);

    const entitlements = {
      advancedAnalytics: hasFeature(plan, 'advancedAnalytics') || !!addOns.analyticsPlus,
      whiteLabel: hasFeature(plan, 'whiteLabel') || !!addOns.whiteLabelKit,
      sso: hasFeature(plan, 'sso') || !!addOns.sso,
    };

    return NextResponse.json({
      subscription: {
        id: sub.id,
        plan: sub.plan,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        seats: sub.seats,
        stripeCustomerId: !!sub.stripeCustomerId,
        addOns,
      },
      limits,
      entitlements,
      display,
    });
  } catch (e) {
    console.error('GET /api/billing/subscription', e);
    return NextResponse.json(freePayload());
  }
}
