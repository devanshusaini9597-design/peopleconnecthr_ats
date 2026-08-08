import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

export const GET = withAuth(async (_req, _ctx, user) => {
  try {
    const orgId = requireOrgId(user);
    if (isOrgError(orgId)) return orgId;

    const threads = await prisma.messageThread.findMany({
      orderBy: { lastMessageAt: 'desc' },
      where: {
        messages: { some: { isDeleted: false } },
        organizationId: orgId,
      },
      include: {
        messages: {
          where: { isDeleted: false },
          orderBy: { sentAt: 'desc' },
          take: 1,
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

    const list = threads.map((t) => ({
      id: t.id,
      candidateId: t.candidateId ?? null,
      subject: t.subject,
      createdAt: t.createdAt.toISOString(),
      lastMessageAt: t.lastMessageAt.toISOString(),
      unreadCount: t._count.messages,
      lastMessage: t.messages[0]
        ? {
            id: t.messages[0].id,
            fromName: t.messages[0].fromName,
            fromEmail: t.messages[0].fromEmail,
            body: t.messages[0].body,
            direction: t.messages[0].direction,
            isRead: t.messages[0].isRead,
            sentAt: t.messages[0].sentAt.toISOString(),
            channel: t.messages[0].channel,
          }
        : null,
    }));

    return NextResponse.json({ threads: list });
  } catch (e) {
    console.error('GET /api/messages/threads', e);
    return NextResponse.json({ error: 'Failed to load threads' }, { status: 500 });
  }
});

export const POST = withAuth(async (request: NextRequest, _ctx, user) => {
  try {
    const orgId = requireOrgId(user);
    if (isOrgError(orgId)) return orgId;

    const body = await request.json();
    const { subject, toEmail, message, attachments } = body;

    const thread = await prisma.messageThread.create({
      data: {
        subject: subject || 'No Subject',
        lastMessageAt: new Date(),
        organizationId: orgId,
      },
    });

    const msg = await prisma.message.create({
      data: {
        threadId: thread.id,
        fromUserId: user.id,
        fromName: user.name || 'Recruiter',
        fromEmail: user.email,
        toEmail,
        body: message,
        direction: 'OUTBOUND',
        status: 'sent',
        attachments: attachments || [],
        sentAt: new Date(),
      },
    });

    return NextResponse.json({
      thread: {
        id: thread.id,
        candidateId: thread.candidateId ?? null,
        subject: thread.subject,
        createdAt: thread.createdAt.toISOString(),
        lastMessageAt: thread.lastMessageAt.toISOString(),
        unreadCount: 0,
        lastMessage: {
          id: msg.id,
          fromName: msg.fromName,
          fromEmail: msg.fromEmail,
          body: msg.body,
          direction: msg.direction,
          isRead: true,
          sentAt: msg.sentAt.toISOString(),
          channel: msg.channel,
        },
      },
    }, { status: 201 });
  } catch (e) {
    console.error('POST /api/messages/threads', e);
    return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
  }
});
