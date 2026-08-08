import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

// POST /api/messages - Create new message
export const POST = withAuth(async (request: NextRequest, _ctx, user) => {
  try {
    const orgId = requireOrgId(user);
    if (isOrgError(orgId)) return orgId;

    const body = await request.json();
    const { threadId, toEmail, subject, body: messageBody, attachments, candidateId } = body;

    let thread;
    if (!threadId) {
      thread = await prisma.messageThread.create({
        data: {
          subject: subject || 'No Subject',
          organizationId: orgId,
          candidateId: typeof candidateId === 'string' ? candidateId : undefined,
          lastMessageAt: new Date(),
        },
      });
    } else {
      thread = await prisma.messageThread.findFirst({
        where: {
          id: threadId,
          organizationId: orgId,
        },
      });
      if (!thread) {
        return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
      }
    }

    const message = await prisma.message.create({
      data: {
        threadId: thread.id,
        fromUserId: user.id,
        fromName: user.name || 'Recruiter',
        fromEmail: user.email,
        toEmail,
        channel: 'EMAIL',
        body: messageBody,
        direction: 'OUTBOUND',
        status: 'sent',
        attachments: attachments || [],
        sentAt: new Date(),
      },
    });

    await prisma.messageThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date() },
    });

    return NextResponse.json({ message, thread }, { status: 201 });
  } catch (e) {
    console.error('POST /api/messages', e);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
});

// GET /api/messages - Get all messages with filtering
export const GET = withAuth(async (request: NextRequest, _ctx, user) => {
  try {
    const orgId = requireOrgId(user);
    if (isOrgError(orgId)) return orgId;

    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get('threadId');
    const search = searchParams.get('search');
    const direction = searchParams.get('direction');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const orgFilter = { thread: { organizationId: orgId } };

    const where: Record<string, unknown> = {
      isDeleted: false,
      ...orgFilter,
    };

    if (threadId) where.threadId = threadId;
    if (direction) where.direction = direction;
    if (search) {
      where.OR = [
        { body: { contains: search, mode: 'insensitive' } },
        { fromName: { contains: search, mode: 'insensitive' } },
        { fromEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          thread: {
            select: {
              id: true,
              subject: true,
            },
          },
        },
      }),
      prisma.message.count({ where }),
    ]);

    return NextResponse.json({
      messages: messages.map(m => ({
        ...m,
        sentAt: m.sentAt.toISOString(),
        readAt: m.readAt?.toISOString(),
        createdAt: m.createdAt.toISOString(),
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + messages.length < total,
      },
    });
  } catch (e) {
    console.error('GET /api/messages', e);
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
});
