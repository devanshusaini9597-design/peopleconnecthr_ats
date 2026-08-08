import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  normalizePhone,
  findCandidateByPhone,
  findOrCreateCandidateThread,
  appendInboundMessage,
} from '@/lib/messaging';
import { validateWhatsAppSignature } from '@/lib/webhook-auth';

/**
 * Meta WhatsApp Cloud API webhook (BYOK).
 * GET — verification challenge (WHATSAPP_VERIFY_TOKEN)
 * POST — inbound messages (signed with WHATSAPP_APP_SECRET in production)
 *
 * Env: WHATSAPP_VERIFY_TOKEN, WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_APP_SECRET
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  const verify = process.env.WHATSAPP_VERIFY_TOKEN || '';

  if (mode === 'subscribe' && verify && token === verify && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const sigError = validateWhatsAppSignature(rawBody, req.headers.get('x-hub-signature-256'));
    if (sigError) return sigError;

    const payload = JSON.parse(rawBody || '{}');
    const entries = payload?.entry ?? [];

    for (const entry of entries) {
      const changes = entry?.changes ?? [];
      for (const change of changes) {
        const value = change?.value;
        const messages = value?.messages ?? [];
        for (const msg of messages) {
          if (msg.type !== 'text') continue;
          const from = msg.from ? `+${String(msg.from).replace(/^\+/, '')}` : '';
          const body = msg.text?.body?.trim() || '';
          const wamid = msg.id || '';
          if (!from || !body) continue;

          if (wamid) {
            const dup = await prisma.message.findFirst({ where: { externalId: wamid } });
            if (dup) continue;
          }

          const candidate = await findCandidateByPhone(from, null);
          const orgId = candidate?.organizationId ?? null;

          let threadId: string;
          if (candidate) {
            const thread = await findOrCreateCandidateThread({
              candidateId: candidate.id,
              organizationId: orgId,
              subject: `WhatsApp · ${candidate.name}`,
            });
            threadId = thread.id;
          } else {
            const thread = await prisma.messageThread.create({
              data: {
                subject: `WhatsApp from ${normalizePhone(from)}`,
                lastMessageAt: new Date(),
              },
            });
            threadId = thread.id;
          }

          await appendInboundMessage({
            threadId,
            channel: 'WHATSAPP',
            body,
            fromName: candidate?.name || normalizePhone(from),
            fromPhone: normalizePhone(from),
            externalId: wamid || null,
            metadata: { provider: 'whatsapp_cloud', rawFrom: msg.from },
          });

          const keyword = body.trim().toUpperCase();
          if (candidate && (keyword === 'STOP' || keyword === 'UNSUBSCRIBE')) {
            await prisma.candidate.update({
              where: { id: candidate.id },
              data: { whatsappOptIn: false },
            });
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/webhooks/whatsapp', e);
    return NextResponse.json({ ok: true }); // acknowledge to avoid retries storm
  }
}
