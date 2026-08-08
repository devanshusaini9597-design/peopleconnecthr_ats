import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { isAIEnabled, rankCandidatesWithAI } from '@/lib/ai';
import { hasFeature } from '@/lib/plan-limits';
import { getPlanContext } from '@/lib/with-plan';
import { requireOrgId, requireOrgFilter, requireCompanyFilter, isOrgError } from '@/lib/require-org';

// POST /api/ai/rank — Rank candidates against a job using AI
// Falls back to simple skill-matching score if AI is not configured
export const POST = withPermission('USE_SMART_SEARCH', async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    // Plan feature gate: AI ranking requires AI-enabled plan
    const { plan } = await getPlanContext(orgId);
    if (!hasFeature(plan, 'ai')) {
      return NextResponse.json({ error: 'AI features require a STARTER or higher plan.', code: 'PLAN_UPGRADE_REQUIRED' }, { status: 403 });
    }

    const { jobId, candidateIds } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const orgFilter = requireCompanyFilter(session);
    if (isOrgError(orgFilter)) return orgFilter;

    // Fetch job
    const job = await prisma.job.findUnique({
      where: { id: jobId, ...orgFilter },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Extract skill-like keywords from job requirements text
    const extractSkillsFromText = (text: string | null): string[] => {
      if (!text) return [];
      const words = text.split(/[,;\n•\-]+/).map(w => w.trim()).filter(w => w.length > 1 && w.length < 40);
      return words;
    };
    const jobSkillsList = extractSkillsFromText(job.requirements);

    // Fetch candidates — either specific IDs or all candidates with applications for this job
    const candidateOrgFilter = requireOrgFilter(session);
    if (isOrgError(candidateOrgFilter)) return candidateOrgFilter;
    const candidates = await prisma.candidate.findMany({
      where: candidateIds?.length
        ? { id: { in: candidateIds }, ...candidateOrgFilter }
        : { applications: { some: { jobId } }, ...candidateOrgFilter },
      take: 50,
    });

    if (candidates.length === 0) {
      return NextResponse.json({ rankings: [], method: 'none', message: 'No candidates found' });
    }

    // ── AI Ranking ──────────────────────────────────────────────────────────
    if (isAIEnabled()) {
      const aiRankings = await rankCandidatesWithAI(
        candidates.map(c => ({
          id: c.id,
          name: c.name,
          skills: (c.skills as unknown as string[]) ?? [],
          experience: c.experience,
          currentTitle: c.currentTitle,
          summary: c.resumeText,
        })),
        {
          title: job.title,
          department: job.department,
          description: job.description,
          requirements: job.requirements,
          skills: jobSkillsList,
        }
      );

      if (aiRankings) {
        return NextResponse.json({
          rankings: aiRankings.sort((a, b) => b.score - a.score),
          method: 'ai',
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        });
      }
    }

    // ── Fallback: Simple skill-matching score ───────────────────────────────
    const jobSkillsLower = jobSkillsList.map(s => s.toLowerCase());
    const rankings = candidates.map(c => {
      const candidateSkills = ((c.skills as unknown as string[]) ?? []).map((s: string) => s.toLowerCase());
      const matchingSkills = candidateSkills.filter((s: string) => jobSkillsLower.some(js => s.includes(js) || js.includes(s)));
      const skillScore = jobSkillsLower.length > 0 ? Math.round((matchingSkills.length / jobSkillsLower.length) * 70) : 0;
      const expScore = c.experience ? Math.min(30, c.experience * 3) : 0;
      const score = Math.min(100, skillScore + expScore);

      return {
        candidateId: c.id,
        score,
        reasoning: `Matched ${matchingSkills.length}/${jobSkillsLower.length} required skills, ${c.experience ?? 0} years experience.`,
        strengths: matchingSkills.slice(0, 3),
        gaps: jobSkillsLower.filter((s: string) => !candidateSkills.includes(s)).slice(0, 3),
      };
    });

    return NextResponse.json({
      rankings: rankings.sort((a, b) => b.score - a.score),
      method: 'rule-based',
    });
  } catch (error) {
    console.error('[AI Rank] Error:', error);
    return NextResponse.json({ error: 'Failed to rank candidates' }, { status: 500 });
  }
});
