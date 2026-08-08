import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

/** GET /api/audit-logs — view activity logs (ADMIN only) */
export const GET = withPermission('VIEW_AUDIT_LOGS', async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50'));
    const userId = searchParams.get('userId') ?? undefined;
    const action = searchParams.get('action') ?? undefined;

    const orgUsers = await prisma.user.findMany({
      where: { organizationId: orgId },
      select: { id: true },
    });
    const orgUserIds = orgUsers.map((u) => u.id);

    const scopedWhere = userId
      ? { userId: orgUserIds.includes(userId) ? userId : '__none__', ...(action ? { action } : {}) }
      : { userId: { in: orgUserIds }, ...(action ? { action } : {}) };

    const [logs, total] = await Promise.all([
      prisma.userActivityLog.findMany({
        where: scopedWhere,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
      prisma.userActivityLog.count({ where: scopedWhere }),
    ]);

    return NextResponse.json({
      logs: logs.map((l) => ({
        id: l.id,
        action: l.action,
        metadata: l.metadata,
        createdAt: l.createdAt.toISOString(),
        user: l.user,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (e) {
    console.error('GET /api/audit-logs', e);
    return NextResponse.json({ error: 'Failed to load audit logs' }, { status: 500 });
  }
});
