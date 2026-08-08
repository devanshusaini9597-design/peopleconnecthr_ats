import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

/**
 * POST — tag candidate into a keep-warm / silver-medalist pool at rejection.
 * Body: { candidateId, poolId?, poolType?, reason?, grantConsent? }
 * Creates a default "Silver medalists" pool if none provided.
 */
export const POST = withPermission('MOVE_APPLICATION', async (req: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const body = await req.json();
    const candidateId = typeof body.candidateId === 'string' ? body.candidateId : '';
    if (!candidateId) {
      return NextResponse.json({ error: 'candidateId required' }, { status: 400 });
    }

    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, organizationId: orgId },
    });
    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

    // Explicit opt-in only — never silently grant consent (existing buyer safety / GDPR)
    if (body.grantConsent === true) {
      await prisma.candidate.update({
        where: { id: candidateId },
        data: { talentPoolConsent: true, talentPoolConsentAt: new Date() },
      });
    } else if (!candidate.talentPoolConsent) {
      return NextResponse.json(
        { error: 'talent_pool_consent_required', code: 'CONSENT_REQUIRED' },
        { status: 403 },
      );
    }

    let poolId = typeof body.poolId === 'string' ? body.poolId : null;
    if (!poolId) {
      const poolType = typeof body.poolType === 'string' ? body.poolType : 'silver_medalist';
      let pool = await prisma.talentPool.findFirst({
        where: {
          organizationId: orgId,
          poolType,
          isActive: true,
        },
      });
      if (!pool) {
        pool = await prisma.talentPool.create({
          data: {
            organizationId: orgId,
            name: poolType === 'keep_warm' ? 'Keep warm' : 'Silver medalists',
            poolType,
            description: 'Auto-created from rejection flow',
            createdById: session.id,
          },
        });
      }
      poolId = pool.id;
    }

    const member = await prisma.talentPoolMember.upsert({
      where: { poolId_candidateId: { poolId, candidateId } },
      create: {
        poolId,
        candidateId,
        addedReason: typeof body.reason === 'string' ? body.reason : 'rejected_keep_warm',
        addedById: session.id,
        tags: ['rejection'],
      },
      update: {
        addedReason: typeof body.reason === 'string' ? body.reason : 'rejected_keep_warm',
      },
    });

    return NextResponse.json({ ok: true, poolId, memberId: member.id });
  } catch (e) {
    console.error('add-on-reject', e);
    return NextResponse.json({ error: 'Failed to add to pool' }, { status: 500 });
  }
});
