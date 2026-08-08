import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token') ?? '';
    if (!token) {
      return NextResponse.json({ error: 'Verification token is required' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpiry: { gt: new Date() },
      },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'This verification link is invalid or has expired. Please request a new one.' },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });

    return NextResponse.json({ message: 'Email verified successfully. You can now sign in.' });
  } catch (e) {
    console.error('GET /api/auth/verify-email', e);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
