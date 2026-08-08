import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { validateCsrf } from '@/lib/csrf';

type Ctx = { params: Promise<{ id: string }> };

async function getInterview(id: string, organizationId: string | null) {
  return prisma.interviewEvent.findFirst({
    where: {
      id,
      ...(organizationId
        ? {
            OR: [
              { candidate: { organizationId } },
              { job: { companyId: organizationId } },
            ],
          }
        : {}),
    },
    include: { transcript: true, job: { select: { title: true } }, candidate: { select: { name: true } } },
  });
}

export const GET = withPermission('VIEW_INTERVIEWS', async (_req, ctx: Ctx, session) => {
  const { id } = await ctx.params;
  const interview = await getInterview(id, session.organizationId);
  if (!interview) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    interview: {
      id: interview.id,
      recordingConsent: interview.recordingConsent,
      transcriptRetentionDays: interview.transcriptRetentionDays,
      feedbackSummary: interview.feedbackSummary,
      videoLink: interview.videoLink,
      meetingBotId: interview.meetingBotId,
      meetingBotProvider: interview.meetingBotProvider,
      meetingBotStatus: interview.meetingBotStatus,
    },
    transcript: interview.transcript,
  });
});

/**
 * POST — upload/replace transcript (manual or webhook payload)
 * Body: { rawTranscript, speakers?, timestamps?, source?, recordingConsent? }
 */
export const POST = withPermission('SCORE_INTERVIEW', async (req: NextRequest, ctx: Ctx, session) => {
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  try {
    const { id } = await ctx.params;
    const interview = await getInterview(id, session.organizationId);
    if (!interview) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    if (body.recordingConsent === true) {
      await prisma.interviewEvent.update({
        where: { id },
        data: { recordingConsent: true, recordingConsentAt: new Date() },
      });
    }

    const fresh = await prisma.interviewEvent.findUnique({ where: { id } });
    if (!fresh?.recordingConsent) {
      return NextResponse.json(
        { error: 'Recording consent required before storing transcript', code: 'CONSENT_REQUIRED' },
        { status: 403 },
      );
    }

    const rawTranscript = typeof body.rawTranscript === 'string' ? body.rawTranscript.trim() : '';
    if (!rawTranscript) {
      return NextResponse.json({ error: 'rawTranscript required' }, { status: 400 });
    }

    const transcript = await prisma.interviewTranscript.upsert({
      where: { interviewEventId: id },
      create: {
        interviewEventId: id,
        rawTranscript,
        speakers: Array.isArray(body.speakers) ? body.speakers : [],
        timestamps: Array.isArray(body.timestamps) ? body.timestamps : [],
        source: typeof body.source === 'string' ? body.source : 'manual',
      },
      update: {
        rawTranscript,
        speakers: Array.isArray(body.speakers) ? body.speakers : undefined,
        timestamps: Array.isArray(body.timestamps) ? body.timestamps : undefined,
        source: typeof body.source === 'string' ? body.source : undefined,
      },
    });

    return NextResponse.json({ transcript }, { status: 201 });
  } catch (e) {
    console.error('POST interview transcript', e);
    return NextResponse.json({ error: 'Failed to save transcript' }, { status: 500 });
  }
});
