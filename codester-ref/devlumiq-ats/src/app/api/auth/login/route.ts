import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signSession, sessionCookieOptions, SESSION_COOKIE, createUserSession } from '@/lib/auth';
import { rateLimitAsync, getClientIp } from '@/lib/rate-limit';

/** Dummy bcrypt hash used so "user not found" still pays the compare cost (anti-enumeration). */
const DUMMY_PASSWORD_HASH =
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.G2oQ.YqKxqKxqK';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = await rateLimitAsync(`login:${ip}`, 10, 15 * 60 * 1000);
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
      );
    }

    const body = await request.json();
    const email = (body?.email ?? '').toString().trim().toLowerCase();
    const password = (body?.password ?? '').toString();

    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    if (!password) return NextResponse.json({ error: 'Password is required' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email }, select: {
      id: true, name: true, email: true, password: true, role: true, isActive: true, organizationId: true,
      isEmailVerified: true, inviteToken: true, tokenVersion: true,
    }});

    // Always run bcrypt.compare to avoid timing leaks that reveal whether an email is registered
    const hashToCompare = user?.password || DUMMY_PASSWORD_HASH;
    const valid = await bcrypt.compare(password, hashToCompare);

    if (!user || !user.password || !valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: 'Your account has been deactivated. Contact your administrator.' }, { status: 403 });
    }

    if (!user.isEmailVerified) {
      if (user.inviteToken) {
        return NextResponse.json(
          { error: 'You have a pending invitation. Please check your email to set up your account.', code: 'PENDING_INVITE' },
          { status: 403 },
        );
      }
      return NextResponse.json(
        { error: 'Please verify your email address before signing in. Check your inbox for the verification link.', code: 'EMAIL_UNVERIFIED' },
        { status: 403 },
      );
    }

    // Update last login timestamp
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});

    // Log activity
    await prisma.userActivityLog.create({
      data: { userId: user.id, action: 'login', metadata: { method: 'password' } },
    }).catch(() => {});

    const tv = user.tokenVersion ?? 0;
    const token = signSession({ userId: user.id, email: user.email, name: user.name, role: user.role, organizationId: user.organizationId ?? null, tokenVersion: tv });
    await createUserSession(user.id, tv, ip, request.headers.get('user-agent'));

    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, initials: user.name.slice(0, 2).toUpperCase() },
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (e) {
    console.error('POST /api/auth/login', e);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
