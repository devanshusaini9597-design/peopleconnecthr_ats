import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const cookieValue = request.cookies.get(SESSION_COOKIE)?.value;
    if (!cookieValue) return NextResponse.json({ user: null });

    // Verify JWT session
    const payload = verifySession(cookieValue);
    const userId = payload?.userId ?? null;

    if (!userId) return NextResponse.json({ user: null });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, isActive: true, organizationId: true },
    });

    if (!user || !user.isActive) return NextResponse.json({ user: null });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId ?? null,
        initials: user.name.slice(0, 2).toUpperCase(),
      },
    });
  } catch (e) {
    console.error('GET /api/auth/session', e);
    return NextResponse.json({ user: null });
  }
}
