import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePortalUser } from '@/lib/portal-auth';

// GET /api/portal/applications - Get candidate's applications
export async function GET(request: Request) {
  try {
    const auth = await requirePortalUser(request);
    if ('error' in auth) return auth.error;

    const userId = auth.user.id;

    const applications = await prisma.application.findMany({
      where: { portalUserId: userId },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            department: true,
            location: true,
            company: {
              select: {
                name: true,
                logoUrl: true,
              },
            },
          },
        },
        interviews: {
          orderBy: { start: 'desc' },
          take: 1,
          select: {
            start: true,
            status: true,
            videoLink: true,
          },
        },
      },
      orderBy: { appliedAt: 'desc' },
    });

    // Get activity logs
    const activityLogs = await prisma.candidateActivityLog.findMany({
      where: { candidateId: userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      applications,
      activityLogs,
    });
  } catch (error) {
    console.error('Error fetching portal applications:', error);
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 });
  }
}
