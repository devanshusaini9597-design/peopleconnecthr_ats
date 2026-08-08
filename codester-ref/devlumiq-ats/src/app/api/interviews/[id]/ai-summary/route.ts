import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { validateCsrf } from '@/lib/csrf';
import { summarizeInterviewTranscript } from '@/lib/ai';
import { getPlanContext } from '@/lib/with-plan';
import { hasFeature } from '@/lib/plan-limits';
import { requireOrgId, isOrgError } from '@/lib/require-org';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST — AI summarize transcript → suggest feedbackSummary / score / recommendation.
 * Does NOT auto-submit scorecards — returns suggestions for human confirm.
 * Body: { applySummary?: boolean } — if true, writes feedbackSummary + suggestion fields only
 */
export const POST = withPermission('SCORE_INTERVIEW', async (req: NextRequest, ctx: Ctx, session) => {
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  try {
    const { id } = await ctx.params;

    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { plan } = await getPlanContext(orgId);
    void hasFeature(plan, 'ai');

    const interview = await prisma.interviewEvent.findFirst({
      where: {
        id,
        OR: [
          { candidate: { organizationId: orgId } },
          { job: { companyId: orgId } },
        ],
      },
      include: {
        transcript: true,
        job: { select: { title: true } },
        candidate: { select: { name: true } },
        scorecardTemplate: { include: { criteria: true } },
      },
    });

    if (!interview) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!interview.recordingConsent) {
      return NextResponse.json({ error: 'Recording consent required', code: 'CONSENT_REQUIRED' }, { status: 403 });
    }
    if (!interview.transcript?.rawTranscript) {
      return NextResponse.json({ error: 'No transcript uploaded yet' }, { status: 400 });
    }

    const criteriaNames =
      interview.scorecardTemplate?.criteria?.map((c: { name: string }) => c.name) ?? [];

    const summary = await summarizeInterviewTranscript(interview.transcript.rawTranscript, {
      jobTitle: interview.job?.title,
      candidateName: interview.candidate?.name,
      criteria: criteriaNames,
    });

    if (!summary) {
      return NextResponse.json({ error: 'Summary failed' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const applySummary = body.applySummary !== false;

    await prisma.interviewTranscript.update({
      where: { interviewEventId: id },
      data: {
        aiSummary: summary.feedbackSummary,
        suggestedScore: summary.overallScore,
        suggestedRecommendation: summary.recommendation,
        scorecardSuggestions: summary.scorecardSuggestions,
        timestamps: summary.keyMoments.length
          ? summary.keyMoments
          : interview.transcript.timestamps ?? [],
      },
    });

    if (applySummary) {
      await prisma.interviewEvent.update({
        where: { id },
        data: {
          feedbackSummary: summary.feedbackSummary,
          // Do not overwrite overallScore/recommendation unless empty
          ...(interview.overallScore == null && summary.overallScore != null
            ? { overallScore: summary.overallScore }
            : {}),
          ...((!interview.recommendation || interview.recommendation === 'pending') && summary.recommendation
            ? { recommendation: summary.recommendation }
            : {}),
        },
      });
    }

    return NextResponse.json({
      summary,
      transcript: {
        timestamps: summary.keyMoments.length
          ? summary.keyMoments
          : interview.transcript.timestamps ?? [],
      },
      note: 'Scorecard suggestions are for human confirmation — not auto-submitted.',
    });
  } catch (e) {
    console.error('POST ai-summary', e);
    return NextResponse.json({ error: 'AI summary failed' }, { status: 500 });
  }
});
