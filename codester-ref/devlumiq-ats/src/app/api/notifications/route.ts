import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-permission';
import type { SessionUser } from '@/lib/auth';

/** GET /api/notifications — return latest 20 notifications for the current user */
export const GET = withAuth(async (_req: NextRequest, _ctx, session: SessionUser) => {
  try {
    const userId = session.id;

    const where = { OR: [{ userId }, { userId: null as string | null }] };

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const unreadCount = await prisma.notification.count({
      where: { ...where, isRead: false },
    });
    return NextResponse.json({ notifications, unreadCount });
  } catch (e) {
    console.error('GET /api/notifications', e);
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }
});

/** PATCH /api/notifications — mark all as read, or mark one by id */
export const PATCH = withAuth(async (request: NextRequest, _ctx, session: SessionUser) => {
  try {
    const userId = session.id;
    const body = await request.json().catch(() => ({}));
    const id = (body as { id?: string })?.id;

    const where = { OR: [{ userId }, { userId: null }] };

    if (id) {
      await prisma.notification.update({ where: { id }, data: { isRead: true } });
    } else {
      await prisma.notification.updateMany({ where: { ...where, isRead: false }, data: { isRead: true } });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('PATCH /api/notifications', e);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
});
