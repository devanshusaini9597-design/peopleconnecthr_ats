import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { validateCsrf } from '@/lib/csrf';
import { requireOrgId, isOrgError } from '@/lib/require-org';

type Ctx = { params: Promise<{ id: string }> };

async function assertJobAccess(jobId: string, organizationId: string) {
  return prisma.job.findFirst({
    where: { id: jobId, companyId: organizationId },
    select: { id: true },
  });
}

export const GET = withPermission('VIEW_JOBS', async (_req, ctx: Ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id } = await ctx.params;
    const job = await assertJobAccess(id, orgId);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const skills = await prisma.jobSkill.findMany({
      where: { jobId: id },
      include: { skill: { select: { id: true, name: true, slug: true, category: true } } },
      orderBy: [{ required: 'desc' }, { skill: { name: 'asc' } }],
    });

    return NextResponse.json({ skills });
  } catch (e) {
    console.error('GET /api/jobs/[id]/skills', e);
    return NextResponse.json({ error: 'Failed to load job skills' }, { status: 500 });
  }
});

export const PUT = withPermission('EDIT_JOB', async (req: NextRequest, ctx: Ctx, session) => {
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id } = await ctx.params;
    const job = await assertJobAccess(id, orgId);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const body = await req.json();
    type Item = {
      skillId: string;
      required?: boolean;
      minProficiency?: number;
      weight?: number;
    };
    if (!Array.isArray(body.skills)) {
      return NextResponse.json({ error: 'skills[] is required' }, { status: 400 });
    }
    const items = (body.skills as Item[]).filter((s) => s?.skillId);
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
      await tx.jobSkill.deleteMany({ where: { jobId: id } });
      if (filtered.length) {
        await tx.jobSkill.createMany({
          data: filtered.map((i) => ({
            jobId: id,
            skillId: i.skillId,
            required: i.required !== false,
            minProficiency: Math.min(5, Math.max(1, i.minProficiency ?? 1)),
            weight: typeof i.weight === 'number' && i.weight > 0 ? i.weight : 1,
          })),
        });
      }
    });

    const skills = await prisma.jobSkill.findMany({
      where: { jobId: id },
      include: { skill: { select: { id: true, name: true, slug: true, category: true } } },
      orderBy: [{ required: 'desc' }, { skill: { name: 'asc' } }],
    });

    return NextResponse.json({ skills });
  } catch (e) {
    console.error('PUT /api/jobs/[id]/skills', e);
    return NextResponse.json({ error: 'Failed to update job skills' }, { status: 500 });
  }
});
