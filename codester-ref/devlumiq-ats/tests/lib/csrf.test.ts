import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateCsrf } from '@/lib/csrf';

function makeRequest(method: string, headers: Record<string, string> = {}, pathname = '/api/candidates') {
  return {
    method,
    headers: new Headers(headers),
    nextUrl: { pathname },
  } as any;
}

describe('CSRF Protection', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.devlumiq.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows GET requests without origin', () => {
    const result = validateCsrf(makeRequest('GET'));
    expect(result).toBeNull();
  });

  it('allows HEAD requests without origin', () => {
    const result = validateCsrf(makeRequest('HEAD'));
    expect(result).toBeNull();
  });

  it('blocks POST without origin or referer in production', () => {
    const result = validateCsrf(makeRequest('POST'));
    expect(result).not.toBeNull();
  });

  it('allows POST with matching origin', () => {
    const result = validateCsrf(makeRequest('POST', { origin: 'https://app.devlumiq.com' }));
    expect(result).toBeNull();
  });

  it('blocks POST with mismatched origin', () => {
    const result = validateCsrf(makeRequest('POST', { origin: 'https://evil.com' }));
    expect(result).not.toBeNull();
  });

  it('skips CSRF for Bearer API keys', () => {
    const result = validateCsrf(
      makeRequest('POST', { authorization: 'Bearer ext_token_abc' })
    );
    expect(result).toBeNull();
  });

  it('skips CSRF for exempt webhook paths', () => {
    const req = makeRequest('POST');
    (req as any).nextUrl = { pathname: '/api/webhooks/twilio' };
    const result = validateCsrf(req as any);
    expect(result).toBeNull();
  });

  it('allows all requests in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const result = validateCsrf(makeRequest('POST'));
    expect(result).toBeNull();
  });
});
