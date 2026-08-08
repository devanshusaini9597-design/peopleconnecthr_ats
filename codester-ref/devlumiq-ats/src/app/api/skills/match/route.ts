import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/with-permission';
import { prisma } from '@/lib/prisma';
import { getJobCandidateMatch } from '@/lib/skills';
import { requireOrgId, isOrgError } from '@/lib/require-org';

/** GET ?jobId=&candidateId=  OR ?jobId= (returns matches for all candidates with skills) */
export const GET = withPermission('VIEW_CANDIDATES', async (req: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    const candidateId = searchParams.get('candidateId');

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        companyId: orgId,
      },
      select: { id: true },
    });
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    if (candidateId) {
      const candidate = await prisma.candidate.findFirst({
        where: {
          id: candidateId,
          organizationId: orgId,
        },
        select: { id: true, name: true },
      });
      if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

      const match = await getJobCandidateMatch(jobId, candidateId);
      return NextResponse.json({
        jobId,
        candidateId,
        match: match ?? {
          matchPercent: null,
          requiredMatchPercent: null,
          matchedCount: 0,
          requiredCount: 0,
          details: [],
          note: 'Job has no taxonomy skills configured',
        },
      });
    }

    // Batch: candidates who applied to this job
    const apps = await prisma.application.findMany({
      where: { jobId },
      select: { candidateId: true, candidate: { select: { id: true, name: true, email: true } } },
      take: 200,
    });

    const results = [];
    for (const app of apps) {
      const match = await getJobCandidateMatch(jobId, app.candidateId);
      results.push({
        candidateId: app.candidate.id,
        name: app.candidate.name,
        email: app.candidate.email,
        matchPercent: match?.matchPercent ?? null,
        requiredMatchPercent: match?.requiredMatchPercent ?? null,
        matchedCount: match?.matchedCount ?? 0,
        requiredCount: match?.requiredCount ?? 0,
      });
    }
    results.sort((a, b) => (b.matchPercent ?? -1) - (a.matchPercent ?? -1));

    return NextResponse.json({ jobId, results });
  } catch (e) {
    console.error('GET /api/skills/match', e);
    return NextResponse.json({ error: 'Failed to compute skill match' }, { status: 500 });
  }
});
