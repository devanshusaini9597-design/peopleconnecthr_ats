import { describe, it, expect, afterEach } from 'vitest';
import { POST as createCheckHandler, GET as getChecksHandler } from '@/app/api/checkr/route';
import { POST as webhookHandler } from '@/app/api/webhooks/checkr/route';

describe('Checkr API Integration — RBAC enforcement', () => {
  it('returns 401 for unauthenticated POST /api/checkr', async () => {
    const req = new Request('http://localhost/api/checkr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ candidateId: 'test-123' }),
    }) as any;
    req.nextUrl = new URL('http://localhost/api/checkr');
    const response = await createCheckHandler(req);
    expect(response.status).toBe(401);
  });

  it('returns 401 for unauthenticated GET /api/checkr', async () => {
    const req = new Request('http://localhost/api/checkr?candidateId=test-123') as any;
    const response = await getChecksHandler(req);
    expect(response.status).toBe(401);
  });
});

describe('Checkr Webhook Handler — fail-closed signature verification', () => {
  const originalSecret = process.env.CHECKR_WEBHOOK_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CHECKR_WEBHOOK_SECRET;
    else process.env.CHECKR_WEBHOOK_SECRET = originalSecret;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('allows unsigned webhook in development when secret is unset', async () => {
    process.env.NODE_ENV = 'development';
    process.env.CHECKR_WEBHOOK_SECRET = '';
    const req = new Request('http://localhost/api/webhooks/checkr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'report.completed',
        data: { id: 'rep-123', candidate_id: 'cand-123', adjudication: 'clear' },
      }),
    });
    const response = await webhookHandler(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.received).toBe(true);
  });

  it('rejects unsigned webhook in production when secret is unset (fail-closed)', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CHECKR_WEBHOOK_SECRET;
    const req = new Request('http://localhost/api/webhooks/checkr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'report.clear', data: { candidate_id: 'x' } }),
    });
    const response = await webhookHandler(req);
    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.code).toBe('SECRET_NOT_CONFIGURED');
  });

  it('rejects webhook with wrong HMAC signature when secret is configured', async () => {
    process.env.CHECKR_WEBHOOK_SECRET = 'test-secret';
    const req = new Request('http://localhost/api/webhooks/checkr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Checkr-Signature': 'bad-signature',
      },
      body: JSON.stringify({ type: 'report.completed', data: {} }),
    });
    const response = await webhookHandler(req);
    expect(response.status).toBe(401);
  });

  it('accepts webhook with valid HMAC signature', async () => {
    const { createHmac } = await import('crypto');
    const secret = 'test-secret-valid';
    process.env.CHECKR_WEBHOOK_SECRET = secret;
    const body = JSON.stringify({ type: 'candidate.created', data: {} });
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    const req = new Request('http://localhost/api/webhooks/checkr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Checkr-Signature': sig },
      body,
    });
    const response = await webhookHandler(req);
    expect(response.status).toBe(200);
  });
});
