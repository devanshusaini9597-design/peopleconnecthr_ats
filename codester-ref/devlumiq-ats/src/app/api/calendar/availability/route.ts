import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-permission';

export const GET = withAuth(async (_req, _ctx, session) => {
  try {
    const availability = await prisma.interviewAvailability.findMany({
      where: { userId: session.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    return NextResponse.json(availability);
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 });
  }
});

export const POST = withAuth(async (request: NextRequest, _ctx, session) => {
  try {
    const { availability } = await request.json();

    await prisma.interviewAvailability.deleteMany({ where: { userId: session.id } });

    const slots = await prisma.interviewAvailability.createMany({
      data: (availability as any[]).map((slot) => ({
        userId: session.id,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        timezone: slot.timezone || 'UTC',
        isRecurring: slot.isRecurring ?? true,
        isBlocked: slot.isBlocked ?? false,
      })),
    });

    return NextResponse.json({ success: true, count: slots.count });
  } catch (error) {
    console.error('Error setting availability:', error);
    return NextResponse.json({ error: 'Failed to set availability' }, { status: 500 });
  }
});
