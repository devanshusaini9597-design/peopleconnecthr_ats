import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

// GET /api/scorecards/templates - Get all scorecard templates
export const GET = withAuth(async (_req, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const templates = await prisma.scorecardTemplate.findMany({
      where: {
        isActive: true,
        OR: [
          { organizationId: null },
          { organizationId: orgId },
        ],
      },
      include: {
        criteria: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching scorecard templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
});

// POST /api/scorecards/templates - Create scorecard template
export const POST = withPermission('SCORE_INTERVIEW', async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { name, description, category, criteria, isDefault } = await request.json();

    const template = await prisma.scorecardTemplate.create({
      data: {
        name,
        description,
        category,
        isDefault,
        organizationId: orgId,
        criteria: {
          create: criteria.map((c: any, index: number) => ({
            name: c.name,
            description: c.description,
            maxScore: c.maxScore || 5,
            weight: c.weight || 1.0,
            sortOrder: index,
            suggestedQuestions: c.suggestedQuestions || [],
            whatToLookFor: c.whatToLookFor,
            redFlags: c.redFlags,
          })),
        },
      },
      include: {
        criteria: true,
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error('Error creating scorecard template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
});
