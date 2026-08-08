import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable must be set in production');
}

const JWT_SECRET = env.JWT_SECRET;

export interface PortalSession {
  userId: string;
  email: string;
}

export function signPortalToken(userId: string, email: string): string {
  return jwt.sign({ userId, email, type: 'candidate' }, JWT_SECRET, { expiresIn: '7d' });
}

export function getPortalToken(request: Request | NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  // Also allow cookie for browser portal UI
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/(?:^|;\s*)portal_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function verifyPortalToken(token: string): PortalSession | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId?: string; email?: string; type?: string };
    if (!payload.userId || payload.type !== 'candidate') return null;
    return { userId: payload.userId, email: payload.email || '' };
  } catch {
    return null;
  }
}

export async function requirePortalUser(request: Request | NextRequest) {
  const token = getPortalToken(request);
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  }
  const session = verifyPortalToken(token);
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  }
  const user = await prisma.candidatePortalUser.findUnique({
    where: { id: session.userId },
    include: { linkedCandidate: true },
  });
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  }
  return { user, session } as const;
}
