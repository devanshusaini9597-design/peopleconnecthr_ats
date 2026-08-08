import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { validateCsrf } from '@/lib/csrf';
import { syncCandidateSkillsJson } from '@/lib/skills';
import { requireOrgId, isOrgError } from '@/lib/require-org';

type Ctx = { params: Promise<{ id: string }> };

async function assertCandidateAccess(candidateId: string, organizationId: string) {
  return prisma.candidate.findFirst({
    where: { id: candidateId, organizationId },
    select: { id: true, organizationId: true },
  });
}

export const GET = withPermission('VIEW_CANDIDATES', async (_req, ctx: Ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id } = await ctx.params;
    const candidate = await assertCandidateAccess(id, orgId);
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const skills = await prisma.candidateSkill.findMany({
      where: { candidateId: id },
      include: { skill: { select: { id: true, name: true, slug: true, category: true, isSystem: true } } },
      orderBy: { skill: { name: 'asc' } },
    });

    return NextResponse.json({ skills });
  } catch (e) {
    console.error('GET /api/candidates/[id]/skills', e);
    return NextResponse.json({ error: 'Failed to load skills' }, { status: 500 });
  }
});

/** Replace candidate skills: [{ skillId, proficiency?, yearsUsed? }] or { skillIds: string[] } */
export const PUT = withPermission('EDIT_CANDIDATE', async (req: NextRequest, ctx: Ctx, session) => {
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id } = await ctx.params;
    const candidate = await assertCandidateAccess(id, orgId);
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const body = await req.json();
    type Item = { skillId: string; proficiency?: number; yearsUsed?: number | null; source?: string };
    let items: Item[] = [];

    if (Array.isArray(body.skills)) {
      items = body.skills.filter((s: Item) => s?.skillId);
    } else if (Array.isArray(body.skillIds)) {
      items = body.skillIds.map((skillId: string) => ({ skillId }));
    } else {
      return NextResponse.json({ error: 'Provide skills[] or skillIds[]' }, { status: 400 });
    }

    const skillIds = [...new Set(items.map((i) => i.skillId))];
    const found = await prisma.skill.findMany({
      where: {
        id: { in: skillIds },
        OR: [{ isSystem: true }, { organizationId: orgId }],
      },
      select: { id: true },
    });
    const allowed = new Set(found.map((f) => f.id));
    const filtered = items.filter((i) => allowed.has(i.skillId));

    await prisma.$transaction(async (tx) => {
      await tx.candidateSkill.deleteMany({ where: { candidateId: id } });
      if (filtered.length) {
        await tx.candidateSkill.createMany({
          data: filtered.map((i) => ({
            candidateId: id,
            skillId: i.skillId,
            proficiency: Math.min(5, Math.max(1, i.proficiency ?? 3)),
            yearsUsed: i.yearsUsed ?? null,
            source: i.source ?? 'manual',
          })),
        });
      }
    });

    await syncCandidateSkillsJson(id);

    const skills = await prisma.candidateSkill.findMany({
      where: { candidateId: id },
      include: { skill: { select: { id: true, name: true, slug: true, category: true, isSystem: true } } },
      orderBy: { skill: { name: 'asc' } },
    });

    return NextResponse.json({ skills });
  } catch (e) {
    console.error('PUT /api/candidates/[id]/skills', e);
    return NextResponse.json({ error: 'Failed to update skills' }, { status: 500 });
  }
});
