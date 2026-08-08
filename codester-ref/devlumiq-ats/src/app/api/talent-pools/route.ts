import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';
import { ensureDemoTalentPools } from '@/lib/ensure-demo-talent-pools';

export const GET = withPermission('VIEW_CANDIDATES', async (req: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    // First visit with no pools — seed realistic demo CRM data (creates candidates if needed)
    try {
      await ensureDemoTalentPools(orgId, session.id);
    } catch (e) {
      console.error('ensureDemoTalentPools failed', e);
    }

    const { searchParams } = new URL(req.url);
    const poolType = searchParams.get('type') || undefined;
    const q = searchParams.get('q')?.trim();

    const pools = await prisma.talentPool.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        ...(poolType ? { poolType } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ pools });
  } catch (e) {
    console.error('GET /api/talent-pools', e);
    return NextResponse.json({ error: 'Failed to load pools' }, { status: 500 });
  }
});

export const POST = withPermission('CREATE_CANDIDATE', async (req: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const pool = await prisma.talentPool.create({
      data: {
        organizationId: orgId,
        name,
        description: typeof body.description === 'string' ? body.description : null,
        poolType: typeof body.poolType === 'string' ? body.poolType : 'general',
        tags: Array.isArray(body.tags) ? body.tags : [],
        createdById: session.id,
      },
    });

    return NextResponse.json({ pool }, { status: 201 });
  } catch (e) {
    console.error('POST /api/talent-pools', e);
    return NextResponse.json({ error: 'Failed to create pool' }, { status: 500 });
  }
});
