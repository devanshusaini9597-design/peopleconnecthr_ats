import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

// POST /api/messages/read - Mark messages as read
export const POST = withAuth(async (request: NextRequest, _ctx, user) => {
  try {
    const orgId = requireOrgId(user);
    if (isOrgError(orgId)) return orgId;

    const body = await request.json();
    const { messageIds, threadId, markAll = false } = body;

    let where: Record<string, unknown> = {
      thread: { organizationId: orgId },
    };

    if (markAll) {
      where = {
        ...where,
        isRead: false,
        direction: 'INBOUND',
        isDeleted: false,
      };
    } else if (messageIds && messageIds.length > 0) {
      where = {
        ...where,
        id: { in: messageIds },
        isRead: false,
      };
    } else if (threadId) {
      where = {
        ...where,
        threadId,
        isRead: false,
        direction: 'INBOUND',
      };
    } else {
      return NextResponse.json({ error: 'No messages specified' }, { status: 400 });
    }

    const result = await prisma.message.updateMany({
      where,
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      markedAsRead: result.count,
    });
  } catch (e) {
    console.error('POST /api/messages/read', e);
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 });
  }
});
