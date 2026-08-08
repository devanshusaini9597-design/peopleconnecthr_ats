/**
 * Plan-based route protection for API handlers.
 *
 * Usage:
 *   import { withPlanGate } from '@/lib/with-plan';
 *
 *   export const POST = withPlanGate('api', async (req, session, { plan, limits }) => {
 *     // handler body
 *   });
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasFeature, PLAN_LIMITS, type PlanId } from './plan-limits';

export interface PlanContext {
  plan: PlanId;
  limits: (typeof PLAN_LIMITS)[PlanId];
  subscription: { status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: Date | null };
}

/**
 * Middleware-style wrapper for Next.js API routes that checks plan features.
 * Automatically creates a FREE subscription if none exists.
 *
 * @param requiredFeature — key of PlanLimits to gate on (e.g. 'api', 'ai')
 * @param handler — actual route handler, receives (req, session, planContext)
 */
export function withPlanGate(
  requiredFeature: keyof typeof PLAN_LIMITS['FREE'],
  handler: (req: NextRequest, session: any, planContext: PlanContext) => Promise<Response>
) {
  return async (req: NextRequest): Promise<Response> => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = session.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    let sub = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
    if (!sub) {
      sub = await prisma.subscription.create({
        data: { organizationId: orgId, plan: 'FREE', status: 'ACTIVE', seats: 3 },
      });
    }

    const plan = sub.plan as PlanId;
    const limits = PLAN_LIMITS[plan];

    // If subscription is past due or canceled, downgrade to FREE behavior
    const isPaid = plan !== 'FREE';
    if (isPaid && (sub.status === 'PAST_DUE' || sub.status === 'CANCELED')) {
      // Still allow read operations but block writes for gated features
      if (req.method !== 'GET' && !hasFeature('FREE', requiredFeature)) {
        return NextResponse.json(
          { error: 'Subscription is inactive. Please update your billing.', code: 'SUBSCRIPTION_INACTIVE' },
          { status: 403 }
        );
      }
    }

    if (!hasFeature(plan, requiredFeature)) {
      return NextResponse.json(
        {
          error: `This feature requires a higher plan. Upgrade to unlock.`,
          code: 'PLAN_UPGRADE_REQUIRED',
          currentPlan: plan,
          required: requiredFeature,
        },
        { status: 403 }
      );
    }

    return handler(req, session, {
      plan,
      limits,
      subscription: {
        status: sub.status,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        currentPeriodEnd: sub.currentPeriodEnd,
      },
    });
  };
}

/**
 * Get plan context without checking a specific feature (useful for GET endpoints
 * that want to show different data per plan).
 */
export async function getPlanContext(orgId: string): Promise<PlanContext> {
  let sub = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
  if (!sub) {
    sub = await prisma.subscription.create({
      data: { organizationId: orgId, plan: 'FREE', status: 'ACTIVE', seats: 3 },
    });
  }
  const plan = sub.plan as PlanId;
  return {
    plan,
    limits: PLAN_LIMITS[plan],
    subscription: {
      status: sub.status,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      currentPeriodEnd: sub.currentPeriodEnd,
    },
  };
}
