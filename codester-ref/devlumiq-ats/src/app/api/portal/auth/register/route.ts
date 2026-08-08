import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// POST /api/portal/auth/register - Register candidate portal account
export async function POST(request: Request) {
  try {
    const { email, password, name, phone } = await request.json();

    // Check if email already exists
    const existing = await prisma.candidatePortalUser.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create portal user
    const user = await prisma.candidatePortalUser.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
      },
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
    });
  } catch (error) {
    console.error('Error registering portal user:', error);
    return NextResponse.json({ error: 'Failed to register' }, { status: 500 });
  }
}
