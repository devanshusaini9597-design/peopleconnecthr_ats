import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { requireOrgId, isOrgError } from '@/lib/require-org';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const orgId = requireOrgId(user);
    if (isOrgError(orgId)) return orgId;

    const { id } = await params;
    const thread = await prisma.messageThread.findFirst({
      where: { id, organizationId: orgId },
      include: {
        messages: {
          where: { isDeleted: false },
          orderBy: { sentAt: 'asc' },
        },
        _count: {
          select: {
            messages: {
              where: {
                isDeleted: false,
                isRead: false,
                direction: 'INBOUND',
              },
            },
          },
        },
      },
    });

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Mark unread inbound messages as read
    const unreadMessageIds = thread.messages
      .filter((m) => !m.isRead && m.direction === 'INBOUND')
      .map((m) => m.id);

    if (unreadMessageIds.length > 0) {
      await prisma.message.updateMany({
        where: { id: { in: unreadMessageIds } },
        data: { isRead: true, readAt: new Date() },
      });
    }

    return NextResponse.json({
      id: thread.id,
      subject: thread.subject,
      createdAt: thread.createdAt.toISOString(),
      lastMessageAt: thread.lastMessageAt.toISOString(),
      unreadCount: thread._count.messages,
      messages: thread.messages.map((m) => ({
        id: m.id,
        fromName: m.fromName,
        fromEmail: m.fromEmail,
        fromUserId: m.fromUserId,
        toEmail: m.toEmail,
        body: m.body,
        bodyHtml: m.bodyHtml,
        direction: m.direction,
        status: m.status,
        isRead: m.isRead,
        readAt: m.readAt?.toISOString(),
        attachments: m.attachments,
        sentAt: m.sentAt.toISOString(),
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error('GET /api/messages/threads/[id]', e);
    return NextResponse.json({ error: 'Failed to load thread' }, { status: 500 });
  }
}

// DELETE /api/messages/threads/[id] - Hard delete thread (cascades to messages)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const orgId = requireOrgId(user);
    if (isOrgError(orgId)) return orgId;

    const { id } = await params;

    const thread = await prisma.messageThread.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Hard delete the thread; Message.onDelete: Cascade removes all messages automatically
    await prisma.messageThread.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Thread deleted' });
  } catch (e) {
    console.error('DELETE /api/messages/threads/[id]', e);
    return NextResponse.json({ error: 'Failed to delete thread' }, { status: 500 });
  }
}
