import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { sendEmail, generateEmailVerificationEmail } from '@/lib/email';
import { rateLimitAsync, getClientIp } from '@/lib/rate-limit';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = await rateLimitAsync(`resend-verify:${ip}`, 3, 15 * 60 * 1000);
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
      );
    }

    const body = await request.json();
    const email = (body?.email ?? '').toString().trim().toLowerCase();
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, isEmailVerified: true },
    });

    // Always return 200 to avoid leaking email existence
    if (!user || user.isEmailVerified) {
      return NextResponse.json({ message: 'If your email is pending verification, a new link has been sent.' });
    }

    const token = randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken: token, verificationTokenExpiry: expiry },
    });

    const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
    const { subject, html, text } = generateEmailVerificationEmail(user.name, verifyUrl);
    await sendEmail({ to: user.email, subject, html, text });

    return NextResponse.json({ message: 'If your email is pending verification, a new link has been sent.' });
  } catch (e) {
    console.error('POST /api/auth/resend-verification', e);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
