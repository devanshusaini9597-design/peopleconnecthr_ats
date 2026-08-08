/**
 * Native Recall.ai webhook handler (BYOK join bot).
 *
 * Auth: ?token= matching MEETING_WEBHOOK_SECRET or RECALL_WEBHOOK_SECRET,
 * or Authorization / X-Meeting-Secret / X-Recall-Secret header.
 *
 * Configure in Recall dashboard (workspace webhook) for bot.done / transcript.done.
 * Realtime transcript.data events are also sent per-bot via createRecallBot realtime_endpoints.
 *
 * Docs: https://docs.recall.ai/docs/bot-status-change-events
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isProduction, safeEqual } from '@/lib/webhook-auth';
import {
  fetchRecallBotTranscript,
  formatRecallTranscript,
} from '@/lib/meeting-bot';
import type { Prisma } from '@prisma/client';

function extractProvidedSecret(req: NextRequest): string {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('token')?.trim() || '';
  if (fromQuery) return fromQuery;

  const headers = ['authorization', 'x-meeting-secret', 'x-recall-secret'];
  for (const h of headers) {
    const v = req.headers.get(h);
    if (!v) continue;
    const provided = h === 'authorization' ? v.replace(/^Bearer\s+/i, '').trim() : v.trim();
    if (provided) return provided;
  }
  return '';
}

function authorizeRecallWebhook(req: NextRequest): NextResponse | null {
  const secrets = [
    process.env.MEETING_WEBHOOK_SECRET || '',
    process.env.RECALL_WEBHOOK_SECRET || '',
  ]
    .map((s) => s.trim())
    .filter(Boolean);

  const provided = extractProvidedSecret(req);

  if (secrets.length === 0) {
    if (isProduction()) {
      return NextResponse.json(
        { error: 'MEETING_WEBHOOK_SECRET or RECALL_WEBHOOK_SECRET required in production' },
        { status: 503 },
      );
    }
    return null;
  }

  if (!provided || !secrets.some((s) => safeEqual(provided, s))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function extractEventType(body: Record<string, unknown>): string {
  if (typeof body.event === 'string') return body.event;
  if (typeof body.type === 'string') return body.type;
  const data = asRecord(body.data);
  if (data && typeof data.event === 'string') return data.event;
  if (data && typeof data.code === 'string') return data.code;
  const nested = asRecord(data?.data);
  if (nested && typeof nested.code === 'string') return `status.${nested.code}`;
  return '';
}

function extractBotId(body: Record<string, unknown>): string | null {
  const data = asRecord(body.data);
  const bot = asRecord(data?.bot) || asRecord(body.bot);
  if (bot && typeof bot.id === 'string') return bot.id;
  if (typeof body.bot_id === 'string') return body.bot_id;
  if (typeof data?.bot_id === 'string') return data.bot_id as string;
  return null;
}

function extractInterviewId(body: Record<string, unknown>): string | null {
  const data = asRecord(body.data);
  const bot = asRecord(data?.bot) || asRecord(body.bot);
  const meta = asRecord(bot?.metadata) || asRecord(body.metadata) || asRecord(data?.metadata);
  if (meta && typeof meta.interviewId === 'string') return meta.interviewId;
  if (typeof body.interviewId === 'string') return body.interviewId;
  return null;
}

function extractUtteranceText(body: Record<string, unknown>): {
  text: string;
  speaker: string;
} | null {
  const data = asRecord(body.data);
  const inner = asRecord(data?.data) || data;
  if (!inner) return null;

  const participant = asRecord(inner.participant);
  const speaker =
    (participant && typeof participant.name === 'string' && participant.name) || 'Speaker';

  if (typeof inner.text === 'string' && inner.text.trim()) {
    return { text: inner.text.trim(), speaker };
  }

  if (Array.isArray(inner.words)) {
    const text = (inner.words as Array<{ text?: string }>)
      .map((w) => w.text || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) return { text, speaker };
  }

  if (typeof body.transcript === 'string' && body.transcript.trim()) {
    return { text: body.transcript.trim(), speaker: 'Speaker' };
  }

  return null;
}

async function findInterview(interviewId: string | null, botId: string | null) {
  if (interviewId) {
    const byId = await prisma.interviewEvent.findUnique({ where: { id: interviewId } });
    if (byId) return byId;
  }
  if (botId) {
    return prisma.interviewEvent.findFirst({
      where: { meetingBotId: botId },
      orderBy: { start: 'desc' },
    });
  }
  return null;
}

async function upsertTranscript(
  interviewId: string,
  rawTranscript: string,
  speakers: Prisma.InputJsonValue,
  append = false,
) {
  const existing = await prisma.interviewTranscript.findUnique({
    where: { interviewEventId: interviewId },
  });

  let finalText = rawTranscript;
  let finalSpeakers = speakers;

  if (append && existing?.rawTranscript) {
    finalText = `${existing.rawTranscript.trim()}\n${rawTranscript}`.trim();
    const prev = Array.isArray(existing.speakers) ? existing.speakers : [];
    const next = Array.isArray(speakers) ? speakers : [];
    finalSpeakers = [...prev, ...next] as Prisma.InputJsonValue;
  }

  return prisma.interviewTranscript.upsert({
    where: { interviewEventId: interviewId },
    create: {
      interviewEventId: interviewId,
      rawTranscript: finalText,
      speakers: finalSpeakers,
      source: 'recall',
    },
    update: {
      rawTranscript: finalText,
      speakers: finalSpeakers,
      source: 'recall',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const authError = authorizeRecallWebhook(req);
    if (authError) return authError;

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const eventType = extractEventType(body).toLowerCase();
    const botId = extractBotId(body);
    const interviewIdMeta = extractInterviewId(body);

    const interview = await findInterview(interviewIdMeta, botId);
    if (!interview) {
      // Ack unknown bots so Recall does not retry forever
      return NextResponse.json({ ok: true, ignored: true, reason: 'interview_not_found' });
    }

    // Status transitions
    if (
      eventType.includes('joining') ||
      eventType.includes('in_call') ||
      eventType.includes('waiting') ||
      eventType === 'bot.joining_call' ||
      eventType === 'bot.in_call_recording'
    ) {
      await prisma.interviewEvent.update({
        where: { id: interview.id },
        data: {
          meetingBotStatus: 'joining',
          ...(botId && !interview.meetingBotId ? { meetingBotId: botId } : {}),
          meetingBotProvider: interview.meetingBotProvider || 'recall',
        },
      });
      return NextResponse.json({ ok: true, status: 'joining' });
    }

    if (eventType.includes('fatal') || eventType.endsWith('.failed')) {
      await prisma.interviewEvent.update({
        where: { id: interview.id },
        data: { meetingBotStatus: 'failed' },
      });
      return NextResponse.json({ ok: true, status: 'failed' });
    }

    // Realtime utterance — append if consent already captured
    if (
      (eventType === 'transcript.data' || eventType.includes('transcript.data')) &&
      !eventType.includes('partial')
    ) {
      if (!interview.recordingConsent) {
        return NextResponse.json({ ok: true, skipped: 'consent_required' });
      }
      const utterance = extractUtteranceText(body);
      if (utterance) {
        await upsertTranscript(
          interview.id,
          `${utterance.speaker}: ${utterance.text}`,
          [{ speaker: utterance.speaker, text: utterance.text }] as Prisma.InputJsonValue,
          true,
        );
      }
      return NextResponse.json({ ok: true, appended: Boolean(utterance) });
    }

    // Ignore partials (too noisy for persistence)
    if (eventType.includes('partial')) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    // bot.done / transcript.done / recording.done — fetch full transcript
    const isDone =
      eventType === 'bot.done' ||
      eventType === 'transcript.done' ||
      eventType === 'recording.done' ||
      eventType.endsWith('.done') ||
      eventType.includes('call_ended');

    if (isDone) {
      if (!interview.recordingConsent) {
        await prisma.interviewEvent.update({
          where: { id: interview.id },
          data: { meetingBotStatus: 'done' },
        });
        return NextResponse.json({ ok: true, skipped: 'consent_required', status: 'done' });
      }

      const resolvedBotId = botId || interview.meetingBotId;
      let rawTranscript = '';
      let speakers: Prisma.InputJsonValue = [];

      if (resolvedBotId) {
        // Org id via job/candidate for BYOK key resolution
        const withOrg = await prisma.interviewEvent.findUnique({
          where: { id: interview.id },
          include: {
            job: { select: { companyId: true } },
            candidate: { select: { organizationId: true } },
          },
        });
        const orgId =
          withOrg?.job?.companyId || withOrg?.candidate?.organizationId || null;

        const fetched = await fetchRecallBotTranscript(resolvedBotId, orgId);
        if (fetched) {
          rawTranscript = fetched.rawTranscript;
          speakers = fetched.speakers as Prisma.InputJsonValue;
        }
      }

      // Fallback: try inline transcript in payload
      if (!rawTranscript) {
        const utterance = extractUtteranceText(body);
        if (utterance) rawTranscript = `${utterance.speaker}: ${utterance.text}`;
        if (typeof body.transcript === 'string') rawTranscript = body.transcript.trim();
        const data = asRecord(body.data);
        if (!rawTranscript && Array.isArray(data?.transcript)) {
          const formatted = formatRecallTranscript(data.transcript);
          rawTranscript = formatted.rawTranscript;
          speakers = formatted.speakers as Prisma.InputJsonValue;
        }
      }

      if (rawTranscript) {
        await upsertTranscript(interview.id, rawTranscript, speakers, false);
      }

      await prisma.interviewEvent.update({
        where: { id: interview.id },
        data: {
          meetingBotStatus: 'done',
          ...(resolvedBotId ? { meetingBotId: resolvedBotId } : {}),
          meetingBotProvider: 'recall',
        },
      });

      return NextResponse.json({
        ok: true,
        status: 'done',
        interviewId: interview.id,
        hasTranscript: Boolean(rawTranscript),
      });
    }

    return NextResponse.json({ ok: true, ignored: true, event: eventType || null });
  } catch (e) {
    console.error('POST /api/webhooks/recall', e);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: 'recall',
    docs:
      'Native Recall.ai join-bot webhook. Set workspace webhook to this URL for bot.done / transcript.done. Auth via ?token= or Authorization matching MEETING_WEBHOOK_SECRET / RECALL_WEBHOOK_SECRET. Send bots via POST /api/interviews/[id]/meeting-bot.',
  });
}
