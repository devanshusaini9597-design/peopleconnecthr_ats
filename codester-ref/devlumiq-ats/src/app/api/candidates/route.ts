import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stageToDisplay } from '@/lib/api-helpers';
import { withPermission, withAuth } from '@/lib/with-permission';
import { checkOrgLimit } from '@/lib/plan-limits';
import { notifyNewApplication } from '@/lib/push';
import {
  isOrgBlindScreeningEnabled,
  maskCandidateForList,
  shouldBlindScreen,
} from '@/lib/blind-screening';
import { requireOrgId, requireOrgFilter, requireCompanyFilter, isOrgError } from '@/lib/require-org';

export const GET = withAuth(async (req: NextRequest, _ctx, session) => {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50')));
    const skip = (page - 1) * limit;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortDir = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc';
    const minAssessmentScore = searchParams.get('minAssessmentScore');
    const minScore = minAssessmentScore != null && minAssessmentScore !== ''
      ? Number(minAssessmentScore)
      : null;

    const orgFilter = requireOrgFilter(session);
    if (isOrgError(orgFilter)) return orgFilter;
    const blindEnabled = shouldBlindScreen(
      session.role,
      await isOrgBlindScreeningEnabled(session.organizationId),
    );

    const [candidates, total] = await Promise.all([
      prisma.candidate.findMany({
        where: {
          ...orgFilter,
          ...(minScore != null && !Number.isNaN(minScore)
            ? {
                assessmentAssignments: {
                  some: {
                    status: 'completed',
                    percentage: { gte: minScore },
                  },
                },
              }
            : {}),
        },
        orderBy: sortBy === 'assessmentScore' ? { createdAt: 'desc' } : { createdAt: sortDir },
        skip: sortBy === 'assessmentScore' ? 0 : skip,
        take: sortBy === 'assessmentScore' ? 500 : limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          source: true,
          experience: true,
          createdAt: true,
          applications: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: {
              stage: true,
              job: { select: { title: true } },
            },
          },
          assessmentAssignments: {
            where: { status: 'completed', percentage: { not: null } },
            orderBy: { submittedAt: 'desc' },
            take: 1,
            select: { percentage: true, passed: true, score: true, maxScore: true },
          },
        },
      }),
      prisma.candidate.count({
        where: {
          ...orgFilter,
          ...(minScore != null && !Number.isNaN(minScore)
            ? {
                assessmentAssignments: {
                  some: {
                    status: 'completed',
                    percentage: { gte: minScore },
                  },
                },
              }
            : {}),
        },
      }),
    ]);

    let list = candidates.map((c, i) => {
      const app = c.applications[0];
      const position = app?.job?.title ?? '';
      const status = app ? stageToDisplay(app.stage) : 'Applied';
      const latestAssessment = c.assessmentAssignments[0];
      const assessmentScore =
        latestAssessment?.percentage != null
          ? parseFloat(latestAssessment.percentage.toString())
          : null;
      const row = {
        id: c.id,
        name: c.name,
        email: c.email,
        position,
        source: c.source ?? '',
        status,
        createdAt: c.createdAt.toISOString(),
        phone: c.phone ?? '',
        experience: c.experience ?? null,
        assessmentScore,
        assessmentPassed: latestAssessment?.passed ?? null,
      };
      return maskCandidateForList(row, skip + i, blindEnabled);
    });

    if (sortBy === 'assessmentScore') {
      list = list.sort((a, b) => {
        const av = (a as { assessmentScore?: number | null }).assessmentScore;
        const bv = (b as { assessmentScore?: number | null }).assessmentScore;
        const an = av == null ? -1 : av;
        const bn = bv == null ? -1 : bv;
        return sortDir === 'asc' ? an - bn : bn - an;
      });
      list = list.slice(skip, skip + limit);
    }

    return NextResponse.json({
      candidates: list,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      blindScreening: blindEnabled,
    });
  } catch (e: any) {
    console.error('GET /api/candidates', e);
    return NextResponse.json({ error: 'Failed to load candidates' }, { status: 500 });
  }
});

export const POST = withPermission('CREATE_CANDIDATE', async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const body = await request.json();
    const {
      name, email, phone, source, position, experience, jobId,
      skills, location, currentTitle, linkedInUrl, githubUrl, portfolioUrl, summary, tags,
    } = body as {
      name?: string;
      email?: string;
      phone?: string;
      source?: string;
      position?: string;
      experience?: number;
      jobId?: string;
      skills?: string[];
      location?: string;
      currentTitle?: string;
      linkedInUrl?: string;
      githubUrl?: string;
      portfolioUrl?: string;
      summary?: string;
      tags?: string[];
    };

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    // Enforce plan candidate limit
    const limitCheck = await checkOrgLimit(orgId, 'candidates');
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: `Candidate limit reached (${limitCheck.current}/${limitCheck.limit}). Upgrade your plan to add more candidates.`, code: 'PLAN_LIMIT_REACHED' },
        { status: 403 }
      );
    }

    const orgFilter = requireCompanyFilter(session);
    if (isOrgError(orgFilter)) return orgFilter;
    const job = jobId
      ? await prisma.job.findUnique({ where: { id: jobId, ...orgFilter } })
      : await prisma.job.findFirst({ where: orgFilter });

    const candidateData: any = {
      name,
      email,
      phone: phone ?? null,
      source: source ?? 'LinkedIn',
      experience: experience ?? null,
      skills: skills ?? [],
      tags: tags ?? [],
      location: location ?? null,
      currentTitle: currentTitle ?? null,
      linkedInUrl: linkedInUrl ?? null,
      githubUrl: githubUrl ?? null,
      portfolioUrl: portfolioUrl ?? null,
      resumeText: summary ?? null,
      organizationId: orgId,
      applications: job
        ? { create: { jobId: job.id, stage: 'APPLIED' } }
        : undefined,
    };

    const candidate = await prisma.candidate.create({
      data: candidateData,
      include: {
        applications: {
          take: 1,
          include: { job: true },
        },
      },
    });

    const app = candidate.applications[0];
    const positionTitle = app?.job?.title ?? position ?? '';
    const status = app ? stageToDisplay(app.stage) : 'Applied';

    await prisma.userActivityLog.create({
      data: { userId: session.id, action: 'candidate_created', entityType: 'candidate', entityId: candidate.id, metadata: { name: candidate.name, email: candidate.email, position: positionTitle } },
    }).catch(() => {});

    if (app?.job) {
      await notifyNewApplication({
        organizationId: orgId,
        candidateName: candidate.name,
        jobTitle: app.job.title,
        candidateId: candidate.id,
      }).catch(() => {});
    }

    return NextResponse.json({
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      position: positionTitle,
      source: candidate.source ?? '',
      status,
      createdAt: candidate.createdAt.toISOString(),
      phone: candidate.phone ?? '',
      experience: candidate.experience ?? null,
    });
  } catch (e) {
    console.error('POST /api/candidates', e);
    return NextResponse.json({ error: 'Failed to create candidate' }, { status: 500 });
  }
});
