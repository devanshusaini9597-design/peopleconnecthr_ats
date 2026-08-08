import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

// GET /api/assessments/templates - Get assessment templates
export const GET = withAuth(async (_req, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const templates = await prisma.assessmentTemplate.findMany({
      where: {
        isActive: true,
        OR: [{ organizationId: orgId }, { organizationId: null }],
      },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { assignments: true, questions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ templates: templates || [] });
  } catch (error) {
    console.error('Error fetching assessment templates:', error);
    return NextResponse.json({ templates: [] }, { status: 500 });
  }
});

// POST /api/assessments/templates - Create assessment template
export const POST = withPermission('MANAGE_SETTINGS', async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const {
      name, description, category, type, duration, difficulty, passingScore, questions,
      proctoringEnabled, proctoringStrictness, requireFullscreen, snapshotIntervalSec,
    } = await request.json();

    const template = await prisma.assessmentTemplate.create({
      data: {
        name,
        description,
        category,
        type,
        duration,
        difficulty,
        passingScore,
        proctoringEnabled: !!proctoringEnabled,
        proctoringStrictness: proctoringStrictness || 'standard',
        requireFullscreen: !!requireFullscreen,
        snapshotIntervalSec: Number(snapshotIntervalSec) || 30,
        organizationId: orgId,
        questions: {
          create: questions.map((q: any, index: number) => ({
            type: q.type,
            question: q.question,
            description: q.description,
            codeSnippet: q.codeSnippet,
            options: q.options,
            correctAnswer: q.correctAnswer,
            points: q.points || 1,
            sortOrder: index,
            testCases: q.testCases,
            language: q.language,
          })),
        },
      },
      include: {
        questions: true,
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error('Error creating assessment template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
});
