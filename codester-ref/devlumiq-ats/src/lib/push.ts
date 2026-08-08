/**
 * Web Push fan-out for recruiters (applications, interview reminders).
 * Uses Web Push API when VAPID keys are set; no-ops safely otherwise.
 */

import { prisma } from '@/lib/prisma';

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}

async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url?: string },
): Promise<boolean> {
  if (!pushConfigured()) return false;

  try {
    const webpush = await import('web-push');
    const wp = webpush.default ?? webpush;
    wp.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:support@devlumiq.com',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    await wp.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
    );
    return true;
  } catch (e) {
    console.error('[push] send failed', e);
    return false;
  }
}

/** Notify all org users with push subscriptions */
export async function notifyOrgUsers(
  organizationId: string | null | undefined,
  payload: { title: string; body: string; url?: string },
): Promise<number> {
  if (!organizationId || !pushConfigured()) return 0;

  const users = await prisma.user.findMany({
    where: { organizationId, isActive: true },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  if (!userIds.length) return 0;

  // Respect pushNotifications preference when UserSettings exists
  const settings = await prisma.userSettings.findMany({
    where: { userId: { in: userIds }, pushNotifications: false },
    select: { userId: true },
  });
  const optedOut = new Set(settings.map((s) => s.userId));
  const eligible = userIds.filter((id) => !optedOut.has(id));

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: eligible } },
  });

  let sent = 0;
  for (const sub of subs) {
    const ok = await sendWebPush(sub, payload);
    if (ok) sent++;
    else {
      // Drop gone subscriptions
      await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
    }
  }
  return sent;
}

export async function notifyNewApplication(opts: {
  organizationId: string | null;
  candidateName: string;
  jobTitle: string;
  candidateId: string;
}) {
  return notifyOrgUsers(opts.organizationId, {
    title: 'New application',
    body: `${opts.candidateName} applied for ${opts.jobTitle}`,
    url: `/dashboard/candidates/${opts.candidateId}`,
  });
}

export async function notifyInterviewReminder(opts: {
  organizationId: string | null;
  candidateName: string;
  interviewTitle: string;
  interviewId: string;
  start: Date;
}) {
  return notifyOrgUsers(opts.organizationId, {
    title: 'Interview reminder',
    body: `${opts.interviewTitle} with ${opts.candidateName} at ${opts.start.toLocaleString()}`,
    url: `/dashboard/calendar`,
  });
}
