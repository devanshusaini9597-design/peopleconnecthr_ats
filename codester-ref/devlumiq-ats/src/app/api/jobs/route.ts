import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, withAuth } from '@/lib/with-permission';
import { checkOrgLimit } from '@/lib/plan-limits';
import type { SessionUser } from '@/lib/auth';
import { requireOrgId, requireCompanyFilter, isOrgError } from '@/lib/require-org';

// Get or create company for a given session
async function resolveCompany(organizationId: string) {
  const company = await prisma.company.findUnique({ where: { id: organizationId } });
  if (company) return company;
  // Fallback: find first or create a default
  let fallback = await prisma.company.findFirst();
  if (!fallback) {
    fallback = await prisma.company.create({
      data: { name: 'Default Company', slug: `default-${Date.now()}` },
    });
  }
  return fallback;
}

export const GET = withAuth(async (_req, _ctx, session: SessionUser) => {
  try {
    const orgFilter = requireCompanyFilter(session);
    if (isOrgError(orgFilter)) return orgFilter;
    const jobs = await prisma.job.findMany({
      where: orgFilter,
      orderBy: { createdAt: 'desc' },
      include: {
        company: {
          select: {
            name: true,
            logoUrl: true,
          },
        },
        _count: {
          select: { applications: true }
        }
      },
    });

    const list = jobs.map((j) => ({
      id: j.id,
      title: j.title,
      department: j.department,
      location: j.location,
      type: j.type,
      applicants: j._count.applications,
      status: j.status,
      postedAt: j.postedAt.toISOString(),
      company: j.company,
    }));

    return NextResponse.json({ jobs: list });
  } catch (e) {
    console.error('GET /api/jobs', e);
    return NextResponse.json({ jobs: [], error: 'Failed to load jobs' }, { status: 500 });
  }
});

export const POST = withPermission('CREATE_JOB', async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const body = await request.json();
    const { title, department, location, type, status, description, requirements } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Enforce plan job limit
    const limitCheck = await checkOrgLimit(orgId, 'jobs');
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: `Job limit reached (${limitCheck.current}/${limitCheck.limit}). Upgrade your plan to add more jobs.`, code: 'PLAN_LIMIT_REACHED' },
        { status: 403 }
      );
    }

    const company = await resolveCompany(orgId);

    const job = await prisma.job.create({
      data: {
        title,
        department: department ?? 'General',
        location: location ?? 'Remote',
        type: type ?? 'Full-time',
        status: status ?? 'Active',
        description,
        requirements,
        companyId: company.id,
      },
    });

    await prisma.userActivityLog.create({
      data: { userId: session.id, action: 'job_created', entityType: 'job', entityId: job.id, metadata: { title: job.title, department: job.department } },
    }).catch(() => {});

    return NextResponse.json({
      id: job.id,
      title: job.title,
      department: job.department,
      location: job.location,
      type: job.type,
      applicants: 0,
      status: job.status,
      postedAt: job.postedAt.toISOString(),
    });
  } catch (e) {
    console.error('POST /api/jobs', e);
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
  }
});
