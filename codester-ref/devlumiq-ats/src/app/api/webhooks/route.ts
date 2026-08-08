import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

// GET /api/webhooks - Get org webhooks
export const GET = withPermission('MANAGE_INTEGRATIONS', async (_req, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const webhooks = await prisma.webhook.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { eventsLog: true },
        },
      },
    });

    return NextResponse.json(webhooks);
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    return NextResponse.json({ error: 'Failed to fetch webhooks' }, { status: 500 });
  }
});

// POST /api/webhooks - Create webhook
export const POST = withPermission('MANAGE_INTEGRATIONS', async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { name, url, secret, events, headers, retryCount, timeout } = await request.json();

    const webhook = await prisma.webhook.create({
      data: {
        name,
        url,
        secret,
        events,
        headers,
        retryCount: retryCount || 3,
        timeout: timeout || 30,
        organizationId: orgId,
      },
    });

    return NextResponse.json(webhook);
  } catch (error) {
    console.error('Error creating webhook:', error);
    return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
  }
});

// DELETE /api/webhooks - Delete webhook
export const DELETE = withPermission('MANAGE_INTEGRATIONS', async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Webhook ID required' }, { status: 400 });
    }

    const existing = await prisma.webhook.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    await prisma.webhook.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
  }
});
