import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-permission';
import { invalidateAllSessions } from '@/lib/auth';

/**
 * PATCH /api/users/me/password
 * Body: { currentPassword: string; newPassword: string }
 */
export const PATCH = withAuth(async (request: NextRequest, _ctx, session) => {
  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const currentPassword = (body?.currentPassword ?? '').toString();
  const newPassword = (body?.newPassword ?? '').toString();

  if (!currentPassword) {
    return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
  }
  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (user.password) {
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: session.id },
    data: { password: hashed },
  });

  await invalidateAllSessions(session.id).catch(() => {});

  return NextResponse.json({ success: true });
});
