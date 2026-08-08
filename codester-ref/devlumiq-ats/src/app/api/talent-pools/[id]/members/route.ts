import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST — add member(s). Requires candidate.talentPoolConsent === true (GDPR).
 * Body: { candidateId } | { candidateIds: string[] } + addedReason?, tags?
 */
export const POST = withPermission('EDIT_CANDIDATE', async (req: NextRequest, ctx: Ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id: poolId } = await ctx.params;

    const pool = await prisma.talentPool.findFirst({
      where: { id: poolId, organizationId: orgId },
    });
    if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 });

    const body = await req.json();
    const ids: string[] = Array.isArray(body.candidateIds)
      ? body.candidateIds
      : body.candidateId
        ? [body.candidateId]
        : [];
    if (!ids.length) {
      return NextResponse.json({ error: 'candidateId or candidateIds required' }, { status: 400 });
    }

    const candidates = await prisma.candidate.findMany({
      where: {
        id: { in: ids },
        organizationId: orgId,
      },
      select: { id: true, name: true, talentPoolConsent: true },
    });

    const added: string[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];

    for (const c of candidates) {
      if (!c.talentPoolConsent) {
        skipped.push({ id: c.id, reason: 'talent_pool_consent_required' });
        continue;
      }
      try {
        await prisma.talentPoolMember.upsert({
          where: { poolId_candidateId: { poolId, candidateId: c.id } },
          create: {
            poolId,
            candidateId: c.id,
            addedReason: typeof body.addedReason === 'string' ? body.addedReason : 'manual',
            addedById: session.id,
            tags: Array.isArray(body.tags) ? body.tags : [],
            notes: typeof body.notes === 'string' ? body.notes : null,
          },
          update: {
            addedReason: typeof body.addedReason === 'string' ? body.addedReason : undefined,
            tags: Array.isArray(body.tags) ? body.tags : undefined,
          },
        });
        added.push(c.id);
      } catch {
        skipped.push({ id: c.id, reason: 'upsert_failed' });
      }
    }

    for (const id of ids.filter((i) => !candidates.some((c) => c.id === i))) {
      skipped.push({ id, reason: 'not_found' });
    }

    return NextResponse.json({ added: added.length, skipped, addedIds: added }, { status: 201 });
  } catch (e) {
    console.error('POST talent-pools members', e);
    return NextResponse.json({ error: 'Failed to add members' }, { status: 500 });
  }
});

export const DELETE = withPermission('EDIT_CANDIDATE', async (req: NextRequest, ctx: Ctx, session) => {
  const orgId = requireOrgId(session);
  if (isOrgError(orgId)) return orgId;

  const { id: poolId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const candidateId = body.candidateId as string | undefined;
  if (!candidateId) {
    return NextResponse.json({ error: 'candidateId required' }, { status: 400 });
  }

  const pool = await prisma.talentPool.findFirst({
    where: { id: poolId, organizationId: orgId },
  });
  if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 });

  await prisma.talentPoolMember.deleteMany({
    where: { poolId, candidateId },
  });
  return NextResponse.json({ ok: true });
});
