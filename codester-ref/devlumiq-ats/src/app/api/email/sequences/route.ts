import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import {
  normalizePhone,
  isValidE164,
  findOrCreateCandidateThread,
  appendOutboundMessage,
  sendTwilioSms,
  twilioConfigured,
} from '@/lib/messaging';
import { resolveChannelBody } from '@/lib/short-templates';
import { sendEmail } from '@/lib/email';
import { requireOrgId, isOrgError } from '@/lib/require-org';

export const GET = withPermission('USE_EMAIL_TEMPLATES', async (_req, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const sequences = await prisma.emailSequence.findMany({
      where: {
        isActive: true,
        organizationId: orgId,
      },
      include: {
        steps: {
          include: { template: true },
          orderBy: { stepNumber: 'asc' },
        },
        _count: {
          select: { enrollments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(sequences);
  } catch (error) {
    console.error('Error fetching sequences:', error);
    return NextResponse.json({ error: 'Failed to fetch sequences' }, { status: 500 });
  }
});

export const POST = withPermission('MANAGE_EMAIL_SEQUENCES', async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { name, description, triggerType, steps } = await request.json();

    const sequence = await prisma.emailSequence.create({
      data: {
        name,
        description,
        triggerType,
        organizationId: orgId,
        steps: {
          create: (steps || []).map((s: {
            delayHours?: number;
            templateId?: string;
            subject?: string;
            body?: string;
            condition?: string;
            channel?: string;
          }, index: number) => ({
            stepNumber: index + 1,
            delayHours: s.delayHours || 0,
            templateId: s.templateId,
            subject: s.subject,
            body: s.body,
            condition: s.condition,
            channel: s.channel === 'SMS' || s.channel === 'WHATSAPP' ? s.channel : 'EMAIL',
          })),
        },
      },
      include: {
        steps: true,
      },
    });

    return NextResponse.json(sequence);
  } catch (error) {
    console.error('Error creating sequence:', error);
    return NextResponse.json({ error: 'Failed to create sequence' }, { status: 500 });
  }
});

export const PATCH = withPermission('MANAGE_EMAIL_SEQUENCES', async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { sequenceId, candidateId, applicationId } = await request.json();

    if (!sequenceId || !candidateId) {
      return NextResponse.json(
        { error: 'sequenceId and candidateId are required' },
        { status: 400 },
      );
    }

    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, organizationId: orgId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        smsOptIn: true,
        organizationId: true,
      },
    });
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const sequence = await prisma.emailSequence.findFirst({
      where: { id: sequenceId, organizationId: orgId },
      include: {
        steps: {
          include: { template: true },
          orderBy: { stepNumber: 'asc' },
        },
      },
    });
    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    if (applicationId) {
      const application = await prisma.application.findFirst({
        where: {
          id: applicationId,
          OR: [
            { candidate: { organizationId: orgId } },
            { job: { companyId: orgId } },
          ],
        },
        select: { id: true },
      });
      if (!application) {
        return NextResponse.json({ error: 'Application not found' }, { status: 404 });
      }
    }

    const enrollment = await prisma.emailSequenceEnrollment.create({
      data: {
        sequenceId,
        candidateId,
        applicationId,
        status: 'active',
        currentStep: 0,
      },
    });

    if (sequence.steps.length > 0) {
      const firstStep = sequence.steps[0];
      const scheduledAt = new Date();
      scheduledAt.setHours(scheduledAt.getHours() + firstStep.delayHours);

      const channel = firstStep.channel || 'EMAIL';
      const templateBody = firstStep.template
        ? resolveChannelBody(
            {
              body: firstStep.template.body || firstStep.body || '',
              smsBody: firstStep.template.smsBody,
              whatsappBody: firstStep.template.whatsappBody,
            },
            channel === 'SMS' || channel === 'WHATSAPP' ? channel : 'EMAIL',
          )
        : firstStep.body || '';

      if (channel === 'SMS') {
        if (!twilioConfigured()) {
          return NextResponse.json(
            { success: true, enrollment, warning: 'SMS_NOT_CONFIGURED', message: 'Enrolled but SMS step skipped' },
          );
        }
        if (!candidate.smsOptIn || !candidate.phone) {
          return NextResponse.json({
            success: true,
            enrollment,
            warning: 'NO_SMS_OPT_IN',
            message: 'Enrolled but SMS step skipped (opt-in/phone required)',
          });
        }
        const to = normalizePhone(candidate.phone);
        if (!isValidE164(to)) {
          return NextResponse.json({
            success: true,
            enrollment,
            warning: 'INVALID_PHONE',
          });
        }

        const sendNow = firstStep.delayHours <= 0;
        if (sendNow) {
          const text = templateBody
            .replace(/\{\{candidateName\}\}/gi, candidate.name)
            .replace(/\{\{name\}\}/gi, candidate.name)
            .slice(0, 1600);
          const { sid } = await sendTwilioSms(to, text);
          const thread = await findOrCreateCandidateThread({
            candidateId: candidate.id,
            organizationId: orgId,
            subject: `Sequence · ${sequence.name}`,
          });
          await appendOutboundMessage({
            threadId: thread.id,
            fromUserId: session.id,
            fromName: session.name,
            fromEmail: session.email,
            channel: 'SMS',
            body: text,
            toPhone: to,
            externalId: sid,
            metadata: { sequenceId, stepId: firstStep.id },
          });
          await prisma.emailSequenceEnrollment.update({
            where: { id: enrollment.id },
            data: { currentStep: 1 },
          });
        } else {
          // Queue as scheduled email row with SMS body for cron/processor
          await prisma.scheduledEmail.create({
            data: {
              enrollmentId: enrollment.id,
              stepId: firstStep.id,
              candidateId,
              to: to,
              subject: `[SMS] ${firstStep.subject || sequence.name}`,
              body: templateBody,
              scheduledAt,
            },
          });
        }
      } else {
        const toEmail = candidate.email || '';
        await prisma.scheduledEmail.create({
          data: {
            enrollmentId: enrollment.id,
            stepId: firstStep.id,
            candidateId,
            to: toEmail,
            subject: firstStep.subject || firstStep.template?.subject || '',
            body: templateBody || firstStep.body || '',
            scheduledAt,
          },
        });
        if (firstStep.delayHours <= 0 && toEmail && templateBody) {
          await sendEmail({
            to: toEmail,
            subject: firstStep.subject || firstStep.template?.subject || sequence.name,
            html: `<p>${templateBody.replace(/\n/g, '<br/>')}</p>`,
            text: templateBody,
          }).catch(() => {});
        }
      }
    }

    return NextResponse.json({ success: true, enrollment });
  } catch (error) {
    console.error('Error enrolling candidate:', error);
    return NextResponse.json({ error: 'Failed to enroll' }, { status: 500 });
  }
});
