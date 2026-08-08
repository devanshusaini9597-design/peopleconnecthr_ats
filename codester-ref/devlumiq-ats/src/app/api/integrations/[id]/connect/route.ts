import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-permission';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/integrations/[id]/connect — persist connection in Integration table
export const POST = withAuth(async (_request: NextRequest, ctx: Ctx, user) => {
  try {
    const { id } = await ctx.params;
    const provider = id.toUpperCase();

    await prisma.integration.upsert({
      where: { userId_provider: { userId: user.id, provider } },
      create: {
        userId: user.id,
        provider,
        accessToken: 'connected',
        expiresAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
      update: { isActive: true, updatedAt: new Date() },
    });

    return NextResponse.json({ ok: true, integrationId: id, connected: true });
  } catch (e) {
    console.error('POST /api/integrations/[id]/connect', e);
    return NextResponse.json({ error: 'Failed to connect integration' }, { status: 500 });
  }
});

// DELETE /api/integrations/[id]/connect — soft-disconnect
export const DELETE = withAuth(async (_request: NextRequest, ctx: Ctx, user) => {
  try {
    const { id } = await ctx.params;
    const provider = id.toUpperCase();

    await prisma.integration.updateMany({
      where: { userId: user.id, provider },
      data: { isActive: false },
    });

    return NextResponse.json({ ok: true, integrationId: id, connected: false });
  } catch (e) {
    console.error('DELETE /api/integrations/[id]/connect', e);
    return NextResponse.json({ error: 'Failed to disconnect integration' }, { status: 500 });
  }
});
