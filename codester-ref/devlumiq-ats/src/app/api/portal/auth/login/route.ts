import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { rateLimitAsync, getClientIp } from '@/lib/rate-limit';
import { signPortalToken } from '@/lib/portal-auth';

/** Dummy bcrypt hash so "user not found" still pays the compare cost (anti-enumeration). */
const DUMMY_PASSWORD_HASH =
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.G2oQ.YqKxqKxqK';

// POST /api/portal/auth/login - Login candidate portal
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = await rateLimitAsync(`portal-login:${ip}`, 10, 15 * 60 * 1000);
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
      );
    }

    const { email, password } = await request.json();

    const user = await prisma.candidatePortalUser.findUnique({
      where: { email },
    });

    // Always compare to avoid timing leaks that reveal whether an email is registered
    const isValid = await bcrypt.compare(password, user?.password || DUMMY_PASSWORD_HASH);

    if (!user || !isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Update last login
    await prisma.candidatePortalUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = signPortalToken(user.id, user.email);

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error('Error logging in:', error);
    return NextResponse.json({ error: 'Failed to login' }, { status: 500 });
  }
}
