import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { validateCsrf } from '@/lib/csrf';
import { sendEmail } from '@/lib/email';
import { resolveChannelBody } from '@/lib/short-templates';
import {
  normalizePhone,
  isValidE164,
  findOrCreateCandidateThread,
  appendOutboundMessage,
  sendTwilioSms,
  twilioConfigured,
} from '@/lib/messaging';
import { requireOrgId, isOrgError } from '@/lib/require-org';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/talent-pools/[id]/campaign
 * Body: {
 *   channel: 'EMAIL' | 'SMS',
 *   subject?: string,
 *   message: string,
 *   sequenceId?: string,  // optional enroll into EmailSequence
 *   memberIds?: string[]  // subset; default all consented members
 * }
 */
export const POST = withPermission('USE_EMAIL_TEMPLATES', async (req: NextRequest, ctx: Ctx, session) => {
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id: poolId } = await ctx.params;

    const pool = await prisma.talentPool.findFirst({
      where: { id: poolId, organizationId: orgId },
    });
    if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 });

    const body = await req.json();
    const channel = body.channel === 'SMS' ? 'SMS' : 'EMAIL';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const subject = typeof body.subject === 'string' ? body.subject.trim() : `Opportunity from our team`;
    const sequenceId = typeof body.sequenceId === 'string' ? body.sequenceId : null;
    const memberIds: string[] | null = Array.isArray(body.memberIds) ? body.memberIds : null;

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const members = await prisma.talentPoolMember.findMany({
      where: {
        poolId,
        ...(memberIds ? { id: { in: memberIds } } : {}),
        candidate: { talentPoolConsent: true },
      },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            smsOptIn: true,
          },
        },
      },
      take: 200,
    });

    const sent: string[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];
    const failed: Array<{ id: string; reason: string }> = [];

    for (const m of members) {
      const c = m.candidate;
      const text = message
        .replace(/\{\{candidateName\}\}/gi, c.name)
        .replace(/\{\{name\}\}/gi, c.name)
        .replace(/\{\{poolName\}\}/gi, pool.name);

      try {
        if (channel === 'EMAIL') {
          if (!c.email) {
            skipped.push({ id: c.id, reason: 'no_email' });
            continue;
          }
          const ok = await sendEmail({
            to: c.email,
            subject: subject.replace(/\{\{candidateName\}\}/gi, c.name),
            html: `<p>${text.replace(/\n/g, '<br/>')}</p>`,
            text,
          });
          if (!ok) {
            failed.push({ id: c.id, reason: 'email_send_failed' });
            continue;
          }
          const thread = await findOrCreateCandidateThread({
            candidateId: c.id,
            organizationId: orgId,
            subject: `Pool campaign · ${pool.name}`,
          });
          await appendOutboundMessage({
            threadId: thread.id,
            fromUserId: session.id,
            fromName: session.name,
            fromEmail: session.email,
            channel: 'EMAIL',
            body: text,
            toEmail: c.email,
            metadata: { talentPoolId: poolId, campaign: true },
          });
        } else {
          if (!twilioConfigured()) {
            return NextResponse.json({ error: 'SMS not configured', code: 'SMS_NOT_CONFIGURED' }, { status: 503 });
          }
          if (!c.smsOptIn || !c.phone) {
            skipped.push({ id: c.id, reason: !c.smsOptIn ? 'no_sms_opt_in' : 'no_phone' });
            continue;
          }
          const to = normalizePhone(c.phone);
          if (!isValidE164(to)) {
            skipped.push({ id: c.id, reason: 'invalid_phone' });
            continue;
          }
          const { sid } = await sendTwilioSms(to, text.slice(0, 1600));
          const thread = await findOrCreateCandidateThread({
            candidateId: c.id,
            organizationId: orgId,
            subject: `Pool SMS · ${pool.name}`,
          });
          await appendOutboundMessage({
            threadId: thread.id,
            fromUserId: session.id,
            fromName: session.name,
            fromEmail: session.email,
            channel: 'SMS',
            body: text.slice(0, 1600),
            toPhone: to,
            externalId: sid,
            metadata: { talentPoolId: poolId, campaign: true },
          });
        }

        await prisma.talentPoolMember.update({
          where: { id: m.id },
          data: { lastContactedAt: new Date() },
        });

        if (sequenceId) {
          const sequence = await prisma.emailSequence.findFirst({
            where: {
              id: sequenceId,
              organizationId: orgId,
            },
            include: {
              steps: {
                include: { template: true },
                orderBy: { stepNumber: 'asc' },
              },
            },
          });
          const enrollment = await prisma.emailSequenceEnrollment
            .create({
              data: {
                sequenceId,
                candidateId: c.id,
                status: 'active',
                currentStep: 0,
              },
            })
            .catch(() => null);

          if (enrollment && sequence?.steps?.[0]) {
            const step = sequence.steps[0];
            const stepChannel = step.channel || 'EMAIL';
            if (stepChannel === 'SMS' && c.smsOptIn && c.phone && twilioConfigured()) {
              const smsText = (
                step.template
                  ? resolveChannelBody(
                      {
                        body: step.template.body || step.body || text,
                        smsBody: step.template.smsBody,
                        whatsappBody: step.template.whatsappBody,
                      },
                      'SMS',
                    )
                  : step.body || text
              )
                .replace(/\{\{candidateName\}\}/gi, c.name)
                .replace(/\{\{name\}\}/gi, c.name)
                .slice(0, 1600);
              if (step.delayHours <= 0) {
                const to = normalizePhone(c.phone);
                if (isValidE164(to)) {
                  await sendTwilioSms(to, smsText).catch(() => {});
                  await prisma.emailSequenceEnrollment
                    .update({ where: { id: enrollment.id }, data: { currentStep: 1 } })
                    .catch(() => {});
                }
              }
            }
          }
        }

        sent.push(c.id);
      } catch (e: unknown) {
        failed.push({
          id: c.id,
          reason: e instanceof Error ? e.message : 'failed',
        });
      }
    }

    return NextResponse.json({
      sent: sent.length,
      skipped: skipped.length,
      failed: failed.length,
      details: { sent, skipped, failed },
    });
  } catch (e) {
    console.error('POST talent-pools campaign', e);
    return NextResponse.json({ error: 'Campaign failed' }, { status: 500 });
  }
});
