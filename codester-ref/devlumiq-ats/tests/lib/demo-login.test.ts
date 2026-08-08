import { describe, it, expect, afterEach } from 'vitest';
import { isDemoLoginEnabled, isDemoHost } from '@/lib/demo-login';

describe('isDemoHost', () => {
  it('matches the official staging hostname', () => {
    expect(isDemoHost('devlumiq-ats-v22-staging.vercel.app')).toBe(true);
  });

  it('matches the official rbac demo hostname', () => {
    expect(isDemoHost('devlumiq-ats-rbac.vercel.app')).toBe(true);
  });

  it('matches localhost', () => {
    expect(isDemoHost('localhost:3000')).toBe(true);
  });

  it('rejects customer production hosts', () => {
    expect(isDemoHost('app.customer.com')).toBe(false);
    expect(isDemoHost('devlumiq.com')).toBe(false);
  });
});

describe('isDemoLoginEnabled', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalFlag = process.env.ENABLE_DEMO_LOGIN;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalFlag === undefined) delete process.env.ENABLE_DEMO_LOGIN;
    else process.env.ENABLE_DEMO_LOGIN = originalFlag;
    if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it('is disabled in production by default', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_DEMO_LOGIN;
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(isDemoLoginEnabled()).toBe(false);
  });

  it('is enabled on staging host even in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_DEMO_LOGIN;
    expect(isDemoLoginEnabled('devlumiq-ats-v22-staging.vercel.app')).toBe(true);
  });

  it('can be explicitly enabled in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_DEMO_LOGIN = 'true';
    expect(isDemoLoginEnabled()).toBe(true);
  });

  it('is enabled in development by default', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ENABLE_DEMO_LOGIN;
    expect(isDemoLoginEnabled()).toBe(true);
  });

  it('can be explicitly disabled in development', () => {
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_DEMO_LOGIN = 'false';
    expect(isDemoLoginEnabled('devlumiq-ats-v22-staging.vercel.app')).toBe(false);
  });
});
