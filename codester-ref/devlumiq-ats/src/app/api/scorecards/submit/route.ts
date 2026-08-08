import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

async function assertInterviewInOrg(interviewId: string, orgId: string) {
  return prisma.interviewEvent.findFirst({
    where: {
      id: interviewId,
      OR: [
        { candidate: { organizationId: orgId } },
        { job: { companyId: orgId } },
      ],
    },
    select: { id: true },
  });
}

// POST /api/scorecards/submit - Submit interview scores
export const POST = withPermission('SCORE_INTERVIEW', async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { interviewId, scores, recommendation, overallScore, scoredById } = await request.json();

    if (!interviewId || !Array.isArray(scores)) {
      return NextResponse.json({ error: 'interviewId and scores are required' }, { status: 400 });
    }

    const interview = await assertInterviewInOrg(interviewId, orgId);
    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    await prisma.interviewScore.createMany({
      data: scores.map((s: {
        criteriaId?: string;
        criteriaName?: string;
        criteriaDescription?: string;
        score: number;
        maxScore?: number;
        weight?: number;
        notes?: string;
      }) => ({
        interviewId,
        criteriaId: s.criteriaId,
        criteriaName: s.criteriaName,
        criteriaDescription: s.criteriaDescription,
        score: s.score,
        maxScore: s.maxScore || 5,
        weight: s.weight || 1.0,
        notes: s.notes,
        scoredById: scoredById || session.id,
        recommendation,
      })),
    });

    await prisma.interviewEvent.update({
      where: { id: interviewId },
      data: {
        overallScore,
        recommendation,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error submitting scores:', error);
    return NextResponse.json({ error: 'Failed to submit scores' }, { status: 500 });
  }
});

// GET /api/scorecards/submit - Get scores for an interview
export const GET = withAuth(async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { searchParams } = new URL(request.url);
    const interviewId = searchParams.get('interviewId');

    if (!interviewId) {
      return NextResponse.json({ error: 'Interview ID required' }, { status: 400 });
    }

    const interview = await assertInterviewInOrg(interviewId, orgId);
    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    const scores = await prisma.interviewScore.findMany({
      where: { interviewId },
      include: {
        scoredBy: {
          select: { name: true, email: true },
        },
      },
    });

    return NextResponse.json(scores);
  } catch (error) {
    console.error('Error fetching scores:', error);
    return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 500 });
  }
});
