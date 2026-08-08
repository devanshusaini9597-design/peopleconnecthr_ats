import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { withAuth, withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';
import {
  buildTakeUrl,
  sendAssessmentInvite,
  sanitizeAssignmentForRecruiter,
} from '@/lib/assessments';

// POST /api/assessments/assign - Assign assessment to candidate
export const POST = withPermission('VIEW_ASSESSMENTS', async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { templateId, candidateId, applicationId, assignedById, expiresInDays = 7 } = await request.json();

    if (!templateId || !candidateId) {
      return NextResponse.json({ error: 'templateId and candidateId are required' }, { status: 400 });
    }

    const [template, candidate] = await Promise.all([
      prisma.assessmentTemplate.findUnique({ where: { id: templateId } }),
      prisma.candidate.findUnique({
        where: { id: candidateId },
        select: { id: true, name: true, email: true, organizationId: true },
      }),
    ]);

    if (!template || !template.isActive) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    if (template.organizationId && template.organizationId !== orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (candidate.organizationId && candidate.organizationId !== orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (applicationId) {
      const app = await prisma.application.findUnique({
        where: { id: applicationId },
        select: { candidateId: true, candidate: { select: { organizationId: true } } },
      });
      if (!app || app.candidateId !== candidateId) {
        return NextResponse.json({ error: 'Invalid application' }, { status: 400 });
      }
      if (app.candidate.organizationId && app.candidate.organizationId !== orgId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Math.min(90, Math.max(1, Number(expiresInDays) || 7)));
    const accessToken = randomBytes(24).toString('hex');

    const assignment = await prisma.assessmentAssignment.create({
      data: {
        templateId,
        candidateId,
        applicationId: applicationId ?? null,
        assignedById: assignedById ?? session.id ?? 'system',
        expiresAt,
        status: 'pending',
        accessToken,
      },
    });

    const takeUrl = buildTakeUrl(accessToken);
    let emailSent = false;
    if (candidate.email) {
      emailSent = await sendAssessmentInvite({
        candidateName: candidate.name,
        candidateEmail: candidate.email,
        templateName: template.name,
        duration: template.duration ?? null,
        expiresAt,
        takeUrl,
      });
    }

    const { accessToken: _t, ...safeAssignment } = assignment;

    return NextResponse.json({
      success: true,
      assignment: safeAssignment,
      takeUrl,
      emailSent,
      message: `Assessment "${template.name}" assigned successfully`,
    });
  } catch (error) {
    console.error('Error assigning assessment:', error);
    return NextResponse.json({ error: 'Failed to assign assessment' }, { status: 500 });
  }
});

// GET /api/assessments/assign - Get assessments (org-scoped)
export const GET = withAuth(async (request: NextRequest, _ctx, session) => {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const candidateId = searchParams.get('candidateId');
    const applicationId = searchParams.get('applicationId');
    const status = searchParams.get('status');

    if (candidateId) {
      const cand = await prisma.candidate.findUnique({
        where: { id: candidateId },
        select: { organizationId: true },
      });
      if (!cand) return NextResponse.json({ assignments: [] });
      if (cand.organizationId && cand.organizationId !== orgId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const assignments = await prisma.assessmentAssignment.findMany({
      where: {
        ...(candidateId ? { candidateId } : {}),
        ...(applicationId ? { applicationId } : {}),
        ...(status && status !== 'all' ? { status } : {}),
        candidate: { organizationId: orgId },
      },
      include: {
        template: {
          select: { name: true, category: true, duration: true, passingScore: true },
        },
        candidate: {
          select: { name: true, email: true, organizationId: true },
        },
        responses: {
          select: { id: true, questionId: true, pointsEarned: true, timeSpent: true, isCorrect: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const serialised = assignments.map((a) => {
      const sanitized = sanitizeAssignmentForRecruiter(a);
      return {
        ...sanitized,
        percentage: a.percentage != null ? parseFloat(a.percentage.toString()) : null,
      };
    });

    return NextResponse.json({ assignments: serialised });
  } catch (error) {
    console.error('Error fetching assessments:', error);
    return NextResponse.json({ error: 'Failed to fetch assessments' }, { status: 500 });
  }
});
