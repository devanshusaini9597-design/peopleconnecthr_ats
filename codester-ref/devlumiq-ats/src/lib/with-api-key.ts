/**
 * API Key / Chrome Extension Bearer token authentication middleware.
 *
 * Accepts Authorization: Bearer <token> resolved in order:
 *   1. ChromeExtensionToken records
 *   2. ApiKey records (hashed, with legacy plain-text fallback)
 *   3. EXTENSION_API_KEY env (maps to EXTENSION_API_USER_ID user, or first active ADMIN)
 *
 * Usage:
 *   export const GET = withApiKey(['write'], async (req, ctx, apiKeyRecord) => { ... });
 */

import { createHash, randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { ApiKey } from '@prisma/client';
import { getSession, SessionUser } from '@/lib/auth';
import { hasPermission, Permission, Role } from '@/lib/roles';
import { validateCsrf } from '@/lib/csrf';

/** Hash a raw API key for safe DB storage / lookup */
export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

/** Generate a new extension token string (returned once to the user). */
export function generateExtensionToken(): string {
  return `ext_${randomBytes(32).toString('hex')}`;
}

/** Full shape of an ApiKey row joined with its owner — includes the new keyHash column */
export type ApiKeyRecord = Omit<ApiKey, 'keyHash'> & {
  keyHash?: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    organizationId: string | null;
  };
};

type RouteContext = { params: Promise<Record<string, string>> };
type AuthedHandler<T extends RouteContext = RouteContext> = (
  req: NextRequest,
  ctx: T,
  session: SessionUser,
) => Promise<NextResponse> | NextResponse;

type ApiKeyHandler = (
  req: NextRequest,
  ctx: RouteContext,
  key: ApiKeyRecord,
) => Promise<NextResponse> | NextResponse;

function toSessionUser(user: ApiKeyRecord['user']): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  };
}

async function resolveExtensionEnvUser(): Promise<ApiKeyRecord['user'] | null> {
  const userId = process.env.EXTENSION_API_USER_ID?.trim();
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, isActive: true, organizationId: true },
    });
    if (user?.isActive) return user;
  }

  // Fallback: first active ADMIN with an organization
  return prisma.user.findFirst({
    where: { role: 'ADMIN', isActive: true, organizationId: { not: null } },
    select: { id: true, name: true, email: true, role: true, isActive: true, organizationId: true },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Resolve a Bearer token to an ApiKeyRecord-like auth context.
 * Returns null if the token is invalid.
 */
export async function resolveBearerAuth(rawKey: string): Promise<ApiKeyRecord | null> {
  if (!rawKey) return null;

  const userSelect = {
    select: { id: true, name: true, email: true, role: true, isActive: true, organizationId: true },
  } as const;

  // 1) ChromeExtensionToken
  const extToken = await prisma.chromeExtensionToken.findUnique({
    where: { token: rawKey },
  });
  if (extToken) {
    if (!extToken.isActive) return null;
    if (extToken.expiresAt && extToken.expiresAt < new Date()) return null;

    const user = await prisma.user.findUnique({
      where: { id: extToken.userId },
      ...userSelect,
    });
    if (!user?.isActive) return null;

    prisma.chromeExtensionToken
      .update({ where: { id: extToken.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});

    return {
      id: extToken.id,
      userId: user.id,
      name: 'Chrome Extension',
      key: rawKey,
      keyHash: null,
      permissions: ['read', 'write'],
      lastUsedAt: extToken.lastUsedAt,
      expiresAt: extToken.expiresAt,
      isActive: true,
      createdAt: extToken.createdAt,
      user,
    };
  }

  // 2) ApiKey (hash then legacy plain-text)
  const keyHash = hashApiKey(rawKey);
  const byHash = await prisma.apiKey.findFirst({
    where: { keyHash },
    include: { user: userSelect },
  });

  const keyRecord: ApiKeyRecord | null =
    byHash ??
    (await prisma.apiKey.findUnique({
      where: { key: rawKey },
      include: { user: userSelect },
    }));

  if (!byHash && keyRecord) {
    prisma.apiKey.update({ where: { id: keyRecord.id }, data: { keyHash } }).catch(() => {});
  }

  if (keyRecord) {
    if (!keyRecord.isActive) return null;
    if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) return null;
    if (!keyRecord.user.isActive) return null;

    prisma.apiKey
      .update({ where: { id: keyRecord.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});

    return keyRecord;
  }

  // 3) EXTENSION_API_KEY env fallback
  const envKey = process.env.EXTENSION_API_KEY?.trim();
  if (envKey && rawKey === envKey) {
    const user = await resolveExtensionEnvUser();
    if (!user) return null;

    return {
      id: 'env-extension-key',
      userId: user.id,
      name: 'EXTENSION_API_KEY',
      key: rawKey,
      keyHash: null,
      permissions: ['read', 'write'],
      lastUsedAt: new Date(),
      expiresAt: null,
      isActive: true,
      createdAt: new Date(),
      user,
    };
  }

  return null;
}

/**
 * @param requiredPermissions  Any of these must be present in ApiKey.permissions
 * @param handler              Route handler receiving the validated key + owning user
 */
export function withApiKey(requiredPermissions: string[], handler: ApiKeyHandler) {
  return async (req: NextRequest, ctx: RouteContext) => {
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }

    const rawKey = authHeader.slice(7).trim();
    const keyRecord = await resolveBearerAuth(rawKey);

    if (!keyRecord) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    if (requiredPermissions.length > 0) {
      const keyPerms = (keyRecord.permissions as unknown as string[]) ?? [];
      // Extension tokens / env key grant read+write; ApiKeys use their stored perms
      const hasPermission =
        keyPerms.length === 0
          ? false
          : requiredPermissions.some((p) => keyPerms.includes(p));
      if (!hasPermission) {
        return NextResponse.json(
          { error: 'Insufficient API key permissions', required: requiredPermissions },
          { status: 403 },
        );
      }
    }

    return handler(req, ctx, {
      ...keyRecord,
      user: {
        id: keyRecord.user.id,
        name: keyRecord.user.name,
        email: keyRecord.user.email,
        role: keyRecord.user.role,
        isActive: keyRecord.user.isActive,
        organizationId: keyRecord.user.organizationId,
      },
    });
  };
}

/**
 * Accepts either a cookie session (with optional permission) or a Bearer API key.
 * Used by Chrome extension routes that must work outside the browser cookie jar.
 */
export function withSessionOrApiKey<T extends RouteContext = RouteContext>(
  permission: Permission | null,
  apiKeyPermissions: string[],
  handler: AuthedHandler<T>,
) {
  return async (req: NextRequest, ctx: T) => {
    const authHeader = req.headers.get('authorization') ?? '';

    if (authHeader.startsWith('Bearer ')) {
      const rawKey = authHeader.slice(7).trim();
      const keyRecord = await resolveBearerAuth(rawKey);
      if (!keyRecord) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
      }
      if (apiKeyPermissions.length > 0) {
        const keyPerms = (keyRecord.permissions as unknown as string[]) ?? [];
        const ok = apiKeyPermissions.some((p) => keyPerms.includes(p));
        if (!ok) {
          return NextResponse.json(
            { error: 'Insufficient API key permissions', required: apiKeyPermissions },
            { status: 403 },
          );
        }
      }
      return handler(req, ctx, toSessionUser(keyRecord.user));
    }

    // Cookie session path — CSRF for mutating methods
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const csrfError = validateCsrf(req);
      if (csrfError) return csrfError;
    }

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (permission && !hasPermission(session.role as Role, permission)) {
      return NextResponse.json({ error: 'Forbidden', required: permission }, { status: 403 });
    }
    return handler(req, ctx, session);
  };
}
