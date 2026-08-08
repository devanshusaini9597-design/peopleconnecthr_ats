import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withPermission } from '@/lib/with-permission';
import { requireOrgId, requireOrgFilter, isOrgError } from '@/lib/require-org';

// GET /api/referrals/programs - Get all referral programs
export const GET = withAuth(async (_req, _ctx, session) => {
  try {
    const orgFilter = requireOrgFilter(session);
    if (isOrgError(orgFilter)) return orgFilter;
    const programs = await prisma.referralProgram.findMany({
      where: orgFilter,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { referrals: true },
        },
      },
    });

    return NextResponse.json({ programs });
  } catch (error) {
    console.error('Error fetching referral programs:', error);
    return NextResponse.json({ programs: [] });
  }
});

// POST /api/referrals/programs - Create a new referral program
export const POST = withPermission('MANAGE_REFERRALS', async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const {
      name,
      description,
      rewardType,
      rewardAmount,
      rewardCurrency,
      rewardTiming,
      minDaysEmployed,
      maxReferralsPerMonth,
      eligibleJobIds,
      excludedJobIds,
    } = await request.json();

    const program = await prisma.referralProgram.create({
      data: {
        name,
        description,
        rewardType: rewardType || 'cash',
        rewardAmount: rewardAmount || 0,
        rewardCurrency: rewardCurrency || 'USD',
        rewardTiming: rewardTiming || 'hire',
        minDaysEmployed: minDaysEmployed || 90,
        maxReferralsPerMonth,
        eligibleJobIds: eligibleJobIds || [],
        excludedJobIds: excludedJobIds || [],
        isActive: true,
        organizationId: orgId,
      },
    });

    return NextResponse.json({ success: true, program });
  } catch (error) {
    console.error('Error creating referral program:', error);
    return NextResponse.json({ error: 'Failed to create program' }, { status: 500 });
  }
});
