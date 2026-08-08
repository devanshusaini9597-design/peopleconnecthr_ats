import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stageToDisplay } from '@/lib/api-helpers';
import { withPermission } from '@/lib/with-permission';
import { withSessionOrApiKey } from '@/lib/with-api-key';
import { requireOrgId, isOrgError } from '@/lib/require-org';
import {
  applyBlindScreening,
  isOrgBlindScreeningEnabled,
  shouldBlindScreen,
} from '@/lib/blind-screening';

export const GET = withSessionOrApiKey(null, ['read'], async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  session
) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id } = await params;
    const candidate = await prisma.candidate.findFirst({
      where: { id, organizationId: orgId },
      include: {
        applications: { include: { job: true } },
      },
    });

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const app = candidate.applications[0];
    const position = app?.job?.title ?? '';
    const status = app ? stageToDisplay(app.stage) : 'Applied';

    let payload = {
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      position,
      source: candidate.source ?? '',
      status,
      createdAt: candidate.createdAt.toISOString(),
      phone: candidate.phone ?? '',
      skills: candidate.skills ?? [],
      tags: candidate.tags ?? [],
      experience: candidate.experience,
      location: candidate.location ?? '',
      city: candidate.city ?? '',
      country: candidate.country ?? '',
      currentTitle: candidate.currentTitle ?? '',
      currentCompany: candidate.currentCompany ?? '',
      linkedInUrl: candidate.linkedInUrl ?? '',
      portfolioUrl: candidate.portfolioUrl ?? '',
      githubUrl: candidate.githubUrl ?? '',
      websiteUrl: candidate.websiteUrl ?? '',
      resumeUrl: candidate.resumeUrl ?? '',
      resumeParsed: candidate.resumeParsed,
      applications: candidate.applications.map((a) => ({
        id: a.id,
        jobId: a.jobId,
        jobTitle: a.job.title,
        stage: stageToDisplay(a.stage),
        createdAt: a.createdAt.toISOString(),
      })),
      blindScreening: false,
    };

    if (
      shouldBlindScreen(
        session.role,
        await isOrgBlindScreeningEnabled(session.organizationId),
      )
    ) {
      payload = {
        ...applyBlindScreening(payload, true),
        blindScreening: true,
      };
    }

    return NextResponse.json(payload);
  } catch (e) {
    console.error('GET /api/candidates/[id]', e);
    return NextResponse.json({ error: 'Failed to load candidate' }, { status: 500 });
  }
});

export const PATCH = withPermission('EDIT_CANDIDATE', async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  session
) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id } = await params;

    const existing = await prisma.candidate.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

    const body = await request.json();
    const { name, email, phone, source } = body as {
      name?: string;
      email?: string;
      phone?: string;
      source?: string;
    };

    const candidate = await prisma.candidate.update({
      where: { id },
      data: {
        ...(name != null && { name }),
        ...(email != null && { email }),
        ...(phone != null && { phone }),
        ...(source != null && { source }),
      },
      include: {
        applications: { take: 1, include: { job: true } },
      },
    });

    const app = candidate.applications[0];
    const position = app?.job?.title ?? '';
    const status = app ? stageToDisplay(app.stage) : 'Applied';

    return NextResponse.json({
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      position,
      source: candidate.source ?? '',
      status,
      createdAt: candidate.createdAt.toISOString(),
      phone: candidate.phone ?? '',
    });
  } catch (e) {
    console.error('PATCH /api/candidates/[id]', e);
    return NextResponse.json({ error: 'Failed to update candidate' }, { status: 500 });
  }
});

export const DELETE = withPermission('DELETE_CANDIDATE', async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  session
) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id } = await params;

    const existing = await prisma.candidate.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

    await prisma.application.deleteMany({ where: { candidateId: id } });
    await prisma.candidate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/candidates/[id]', e);
    return NextResponse.json({ error: 'Failed to delete candidate' }, { status: 500 });
  }
});
