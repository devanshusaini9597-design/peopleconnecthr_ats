import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

async function assertCandidateInOrg(candidateId: string, orgId: string) {
  return prisma.candidate.findFirst({
    where: { id: candidateId, organizationId: orgId },
    select: { id: true },
  });
}

async function getOrCreateInterview(candidateId: string, userId: string) {
  let interview = await prisma.interviewEvent.findFirst({
    where: { candidateId },
    orderBy: { createdAt: 'desc' },
  });

  if (!interview) {
    interview = await prisma.interviewEvent.create({
      data: {
        title: 'Interview Evaluation',
        type: 'general',
        candidateId,
        assignedToId: userId,
        start: new Date(),
        status: 'completed',
      },
    });
  }

  return interview;
}

export const GET = withAuth(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  session,
) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id } = await params;
    const candidate = await assertCandidateInOrg(id, orgId);
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const interviews = await prisma.interviewEvent.findMany({
      where: { candidateId: id },
      select: { id: true },
    });

    if (interviews.length === 0) {
      return NextResponse.json({ scores: [] });
    }

    const interviewIds = interviews.map((i) => i.id);

    const scores = await prisma.interviewScore.findMany({
      where: { interviewId: { in: interviewIds } },
      include: { scoredBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      scores: scores.map((s) => ({
        id: s.id,
        criteria: s.criteriaName,
        score: s.score,
        maxScore: s.maxScore,
        notes: s.notes || '',
        scoredBy: s.scoredBy?.name ?? 'Unknown',
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('GET /api/candidates/[id]/scores', error);
    return NextResponse.json({ scores: [] });
  }
});

export const POST = withPermission('SCORE_INTERVIEW', async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  session,
) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id } = await params;
    const candidate = await assertCandidateInOrg(id, orgId);
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const data = await req.json();

    const interview = await getOrCreateInterview(id, session.id);

    // Upsert: update if same criteria exists, else create
    const existing = await prisma.interviewScore.findFirst({
      where: {
        interviewId: interview.id,
        criteriaName: data.criteria,
      },
    });

    let score;
    if (existing) {
      score = await prisma.interviewScore.update({
        where: { id: existing.id },
        data: {
          score: data.score,
          notes: data.notes || '',
        },
        include: { scoredBy: { select: { name: true } } },
      });
    } else {
      score = await prisma.interviewScore.create({
        data: {
          interviewId: interview.id,
          criteriaName: data.criteria,
          score: data.score,
          maxScore: data.maxScore || 5,
          notes: data.notes || '',
          scoredById: session.id,
          weight: 1.0,
        },
        include: { scoredBy: { select: { name: true } } },
      });
    }

    return NextResponse.json({
      id: score.id,
      criteria: score.criteriaName,
      score: score.score,
      maxScore: score.maxScore,
      notes: score.notes || '',
      scoredBy: score.scoredBy?.name ?? session.name,
      createdAt: score.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/candidates/[id]/scores', error);
    return NextResponse.json({ error: 'Failed to save score' }, { status: 500 });
  }
});

export const DELETE = withPermission('SCORE_INTERVIEW', async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  session,
) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id } = await params;
    const candidate = await assertCandidateInOrg(id, orgId);
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // Delete all scores for this candidate's interviews
    const interviews = await prisma.interviewEvent.findMany({
      where: { candidateId: id },
      select: { id: true },
    });

    if (interviews.length > 0) {
      await prisma.interviewScore.deleteMany({
        where: { interviewId: { in: interviews.map((i) => i.id) } },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/candidates/[id]/scores', error);
    return NextResponse.json({ error: 'Failed to delete scores' }, { status: 500 });
  }
});
