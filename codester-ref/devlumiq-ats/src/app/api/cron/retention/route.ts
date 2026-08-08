import { NextRequest, NextResponse } from 'next/server';
import { purgeExpiredTranscripts } from '@/lib/transcript-retention';
import { prisma } from '@/lib/prisma';
import { notifyInterviewReminder } from '@/lib/push';
import { requireSharedSecret } from '@/lib/webhook-auth';
import { expireOverdueAssignments, sendAssessmentReminders } from '@/lib/assessments';
import {
  appendOutboundMessage,
  findOrCreateCandidateThread,
  isValidE164,
  normalizePhone,
  sendTwilioSms,
  twilioConfigured,
} from '@/lib/messaging';

/**
 * GET/POST /api/cron/retention
 * Auth: Authorization: Bearer CRON_SECRET (or ?secret=)
 *
 * - Purges expired interview transcripts
 * - Sends push reminders for interviews starting in the next 60 minutes
 * - SMS reminders for opted-in candidates (same window; deduped 2h)
 * - Expires overdue assessment assignments + notifies recruiters
 * - Sends assessment reminder emails (within 48h of expiresAt)
 */
async function run(req: NextRequest) {
  const authError = requireSharedSecret(req, 'CRON_SECRET', {
    queryParam: 'secret',
    headerNames: ['authorization', 'x-cron-secret'],
  });
  if (authError) return authError;

  const purged = await purgeExpiredTranscripts().catch((e) => {
    console.error('[cron/retention] purge failed', e);
    return 0;
  });

  const now = new Date();
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  let reminders = 0;
  let smsRemindersSent = 0;

  try {
    const upcoming = await prisma.interviewEvent.findMany({
      where: {
        status: { in: ['scheduled', 'confirmed'] },
        start: { gte: now, lte: inOneHour },
      },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            phone: true,
            smsOptIn: true,
            organizationId: true,
          },
        },
      },
      take: 50,
    });

    for (const iv of upcoming) {
      try {
        const n = await notifyInterviewReminder({
          organizationId: iv.candidate?.organizationId ?? null,
          candidateName: iv.candidate?.name || 'Candidate',
          interviewTitle: iv.title,
          interviewId: iv.id,
          start: iv.start,
        });
        reminders += n;
      } catch {
        /* push is optional — never fail the cron job */
      }

      // SMS reminder for opted-in candidates with a phone
      if (!twilioConfigured()) continue;
      const cand = iv.candidate;
      if (!cand?.id || !cand.smsOptIn || !cand.phone) continue;

      try {
        const already = await prisma.message.findFirst({
          where: {
            channel: 'SMS',
            direction: 'OUTBOUND',
            sentAt: { gte: twoHoursAgo },
            AND: [
              { metadata: { path: ['interviewId'], equals: iv.id } },
              { metadata: { path: ['reminder'], equals: true } },
            ],
          },
          select: { id: true },
        });
        if (already) continue;

        const to = normalizePhone(cand.phone);
        if (!isValidE164(to)) continue;

        const timeLabel = iv.start.toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZone: iv.timezone || 'UTC',
        });
        const body = `Reminder: your interview '${iv.title}' starts at ${timeLabel}. Reply STOP to opt out.`;

        const { sid, status } = await sendTwilioSms(to, body);
        const thread = await findOrCreateCandidateThread({
          candidateId: cand.id,
          organizationId: cand.organizationId ?? null,
          subject: `SMS · ${cand.name}`,
        });
        await appendOutboundMessage({
          threadId: thread.id,
          fromUserId: 'cron',
          fromName: 'Interview reminder',
          fromEmail: '',
          channel: 'SMS',
          body,
          toPhone: to,
          fromPhone: process.env.TWILIO_PHONE_NUMBER || null,
          externalId: sid,
          status: status === 'failed' ? 'failed' : 'sent',
          metadata: {
            provider: 'twilio',
            interviewId: iv.id,
            reminder: true,
          },
        });
        if (status !== 'failed') smsRemindersSent += 1;
      } catch (e) {
        console.error('[cron/retention] SMS reminder failed', iv.id, e);
      }
    }
  } catch (e) {
    console.error('[cron/retention] interview query failed', e);
  }

  const assessmentsExpired = await expireOverdueAssignments().catch((e: unknown) => {
    console.error('[cron/retention] assessment expire failed', e);
    return 0;
  });

  const assessmentRemindersSent = await sendAssessmentReminders(48).catch((e: unknown) => {
    console.error('[cron/retention] assessment reminders failed', e);
    return 0;
  });

  return NextResponse.json({
    ok: true,
    purged,
    interviewRemindersSent: reminders,
    smsRemindersSent,
    assessmentsExpired,
    assessmentRemindersSent,
  });
}

export const GET = run;
export const POST = run;
