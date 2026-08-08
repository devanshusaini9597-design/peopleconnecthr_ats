import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { validateCsrf } from '@/lib/csrf';
import { normalizePhone, isValidE164, sendTwilioSms, twilioConfigured } from '@/lib/messaging';
import { requireOrgId, isOrgError } from '@/lib/require-org';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST — start phone verification (sends SMS code) or confirm code.
 * Body: { action: 'send' | 'confirm', code?: string, smsOptIn?: boolean, whatsappOptIn?: boolean }
 *
 * Codes stored in-memory for 10 minutes (dev/single-instance). Production: use Redis.
 */
const codes = new Map<string, { code: string; expires: number }>();

export const POST = withPermission('EDIT_CANDIDATE', async (req: NextRequest, ctx: Ctx, session) => {
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id } = await ctx.params;
    const body = await req.json();
    const action = body.action === 'confirm' ? 'confirm' : 'send';

    const candidate = await prisma.candidate.findFirst({
      where: {
        id,
        organizationId: orgId,
      },
    });
    if (!candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!candidate.phone) {
      return NextResponse.json({ error: 'Candidate has no phone number' }, { status: 400 });
    }

    const phone = normalizePhone(candidate.phone);
    if (!isValidE164(phone)) {
      return NextResponse.json({ error: 'Invalid phone' }, { status: 400 });
    }

    if (action === 'send') {
      if (!twilioConfigured()) {
        // Dev fallback: accept fixed code 000000 without SMS
        codes.set(id, { code: '000000', expires: Date.now() + 10 * 60 * 1000 });
        return NextResponse.json({
          ok: true,
          mode: 'dev',
          message: 'Twilio not configured — use code 000000 to verify in development',
        });
      }
      const code = String(Math.floor(100000 + Math.random() * 900000));
      codes.set(id, { code, expires: Date.now() + 10 * 60 * 1000 });
      await sendTwilioSms(
        phone,
        `Your DevLumiq verification code is ${code}. Reply STOP to opt out of SMS.`,
      );
      return NextResponse.json({ ok: true, mode: 'sms' });
    }

    const entry = codes.get(id);
    if (!entry || entry.expires < Date.now()) {
      return NextResponse.json({ error: 'Code expired — request a new one' }, { status: 400 });
    }
    if (String(body.code || '').trim() !== entry.code) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }
    codes.delete(id);

    const updated = await prisma.candidate.update({
      where: { id },
      data: {
        phoneVerifiedAt: new Date(),
        messagingConsentAt: new Date(),
        messagingConsentIp:
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        ...(typeof body.smsOptIn === 'boolean' ? { smsOptIn: body.smsOptIn } : { smsOptIn: true }),
        ...(typeof body.whatsappOptIn === 'boolean' ? { whatsappOptIn: body.whatsappOptIn } : {}),
      },
      select: {
        id: true,
        phoneVerifiedAt: true,
        smsOptIn: true,
        whatsappOptIn: true,
      },
    });

    return NextResponse.json({ ok: true, candidate: updated });
  } catch (e: unknown) {
    console.error('verify-phone', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Verification failed' },
      { status: 500 },
    );
  }
});
