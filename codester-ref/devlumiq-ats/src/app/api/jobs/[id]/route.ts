import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  session
) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id } = await params;
    const job = await prisma.job.findFirst({
      where: {
        id,
        companyId: orgId,
      },
      include: { applications: { include: { candidate: true } } },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: job.id,
      title: job.title,
      department: job.department,
      location: job.location,
      type: job.type,
      applicants: job.applicants,
      status: job.status,
      postedAt: job.postedAt.toISOString(),
      description: job.description,
      requirements: job.requirements,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      currency: job.salaryCurrency,
      applications: job.applications.map((a) => ({
        id: a.id,
        candidateId: a.candidateId,
        candidateName: a.candidate.name,
        candidateEmail: a.candidate.email,
        stage: a.stage,
      })),
    });
  } catch (e) {
    console.error('GET /api/jobs/[id]', e);
    return NextResponse.json({ error: 'Failed to load job' }, { status: 500 });
  }
});

export const PATCH = withPermission('EDIT_JOB', async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  session
) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id } = await params;
    const body = await request.json();
    const { title, department, location, type, status, description, requirements, salaryMin, salaryMax, currency } = body;

    // Verify ownership before updating
    const existing = await prisma.job.findFirst({
      where: {
        id,
        companyId: orgId,
      },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const job = await prisma.job.update({
      where: { id },
      data: {
        ...(title != null && { title }),
        ...(department != null && { department }),
        ...(location != null && { location }),
        ...(type != null && { type }),
        ...(status != null && { status }),
        ...(description !== undefined && { description }),
        ...(requirements !== undefined && { requirements }),
        ...(salaryMin !== undefined && { salaryMin }),
        ...(salaryMax !== undefined && { salaryMax }),
        ...(currency !== undefined && { salaryCurrency: currency }),
      },
    });

    return NextResponse.json({
      id: job.id,
      title: job.title,
      department: job.department,
      location: job.location,
      type: job.type,
      applicants: job.applicants,
      status: job.status,
      postedAt: job.postedAt.toISOString(),
    });
  } catch (e) {
    console.error('PATCH /api/jobs/[id]', e);
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
  }
});

export const DELETE = withPermission('DELETE_JOB', async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  session
) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id } = await params;

    // Verify ownership before deleting
    const existing = await prisma.job.findFirst({
      where: {
        id,
        companyId: orgId,
      },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    await prisma.application.deleteMany({ where: { jobId: id } });
    await prisma.job.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/jobs/[id]', e);
    return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 });
  }
});
