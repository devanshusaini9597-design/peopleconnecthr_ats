import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { validateCsrf } from '@/lib/csrf';

type Ctx = { params: Promise<{ id: string }> };

async function getOrgPool(id: string, organizationId: string | null) {
  if (!organizationId) return null;
  return prisma.talentPool.findFirst({
    where: { id, organizationId },
  });
}

export const GET = withPermission('VIEW_CANDIDATES', async (req: NextRequest, ctx: Ctx, session) => {
  try {
    const { id } = await ctx.params;
    const pool = await getOrgPool(id, session.organizationId);
    if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const skills = searchParams.get('skills')?.split(',').filter(Boolean) ?? [];
    const location = searchParams.get('location')?.trim();
    const contactedBefore = searchParams.get('contactedBefore');
    const contactedAfter = searchParams.get('contactedAfter');

    let members = await prisma.talentPoolMember.findMany({
      where: { poolId: id },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            location: true,
            city: true,
            skills: true,
            tags: true,
            currentTitle: true,
            experience: true,
            talentPoolConsent: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (location) {
      const loc = location.toLowerCase();
      members = members.filter(
        (m) =>
          m.candidate.location?.toLowerCase().includes(loc) ||
          m.candidate.city?.toLowerCase().includes(loc),
      );
    }
    if (skills.length) {
      members = members.filter((m) => {
        const cSkills = (m.candidate.skills as unknown as string[]) ?? [];
        return skills.some((s) => cSkills.some((cs) => cs.toLowerCase() === s.toLowerCase()));
      });
    }
    if (contactedBefore) {
      const d = new Date(contactedBefore);
      members = members.filter((m) => !m.lastContactedAt || m.lastContactedAt < d);
    }
    if (contactedAfter) {
      const d = new Date(contactedAfter);
      members = members.filter((m) => m.lastContactedAt && m.lastContactedAt >= d);
    }

    return NextResponse.json({ pool, members });
  } catch (e) {
    console.error('GET /api/talent-pools/[id]', e);
    return NextResponse.json({ error: 'Failed to load pool' }, { status: 500 });
  }
});

export const PATCH = withPermission('EDIT_CANDIDATE', async (req: NextRequest, ctx: Ctx, session) => {
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  const { id } = await ctx.params;
  const pool = await getOrgPool(id, session.organizationId);
  if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.talentPool.update({
    where: { id },
    data: {
      ...(typeof body.name === 'string' ? { name: body.name.trim() } : {}),
      ...(typeof body.description === 'string' ? { description: body.description } : {}),
      ...(typeof body.poolType === 'string' ? { poolType: body.poolType } : {}),
      ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
      ...(Array.isArray(body.tags) ? { tags: body.tags } : {}),
    },
  });
  return NextResponse.json({ pool: updated });
});

export const DELETE = withPermission('DELETE_CANDIDATE', async (_req, ctx: Ctx, session) => {
  const csrfError = validateCsrf(_req);
  if (csrfError) return csrfError;

  const { id } = await ctx.params;
  const pool = await getOrgPool(id, session.organizationId);
  if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 });

  await prisma.talentPool.update({
    where: { id },
    data: { isActive: false },
  });
  return NextResponse.json({ ok: true });
});
