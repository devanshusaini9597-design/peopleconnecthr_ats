import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

type Ctx = { params: Promise<{ id: string }> };

async function findOrgTemplate(id: string, orgId: string) {
  return prisma.assessmentTemplate.findFirst({
    where: {
      id,
      OR: [{ organizationId: orgId }, { organizationId: null }],
    },
    include: {
      questions: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { assignments: true, questions: true } },
    },
  });
}

// GET /api/assessments/templates/[id]
export const GET = withAuth(async (_request: NextRequest, ctx: Ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id } = await ctx.params;
    const template = await findOrgTemplate(id, orgId);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error fetching assessment template:', error);
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
  }
});

// PATCH /api/assessments/templates/[id]
export const PATCH = withPermission('MANAGE_SETTINGS', async (request: NextRequest, ctx: Ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id } = await ctx.params;
    const existing = await prisma.assessmentTemplate.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Template not found or system templates are read-only' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const {
      name, description, category, type, duration, difficulty, passingScore, isActive,
      proctoringEnabled, proctoringStrictness, requireFullscreen, snapshotIntervalSec,
    } = body;

    const template = await prisma.assessmentTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(type !== undefined && { type }),
        ...(duration !== undefined && { duration }),
        ...(difficulty !== undefined && { difficulty }),
        ...(passingScore !== undefined && { passingScore }),
        ...(isActive !== undefined && { isActive }),
        ...(proctoringEnabled !== undefined && { proctoringEnabled: !!proctoringEnabled }),
        ...(proctoringStrictness !== undefined && { proctoringStrictness }),
        ...(requireFullscreen !== undefined && { requireFullscreen: !!requireFullscreen }),
        ...(snapshotIntervalSec !== undefined && { snapshotIntervalSec: Number(snapshotIntervalSec) || 30 }),
      },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { assignments: true, questions: true } },
      },
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error updating assessment template:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
});

// DELETE /api/assessments/templates/[id]
export const DELETE = withPermission('MANAGE_SETTINGS', async (_request: NextRequest, ctx: Ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id } = await ctx.params;
    const existing = await prisma.assessmentTemplate.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Template not found or system templates cannot be deleted' },
        { status: 404 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.assessmentResponse.deleteMany({
        where: { assignment: { templateId: id } },
      });
      await tx.assessmentAssignment.deleteMany({
        where: { templateId: id },
      });
      await tx.assessmentTemplate.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting assessment template:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
});
