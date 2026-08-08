import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { codeSimilarity, computeRiskScore } from '@/lib/proctoring';
import { rateLimitAsync } from '@/lib/rate-limit';
import {
  findAssignmentByToken,
  ensureNotExpired,
  isWritableStatus,
  durationExceeded,
  gradeAnswer,
  needsManualReview,
  notifyRecruiterAssessmentEvent,
  recomputeAssignmentScore,
  claimAssignmentForSubmit,
  validateAnswerPayload,
  DURATION_GRACE_SEC,
} from '@/lib/assessments';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/assessments/[token]/submit
 * Atomic claim → grade → score. Rejects if already submitted or past duration (+ grace).
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id: token } = await ctx.params;
    const rl = await rateLimitAsync(`assess:submit:${token}`, 5, 60_000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));

    const assignment = await findAssignmentByToken(token);
    if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (await ensureNotExpired(assignment)) {
      return NextResponse.json({ error: 'Assessment expired' }, { status: 410 });
    }
    if (assignment.status === 'completed') {
      return NextResponse.json({ error: 'Already submitted' }, { status: 400 });
    }
    if (assignment.status === 'expired') {
      return NextResponse.json({ error: 'Assessment expired' }, { status: 410 });
    }
    if (!isWritableStatus(assignment.status)) {
      return NextResponse.json({ error: `Cannot submit: status is ${assignment.status}` }, { status: 400 });
    }

    // Allow submit after duration only within grace (auto-submit race); reject hard overruns
    const timeErr = durationExceeded(assignment);
    // durationExceeded includes grace — if it fires, hard reject
    if (timeErr) {
      return NextResponse.json({ error: timeErr, code: 'TIME_UP' }, { status: 403 });
    }

    // Atomic claim — only one concurrent submit wins
    const claimed = await claimAssignmentForSubmit(assignment.id);
    if (!claimed) {
      return NextResponse.json({ error: 'Already submitted' }, { status: 409 });
    }

    const answers = Array.isArray(body.answers) ? body.answers : [];
    const questions = assignment.template.questions;
    let pendingReview = false;

    for (const q of questions) {
      const fromBody = answers.find((a: { questionId: string }) => a.questionId === q.id);
      const existing = assignment.responses.find((r) => r.questionId === q.id);

      let answer = fromBody?.answer ?? existing?.answer ?? null;
      let codeSubmission = fromBody?.codeSubmission ?? existing?.codeSubmission ?? null;
      if (fromBody) {
        const v = validateAnswerPayload(fromBody);
        if (!v.error) {
          answer = v.answer ?? answer;
          codeSubmission = v.codeSubmission ?? codeSubmission;
        }
      }

      const timeSpent =
        typeof fromBody?.timeSpent === 'number'
          ? Math.min(Math.floor(fromBody.timeSpent), 86400)
          : existing?.timeSpent ?? null;

      const graded = await gradeAnswer(
        {
          type: q.type,
          correctAnswer: q.correctAnswer,
          points: q.points,
          options: q.options,
          testCases: q.testCases,
          language: q.language,
        },
        answer,
        codeSubmission,
        assignment.template.organizationId ?? assignment.candidate.organizationId,
      );

      if (graded.pendingReview || needsManualReview(q.type)) {
        pendingReview = true;
      }

      await prisma.assessmentResponse.upsert({
        where: {
          assignmentId_questionId: { assignmentId: assignment.id, questionId: q.id },
        },
        create: {
          assignmentId: assignment.id,
          questionId: q.id,
          answer,
          codeSubmission,
          isCorrect: graded.isCorrect,
          pointsEarned: graded.pointsEarned,
          timeSpent,
        },
        update: {
          answer,
          codeSubmission,
          isCorrect: graded.isCorrect,
          pointsEarned: graded.pointsEarned,
          ...(timeSpent != null ? { timeSpent } : {}),
          submittedAt: new Date(),
        },
      });
    }

    let plagiarismScore: number | null = null;
    let plagiarismNotes: string | null = null;
    if (assignment.template.proctoringEnabled) {
      let maxSim = 0;
      const notes: string[] = [];
      const responses = await prisma.assessmentResponse.findMany({
        where: { assignmentId: assignment.id },
      });
      for (const ans of responses) {
        const content = (ans.codeSubmission || ans.answer || '').trim();
        if (content.length < 40) continue;
        const others = await prisma.assessmentResponse.findMany({
          where: {
            questionId: ans.questionId,
            assignmentId: { not: assignment.id },
            OR: [{ codeSubmission: { not: null } }, { answer: { not: null } }],
          },
          take: 50,
          select: { codeSubmission: true, answer: true },
        });
        for (const o of others) {
          const otherText = (o.codeSubmission || o.answer || '').trim();
          const sim = codeSimilarity(content, otherText);
          if (sim > maxSim) maxSim = sim;
          if (sim >= 0.75) {
            notes.push(`High similarity (${Math.round(sim * 100)}%) on question ${ans.questionId}`);
          }
        }
      }
      plagiarismScore = maxSim;
      plagiarismNotes = notes.slice(0, 5).join('; ') || null;

      const session = await prisma.proctoringSession.findUnique({
        where: { assignmentId: assignment.id },
      });
      if (session) {
        const copyPaste = (session.copyPasteEvents as unknown as unknown[]) || [];
        const blur = (session.blurEvents as unknown as unknown[]) || [];
        const { riskScore, flagged } = computeRiskScore({
          tabSwitchCount: session.tabSwitchCount,
          copyPasteCount: copyPaste.length,
          blurCount: blur.length,
          fullscreenExits: session.fullscreenExits,
          plagiarismScore,
          strictness: assignment.template.proctoringStrictness,
        });
        const timeline = Array.isArray(session.timeline) ? [...(session.timeline as object[])] : [];
        timeline.push({ type: 'submit', at: new Date().toISOString() });
        await prisma.proctoringSession.update({
          where: { assignmentId: assignment.id },
          data: {
            plagiarismScore,
            plagiarismNotes,
            riskScore,
            flagged,
            timeline: timeline as object[],
          },
        });
      }
    }

    await prisma.assessmentAssignment.update({
      where: { id: assignment.id },
      data: {
        reviewStatus: pendingReview ? 'pending_review' : 'reviewed',
      },
    });

    const scored = await recomputeAssignmentScore(assignment.id);

    await notifyRecruiterAssessmentEvent({
      assignedById: assignment.assignedById,
      candidateName: assignment.candidate.name,
      templateName: assignment.template.name,
      assignmentId: assignment.id,
      candidateId: assignment.candidateId,
      kind: 'completed',
    });

    const percentage =
      scored?.percentage != null ? parseFloat(scored.percentage.toString()) : 0;

    void DURATION_GRACE_SEC;
    return NextResponse.json({
      ok: true,
      score: scored?.score ?? 0,
      maxScore: scored?.maxScore ?? 0,
      percentage,
      passed: scored?.passed ?? null,
      reviewStatus: scored?.reviewStatus ?? (pendingReview ? 'pending_review' : 'reviewed'),
      pendingReview,
      plagiarismScore,
    });
  } catch (e) {
    console.error('POST /api/assessments/[token]/submit', e);
    return NextResponse.json({ error: 'Failed to submit assessment' }, { status: 500 });
  }
}
