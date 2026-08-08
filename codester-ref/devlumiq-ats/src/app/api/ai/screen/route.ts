import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { isAIEnabled, screenCandidateWithAI } from '@/lib/ai';
import { hasFeature } from '@/lib/plan-limits';
import { getPlanContext } from '@/lib/with-plan';
import { requireOrgId, requireOrgFilter, requireCompanyFilter, isOrgError } from '@/lib/require-org';

// POST /api/ai/screen — Screen a candidate against a job using AI
// Falls back to simple skill-matching if AI is not configured
export const POST = withPermission('VIEW_CANDIDATES', async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    // Plan feature gate: AI screening requires AI-enabled plan
    const { plan } = await getPlanContext(orgId);
    if (!hasFeature(plan, 'ai')) {
      return NextResponse.json({ error: 'AI features require a STARTER or higher plan.', code: 'PLAN_UPGRADE_REQUIRED' }, { status: 403 });
    }

    const { candidateId, jobId } = await request.json();

    if (!candidateId || !jobId) {
      return NextResponse.json({ error: 'candidateId and jobId are required' }, { status: 400 });
    }

    const candidateOrgFilter = requireOrgFilter(session);
    if (isOrgError(candidateOrgFilter)) return candidateOrgFilter;
    const jobOrgFilter = requireCompanyFilter(session);
    if (isOrgError(jobOrgFilter)) return jobOrgFilter;

    const [candidate, job] = await Promise.all([
      prisma.candidate.findUnique({ where: { id: candidateId, ...candidateOrgFilter } }),
      prisma.job.findUnique({ where: { id: jobId, ...jobOrgFilter } }),
    ]);

    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    // Extract skill-like keywords from job requirements text
    const extractSkillsFromText = (text: string | null): string[] => {
      if (!text) return [];
      return text.split(/[,;\n•\-]+/).map(w => w.trim()).filter(w => w.length > 1 && w.length < 40);
    };
    const jobSkillsList = extractSkillsFromText(job.requirements);

    // ── AI Screening ───────────────────────────────────────────────────────
    if (isAIEnabled()) {
      const aiResult = await screenCandidateWithAI(
        {
          name: candidate.name,
          skills: (candidate.skills as unknown as string[]) ?? [],
          experience: candidate.experience,
          currentTitle: candidate.currentTitle,
          resumeText: candidate.resumeText,
        },
        {
          title: job.title,
          description: job.description,
          requirements: job.requirements,
          skills: jobSkillsList,
        }
      );

      if (aiResult) {
        return NextResponse.json({
          ...aiResult,
          candidateId,
          jobId,
          method: 'ai',
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        });
      }
    }

    // ── Fallback: Simple skill-matching ──────────────────────────────────
    const jobSkillsLower = jobSkillsList.map(s => s.toLowerCase());
    const candidateSkills = ((candidate.skills as unknown as string[]) ?? []).map((s: string) => s.toLowerCase());
    const matchingSkills = candidateSkills.filter((s: string) => jobSkillsLower.some(js => s.includes(js) || js.includes(s)));
    const missingSkills = jobSkillsLower.filter((s: string) => !candidateSkills.includes(s));
    const skillScore = jobSkillsLower.length > 0 ? Math.round((matchingSkills.length / jobSkillsLower.length) * 70) : 30;
    const expScore = candidate.experience ? Math.min(30, candidate.experience * 3) : 0;
    const score = Math.min(100, skillScore + expScore);

    let verdict: 'strong_match' | 'potential_match' | 'weak_match' = 'weak_match';
    if (score >= 70) verdict = 'strong_match';
    else if (score >= 40) verdict = 'potential_match';

    return NextResponse.json({
      verdict,
      score,
      summary: `Candidate matches ${matchingSkills.length} of ${jobSkillsLower.length} required skills with ${candidate.experience ?? 0} years of experience.`,
      matchingSkills,
      missingSkills,
      experienceMatch: candidate.experience
        ? `${candidate.experience} years of experience as ${candidate.currentTitle || 'a professional'}.`
        : 'Experience information not available.',
      recommendation: verdict === 'strong_match'
        ? 'Strong fit. Recommend proceeding to interview.'
        : verdict === 'potential_match'
          ? 'Partial fit. Consider for phone screen to assess missing areas.'
          : 'Limited match. May not meet core requirements.',
      candidateId,
      jobId,
      method: 'rule-based',
    });
  } catch (error) {
    console.error('[AI Screen] Error:', error);
    return NextResponse.json({ error: 'Failed to screen candidate' }, { status: 500 });
  }
});
