/**
 * Unified meeting transcript webhook for Zoom / Google Meet / Teams / Recall.ai bots (BYOK).
 *
 * External recording/transcript bots (Zoom webhook, Fireflies, etc.) POST here.
 * For native Recall.ai join bots, prefer POST /api/webhooks/recall (and
 * POST /api/interviews/[id]/meeting-bot to send the bot).
 *
 * POST body (JSON):
 * {
 *   provider: "zoom" | "meet" | "teams" | "recall" | "other",
 *   interviewId?: string,          // preferred
 *   videoLink?: string,            // match InterviewEvent.videoLink
 *   externalMeetingId?: string,
 *   transcript: string,
 *   speakers?: [{ speaker, text, startMs?, endMs? }],
 *   timestamps?: [{ label, startMs, endMs? }],
 *   keyMoments?: [{ label, startMs, endMs? }],  // alias → stored on InterviewTranscript.timestamps
 *   recordingConsent?: boolean     // if true, marks interview consent; otherwise interview must already have consent
 * }
 *
 * Auth: MEETING_WEBHOOK_SECRET via X-Meeting-Secret or Bearer (required in production).
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSharedSecret } from '@/lib/webhook-auth';
import type { Prisma } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const authError = requireSharedSecret(req, 'MEETING_WEBHOOK_SECRET', {
      headerNames: ['x-meeting-secret', 'authorization'],
    });
    if (authError) return authError;

    const body = await req.json();
    const transcript = typeof body.transcript === 'string' ? body.transcript.trim() : '';
    if (!transcript) {
      return NextResponse.json({ error: 'transcript required' }, { status: 400 });
    }

    const provider = typeof body.provider === 'string' ? body.provider : 'other';

    let interview = null;
    if (typeof body.interviewId === 'string') {
      interview = await prisma.interviewEvent.findUnique({ where: { id: body.interviewId } });
    }
    if (!interview && typeof body.videoLink === 'string') {
      interview = await prisma.interviewEvent.findFirst({
        where: { videoLink: body.videoLink },
        orderBy: { start: 'desc' },
      });
    }
    if (!interview && typeof body.externalMeetingId === 'string') {
      interview = await prisma.interviewEvent.findFirst({
        where: {
          OR: [
            { videoLink: { contains: body.externalMeetingId } },
            { location: { contains: body.externalMeetingId } },
          ],
        },
        orderBy: { start: 'desc' },
      });
    }

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found for webhook payload' }, { status: 404 });
    }

    // Respect provider recordingConsent flag
    if (body.recordingConsent === true && !interview.recordingConsent) {
      interview = await prisma.interviewEvent.update({
        where: { id: interview.id },
        data: { recordingConsent: true, recordingConsentAt: new Date() },
      });
    }
    if (body.recordingConsent === false) {
      return NextResponse.json(
        { error: 'Provider indicated no recording consent', code: 'CONSENT_DENIED' },
        { status: 403 },
      );
    }

    if (!interview.recordingConsent) {
      return NextResponse.json(
        { error: 'Recording consent not captured for this interview', code: 'CONSENT_REQUIRED' },
        { status: 403 },
      );
    }

    const rawMoments: unknown[] =
      Array.isArray(body.timestamps) && body.timestamps.length > 0
        ? body.timestamps
        : Array.isArray(body.keyMoments)
          ? body.keyMoments
          : [];
    const moments = rawMoments as Prisma.InputJsonValue;

    const saved = await prisma.interviewTranscript.upsert({
      where: { interviewEventId: interview.id },
      create: {
        interviewEventId: interview.id,
        rawTranscript: transcript,
        speakers: (Array.isArray(body.speakers) ? body.speakers : []) as Prisma.InputJsonValue,
        timestamps: moments,
        source: provider,
      },
      update: {
        rawTranscript: transcript,
        speakers: Array.isArray(body.speakers) ? (body.speakers as Prisma.InputJsonValue) : undefined,
        timestamps: rawMoments.length ? moments : undefined,
        source: provider,
      },
    });

    return NextResponse.json({ ok: true, interviewId: interview.id, transcriptId: saved.id });
  } catch (e) {
    console.error('POST /api/webhooks/meetings', e);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    providers: ['zoom', 'meet', 'teams', 'recall', 'other'],
    docs: 'POST transcript JSON with interviewId or videoLink. For Recall.ai join bots use POST /api/interviews/[id]/meeting-bot and receive events at /api/webhooks/recall (or forward a flattened transcript here).',
    recallJoinApi: 'POST /api/interviews/[id]/meeting-bot',
    recallWebhook: 'POST /api/webhooks/recall',
  });
}
