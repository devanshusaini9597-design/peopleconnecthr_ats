import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { rateLimitAsync, getClientIp } from '@/lib/rate-limit';
import { sendEmail, generateEmailVerificationEmail } from '@/lib/email';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/** POST /api/auth/register — create a new user account */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = await rateLimitAsync(`register:${ip}`, 5, 60 * 60 * 1000);
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
      );
    }

    const body = await request.json();
    const name = (body?.name ?? '').toString().trim();
    const email = (body?.email ?? '').toString().trim().toLowerCase();
    const password = (body?.password ?? '').toString();

    if (!name) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists. Please sign in instead.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Derive a company name + slug from the email domain
    const domain = email.split('@')[1] ?? 'workspace';
    const orgName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
    const baseSlug = domain.split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
    const uniqueSlug = `${baseSlug}-${Date.now()}`;

    // Create org + user atomically
    const company = await prisma.company.create({
      data: {
        name: orgName,
        slug: uniqueSlug,
        isPublished: false,
      },
    });

    const verificationToken = randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: passwordHash,
        role: 'ADMIN',
        organizationId: company.id,
        isEmailVerified: false,
        verificationToken,
        verificationTokenExpiry,
      },
    });

    // Send verification email
    const verifyUrl = `${APP_URL}/verify-email?token=${verificationToken}`;
    const { subject, html, text } = generateEmailVerificationEmail(name, verifyUrl);
    await sendEmail({ to: email, subject, html, text });

    return NextResponse.json({
      requiresVerification: true,
      email: user.email,
      message: 'Account created! Please check your email to verify your address before signing in.',
    }, { status: 201 });
  } catch (e) {
    console.error('POST /api/auth/register', e);
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
  }
}
