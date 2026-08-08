import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-permission';
import { signSession, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth';

/** GET /api/users/me — return the current user's profile */
export const GET = withAuth(async (_req, _ctx, session) => {
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  return NextResponse.json({ user });
});

/** PATCH /api/users/me — update name and/or email for the current user */
export const PATCH = withAuth(async (request: NextRequest, _ctx, session) => {
  let body: { name?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = (body?.name ?? '').toString().trim();
  const email = (body?.email ?? '').toString().trim().toLowerCase();

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }

  if (email !== session.email) {
    const conflict = await prisma.user.findUnique({ where: { email } });
    if (conflict) {
      return NextResponse.json({ error: 'Email already in use by another account' }, { status: 409 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: session.id },
    data: { name, email },
    select: { id: true, name: true, email: true, role: true, tokenVersion: true },
  });

  const newToken = signSession({
    userId: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    organizationId: session.organizationId,
    tokenVersion: updated.tokenVersion,
  });
  const response = NextResponse.json({ user: updated });
  response.cookies.set(SESSION_COOKIE, newToken, sessionCookieOptions());
  return response;
});
