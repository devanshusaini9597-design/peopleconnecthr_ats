import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable must be set in production');
}
const JWT_SECRET = process.env.JWT_SECRET || 'devlumiq-ats-dev-only-secret-do-not-use-in-production';
export const SESSION_COOKIE = 'ats_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string | null;
}

interface JwtPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
  organizationId?: string | null;
  tokenVersion?: number;
  iat?: number;
  exp?: number;
}

/** Sign a session payload into a JWT string */
export function signSession(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

/** Verify + decode a JWT string. Returns null if invalid/expired. */
export function verifySession(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

/** Cookie options shared across all session cookie writes */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: SESSION_MAX_AGE,
    path: '/',
  };
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(SESSION_COOKIE)?.value;
    if (!cookieValue) return null;

    const jwtPayload = verifySession(cookieValue);
    if (!jwtPayload?.userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: jwtPayload.userId },
      select: { id: true, name: true, email: true, role: true, isActive: true, organizationId: true, tokenVersion: true },
    });

    if (!user || !user.isActive) return null;

    // Phase B: tokenVersion guard — any password change or force-logout increments this
    if (jwtPayload.tokenVersion !== undefined && user.tokenVersion !== jwtPayload.tokenVersion) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId ?? null,
    };
  } catch (error) {
    console.error('getSession error:', error);
    return null;
  }
}

export async function requireAuth(): Promise<SessionUser | null> {
  return getSession();
}

export async function requireRole(roles: string[]): Promise<SessionUser | null> {
  const user = await getSession();
  if (!user) return null;
  if (!roles.includes(user.role)) return null;
  return user;
}

/**
 * Increment the user's tokenVersion — instantly invalidates ALL existing JWTs
 * for that user (password change, admin force-logout, account deactivation).
 */
export async function invalidateAllSessions(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } }),
    prisma.userSession.deleteMany({ where: { userId } }),
  ]);
}

/** Record a new session in UserSession for active-session tracking */
export async function createUserSession(
  userId: string,
  tokenVersion: number,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  await prisma.userSession.create({
    data: { userId, tokenVersion, ipAddress, userAgent, expiresAt },
  }).catch(() => {});
}
