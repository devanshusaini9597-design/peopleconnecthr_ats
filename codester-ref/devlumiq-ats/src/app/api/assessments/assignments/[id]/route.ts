import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { recomputeAssignmentScore, assertAssignmentOrgAccess } from '@/lib/assessments';

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/assessments/assignments/[id]
 * Full assignment detail for recruiters (org-scoped).
 */
export const GET = withPermission('VIEW_ASSESSMENTS', async (_req: NextRequest, ctx: Ctx, session) => {
  try {
    const { id } = await ctx.params;
    const assignment = await prisma.assessmentAssignment.findUnique({
      where: { id },
      include: {
        template: {
          include: { questions: { orderBy: { sortOrder: 'asc' } } },
        },
        candidate: { select: { id: true, name: true, email: true, organizationId: true } },
        responses: true,
        proctoringSession: {
          select: {
            riskScore: true,
            flagged: true,
            tabSwitchCount: true,
            plagiarismScore: true,
          },
        },
      },
    });
    if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (!assertAssignmentOrgAccess(session.organizationId, assignment.candidate.organizationId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const breakdown = assignment.template.questions.map((q) => {
      const r = assignment.responses.find((x) => x.questionId === q.id);
      return {
        question: {
          id: q.id,
          type: q.type,
          question: q.question,
          points: q.points,
          correctAnswer: q.correctAnswer,
          language: q.language,
        },
        response: r
          ? {
              id: r.id,
              answer: r.answer,
              codeSubmission: r.codeSubmission,
              isCorrect: r.isCorrect,
              pointsEarned: r.pointsEarned,
              timeSpent: r.timeSpent,
              feedback: r.feedback,
            }
          : null,
      };
    });

    return NextResponse.json({
      assignment: {
        id: assignment.id,
        status: assignment.status,
        startedAt: assignment.startedAt,
        submittedAt: assignment.submittedAt,
        expiresAt: assignment.expiresAt,
        score: assignment.score,
        maxScore: assignment.maxScore,
        percentage: assignment.percentage != null ? parseFloat(assignment.percentage.toString()) : null,
        passed: assignment.passed,
        reviewStatus: assignment.reviewStatus,
        feedback: assignment.feedback,
        candidate: {
          id: assignment.candidate.id,
          name: assignment.candidate.name,
          email: assignment.candidate.email,
        },
        template: {
          id: assignment.template.id,
          name: assignment.template.name,
          passingScore: assignment.template.passingScore,
          duration: assignment.template.duration,
        },
        proctoring: assignment.proctoringSession,
      },
      breakdown,
    });
  } catch (e) {
    console.error('GET assignments/[id]', e);
    return NextResponse.json({ error: 'Failed to load assignment' }, { status: 500 });
  }
});

/**
 * PATCH /api/assessments/assignments/[id]
 * Manual grade: { grades: [{ questionId, pointsEarned, isCorrect?, feedback? }], feedback? }
 */
export const PATCH = withPermission('VIEW_ASSESSMENTS', async (req: NextRequest, ctx: Ctx, session) => {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const assignment = await prisma.assessmentAssignment.findUnique({
      where: { id },
      include: {
        template: { include: { questions: true } },
        candidate: { select: { organizationId: true } },
      },
    });
    if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (!assertAssignmentOrgAccess(session.organizationId, assignment.candidate.organizationId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (assignment.status !== 'completed') {
      return NextResponse.json({ error: 'Can only grade completed assessments' }, { status: 400 });
    }

    const grades = Array.isArray(body.grades) ? body.grades : [];
    for (const g of grades) {
      const questionId = typeof g.questionId === 'string' ? g.questionId : '';
      const q = assignment.template.questions.find((x) => x.id === questionId);
      if (!q) continue;
      const maxPts = q.points || 1;
      const pointsEarned = Math.max(0, Math.min(maxPts, Number(g.pointsEarned) || 0));
      // Always resolve isCorrect after manual grade so review can clear
      const isCorrect =
        typeof g.isCorrect === 'boolean'
          ? g.isCorrect
          : pointsEarned >= maxPts
            ? true
            : false;
      const feedback = typeof g.feedback === 'string' ? g.feedback.slice(0, 5000) : undefined;

      await prisma.assessmentResponse.upsert({
        where: { assignmentId_questionId: { assignmentId: id, questionId } },
        create: {
          assignmentId: id,
          questionId,
          pointsEarned,
          isCorrect,
          feedback: feedback ?? null,
        },
        update: {
          pointsEarned,
          isCorrect,
          ...(feedback !== undefined ? { feedback } : {}),
        },
      });
    }

    if (typeof body.feedback === 'string') {
      await prisma.assessmentAssignment.update({
        where: { id },
        data: { feedback: body.feedback.slice(0, 10000) },
      });
    }

    const updated = await recomputeAssignmentScore(id);
    const final = updated ?? (await prisma.assessmentAssignment.findUnique({ where: { id } }));

    return NextResponse.json({
      ok: true,
      score: final?.score,
      maxScore: final?.maxScore,
      percentage: final?.percentage != null ? parseFloat(final.percentage.toString()) : null,
      passed: final?.passed,
      reviewStatus: final?.reviewStatus,
    });
  } catch (e) {
    console.error('PATCH assignments/[id]', e);
    return NextResponse.json({ error: 'Failed to save grades' }, { status: 500 });
  }
});
