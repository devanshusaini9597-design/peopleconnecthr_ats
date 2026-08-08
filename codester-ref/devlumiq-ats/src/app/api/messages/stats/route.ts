import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { requireOrgId, isOrgError } from '@/lib/require-org';

// GET /api/messages/stats - Get inbox statistics
export async function GET() {
  try {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const orgId = requireOrgId(user);
    if (isOrgError(orgId)) return orgId;

    const orgFilter = { organizationId: orgId };
    const msgOrgFilter = { thread: { organizationId: orgId } };

    const [
      totalThreads,
      totalMessages,
      unreadCount,
      inboundCount,
      outboundCount,
      recentThreads,
    ] = await Promise.all([
      prisma.messageThread.count({ where: { ...orgFilter } }),
      prisma.message.count({
        where: { isDeleted: false, ...msgOrgFilter },
      }),
      prisma.message.count({
        where: {
          isDeleted: false,
          isRead: false,
          direction: 'INBOUND',
          ...msgOrgFilter,
        },
      }),
      prisma.message.count({
        where: {
          isDeleted: false,
          direction: 'INBOUND',
          ...msgOrgFilter,
        },
      }),
      prisma.message.count({
        where: {
          isDeleted: false,
          direction: 'OUTBOUND',
          ...msgOrgFilter,
        },
      }),
      prisma.messageThread.findMany({
        take: 5,
        orderBy: { lastMessageAt: 'desc' },
        where: { ...orgFilter },
        include: {
          messages: {
            where: { isDeleted: false },
            orderBy: { sentAt: 'desc' },
            take: 1,
            select: {
              fromName: true,
              body: true,
              sentAt: true,
              isRead: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      stats: {
        totalThreads,
        totalMessages,
        unreadCount,
        inboundCount,
        outboundCount,
        replyRate: inboundCount > 0 ? Math.round((outboundCount / inboundCount) * 100) : 0,
      },
      recentActivity: recentThreads.map(t => ({
        id: t.id,
        subject: t.subject,
        lastMessage: t.messages[0] || null,
        lastMessageAt: t.lastMessageAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error('GET /api/messages/stats', e);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}
