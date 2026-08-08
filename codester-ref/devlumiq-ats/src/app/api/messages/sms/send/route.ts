import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { validateCsrf } from '@/lib/csrf';
import {
  normalizePhone,
  isValidE164,
  findOrCreateCandidateThread,
  appendOutboundMessage,
  sendTwilioSms,
  twilioConfigured,
} from '@/lib/messaging';
import { requireOrgId, isOrgError } from '@/lib/require-org';

/**
 * POST /api/messages/sms/send
 * Body: { candidateId, message, phone? }
 * Requires candidate.smsOptIn === true (TCPA).
 */
export const POST = withPermission('USE_EMAIL_TEMPLATES', async (req: NextRequest, _ctx, session) => {
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    if (!twilioConfigured()) {
      return NextResponse.json(
        {
          error:
            'SMS is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.',
          code: 'SMS_NOT_CONFIGURED',
        },
        { status: 503 },
      );
    }

    const body = await req.json();
    const messageText = typeof body.message === 'string' ? body.message.trim() : '';
    const candidateId = typeof body.candidateId === 'string' ? body.candidateId : '';
    if (!messageText || !candidateId) {
      return NextResponse.json({ error: 'candidateId and message are required' }, { status: 400 });
    }
    if (messageText.length > 1600) {
      return NextResponse.json({ error: 'SMS body too long (max 1600 chars)' }, { status: 400 });
    }

    const candidate = await prisma.candidate.findFirst({
      where: {
        id: candidateId,
        organizationId: orgId,
      },
    });
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const phoneRaw = (typeof body.phone === 'string' && body.phone) || candidate.phone;
    if (!phoneRaw) {
      return NextResponse.json({ error: 'Candidate has no phone number' }, { status: 400 });
    }

    if (!candidate.smsOptIn) {
      return NextResponse.json(
        {
          error: 'Candidate has not opted in to SMS. Capture SMS consent before sending.',
          code: 'SMS_OPT_IN_REQUIRED',
        },
        { status: 403 },
      );
    }

    const to = normalizePhone(phoneRaw);
    if (!isValidE164(to)) {
      return NextResponse.json({ error: 'Invalid phone number (use E.164, e.g. +15551234567)' }, { status: 400 });
    }

    const { sid, status } = await sendTwilioSms(to, messageText);

    const thread = await findOrCreateCandidateThread({
      candidateId: candidate.id,
      organizationId: orgId,
      subject: `SMS · ${candidate.name}`,
    });

    const message = await appendOutboundMessage({
      threadId: thread.id,
      fromUserId: session.id,
      fromName: session.name,
      fromEmail: session.email,
      channel: 'SMS',
      body: messageText,
      toPhone: to,
      fromPhone: process.env.TWILIO_PHONE_NUMBER || null,
      externalId: sid,
      status: status === 'failed' ? 'failed' : 'sent',
      metadata: { provider: 'twilio' },
    });

    return NextResponse.json({
      ok: true,
      message,
      thread,
      sid,
    });
  } catch (e: unknown) {
    console.error('POST /api/messages/sms/send', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to send SMS' },
      { status: 500 },
    );
  }
});
