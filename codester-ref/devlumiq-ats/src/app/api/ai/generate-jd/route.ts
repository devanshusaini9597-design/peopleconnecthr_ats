import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/with-permission';
import { isAIEnabled, generateJobDescriptionWithAI } from '@/lib/ai';
import { hasFeature } from '@/lib/plan-limits';
import { getPlanContext } from '@/lib/with-plan';

// POST /api/ai/generate-jd — Generate a job description using AI
// Falls back to a structured template if AI is not configured
export const POST = withPermission('CREATE_JOB', async (request: NextRequest, _ctx, session) => {
  try {
    // Plan feature gate: AI JD generation requires AI-enabled plan
    if (session?.organizationId) {
      const { plan } = await getPlanContext(session.organizationId);
      if (!hasFeature(plan, 'ai')) {
        return NextResponse.json({ error: 'AI features require a STARTER or higher plan.', code: 'PLAN_UPGRADE_REQUIRED' }, { status: 403 });
      }
    }

    const { title, department, level, type, notes } = await request.json();

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    // ── AI Generation ─────────────────────────────────────────────────────
    if (isAIEnabled()) {
      const aiResult = await generateJobDescriptionWithAI({ title, department, level, type, notes });
      if (aiResult) {
        return NextResponse.json({
          ...aiResult,
          method: 'ai',
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        });
      }
    }

    // ── Fallback: Structured template ───────────────────────────────────
    const jobLevel = level || 'Mid-level';
    const jobType = type || 'Full-time';
    const dept = department || 'Engineering';

    return NextResponse.json({
      title,
      description: `We are looking for a talented ${title} to join our ${dept} team. This is a ${jobType} ${jobLevel} position where you will play a key role in driving our mission forward.\n\nAs a ${title}, you will collaborate with cross-functional teams to deliver high-impact solutions. We value innovation, teamwork, and continuous learning.`,
      responsibilities: [
        `Lead and contribute to ${dept.toLowerCase()} initiatives and projects`,
        'Collaborate with cross-functional teams to define and deliver solutions',
        'Participate in code reviews, design discussions, and knowledge sharing',
        'Mentor junior team members and contribute to team growth',
        'Identify and implement process improvements',
      ],
      requirements: [
        `Proven experience as a ${title} or similar role`,
        `Strong background in ${dept.toLowerCase()} practices and methodologies`,
        'Excellent communication and collaboration skills',
        'Experience working in agile environments',
        `${jobLevel === 'Senior' || jobLevel === 'Lead' ? '5+' : jobLevel === 'Junior' || jobLevel === 'Entry' ? '0-2' : '3-5'} years of relevant experience`,
      ],
      niceToHave: [
        'Experience with modern tools and technologies',
        'Contributions to open-source projects',
        'Relevant certifications or advanced degree',
      ],
      skills: [],
      salaryRange: 'Competitive, based on experience',
      method: 'template',
    });
  } catch (error) {
    console.error('[AI Generate JD] Error:', error);
    return NextResponse.json({ error: 'Failed to generate job description' }, { status: 500 });
  }
});
