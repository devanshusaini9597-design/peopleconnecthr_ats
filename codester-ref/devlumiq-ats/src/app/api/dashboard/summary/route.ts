import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stageToDisplay } from '@/lib/api-helpers';
import { withAuth } from '@/lib/with-permission';
import type { SessionUser } from '@/lib/auth';
import { requireOrgId, isOrgError } from '@/lib/require-org';

const STAGES = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'JOINED', 'REJECTED', 'DROPPED'];

export const GET = withAuth(async (_req: NextRequest, _ctx, session: SessionUser) => {
  try {
    const orgIdOrErr = requireOrgId(session);
    if (isOrgError(orgIdOrErr)) return orgIdOrErr;
    const orgId = orgIdOrErr;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const isInterviewer = session.role === 'INTERVIEWER';

    // Resolve org-scoped job IDs first (more reliable than nested relation filters in production)
    const orgJobIds = (await prisma.job.findMany({ where: { companyId: orgId }, select: { id: true } })).map(j => j.id);

    // Org-scoped filters (fail-closed)
    const candidateWhere = { organizationId: orgId };
    const jobWhere = { companyId: orgId };
    const appWhere = { jobId: { in: orgJobIds } };
    const interviewWhere = {
      start: { gte: now, lte: in7Days },
      jobId: { in: orgJobIds },
      ...(isInterviewer ? { assignedToId: session.id } : {}),
    };

    const [
      candidates,
      applications,
      jobs,
      recentCandidatesWithApps,
      thisMonth,
      lastMonth,
      interviewEvents,
      activityLogs,
      applicationsWithJobs,
      candidatesWithSource,
      dailyCandidates,
      timeToHireData,
      hiredCount,
      rejectedCount,
    ] = await Promise.all([
      prisma.candidate.count({ where: candidateWhere }),
      prisma.application.findMany({ where: appWhere, select: { stage: true } }),
      prisma.job.count({ where: { ...jobWhere, status: 'Active' } }),
      prisma.candidate.findMany({
        where: candidateWhere,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          applications: {
            take: 1,
            orderBy: { updatedAt: 'desc' },
            include: { job: true },
          },
        },
      }),
      prisma.candidate.count({ where: { ...candidateWhere, createdAt: { gte: startOfMonth } } }),
      prisma.candidate.count({ where: { ...candidateWhere, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
      prisma.interviewEvent.findMany({
        where: interviewWhere,
        include: { candidate: true, job: true, assignedTo: true },
        orderBy: { start: 'asc' },
        take: 10,
      }),
      prisma.activityLog.findMany({
        where: { jobId: { in: orgJobIds } },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
      prisma.application.findMany({
        where: appWhere,
        select: { job: { select: { title: true } }, stage: true },
      }),
      prisma.candidate.findMany({
        where: candidateWhere,
        select: { source: true },
      }),
      prisma.candidate.findMany({
        where: { ...candidateWhere, createdAt: { gte: startOfWeek } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.timeToHireMetric.findMany({
        where: {
          totalTimeToHire: { not: null },
          jobId: { in: orgJobIds },
        },
        select: { totalTimeToHire: true },
      }),
      prisma.application.count({ where: { ...appWhere, stage: { in: ['HIRED', 'JOINED'] } } }),
      prisma.application.count({ where: { ...appWhere, stage: 'REJECTED' } }),
    ]);

    const pipelineCounts = STAGES.map((stage) => ({
      stage: stageToDisplay(stage),
      count: applications.filter((a) => a.stage === stage).length,
    }));

    const recentCandidates = recentCandidatesWithApps.map((c) => {
      const app = c.applications[0];
      const position = app?.job?.title ?? '';
      const status = app ? stageToDisplay(app.stage) : 'Applied';
      return {
        id: c.id,
        name: c.name,
        email: c.email,
        position,
        source: c.source ?? '',
        status,
        createdAt: c.createdAt.toISOString(),
        phone: c.phone ?? '',
      };
    });

    const callbacks = interviewEvents.slice(0, 5).map((ev) => {
      const d = new Date(ev.start);
      const daysRemaining = Math.ceil((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      return {
        id: ev.id,
        candidateName: ev.candidate?.name ?? ev.title,
        candidatePosition: ev.job?.title ?? '',
        callBackDate: d.toISOString().slice(0, 10),
        daysRemaining,
        priority: daysRemaining <= 1 ? 'urgent' : daysRemaining <= 3 ? 'high' : 'medium',
      };
    });

    const activities = activityLogs.map((a) => {
      const p = a.payload as Record<string, unknown>;
      return {
        id: a.id,
        type: a.type,
        user: (p?.user as string) ?? 'System',
        candidate: (p?.candidate as string) ?? '',
        position: (p?.position as string) ?? '',
        time: a.createdAt.toISOString(),
        icon: (p?.icon as string) ?? 'activity',
        from: p?.from as string | undefined,
        to: p?.to as string | undefined,
        job: p?.job as string | undefined,
        department: p?.department as string | undefined,
        date: p?.date as string | undefined,
      };
    });

    const upcomingInterviews = interviewEvents.slice(0, 5).map((ev) => {
      const interviewers = ev.interviewers as Array<{name?: string; email?: string}> | null;
      const firstInterviewer = interviewers?.[0]?.name ?? ev.assignedTo?.name ?? 'TBD';
      
      return {
        id: ev.id,
        candidate: ev.candidate?.name ?? ev.title,
        position: ev.job?.title ?? '',
        time: new Date(ev.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        type: ev.type,
        interviewer: firstInterviewer,
      };
    });

    // Calculate real metrics
    const candidateTrend = lastMonth > 0 
      ? Number((((thisMonth - lastMonth) / lastMonth) * 100).toFixed(1))
      : thisMonth > 0 ? 100 : 0;

    const conversionRate = candidates > 0 
      ? Number(((hiredCount / candidates) * 100).toFixed(1))
      : 0;

    const rejectionRate = candidates > 0
      ? Number(((rejectedCount / candidates) * 100).toFixed(1))
      : 0;

    // Calculate average time to hire (in days)
    const avgTimeToHire = timeToHireData.length > 0
      ? Math.round(timeToHireData.reduce((sum, t) => sum + (t.totalTimeToHire ?? 0), 0) / timeToHireData.length / 24)
      : 0;

    // Calculate top positions by application count
    const positionCounts = applicationsWithJobs.reduce((acc, app) => {
      const title = app.job?.title ?? 'Unknown';
      acc[title] = (acc[title] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topPositions = Object.entries(positionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([position, count]) => ({ position, count }));

    // Calculate top sources
    const sourceCounts = candidatesWithSource.reduce((acc, c) => {
      const source = c.source || 'Direct';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topSources = Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([source, count]) => ({ source, count }));

    // Calculate daily submissions for this week
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailySubmissions = dayNames.map((day, index) => {
      const count = dailyCandidates.filter((c) => {
        const d = new Date(c.createdAt);
        return d.getDay() === index;
      }).length;
      return { date: day, count };
    });

    // Calculate previous month hires for comparison
    const prevMonthHires = orgJobIds.length > 0
      ? await prisma.application.count({
          where: {
            jobId: { in: orgJobIds },
            stage: { in: ['HIRED', 'JOINED'] },
            OR: [
              { hiredAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
              { hiredAt: null, updatedAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
            ]
          }
        })
      : 0;

    const summary = {
      totalCandidates: candidates,
      thisMonth,
      lastMonth,
      pendingReview: applications.filter((a) => a.stage === 'SCREENING').length,
      candidateTrend,
      pipeline: pipelineCounts,
      recentCandidates,
      openPositions: jobs,
      conversionRate,
      rejectionRate,
      avgTimeToHire,
      prevMonthHires,
      callbacks,
      activities,
      upcomingInterviews,
      topPositions: topPositions.length > 0 ? topPositions : [],
      topSources: topSources.length > 0 ? topSources : [],
      dailySubmissions: dailySubmissions.length > 0 ? dailySubmissions : dayNames.map(d => ({ date: d, count: 0 })),
    };

    return NextResponse.json(summary);
  } catch (e) {
    console.error('GET /api/dashboard/summary', e);
    return NextResponse.json({ error: 'Failed to load dashboard summary' }, { status: 500 });
  }
});
