import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-permission';

export const GET = withAuth(async (_req, _ctx, session) => {
  try {
    const integrations = await prisma.calendarIntegration.findMany({
      where: { userId: session.id },
      select: { id: true, provider: true, calendarId: true, isActive: true, createdAt: true },
    });
    return NextResponse.json(integrations);
  } catch (error) {
    console.error('Error fetching calendar integrations:', error);
    return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 });
  }
});

export const POST = withAuth(async (request: NextRequest, _ctx, session) => {
  try {
    const { provider, accessToken, refreshToken, expiresAt, calendarId } = await request.json();
    const integration = await prisma.calendarIntegration.create({
      data: {
        userId: session.id,
        provider,
        accessToken,
        refreshToken,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        calendarId,
      },
    });
    return NextResponse.json(integration);
  } catch (error) {
    console.error('Error creating calendar integration:', error);
    return NextResponse.json({ error: 'Failed to connect calendar' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (request: NextRequest, _ctx, session) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Integration ID required' }, { status: 400 });

    const integration = await prisma.calendarIntegration.findUnique({ where: { id } });
    if (!integration || integration.userId !== session.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.calendarIntegration.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting calendar integration:', error);
    return NextResponse.json({ error: 'Failed to disconnect calendar' }, { status: 500 });
  }
});
