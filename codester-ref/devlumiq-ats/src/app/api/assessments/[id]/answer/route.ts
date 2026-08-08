import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimitAsync } from '@/lib/rate-limit';
import {
  findAssignmentByToken,
  ensureNotExpired,
  isWritableStatus,
  durationExceeded,
  validateAnswerPayload,
} from '@/lib/assessments';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/assessments/[token]/answer
 * Body: { questionId, answer?, codeSubmission?, timeSpent? }
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id: token } = await ctx.params;
    const rl = await rateLimitAsync(`assess:answer:${token}`, 120, 60_000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json();
    const questionId = typeof body.questionId === 'string' ? body.questionId : '';
    if (!questionId) {
      return NextResponse.json({ error: 'questionId is required' }, { status: 400 });
    }

    const assignment = await findAssignmentByToken(token);
    if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (await ensureNotExpired(assignment)) {
      return NextResponse.json({ error: 'Assessment expired' }, { status: 410 });
    }
    if (assignment.status === 'completed' || assignment.status === 'expired') {
      return NextResponse.json({ error: 'Assessment is locked' }, { status: 403 });
    }
    if (!isWritableStatus(assignment.status)) {
      return NextResponse.json({ error: `Cannot save: status is ${assignment.status}` }, { status: 400 });
    }
    if (assignment.status === 'pending') {
      return NextResponse.json({ error: 'Start the assessment before saving answers' }, { status: 400 });
    }

    const timeErr = durationExceeded(assignment);
    if (timeErr) {
      return NextResponse.json({ error: timeErr, code: 'TIME_UP' }, { status: 403 });
    }

    const question = assignment.template.questions.find((q) => q.id === questionId);
    if (!question) {
      return NextResponse.json({ error: 'Invalid question' }, { status: 400 });
    }

    const validated = validateAnswerPayload(body);
    if (validated.error) {
      return NextResponse.json({ error: validated.error }, { status: 413 });
    }

    const timeSpent =
      typeof body.timeSpent === 'number' && body.timeSpent >= 0
        ? Math.min(Math.floor(body.timeSpent), 86400)
        : undefined;

    const response = await prisma.assessmentResponse.upsert({
      where: {
        assignmentId_questionId: {
          assignmentId: assignment.id,
          questionId,
        },
      },
      create: {
        assignmentId: assignment.id,
        questionId,
        answer: validated.answer,
        codeSubmission: validated.codeSubmission,
        timeSpent: timeSpent ?? null,
        pointsEarned: 0,
        isCorrect: null,
      },
      update: {
        answer: validated.answer,
        codeSubmission: validated.codeSubmission,
        ...(timeSpent !== undefined ? { timeSpent } : {}),
        submittedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      response: {
        questionId: response.questionId,
        timeSpent: response.timeSpent,
        updatedAt: response.updatedAt,
      },
    });
  } catch (e) {
    console.error('POST /api/assessments/[token]/answer', e);
    return NextResponse.json({ error: 'Failed to save answer' }, { status: 500 });
  }
}
