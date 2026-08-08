import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = (body?.token ?? '').toString().trim();
    const password = (body?.password ?? '').toString();

    if (!token) return NextResponse.json({ error: 'Reset token is required' }, { status: 400 });
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'This reset link is invalid or has expired. Please request a new one.' },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
        isEmailVerified: true,
      },
    });

    return NextResponse.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (e) {
    console.error('POST /api/auth/reset-password', e);
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
