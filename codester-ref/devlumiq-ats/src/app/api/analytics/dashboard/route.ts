import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';
import { hasEntitlement } from '@/lib/plan-limits';

// GET /api/analytics/dashboard - Advanced analytics (plan or analyticsPlus add-on)
export const GET = withPermission('VIEW_ANALYTICS', async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const entitlement = await hasEntitlement(orgId, 'advancedAnalytics');
    if (!entitlement.allowed) {
      return NextResponse.json(
        {
          error: 'Advanced analytics requires Professional plan or the Analytics Plus add-on.',
          code: 'PLAN_UPGRADE_REQUIRED',
          currentPlan: entitlement.plan,
          required: 'advancedAnalytics',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
    const jobId = searchParams.get('jobId');

    const dateFilter = getDateFilter(period);

    // Resolve org-scoped job IDs for filtering
    const orgJobIds = (await prisma.job.findMany({ where: { companyId: orgId }, select: { id: true } })).map((j) => j.id);
    const jobIdFilter = { in: orgJobIds };

    // Pipeline metrics
    const pipelineMetrics = await prisma.pipelineMetric.findMany({
      where: {
        date: { gte: dateFilter },
        ...(jobId ? { jobId } : { jobId: jobIdFilter }),
      },
      orderBy: { date: 'asc' },
    });

    // Source quality metrics
    const sourceMetrics = await prisma.sourceQualityMetric.findMany({
      where: {
        date: { gte: dateFilter },
        organizationId: orgId,
      },
      orderBy: { date: 'asc' },
    });

    // Time to hire metrics
    const timeToHire = await prisma.timeToHireMetric.findMany({
      where: {
        appliedAt: { gte: dateFilter },
        ...(jobId ? { jobId } : { jobId: jobIdFilter }),
      },
    });

    // Calculate aggregate stats
    const appCountWhere = {
      appliedAt: { gte: dateFilter },
      jobId: jobIdFilter,
    };
    const stats = {
      totalApplicants: await prisma.application.count({ where: appCountWhere }),
      avgTimeToHire: calculateAvgTimeToHire(timeToHire),
      conversionRates: calculateConversionRates(pipelineMetrics),
      topSources: getTopSources(sourceMetrics),
    };

    let diversityFunnel: unknown = null;
    try {
      const selfIds = await prisma.candidateSelfId.findMany({
        where: { organizationId: orgId },
        select: { gender: true, ethnicity: true, veteranStatus: true, disability: true },
      });
      const countBy = (values: (string | null | undefined)[]) => {
        const out: Record<string, number> = {};
        for (const v of values) {
          const key = v || 'prefer_not_to_say';
          out[key] = (out[key] || 0) + 1;
        }
        return out;
      };
      diversityFunnel = {
        responses: selfIds.length,
        byGender: countBy(selfIds.map((s) => s.gender)),
        byEthnicity: countBy(selfIds.map((s) => s.ethnicity)),
        byVeteran: countBy(selfIds.map((s) => s.veteranStatus)),
        byDisability: countBy(selfIds.map((s) => s.disability)),
      };
    } catch {
      diversityFunnel = null;
    }

    return NextResponse.json({
      period,
      stats,
      pipelineMetrics,
      sourceMetrics,
      timeToHire,
      diversityFunnel,
      entitled: true,
      // Flattened for legacy premium dashboard component
      totalApplicants: stats.totalApplicants,
      avgTimeToHire: stats.avgTimeToHire,
      topSources: stats.topSources,
      conversionRates: stats.conversionRates,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
});

function getDateFilter(period: string): Date {
  const now = new Date();
  switch (period) {
    case '7d':
      return new Date(now.setDate(now.getDate() - 7));
    case '30d':
      return new Date(now.setDate(now.getDate() - 30));
    case '90d':
      return new Date(now.setDate(now.getDate() - 90));
    case '1y':
      return new Date(now.setFullYear(now.getFullYear() - 1));
    default:
      return new Date(now.setDate(now.getDate() - 30));
  }
}

function calculateAvgTimeToHire(metrics: any[]): number {
  if (metrics.length === 0) return 0;
  const total = metrics.reduce((sum, m) => sum + (m.totalTimeToHire || 0), 0);
  return Math.round(total / metrics.length / 24); // Convert hours to days
}

function calculateConversionRates(metrics: any[]): any {
  const stages = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];
  return stages.map(stage => {
    const stageMetrics = metrics.filter(m => m.stageName === stage);
    const totalIn = stageMetrics.reduce((sum, m) => sum + m.candidatesIn, 0);
    const totalOut = stageMetrics.reduce((sum, m) => sum + m.candidatesOut, 0);
    return {
      stage,
      conversionRate: totalIn > 0 ? (totalOut / totalIn) * 100 : 0,
    };
  });
}

function getTopSources(metrics: any[]): any[] {
  const grouped = metrics.reduce((acc, m) => {
    if (!acc[m.source]) {
      acc[m.source] = { source: m.source, hires: 0, applicants: 0 };
    }
    acc[m.source].hires += m.hires;
    acc[m.source].applicants += m.totalApplicants;
    return acc;
  }, {});

  return Object.values(grouped)
    .sort((a: any, b: any) => b.hires - a.hires)
    .slice(0, 5);
}
