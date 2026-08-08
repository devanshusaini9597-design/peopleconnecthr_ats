/**
 * Rate limiter with Redis support and in-memory fallback.
 *
 * When REDIS_URL is set, uses Redis for distributed rate limiting
 * across multiple instances. Otherwise falls back to an in-process
 * Map (suitable for single-instance / serverless deployments).
 *
 * Redis setup (optional):
 *   1. Set REDIS_URL in .env (e.g. redis://localhost:6379 or Upstash URL)
 *   2. npm install ioredis  (only needed if using Redis)
 *
 * Usage:
 *   const result = await rateLimitAsync(`login:${ip}`, 10, 15 * 60 * 1000);
 *   if (!result.success) return 429;
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// ── In-memory store (fallback) ────────────────────────────────────────────────

const memoryStore = new Map<string, RateLimitRecord>();

/** Purge expired entries every 5 minutes to avoid memory leaks. */
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of memoryStore.entries()) {
      if (now > record.resetAt) memoryStore.delete(key);
    }
  }, 5 * 60 * 1000);
}

// ── Redis client (lazy-loaded, optional) ──────────────────────────────────────

let redisClient: any = null;
let redisAvailable: boolean | null = null;

async function getRedis(): Promise<any | null> {
  if (redisAvailable === false) return null;
  if (redisClient) return redisClient;

  const url = process.env.REDIS_URL;
  if (!url) { redisAvailable = false; return null; }

  try {
    // Dynamic import — ioredis is optional
    const { default: Redis } = await import('ioredis' as string);
    redisClient = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
    await redisClient.connect();
    redisAvailable = true;
    return redisClient;
  } catch {
    console.warn('[rate-limit] Redis not available, using in-memory fallback');
    redisAvailable = false;
    return null;
  }
}

export interface RateLimitResult {
  success: boolean;
  /** Requests remaining in the current window */
  remaining: number;
  /** Epoch ms when the window resets */
  resetAt: number;
  /** Seconds until the window resets (for Retry-After header) */
  retryAfterSeconds: number;
}

// ── Redis-backed rate limiting ────────────────────────────────────────────────

async function rateLimitRedis(redis: any, key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = Date.now();
  const windowSec = Math.ceil(windowMs / 1000);
  const redisKey = `rl:${key}`;

  // Atomic increment + expire
  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.expire(redisKey, windowSec);
  }
  const ttl = await redis.ttl(redisKey);
  const resetAt = now + (ttl > 0 ? ttl * 1000 : windowMs);

  if (count > limit) {
    return { success: false, remaining: 0, resetAt, retryAfterSeconds: ttl > 0 ? ttl : windowSec };
  }

  return { success: true, remaining: limit - count, resetAt, retryAfterSeconds: ttl > 0 ? ttl : windowSec };
}

// ── In-memory rate limiting ──────────────────────────────────────────────────

function rateLimitMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = memoryStore.get(key);

  if (!existing || now > existing.resetAt) {
    const resetAt = now + windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    return { success: true, remaining: limit - 1, resetAt, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }

  if (existing.count >= limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    success: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
    retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
  };
}

/**
 * @param key       Unique bucket key, e.g. `login:127.0.0.1`
 * @param limit     Max requests allowed in the window
 * @param windowMs  Window size in milliseconds
 * @deprecated Prefer rateLimitAsync for auth / multi-instance deployments
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  // Synchronous path — always available
  return rateLimitMemory(key, limit, windowMs);
}

/**
 * Async version that uses Redis when available, falling back to in-memory.
 * Use this in API routes where async is acceptable — especially auth endpoints.
 */
export async function rateLimitAsync(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  try {
    const redis = await getRedis();
    if (redis) return await rateLimitRedis(redis, key, limit, windowMs);
  } catch {
    // Redis error — fall back silently
  }
  return rateLimitMemory(key, limit, windowMs);
}

/**
 * Client IP for rate limiting.
 *
 * X-Forwarded-For / X-Real-IP are only trusted when TRUSTED_PROXY=true
 * (or TRUST_PROXY=true). Without that flag, forged headers can reset buckets.
 */
export function getClientIp(request: Request): string {
  const headers = new Headers((request as Request).headers);
  const trustProxy =
    process.env.TRUSTED_PROXY === 'true' ||
    process.env.TRUST_PROXY === 'true';

  if (trustProxy) {
    const forwarded = headers.get('x-forwarded-for')?.split(',')[0].trim();
    if (forwarded) return forwarded;
    const realIp = headers.get('x-real-ip')?.trim();
    if (realIp) return realIp;
  }

  return 'unknown';
}
