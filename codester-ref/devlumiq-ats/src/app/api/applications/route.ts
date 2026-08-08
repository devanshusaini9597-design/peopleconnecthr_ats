import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stageToDisplay } from '@/lib/api-helpers';
import { withAuth } from '@/lib/with-permission';
import {
  isOrgBlindScreeningEnabled,
  maskCandidateForList,
  shouldBlindScreen,
} from '@/lib/blind-screening';
import { requireOrgId, isOrgError } from '@/lib/require-org';

/** GET: list all applications with candidate + job (for kanban by stage) */
export const GET = withAuth(async (_req, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const orgJobIds = (await prisma.job.findMany({ where: { companyId: orgId }, select: { id: true } })).map(j => j.id);
    const orgFilter = { jobId: { in: orgJobIds } };
    const blindEnabled = shouldBlindScreen(
      session.role,
      await isOrgBlindScreeningEnabled(session.organizationId),
    );
    const applications = await prisma.application.findMany({
      where: orgFilter,
      include: {
        candidate: true,
        job: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const candidateIds = [...new Set(applications.map((a) => a.candidateId))];
    const scoreRows =
      candidateIds.length > 0
        ? await prisma.assessmentAssignment.findMany({
            where: {
              candidateId: { in: candidateIds },
              status: 'completed',
              percentage: { not: null },
            },
            select: { candidateId: true, percentage: true },
          })
        : [];
    const maxScoreByCandidate = new Map<string, number>();
    for (const row of scoreRows) {
      const pct = row.percentage != null ? Number(row.percentage) : NaN;
      if (Number.isNaN(pct)) continue;
      const prev = maxScoreByCandidate.get(row.candidateId);
      if (prev == null || pct > prev) maxScoreByCandidate.set(row.candidateId, pct);
    }

    const list = applications.map((a, i) => {
      const candidate = maskCandidateForList(
        {
          id: a.candidate.id,
          name: a.candidate.name,
          email: a.candidate.email,
          phone: a.candidate.phone,
          source: a.candidate.source,
          createdAt: a.candidate.createdAt.toISOString(),
        },
        i,
        blindEnabled,
      );
      const assessmentScore = maxScoreByCandidate.get(a.candidateId) ?? null;
      return {
        id: a.id,
        candidateId: a.candidateId,
        jobId: a.jobId,
        stage: stageToDisplay(a.stage),
        assessmentScore,
        latestAssessmentScore: assessmentScore,
        candidate,
        job: {
          id: a.job.id,
          title: a.job.title,
        },
      };
    });

    return NextResponse.json({ applications: list, blindScreening: blindEnabled });
  } catch (e) {
    console.error('GET /api/applications', e);
    return NextResponse.json({ error: 'Failed to load applications' }, { status: 500 });
  }
});
