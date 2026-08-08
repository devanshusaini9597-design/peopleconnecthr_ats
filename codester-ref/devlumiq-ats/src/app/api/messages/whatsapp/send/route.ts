import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { validateCsrf } from '@/lib/csrf';
import {
  normalizePhone,
  isValidE164,
  findOrCreateCandidateThread,
  appendOutboundMessage,
  sendWhatsAppCloud,
  whatsappConfigured,
} from '@/lib/messaging';
import { requireOrgId, isOrgError } from '@/lib/require-org';

/**
 * POST /api/messages/whatsapp/send
 * Unified WhatsApp send that also persists into MessageThread.
 * Prefer this over /api/whatsapp/send for inbox sync.
 */
export const POST = withPermission('USE_EMAIL_TEMPLATES', async (req: NextRequest, _ctx, session) => {
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    if (!whatsappConfigured()) {
      return NextResponse.json(
        {
          error: 'WhatsApp is not configured. Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID.',
          code: 'WHATSAPP_NOT_CONFIGURED',
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
    if (!candidate.whatsappOptIn) {
      return NextResponse.json(
        {
          error: 'Candidate has not opted in to WhatsApp. Capture consent before sending.',
          code: 'WHATSAPP_OPT_IN_REQUIRED',
        },
        { status: 403 },
      );
    }

    const to = normalizePhone(phoneRaw);
    if (!isValidE164(to)) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    const { id: wamid } = await sendWhatsAppCloud(to, messageText);

    const thread = await findOrCreateCandidateThread({
      candidateId: candidate.id,
      organizationId: orgId,
      subject: `WhatsApp · ${candidate.name}`,
    });

    const message = await appendOutboundMessage({
      threadId: thread.id,
      fromUserId: session.id,
      fromName: session.name,
      fromEmail: session.email,
      channel: 'WHATSAPP',
      body: messageText,
      toPhone: to,
      externalId: wamid || null,
      status: 'sent',
      metadata: { provider: 'whatsapp_cloud' },
    });

    return NextResponse.json({ ok: true, message, thread, wamid });
  } catch (e: unknown) {
    console.error('POST /api/messages/whatsapp/send', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to send WhatsApp' },
      { status: 500 },
    );
  }
});
