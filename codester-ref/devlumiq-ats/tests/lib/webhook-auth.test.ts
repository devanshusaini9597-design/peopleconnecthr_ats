import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';
import {
  requireSharedSecret,
  validateTwilioSignature,
  validateWhatsAppSignature,
  safeEqual,
} from '@/lib/webhook-auth';

describe('webhook-auth', () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env = { ...prev };
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it('safeEqual matches equal strings', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
  });

  it('requireSharedSecret allows unset secret in development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.CRON_SECRET;
    const req = new NextRequest('http://localhost/api/cron/retention');
    expect(requireSharedSecret(req, 'CRON_SECRET')).toBeNull();
  });

  it('requireSharedSecret fails closed in production without secret', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CRON_SECRET;
    const req = new NextRequest('http://localhost/api/cron/retention');
    const res = requireSharedSecret(req, 'CRON_SECRET');
    expect(res).not.toBeNull();
    expect(res!.status).toBe(503);
  });

  it('requireSharedSecret accepts matching bearer', () => {
    process.env.NODE_ENV = 'production';
    process.env.CRON_SECRET = 'test-secret';
    const req = new NextRequest('http://localhost/api/cron/retention', {
      headers: { authorization: 'Bearer test-secret' },
    });
    expect(requireSharedSecret(req, 'CRON_SECRET')).toBeNull();
  });

  it('validateTwilioSignature accepts valid HMAC', () => {
    process.env.NODE_ENV = 'production';
    process.env.TWILIO_AUTH_TOKEN = 'token123';
    process.env.TWILIO_WEBHOOK_URL = 'https://example.com/api/webhooks/twilio';
    const params = { From: '+15551212', Body: 'hi', To: '+15550000' };
    const keys = Object.keys(params).sort();
    let data = process.env.TWILIO_WEBHOOK_URL!;
    for (const k of keys) data += k + params[k as keyof typeof params];
    const sig = createHmac('sha1', 'token123').update(data, 'utf8').digest('base64');
    const req = new NextRequest('https://example.com/api/webhooks/twilio', {
      headers: { 'x-twilio-signature': sig },
    });
    expect(validateTwilioSignature(req, params)).toBeNull();
  });

  it('validateWhatsAppSignature accepts valid HMAC', () => {
    process.env.NODE_ENV = 'production';
    process.env.WHATSAPP_APP_SECRET = 'appsec';
    process.env.WHATSAPP_TOKEN = 't';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '1';
    const raw = '{"entry":[]}';
    const sig =
      'sha256=' + createHmac('sha256', 'appsec').update(raw, 'utf8').digest('hex');
    expect(validateWhatsAppSignature(raw, sig)).toBeNull();
  });
});
