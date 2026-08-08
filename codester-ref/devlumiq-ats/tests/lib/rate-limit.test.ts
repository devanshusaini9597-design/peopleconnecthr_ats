import { describe, it, expect } from 'vitest';
import { rateLimit } from '@/lib/rate-limit';

describe('Rate Limiter', () => {
  it('allows requests within the limit', () => {
    const key = `test-allow-${Date.now()}`;
    const result = rateLimit(key, 5, 60000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('blocks requests exceeding the limit', () => {
    const key = `test-block-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      rateLimit(key, 3, 60000);
    }
    const blocked = rateLimit(key, 3, 60000);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('resets after the window expires', async () => {
    const key = `test-reset-${Date.now()}`;
    // Use a short window (50ms)
    rateLimit(key, 1, 50);
    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 60));
    const result = rateLimit(key, 1, 50);
    // After window expires, should succeed
    expect(result.success).toBe(true);
  });

  it('returns correct retryAfterSeconds', () => {
    const key = `test-retry-${Date.now()}`;
    rateLimit(key, 1, 60000);
    const blocked = rateLimit(key, 1, 60000);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });
});
