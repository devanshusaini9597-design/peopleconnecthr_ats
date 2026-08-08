import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import {
  normalizePhone,
  findOrCreateCandidateThread,
  appendOutboundMessage,
  sendWhatsAppCloud,
  whatsappConfigured,
} from '@/lib/messaging';
import { requireOrgId, isOrgError } from '@/lib/require-org';

/**
 * POST /api/whatsapp/send
 * Legacy premium WhatsApp send — still supported.
 * Now also persists into MessageThread when candidateId is provided.
 * Prefer /api/messages/whatsapp/send for consent-gated inbox sync.
 */
export const POST = withPermission('USE_EMAIL_TEMPLATES', async (request: NextRequest, _ctx, session) => {
  const orgId = requireOrgId(session);
  if (isOrgError(orgId)) return orgId;

  const { phone, message, candidateId } = await request.json();

  if (!phone || !message) {
    return NextResponse.json({ error: 'phone and message are required' }, { status: 400 });
  }

  if (!whatsappConfigured()) {
    return NextResponse.json(
      { error: 'WhatsApp Business API is not configured. Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID environment variables.' },
      { status: 503 },
    );
  }

  try {
    const to = normalizePhone(phone);

    // When linked to a candidate, require WhatsApp opt-in (TCPA). Phone-only legacy callers unchanged.
    if (candidateId) {
      const candidate = await prisma.candidate.findFirst({
        where: {
          id: candidateId,
          organizationId: orgId,
        },
        select: { id: true, name: true, whatsappOptIn: true },
      });
      if (!candidate) {
        return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
      }
      if (!candidate.whatsappOptIn) {
        return NextResponse.json(
          {
            error: 'WhatsApp opt-in required for this candidate',
            code: 'WHATSAPP_CONSENT_REQUIRED',
          },
          { status: 403 },
        );
      }
    }

    const { id: wamid } = await sendWhatsAppCloud(to, message);

    if (candidateId) {
      const candidate = await prisma.candidate.findFirst({
        where: {
          id: candidateId,
          organizationId: orgId,
        },
        select: { id: true, name: true },
      });
      if (candidate) {
        const thread = await findOrCreateCandidateThread({
          candidateId: candidate.id,
          organizationId: orgId,
          subject: `WhatsApp · ${candidate.name}`,
        });
        await appendOutboundMessage({
          threadId: thread.id,
          fromUserId: session.id,
          fromName: session.name,
          fromEmail: session.email,
          channel: 'WHATSAPP',
          body: message,
          toPhone: to,
          externalId: wamid || null,
          metadata: { provider: 'whatsapp_cloud', legacyRoute: true },
        });
      }
    }

    return NextResponse.json({ ok: true, candidateId, wamid });
  } catch (e: unknown) {
    console.error('WhatsApp API error', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'WhatsApp delivery failed' },
      { status: 502 },
    );
  }
});
