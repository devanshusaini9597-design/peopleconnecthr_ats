import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { gradeAnswer, codeSimilarity, computeRiskScore } from '@/lib/proctoring';
import {
  notifyRecruiterAssessmentEvent,
  needsManualReview,
  claimAssignmentForSubmit,
  durationExceeded,
  recomputeAssignmentScore,
} from '@/lib/assessments';

type Ctx = { params: Promise<{ id: string }> };

async function loadAssignment(id: string, token: string | null) {
  const assignment = await prisma.assessmentAssignment.findUnique({
    where: { id },
    include: {
      template: {
        include: {
          questions: { orderBy: { sortOrder: 'asc' } },
        },
      },
      candidate: { select: { id: true, name: true, email: true } },
      proctoringSession: true,
      responses: true,
    },
  });
  if (!assignment) return null;
  if (!token || assignment.accessToken !== token) return 'unauthorized' as const;
  if (assignment.expiresAt && assignment.expiresAt < new Date() && assignment.status !== 'completed') {
    if (assignment.status !== 'expired') {
      await prisma.assessmentAssignment.update({
        where: { id },
        data: { status: 'expired' },
      });
    }
    return 'expired' as const;
  }
  return assignment;
}

/** GET — load assessment for candidate (token required; strips correct answers) */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const token = new URL(req.url).searchParams.get('token');
    const assignment = await loadAssignment(id, token);
    if (assignment === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (assignment === 'unauthorized') return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    if (assignment === 'expired') return NextResponse.json({ error: 'Assessment expired' }, { status: 410 });

    const questions = assignment.template.questions.map((q) => ({
      id: q.id,
      type: q.type,
      question: q.question,
      description: q.description,
      codeSnippet: q.codeSnippet,
      options: q.options,
      points: q.points,
      language: q.language,
    }));

    return NextResponse.json({
      assignment: {
        id: assignment.id,
        status: assignment.status,
        startedAt: assignment.startedAt,
        submittedAt: assignment.submittedAt,
        expiresAt: assignment.expiresAt,
        score: assignment.score,
        percentage: assignment.percentage != null ? parseFloat(assignment.percentage.toString()) : null,
        passed: assignment.passed,
      },
      template: {
        name: assignment.template.name,
        description: assignment.template.description,
        duration: assignment.template.duration,
        proctoringEnabled: assignment.template.proctoringEnabled,
        proctoringStrictness: assignment.template.proctoringStrictness,
        requireFullscreen: assignment.template.requireFullscreen,
        snapshotIntervalSec: assignment.template.snapshotIntervalSec,
      },
      candidate: { name: assignment.candidate.name },
      questions,
      takeUrl: assignment.accessToken ? `/assess/${assignment.accessToken}` : null,
    });
  } catch (e) {
    console.error('GET assessments/take', e);
    return NextResponse.json({ error: 'Failed to load assessment' }, { status: 500 });
  }
}

/** POST — start or submit (legacy-compatible; uses atomic claim + upsert) */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const token = typeof body.token === 'string' ? body.token : null;
    const action = body.action === 'submit' ? 'submit' : 'start';

    const assignment = await loadAssignment(id, token);
    if (assignment === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (assignment === 'unauthorized') return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    if (assignment === 'expired') return NextResponse.json({ error: 'Assessment expired' }, { status: 410 });

    if (action === 'start') {
      if (assignment.status === 'completed') {
        return NextResponse.json({ error: 'Already submitted' }, { status: 400 });
      }
      const updated = await prisma.assessmentAssignment.update({
        where: { id },
        data: {
          status: 'in_progress',
          startedAt: assignment.startedAt ?? new Date(),
        },
      });

      if (assignment.template.proctoringEnabled) {
        await prisma.proctoringSession.upsert({
          where: { assignmentId: id },
          create: {
            assignmentId: id,
            timeline: [{ type: 'start', at: new Date().toISOString() }],
          },
          update: {},
        });
      }

      return NextResponse.json({ ok: true, status: updated.status, startedAt: updated.startedAt });
    }

    if (assignment.status === 'completed') {
      return NextResponse.json({ error: 'Already submitted' }, { status: 400 });
    }

    const timeErr = durationExceeded(assignment);
    if (timeErr) {
      return NextResponse.json({ error: timeErr, code: 'TIME_UP' }, { status: 403 });
    }

    const claimed = await claimAssignmentForSubmit(id);
    if (!claimed) {
      return NextResponse.json({ error: 'Already submitted' }, { status: 409 });
    }

    const answers = Array.isArray(body.answers) ? body.answers : [];
    const questions = assignment.template.questions;
    let pendingReview = false;

    for (const q of questions) {
      const ans = answers.find((a: { questionId: string }) => a.questionId === q.id);
      const existing = assignment.responses.find((r) => r.questionId === q.id);
      const answer = ans?.answer ?? existing?.answer ?? null;
      const codeSubmission = ans?.codeSubmission ?? existing?.codeSubmission ?? null;
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
        assignment.template.organizationId,
      );
      if (graded.pendingReview || needsManualReview(q.type)) pendingReview = true;
      await prisma.assessmentResponse.upsert({
        where: { assignmentId_questionId: { assignmentId: id, questionId: q.id } },
        create: {
          assignmentId: id,
          questionId: q.id,
          answer,
          codeSubmission,
          isCorrect: graded.isCorrect,
          pointsEarned: graded.pointsEarned,
          timeSpent: typeof ans?.timeSpent === 'number' ? ans.timeSpent : existing?.timeSpent ?? null,
        },
        update: {
          answer,
          codeSubmission,
          isCorrect: graded.isCorrect,
          pointsEarned: graded.pointsEarned,
          ...(typeof ans?.timeSpent === 'number' ? { timeSpent: ans.timeSpent } : {}),
          submittedAt: new Date(),
        },
      });
    }

    let plagiarismScore: number | null = null;
    let plagiarismNotes: string | null = null;
    if (assignment.template.proctoringEnabled) {
      let maxSim = 0;
      const notes: string[] = [];
      for (const ans of answers) {
        const content = (ans.codeSubmission || ans.answer || '').trim();
        if (content.length < 40) continue;
        const others = await prisma.assessmentResponse.findMany({
          where: {
            questionId: ans.questionId,
            assignmentId: { not: id },
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

      const session = await prisma.proctoringSession.findUnique({ where: { assignmentId: id } });
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
          where: { assignmentId: id },
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
      where: { id },
      data: { reviewStatus: pendingReview ? 'pending_review' : 'reviewed' },
    });

    const scored = await recomputeAssignmentScore(id);

    await notifyRecruiterAssessmentEvent({
      assignedById: assignment.assignedById,
      candidateName: assignment.candidate.name,
      templateName: assignment.template.name,
      assignmentId: id,
      candidateId: assignment.candidateId,
      kind: 'completed',
    });

    const percentage = scored?.percentage != null ? parseFloat(scored.percentage.toString()) : 0;

    return NextResponse.json({
      ok: true,
      score: scored?.score ?? 0,
      maxScore: scored?.maxScore ?? 0,
      percentage,
      passed: scored?.passed ?? null,
      pendingReview,
      plagiarismScore,
    });
  } catch (e) {
    console.error('POST assessments/take', e);
    return NextResponse.json({ error: 'Failed to process assessment' }, { status: 500 });
  }
}
