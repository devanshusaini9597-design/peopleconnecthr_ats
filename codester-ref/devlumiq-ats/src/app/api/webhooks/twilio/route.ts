import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  normalizePhone,
  findCandidateByPhone,
  findOrCreateCandidateThread,
  appendInboundMessage,
  twilioConfigured,
} from '@/lib/messaging';
import { isProduction, validateTwilioSignature } from '@/lib/webhook-auth';

/**
 * Twilio inbound SMS webhook (form-urlencoded).
 * Configure Twilio Messaging webhook URL → POST /api/webhooks/twilio
 *
 * Signature validated with TWILIO_AUTH_TOKEN (or TWILIO_WEBHOOK_AUTH_TOKEN).
 * Production requires auth token when this endpoint is used; local/dev allows unset.
 */
export async function POST(req: NextRequest) {
  try {
    // If Twilio send keys aren't configured and we're in prod, still require signature
    // only when an auth token exists — otherwise reject forged traffic in prod.
    if (isProduction() && !twilioConfigured() && !process.env.TWILIO_WEBHOOK_AUTH_TOKEN) {
      // Endpoint unused — reject to avoid open write surface for existing buyers
      return new NextResponse('Not configured', { status: 503 });
    }

    const form = await req.formData();
    const params: Record<string, string> = {};
    form.forEach((value, key) => {
      params[key] = String(value);
    });

    const sigError = validateTwilioSignature(req, params);
    if (sigError) return sigError;

    const from = params.From || '';
    const to = params.To || '';
    const body = (params.Body || '').trim();
    const messageSid = params.MessageSid || '';

    if (!from || !body) {
      return new NextResponse('<Response></Response>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    if (messageSid) {
      const dup = await prisma.message.findFirst({ where: { externalId: messageSid } });
      if (dup) {
        return new NextResponse('<Response></Response>', {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }
    }

    const candidate = await findCandidateByPhone(from, null);
    const orgId = candidate?.organizationId ?? null;

    let threadId: string;
    if (candidate) {
      const thread = await findOrCreateCandidateThread({
        candidateId: candidate.id,
        organizationId: orgId,
        subject: `SMS · ${candidate.name}`,
      });
      threadId = thread.id;
    } else {
      const thread = await prisma.messageThread.create({
        data: {
          subject: `SMS from ${normalizePhone(from)}`,
          lastMessageAt: new Date(),
        },
      });
      threadId = thread.id;
    }

    await appendInboundMessage({
      threadId,
      channel: 'SMS',
      body,
      fromName: candidate?.name || normalizePhone(from),
      fromPhone: normalizePhone(from),
      toPhone: to ? normalizePhone(to) : null,
      externalId: messageSid || null,
      metadata: { provider: 'twilio', rawFrom: from },
    });

    // STOP / START keywords for opt-out compliance
    const keyword = body.trim().toUpperCase();
    if (candidate && (keyword === 'STOP' || keyword === 'UNSUBSCRIBE' || keyword === 'CANCEL')) {
      await prisma.candidate.update({
        where: { id: candidate.id },
        data: { smsOptIn: false },
      });
    }
    // START only re-opts in after prior STOP — does not create first-time consent
    if (
      candidate &&
      (keyword === 'START' || keyword === 'YES' || keyword === 'UNSTOP') &&
      candidate.messagingConsentAt
    ) {
      await prisma.candidate.update({
        where: { id: candidate.id },
        data: { smsOptIn: true, messagingConsentAt: new Date() },
      });
    }

    return new NextResponse('<Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (e) {
    console.error('POST /api/webhooks/twilio', e);
    return new NextResponse('<Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, provider: 'twilio', byok: true });
}
