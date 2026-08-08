import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

export const GET = withAuth(async (_req, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const items = await prisma.announcement.findMany({
      where: {
        OR: [{ organizationId: orgId }, { organizationId: null }],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const list = items.map((a) => ({
      id: a.id,
      type: a.type as 'announcement' | 'news' | 'reminder',
      title: a.title,
      summary: a.summary,
      time: a.timeLabel ?? undefined,
      cta: a.cta ?? undefined,
      href: a.href ?? undefined,
    }));

    return NextResponse.json(list);
  } catch (e) {
    console.error('GET /api/announcements', e);
    return NextResponse.json({ error: 'Failed to load announcements' }, { status: 500 });
  }
});
