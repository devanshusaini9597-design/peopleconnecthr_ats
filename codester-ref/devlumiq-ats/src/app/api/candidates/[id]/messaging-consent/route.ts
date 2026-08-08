import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { validateCsrf } from '@/lib/csrf';
import { requireOrgId, isOrgError } from '@/lib/require-org';

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH — record SMS / WhatsApp opt-in consent (TCPA).
 * Body: { smsOptIn?, whatsappOptIn?, phoneVerified? }
 */
export const PATCH = withPermission('EDIT_CANDIDATE', async (req: NextRequest, ctx: Ctx, session) => {
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id } = await ctx.params;
    const candidate = await prisma.candidate.findFirst({
      where: {
        id,
        organizationId: orgId,
      },
    });
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (typeof body.smsOptIn === 'boolean') data.smsOptIn = body.smsOptIn;
    if (typeof body.whatsappOptIn === 'boolean') data.whatsappOptIn = body.whatsappOptIn;
    if (body.phoneVerified === true) data.phoneVerifiedAt = new Date();

    if (body.smsOptIn === true || body.whatsappOptIn === true) {
      data.messagingConsentAt = new Date();
      data.messagingConsentIp =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No consent fields provided' }, { status: 400 });
    }

    const updated = await prisma.candidate.update({
      where: { id },
      data,
      select: {
        id: true,
        smsOptIn: true,
        whatsappOptIn: true,
        phoneVerifiedAt: true,
        messagingConsentAt: true,
        phone: true,
      },
    });

    return NextResponse.json({ candidate: updated });
  } catch (e) {
    console.error('PATCH messaging-consent', e);
    return NextResponse.json({ error: 'Failed to update consent' }, { status: 500 });
  }
});

export const GET = withPermission('VIEW_CANDIDATES', async (_req, ctx: Ctx, session) => {
  const orgId = requireOrgId(session);
  if (isOrgError(orgId)) return orgId;

  const { id } = await ctx.params;
  const candidate = await prisma.candidate.findFirst({
    where: {
      id,
      organizationId: orgId,
    },
    select: {
      id: true,
      phone: true,
      smsOptIn: true,
      whatsappOptIn: true,
      phoneVerifiedAt: true,
      messagingConsentAt: true,
    },
  });
  if (!candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ candidate });
});
