/**
 * Multi-channel messaging helpers (Email / SMS / WhatsApp).
 * Existing email threads keep working; SMS/WhatsApp are opt-in + env-gated.
 */

import { prisma } from '@/lib/prisma';
import type { MessageChannel, Prisma } from '@prisma/client';

export function normalizePhone(phone: string): string {
  let p = phone.replace(/[\s\-().]/g, '');
  if (!p.startsWith('+') && /^\d+$/.test(p)) {
    // Assume US if 10 digits and no country code
    if (p.length === 10) p = `+1${p}`;
    else if (p.length === 11 && p.startsWith('1')) p = `+${p}`;
    else p = `+${p}`;
  }
  return p;
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

export async function findOrCreateCandidateThread(opts: {
  candidateId: string;
  organizationId: string | null;
  subject: string;
}) {
  const existing = await prisma.messageThread.findFirst({
    where: {
      candidateId: opts.candidateId,
      ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
    },
    orderBy: { lastMessageAt: 'desc' },
  });
  if (existing) return existing;

  return prisma.messageThread.create({
    data: {
      candidateId: opts.candidateId,
      subject: opts.subject,
      organizationId: opts.organizationId ?? undefined,
      lastMessageAt: new Date(),
    },
  });
}

export async function appendOutboundMessage(opts: {
  threadId: string;
  fromUserId: string;
  fromName: string;
  fromEmail: string;
  channel: MessageChannel;
  body: string;
  toEmail?: string | null;
  toPhone?: string | null;
  fromPhone?: string | null;
  externalId?: string | null;
  status?: string;
  metadata?: Record<string, unknown>;
}) {
  const message = await prisma.message.create({
    data: {
      threadId: opts.threadId,
      fromUserId: opts.fromUserId,
      fromName: opts.fromName,
      fromEmail: opts.fromEmail || '',
      toEmail: opts.toEmail ?? null,
      toPhone: opts.toPhone ?? null,
      fromPhone: opts.fromPhone ?? null,
      channel: opts.channel,
      body: opts.body,
      direction: 'OUTBOUND',
      status: opts.status ?? 'sent',
      externalId: opts.externalId ?? null,
      metadata: (opts.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      sentAt: new Date(),
    },
  });
  await prisma.messageThread.update({
    where: { id: opts.threadId },
    data: { lastMessageAt: new Date() },
  });
  return message;
}

export async function appendInboundMessage(opts: {
  threadId: string;
  channel: MessageChannel;
  body: string;
  fromName: string;
  fromPhone?: string | null;
  fromEmail?: string | null;
  toPhone?: string | null;
  externalId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const message = await prisma.message.create({
    data: {
      threadId: opts.threadId,
      fromName: opts.fromName,
      fromEmail: opts.fromEmail ?? '',
      fromPhone: opts.fromPhone ?? null,
      toPhone: opts.toPhone ?? null,
      channel: opts.channel,
      body: opts.body,
      direction: 'INBOUND',
      status: 'delivered',
      isRead: false,
      externalId: opts.externalId ?? null,
      metadata: (opts.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      sentAt: new Date(),
    },
  });
  await prisma.messageThread.update({
    where: { id: opts.threadId },
    data: { lastMessageAt: new Date() },
  });
  return message;
}

/** Find candidate by phone within org (normalized match on stored phone) */
export async function findCandidateByPhone(phone: string, organizationId: string | null) {
  const normalized = normalizePhone(phone);
  const digits = normalized.replace(/\D/g, '');
  const candidates = await prisma.candidate.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      phone: { not: null },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      organizationId: true,
      smsOptIn: true,
      whatsappOptIn: true,
      messagingConsentAt: true,
    },
    take: 500,
  });
  return (
    candidates.find((c) => {
      if (!c.phone) return false;
      const cDigits = normalizePhone(c.phone).replace(/\D/g, '');
      return cDigits === digits || cDigits.endsWith(digits) || digits.endsWith(cDigits);
    }) ?? null
  );
}

export async function sendTwilioSms(to: string, body: string): Promise<{ sid: string; status: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    throw new Error('SMS is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.');
  }

  const params = new URLSearchParams({
    To: to,
    From: from,
    Body: body.slice(0, 1600),
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    },
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error_message || 'Twilio SMS send failed');
  }
  return { sid: data.sid, status: data.status || 'sent' };
}

export async function sendWhatsAppCloud(to: string, body: string): Promise<{ id: string }> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    throw new Error('WhatsApp is not configured. Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID.');
  }

  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/^\+/, ''),
      type: 'text',
      text: { body: body.slice(0, 4096) },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || 'WhatsApp delivery failed');
  }
  return { id: data.messages?.[0]?.id || '' };
}

export function twilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER,
  );
}

export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}
