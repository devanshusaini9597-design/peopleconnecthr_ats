/**
 * Shared auth helpers for BYOK webhooks / cron.
 * Production: fail closed when secrets are missing.
 * Development: allow unauthenticated local testing when secrets are unset.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Compare secrets in constant time when lengths match. */
export function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Require a shared secret for cron / meeting-style endpoints.
 * - Production: secret must be set AND match
 * - Development: if secret unset, allow; if set, must match
 */
export function requireSharedSecret(
  req: NextRequest,
  envKey: string,
  opts?: { queryParam?: string; headerNames?: string[] },
): NextResponse | null {
  const secret = process.env[envKey] || '';
  const headers = opts?.headerNames || ['authorization', 'x-cron-secret', 'x-meeting-secret'];
  let provided = '';
  for (const h of headers) {
    const v = req.headers.get(h);
    if (!v) continue;
    provided = h === 'authorization' ? v.replace(/^Bearer\s+/i, '').trim() : v.trim();
    if (provided) break;
  }
  if (!provided && opts?.queryParam) {
    provided = new URL(req.url).searchParams.get(opts.queryParam)?.trim() || '';
  }

  if (!secret) {
    if (isProduction()) {
      return NextResponse.json(
        { error: `${envKey} is required in production`, code: 'SECRET_NOT_CONFIGURED' },
        { status: 503 },
      );
    }
    return null; // local/dev BYOK: open when unset
  }

  if (!provided || !safeEqual(provided, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

/**
 * Validate Twilio X-Twilio-Signature (HMAC-SHA1 of URL + sorted form params).
 * Uses TWILIO_AUTH_TOKEN (or TWILIO_WEBHOOK_AUTH_TOKEN override).
 * Production: reject if token missing (when validating). Dev: allow if unset.
 */
export function validateTwilioSignature(
  req: NextRequest,
  params: Record<string, string>,
): NextResponse | null {
  const authToken =
    process.env.TWILIO_WEBHOOK_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN || '';

  if (!authToken) {
    if (isProduction()) {
      return NextResponse.json(
        { error: 'Twilio webhook auth not configured', code: 'TWILIO_AUTH_NOT_CONFIGURED' },
        { status: 503 },
      );
    }
    return null;
  }

  const signature = req.headers.get('x-twilio-signature') || '';
  if (!signature) {
    return NextResponse.json({ error: 'Missing X-Twilio-Signature' }, { status: 403 });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  const webhookUrl =
    process.env.TWILIO_WEBHOOK_URL ||
    (appUrl ? `${appUrl}/api/webhooks/twilio` : new URL(req.url).origin + '/api/webhooks/twilio');

  const sortedKeys = Object.keys(params).sort();
  let data = webhookUrl;
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  const expected = createHmac('sha1', authToken).update(data, 'utf8').digest('base64');
  if (!safeEqual(expected, signature)) {
    return NextResponse.json({ error: 'Invalid Twilio signature' }, { status: 403 });
  }
  return null;
}

/**
 * Validate Meta WhatsApp X-Hub-Signature-256.
 * Requires WHATSAPP_APP_SECRET in production when WhatsApp is configured.
 */
export function validateWhatsAppSignature(
  rawBody: string,
  signatureHeader: string | null,
): NextResponse | null {
  const appSecret = process.env.WHATSAPP_APP_SECRET || '';
  const whatsappConfigured = Boolean(
    process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
  );

  if (!appSecret) {
    if (isProduction() && whatsappConfigured) {
      return NextResponse.json(
        { error: 'WHATSAPP_APP_SECRET is required in production', code: 'WHATSAPP_SECRET_NOT_CONFIGURED' },
        { status: 503 },
      );
    }
    // Dev / WhatsApp not used: allow
    return null;
  }

  if (!signatureHeader?.startsWith('sha256=')) {
    return NextResponse.json({ error: 'Missing X-Hub-Signature-256' }, { status: 403 });
  }

  const expected =
    'sha256=' + createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  if (!safeEqual(expected, signatureHeader)) {
    return NextResponse.json({ error: 'Invalid WhatsApp signature' }, { status: 403 });
  }
  return null;
}
