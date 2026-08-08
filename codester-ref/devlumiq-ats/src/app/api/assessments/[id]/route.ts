import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  findAssignmentByToken,
  ensureNotExpired,
  isWritableStatus,
  publicQuestionsPayload,
} from '@/lib/assessment-api';

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/assessments/[token] — load assessment by access token (public)
 * POST /api/assessments/[token] — { action: 'start' } (public)
 *
 * Param is the accessToken (48-char hex), not the assignment id.
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id: token } = await ctx.params;
    const assignment = await findAssignmentByToken(token);
    if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (await ensureNotExpired(assignment)) {
      return NextResponse.json({ error: 'Assessment expired' }, { status: 410 });
    }

    if (assignment.status === 'completed') {
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
        },
        template: {
          name: assignment.template.name,
          description: assignment.template.description,
          duration: assignment.template.duration,
          proctoringEnabled: assignment.template.proctoringEnabled,
          proctoringStrictness: assignment.template.proctoringStrictness,
          requireFullscreen: assignment.template.requireFullscreen,
          snapshotIntervalSec: assignment.template.snapshotIntervalSec,
          passingScore: assignment.template.passingScore,
        },
        candidate: { name: assignment.candidate.name },
        questions: publicQuestionsPayload(assignment.template.questions),
        savedAnswers: assignment.responses.map((r) => ({
          questionId: r.questionId,
          answer: r.answer,
          codeSubmission: r.codeSubmission,
          timeSpent: r.timeSpent,
        })),
        serverNow: new Date().toISOString(),
      });
    }

    if (!isWritableStatus(assignment.status)) {
      return NextResponse.json({ error: `Assessment is ${assignment.status}` }, { status: 400 });
    }

    return NextResponse.json({
      assignment: {
        id: assignment.id,
        status: assignment.status,
        startedAt: assignment.startedAt,
        submittedAt: assignment.submittedAt,
        expiresAt: assignment.expiresAt,
        score: null,
        maxScore: null,
        percentage: null,
        passed: null,
        reviewStatus: null,
      },
      template: {
        name: assignment.template.name,
        description: assignment.template.description,
        duration: assignment.template.duration,
        proctoringEnabled: assignment.template.proctoringEnabled,
        proctoringStrictness: assignment.template.proctoringStrictness,
        requireFullscreen: assignment.template.requireFullscreen,
        snapshotIntervalSec: assignment.template.snapshotIntervalSec,
        passingScore: assignment.template.passingScore,
      },
      candidate: { name: assignment.candidate.name },
      questions: publicQuestionsPayload(assignment.template.questions),
      savedAnswers: assignment.responses.map((r) => ({
        questionId: r.questionId,
        answer: r.answer,
        codeSubmission: r.codeSubmission,
        timeSpent: r.timeSpent,
      })),
      serverNow: new Date().toISOString(),
      durationEndsAt:
        assignment.startedAt && assignment.template.duration
          ? new Date(
              assignment.startedAt.getTime() + assignment.template.duration * 60_000,
            ).toISOString()
          : null,
    });
  } catch (e) {
    console.error('GET /api/assessments/[token]', e);
    return NextResponse.json({ error: 'Failed to load assessment' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id: token } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const action = body.action === 'start' ? 'start' : null;
    if (action !== 'start') {
      return NextResponse.json({ error: 'Use /answer or /submit endpoints' }, { status: 400 });
    }

    const assignment = await findAssignmentByToken(token);
    if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (await ensureNotExpired(assignment)) {
      return NextResponse.json({ error: 'Assessment expired' }, { status: 410 });
    }
    if (assignment.status === 'completed') {
      return NextResponse.json({ error: 'Already submitted' }, { status: 400 });
    }
    if (!isWritableStatus(assignment.status)) {
      return NextResponse.json({ error: `Cannot start: status is ${assignment.status}` }, { status: 400 });
    }

    const startedAt = assignment.startedAt ?? new Date();
    const updated = await prisma.assessmentAssignment.update({
      where: { id: assignment.id },
      data: { status: 'in_progress', startedAt },
    });

    if (assignment.template.proctoringEnabled) {
      await prisma.proctoringSession.upsert({
        where: { assignmentId: assignment.id },
        create: {
          assignmentId: assignment.id,
          timeline: [{ type: 'start', at: new Date().toISOString() }],
        },
        update: {},
      });
    }

    return NextResponse.json({
      ok: true,
      status: updated.status,
      startedAt: updated.startedAt,
      serverNow: new Date().toISOString(),
    });
  } catch (e) {
    console.error('POST /api/assessments/[token] start', e);
    return NextResponse.json({ error: 'Failed to start assessment' }, { status: 500 });
  }
}
