/**
 * Recall.ai BYOK meeting join bot helpers.
 *
 * Create a bot via POST /api/v1/bot/, receive realtime transcript webhooks at
 * /api/webhooks/recall, and fetch the final transcript after bot.done.
 *
 * Dashboard setup: also configure the Recall workspace webhook to POST
 * /api/webhooks/recall (subscribed to bot.done / transcript.done) — status-change
 * events are not delivered via realtime_endpoints.
 */

import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export function getRecallBaseUrl(): string {
  const region = (process.env.RECALL_REGION || 'us-east-1').trim();
  return `https://${region}.recall.ai`;
}

function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').replace(/\/$/, '');
}

function getWebhookSecret(): string {
  return (
    process.env.MEETING_WEBHOOK_SECRET ||
    process.env.RECALL_WEBHOOK_SECRET ||
    ''
  ).trim();
}

/** Resolve Recall API key: env first, then org BYOK key. */
export async function resolveRecallApiKey(
  organizationId?: string | null,
): Promise<string | null> {
  const envKey = (process.env.RECALL_API_KEY || '').trim();
  if (envKey) return envKey;

  if (!organizationId) return null;
  try {
    const row = await prisma.orgApiKeyConfig.findUnique({
      where: {
        organizationId_provider: { organizationId, provider: 'recall' },
      },
    });
    if (!row?.isActive || !row.encryptedKey) return null;
    return decrypt(row.encryptedKey);
  } catch {
    return null;
  }
}

export async function recallConfigured(organizationId?: string | null): Promise<boolean> {
  const key = await resolveRecallApiKey(organizationId);
  return Boolean(key);
}

export type CreateRecallBotParams = {
  meetingUrl: string;
  interviewId: string;
  botName?: string;
  joinAt?: string; // ISO
  organizationId?: string | null;
};

export type CreateRecallBotResult = {
  botId: string;
  raw: unknown;
};

function authHeader(apiKey: string): string {
  // Recall tokenAuth accepts "Token <key>" (Django-style)
  if (/^Token\s+/i.test(apiKey)) return apiKey;
  return `Token ${apiKey}`;
}

export async function createRecallBot(
  params: CreateRecallBotParams,
): Promise<CreateRecallBotResult> {
  const apiKey = await resolveRecallApiKey(params.organizationId);
  if (!apiKey) {
    throw new Error('Recall.ai is not configured (RECALL_API_KEY or org recall key)');
  }

  const base = getRecallBaseUrl();
  const appUrl = getAppUrl();
  const secret = getWebhookSecret();
  const webhookUrl =
    appUrl && secret
      ? `${appUrl}/api/webhooks/recall?token=${encodeURIComponent(secret)}`
      : appUrl
        ? `${appUrl}/api/webhooks/recall`
        : null;

  const body: Record<string, unknown> = {
    meeting_url: params.meetingUrl,
    bot_name: params.botName || 'DevLumiq Notes',
    metadata: { interviewId: params.interviewId },
    recording_config: {
      transcript: {
        provider: { meeting_captions: {} },
      },
      ...(webhookUrl
        ? {
            realtime_endpoints: [
              {
                type: 'webhook',
                url: webhookUrl,
                events: ['transcript.data', 'transcript.partial_data'],
              },
            ],
          }
        : {}),
    },
  };

  if (params.joinAt) {
    body.join_at = params.joinAt;
  }

  const res = await fetch(`${base}/api/v1/bot/`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(apiKey),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof (raw as { detail?: string }).detail === 'string'
        ? (raw as { detail: string }).detail
        : `Recall create bot failed (${res.status})`;
    throw new Error(msg);
  }

  const botId =
    typeof (raw as { id?: string }).id === 'string' ? (raw as { id: string }).id : '';
  if (!botId) throw new Error('Recall create bot returned no id');

  return { botId, raw };
}

type TranscriptWord = { text?: string };
type TranscriptSegment = {
  participant?: { name?: string | null };
  words?: TranscriptWord[];
  text?: string;
};

/** Normalize Recall transcript download JSON into plain text + speakers. */
export function formatRecallTranscript(data: unknown): {
  rawTranscript: string;
  speakers: Array<{ speaker: string; text: string; startMs?: number }>;
} {
  const speakers: Array<{ speaker: string; text: string; startMs?: number }> = [];
  const lines: string[] = [];

  const segments: TranscriptSegment[] = Array.isArray(data)
    ? (data as TranscriptSegment[])
    : Array.isArray((data as { results?: unknown })?.results)
      ? ((data as { results: TranscriptSegment[] }).results)
      : [];

  for (const seg of segments) {
    const speaker = seg.participant?.name || 'Speaker';
    const text =
      typeof seg.text === 'string' && seg.text.trim()
        ? seg.text.trim()
        : Array.isArray(seg.words)
          ? seg.words.map((w) => w.text || '').join(' ').replace(/\s+/g, ' ').trim()
          : '';
    if (!text) continue;
    lines.push(`${speaker}: ${text}`);
    speakers.push({ speaker, text });
  }

  // Fallback: nested words-only utterance from realtime events
  if (!lines.length && data && typeof data === 'object') {
    const d = data as {
      words?: TranscriptWord[];
      participant?: { name?: string | null };
    };
    if (Array.isArray(d.words)) {
      const text = d.words.map((w) => w.text || '').join(' ').replace(/\s+/g, ' ').trim();
      if (text) {
        const speaker = d.participant?.name || 'Speaker';
        lines.push(`${speaker}: ${text}`);
        speakers.push({ speaker, text });
      }
    }
  }

  return { rawTranscript: lines.join('\n'), speakers };
}

/**
 * GET bot + download transcript artifact if available.
 * Returns null when transcript is not ready yet.
 */
export async function fetchRecallBotTranscript(
  botId: string,
  organizationId?: string | null,
): Promise<{ rawTranscript: string; speakers: Array<{ speaker: string; text: string }> } | null> {
  const apiKey = await resolveRecallApiKey(organizationId);
  if (!apiKey) return null;

  const base = getRecallBaseUrl();
  const res = await fetch(`${base}/api/v1/bot/${encodeURIComponent(botId)}/`, {
    headers: {
      Authorization: authHeader(apiKey),
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;

  const bot = (await res.json().catch(() => null)) as {
    recordings?: Array<{
      media_shortcuts?: {
        transcript?: { data?: { download_url?: string | null } } | null;
      };
    }>;
  } | null;
  if (!bot) return null;

  const downloadUrl =
    bot.recordings
      ?.map((r) => r.media_shortcuts?.transcript?.data?.download_url)
      .find((u): u is string => typeof u === 'string' && u.length > 0) || null;

  if (!downloadUrl) return null;

  const tRes = await fetch(downloadUrl, { headers: { Accept: 'application/json' } });
  if (!tRes.ok) return null;
  const payload = await tRes.json().catch(() => null);
  if (!payload) return null;

  const formatted = formatRecallTranscript(payload);
  if (!formatted.rawTranscript.trim()) return null;
  return formatted;
}
