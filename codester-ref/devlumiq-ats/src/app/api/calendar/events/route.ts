import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

// ── Calendar Events (local database only) ────────────────────────────────────
export const GET = withAuth(async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    const startDate = start ? new Date(start) : new Date(0);
    const endDate = end ? new Date(end) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const orgJobIds = (
      await prisma.job.findMany({ where: { companyId: orgId }, select: { id: true } })
    ).map((j) => j.id);

    const events = await prisma.interviewEvent.findMany({
      where: {
        start: { gte: startDate, lte: endDate },
        jobId: { in: orgJobIds },
      },
      include: { candidate: true, job: true },
      orderBy: { start: 'asc' },
    });

    const list = events.map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      start: e.start.toISOString(),
      end: e.end?.toISOString() ?? null,
      candidate: e.candidate?.name ?? null,
      candidateId: e.candidateId,
      position: e.job?.title ?? null,
      interviewers: e.interviewers ?? null,
      location: e.location ?? null,
    }));

    return NextResponse.json(list);
  } catch (e) {
    console.error('GET /api/calendar/events', e);
    return NextResponse.json({ error: 'Failed to load calendar events' }, { status: 500 });
  }
});
