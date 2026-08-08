import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signSession, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth';

/** GET /api/auth/setup-account?token=xxx — look up invite, return name + email for the UI */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token') ?? '';
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 400 });

    const user = await prisma.user.findFirst({
      where: {
        inviteToken: token,
        inviteTokenExpiry: { gt: new Date() },
      },
      select: { name: true, email: true, organization: { select: { name: true } } },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'This invitation link is invalid or has expired. Please contact your administrator.' },
        { status: 400 },
      );
    }

    return NextResponse.json({
      name: user.name,
      email: user.email,
      orgName: user.organization?.name ?? null,
    });
  } catch (e) {
    console.error('GET /api/auth/setup-account', e);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}

/** POST /api/auth/setup-account — set password, consume invite token, auto-login */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = (body?.token ?? '').toString().trim();
    const password = (body?.password ?? '').toString();

    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        inviteToken: token,
        inviteTokenExpiry: { gt: new Date() },
      },
      select: { id: true, name: true, email: true, role: true, organizationId: true, tokenVersion: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'This invitation link is invalid or has expired. Please contact your administrator.' },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: passwordHash,
        isEmailVerified: true,
        inviteToken: null,
        inviteTokenExpiry: null,
        lastLoginAt: new Date(),
      },
    });

    await prisma.userActivityLog.create({
      data: { userId: user.id, action: 'account_setup', metadata: { method: 'invite' } },
    }).catch(() => {});

    const jwtToken = signSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId ?? null,
      tokenVersion: user.tokenVersion,
    });

    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
    response.cookies.set(SESSION_COOKIE, jwtToken, sessionCookieOptions());
    return response;
  } catch (e) {
    console.error('POST /api/auth/setup-account', e);
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 });
  }
}
