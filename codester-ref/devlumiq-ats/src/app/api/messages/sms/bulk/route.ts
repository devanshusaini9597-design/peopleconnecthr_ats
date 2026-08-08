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

const MAX_BULK = 100;

/**
 * POST /api/messages/sms/bulk
 * Body: { candidateIds: string[], message: string, templateVars?: Record }
 * Only sends to candidates with smsOptIn + valid phone. Skips others with report.
 */
export const POST = withPermission('USE_EMAIL_TEMPLATES', async (req: NextRequest, _ctx, session) => {
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    if (!twilioConfigured()) {
      return NextResponse.json(
        { error: 'SMS is not configured', code: 'SMS_NOT_CONFIGURED' },
        { status: 503 },
      );
    }

    const body = await req.json();
    const ids = Array.isArray(body.candidateIds) ? body.candidateIds.filter((x: unknown) => typeof x === 'string') : [];
    const template = typeof body.message === 'string' ? body.message.trim() : '';

    if (!template) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }
    if (ids.length === 0) {
      return NextResponse.json({ error: 'candidateIds required' }, { status: 400 });
    }
    if (ids.length > MAX_BULK) {
      return NextResponse.json({ error: `Maximum ${MAX_BULK} recipients per bulk send` }, { status: 400 });
    }

    const candidates = await prisma.candidate.findMany({
      where: {
        id: { in: ids },
        organizationId: orgId,
      },
    });

    const sent: string[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];
    const failed: Array<{ id: string; reason: string }> = [];

    for (const c of candidates) {
      if (!c.smsOptIn) {
        skipped.push({ id: c.id, reason: 'no_sms_opt_in' });
        continue;
      }
      if (!c.phone) {
        skipped.push({ id: c.id, reason: 'no_phone' });
        continue;
      }
      const to = normalizePhone(c.phone);
      if (!isValidE164(to)) {
        skipped.push({ id: c.id, reason: 'invalid_phone' });
        continue;
      }

      const text = template
        .replace(/\{\{candidateName\}\}/gi, c.name)
        .replace(/\{\{name\}\}/gi, c.name)
        .slice(0, 1600);

      try {
        const { sid, status } = await sendTwilioSms(to, text);
        const thread = await findOrCreateCandidateThread({
          candidateId: c.id,
          organizationId: orgId,
          subject: `SMS · ${c.name}`,
        });
        await appendOutboundMessage({
          threadId: thread.id,
          fromUserId: session.id,
          fromName: session.name,
          fromEmail: session.email,
          channel: 'SMS',
          body: text,
          toPhone: to,
          fromPhone: process.env.TWILIO_PHONE_NUMBER || null,
          externalId: sid,
          status: status === 'failed' ? 'failed' : 'sent',
          metadata: { provider: 'twilio', bulk: true },
        });
        sent.push(c.id);
      } catch (e: unknown) {
        failed.push({
          id: c.id,
          reason: e instanceof Error ? e.message : 'send_failed',
        });
      }
    }

    const missing = ids.filter((id: string) => !candidates.some((c) => c.id === id));
    for (const id of missing) skipped.push({ id, reason: 'not_found' });

    return NextResponse.json({
      sent: sent.length,
      skipped: skipped.length,
      failed: failed.length,
      details: { sent, skipped, failed },
    });
  } catch (e) {
    console.error('POST /api/messages/sms/bulk', e);
    return NextResponse.json({ error: 'Bulk SMS failed' }, { status: 500 });
  }
});
