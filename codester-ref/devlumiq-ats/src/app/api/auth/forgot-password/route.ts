import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { sendEmail, generatePasswordResetEmail } from '@/lib/email';
import { rateLimitAsync, getClientIp } from '@/lib/rate-limit';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = await rateLimitAsync(`forgot-password:${ip}`, 5, 15 * 60 * 1000);
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
      select: { id: true, name: true, email: true },
    });

    // Always return 200 — don't leak whether the email exists
    if (!user) {
      return NextResponse.json({ message: 'If an account exists for that email, a reset link has been sent.' });
    }

    const token = randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiry: expiry },
    });

    const resetUrl = `${APP_URL}/reset-password?token=${token}`;
    const { subject, html, text } = generatePasswordResetEmail(user.name, resetUrl);

    await sendEmail({ to: user.email, subject, html, text });

    return NextResponse.json({ message: 'If an account exists for that email, a reset link has been sent.' });
  } catch (e) {
    console.error('POST /api/auth/forgot-password', e);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
