import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { getJobCandidateMatch } from '@/lib/skills';
import { requireOrgId, isOrgError } from '@/lib/require-org';

/**
 * GET /api/talent-pools/suggest?jobId=
 * Suggest pool members who match a new/open job (skills overlap or taxonomy match).
 */
export const GET = withPermission('VIEW_CANDIDATES', async (req: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const jobId = new URL(req.url).searchParams.get('jobId');
    if (!jobId) {
      return NextResponse.json({ error: 'jobId required' }, { status: 400 });
    }

    const job = await prisma.job.findFirst({
      where: { id: jobId, companyId: orgId },
      select: { id: true, title: true, requirements: true },
    });
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const members = await prisma.talentPoolMember.findMany({
      where: {
        pool: { organizationId: orgId, isActive: true },
        candidate: { talentPoolConsent: true },
      },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            skills: true,
            location: true,
            currentTitle: true,
            experience: true,
          },
        },
        pool: { select: { id: true, name: true, poolType: true } },
      },
      take: 300,
    });

    // Deduplicate by candidate
    const byCandidate = new Map<string, (typeof members)[0]>();
    for (const m of members) {
      if (!byCandidate.has(m.candidateId)) byCandidate.set(m.candidateId, m);
    }

    const reqText = (job.requirements || job.title || '').toLowerCase();
    const suggestions = [];

    for (const m of byCandidate.values()) {
      const c = m.candidate;
      const skills = (c.skills as unknown as string[]) ?? [];
      const skillHits = skills.filter((s) => reqText.includes(s.toLowerCase()));
      const taxonomy = await getJobCandidateMatch(jobId, c.id);
      const matchPercent =
        taxonomy?.matchPercent ??
        (skills.length
          ? Math.min(100, Math.round((skillHits.length / Math.max(1, Math.min(skills.length, 5))) * 100))
          : 0);

      if (matchPercent < 20 && skillHits.length === 0) continue;

      suggestions.push({
        candidateId: c.id,
        name: c.name,
        email: c.email,
        location: c.location,
        currentTitle: c.currentTitle,
        skills,
        poolId: m.pool.id,
        poolName: m.pool.name,
        poolType: m.pool.poolType,
        matchPercent,
        skillHits,
      });
    }

    suggestions.sort((a, b) => b.matchPercent - a.matchPercent);

    return NextResponse.json({
      jobId,
      jobTitle: job.title,
      suggestions: suggestions.slice(0, 50),
    });
  } catch (e) {
    console.error('GET talent-pools/suggest', e);
    return NextResponse.json({ error: 'Failed to suggest' }, { status: 500 });
  }
});
