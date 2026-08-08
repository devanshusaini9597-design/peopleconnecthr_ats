import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-permission';
import { invalidateAllSessions, signSession, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth';

/** GET /api/users/me/sessions — list all active sessions for the current user */
export const GET = withAuth(async (_req, _ctx, session) => {
  const sessions = await prisma.userSession.findMany({
    where: { userId: session.id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, ipAddress: true, userAgent: true, createdAt: true, expiresAt: true },
  });

  return NextResponse.json({ sessions });
});

/** DELETE /api/users/me/sessions — log out ALL other devices (keeps current session) */
export const DELETE = withAuth(async (_req, _ctx, session) => {
  // Invalidate all sessions (increments tokenVersion — kills all existing JWTs)
  await invalidateAllSessions(session.id);

  // Re-issue a fresh JWT for the current device so this request stays authenticated
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { tokenVersion: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const newToken = signSession({
    userId: session.id,
    email: session.email,
    name: session.name,
    role: session.role,
    organizationId: session.organizationId,
    tokenVersion: user.tokenVersion,
  });

  await prisma.userSession.create({
    data: {
      userId: session.id,
      tokenVersion: user.tokenVersion,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  }).catch(() => {});

  const response = NextResponse.json({ success: true, message: 'All other sessions have been terminated.' });
  response.cookies.set(SESSION_COOKIE, newToken, sessionCookieOptions());
  return response;
});
