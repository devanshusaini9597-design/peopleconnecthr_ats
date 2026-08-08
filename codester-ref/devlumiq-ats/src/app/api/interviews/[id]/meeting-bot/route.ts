import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { validateCsrf } from '@/lib/csrf';
import {
  createRecallBot,
  recallConfigured,
} from '@/lib/meeting-bot';

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
  });
}

/**
 * GET — bot status + whether Recall is configured for this org.
 */
export const GET = withPermission('VIEW_INTERVIEWS', async (_req, ctx: Ctx, session) => {
  const { id } = await ctx.params;
  const interview = await getInterview(id, session.organizationId);
  if (!interview) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const configured = await recallConfigured(session.organizationId);
  return NextResponse.json({
    configured,
    provider: interview.meetingBotProvider || null,
    botId: interview.meetingBotId || null,
    status: interview.meetingBotStatus || null,
    videoLink: interview.videoLink || null,
    recordingConsent: interview.recordingConsent,
  });
});

/**
 * POST — send Recall.ai join bot to the interview meeting URL.
 * Body: { videoLink?, botName?, joinAt?, recordingConsent? }
 */
export const POST = withPermission('SCHEDULE_INTERVIEW', async (req: NextRequest, ctx: Ctx, session) => {
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  try {
    const { id } = await ctx.params;
    const interview = await getInterview(id, session.organizationId);
    if (!interview) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const configured = await recallConfigured(session.organizationId);
    if (!configured) {
      return NextResponse.json(
        {
          error: 'Recall.ai is not configured. Set RECALL_API_KEY or add a recall key in Settings → API keys.',
          code: 'RECALL_NOT_CONFIGURED',
        },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const updates: {
      recordingConsent?: boolean;
      recordingConsentAt?: Date;
      videoLink?: string;
      meetingBotId?: string;
      meetingBotProvider?: string;
      meetingBotStatus?: string;
    } = {};

    if (body.recordingConsent === true) {
      updates.recordingConsent = true;
      updates.recordingConsentAt = new Date();
    }

    if (typeof body.videoLink === 'string' && body.videoLink.trim()) {
      updates.videoLink = body.videoLink.trim();
    }

    if (Object.keys(updates).length > 0) {
      await prisma.interviewEvent.update({ where: { id }, data: updates });
    }

    const fresh = await prisma.interviewEvent.findUnique({ where: { id } });
    if (!fresh?.recordingConsent) {
      return NextResponse.json(
        { error: 'Recording consent required before sending a meeting bot', code: 'CONSENT_REQUIRED' },
        { status: 403 },
      );
    }

    const videoLink = fresh.videoLink?.trim() || '';
    if (!videoLink) {
      return NextResponse.json(
        { error: 'videoLink required (meeting URL for Zoom / Meet / Teams)', code: 'VIDEO_LINK_REQUIRED' },
        { status: 400 },
      );
    }

    const joinAt =
      typeof body.joinAt === 'string' && body.joinAt.trim() ? body.joinAt.trim() : undefined;
    const botName =
      typeof body.botName === 'string' && body.botName.trim() ? body.botName.trim() : undefined;

    await prisma.interviewEvent.update({
      where: { id },
      data: {
        meetingBotProvider: 'recall',
        meetingBotStatus: 'pending',
      },
    });

    const { botId } = await createRecallBot({
      meetingUrl: videoLink,
      interviewId: id,
      botName,
      joinAt,
      organizationId: session.organizationId,
    });

    await prisma.interviewEvent.update({
      where: { id },
      data: {
        meetingBotId: botId,
        meetingBotProvider: 'recall',
        meetingBotStatus: 'joining',
      },
    });

    return NextResponse.json({ ok: true, botId, provider: 'recall', status: 'joining' });
  } catch (e) {
    console.error('POST interview meeting-bot', e);
    try {
      const { id } = await ctx.params;
      await prisma.interviewEvent.update({
        where: { id },
        data: { meetingBotStatus: 'failed' },
      });
    } catch {
      /* ignore */
    }
    const message = e instanceof Error ? e.message : 'Failed to create meeting bot';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
