/**
 * Assessment take-flow helpers: token load, writability, grading, scoring, notifications.
 */

import { prisma } from '@/lib/prisma';
import { runCodeAgainstTests, isCodeRunnerEnabled } from '@/lib/code-runner';
import { sendEmail } from '@/lib/email';
import { generateAssessmentInviteEmail, generateAssessmentReminderEmail } from '@/lib/email';

export type AssignmentWithTemplate = NonNullable<Awaited<ReturnType<typeof findAssignmentByToken>>>;

/** Grace period after duration elapses before hard-locking writes (seconds) */
export const DURATION_GRACE_SEC = 30;

export async function findAssignmentByToken(token: string) {
  if (!token || token.length < 16) return null;
  return prisma.assessmentAssignment.findUnique({
    where: { accessToken: token },
    include: {
      template: {
        include: {
          questions: { orderBy: { sortOrder: 'asc' } },
        },
      },
      candidate: { select: { id: true, name: true, email: true, organizationId: true } },
      responses: true,
      proctoringSession: true,
    },
  });
}

/** Lazy-expire if past expiresAt and not completed */
export async function ensureNotExpired(assignment: {
  id: string;
  status: string;
  expiresAt: Date | null;
}) {
  if (
    assignment.expiresAt &&
    assignment.expiresAt < new Date() &&
    assignment.status !== 'completed' &&
    assignment.status !== 'expired'
  ) {
    await prisma.assessmentAssignment.update({
      where: { id: assignment.id },
      data: { status: 'expired' },
    });
    return true;
  }
  return assignment.status === 'expired';
}

/**
 * Server-side duration check. Returns error message if time is up.
 * Allows DURATION_GRACE_SEC after startedAt + duration for network lag / auto-submit.
 */
export function durationExceeded(assignment: {
  startedAt: Date | null;
  status: string;
  template: { duration: number | null };
}): string | null {
  const durationMin = assignment.template.duration;
  if (!durationMin || !assignment.startedAt || assignment.status !== 'in_progress') {
    return null;
  }
  const deadline =
    assignment.startedAt.getTime() + durationMin * 60_000 + DURATION_GRACE_SEC * 1000;
  if (Date.now() > deadline) {
    return 'Time limit exceeded';
  }
  return null;
}

export function isWritableStatus(status: string): boolean {
  return status === 'pending' || status === 'in_progress';
}

export function needsManualReview(type: string): boolean {
  const t = (type || '').toLowerCase();
  return (
    t.includes('open') ||
    t.includes('personality') ||
    t.includes('custom') ||
    t === 'language'
  );
}

export function isCodingType(type: string): boolean {
  const t = (type || '').toLowerCase();
  return t.includes('coding') || t === 'code';
}

export function isAutoGradableMcq(type: string): boolean {
  const t = (type || '').toLowerCase();
  return (
    t.includes('multiple') ||
    t.includes('mcq') ||
    t.includes('logical') ||
    t.includes('reasoning')
  );
}

export async function gradeAnswer(
  question: {
    type: string;
    correctAnswer: string | null;
    points: number;
    options?: unknown;
    testCases?: unknown;
    language?: string | null;
  },
  answer: string | null | undefined,
  codeSubmission?: string | null,
  organizationId?: string | null,
): Promise<{ isCorrect: boolean | null; pointsEarned: number; pendingReview: boolean }> {
  const points = question.points || 1;
  const type = (question.type || '').toLowerCase();

  if (isCodingType(type)) {
    const code = (codeSubmission || answer || '').trim();
    if (!code) return { isCorrect: false, pointsEarned: 0, pendingReview: false };
    if (!isCodeRunnerEnabled()) {
      return { isCorrect: null, pointsEarned: 0, pendingReview: true };
    }
    const run = await runCodeAgainstTests({
      code,
      language: question.language,
      testCases: question.testCases,
      points,
      organizationId,
    });
    if (!run.supported || run.totalCount === 0) {
      return { isCorrect: null, pointsEarned: 0, pendingReview: true };
    }
    return {
      isCorrect: run.isCorrect,
      pointsEarned: run.pointsEarned,
      pendingReview: false,
    };
  }

  if (needsManualReview(type)) {
    return { isCorrect: null, pointsEarned: 0, pendingReview: true };
  }

  if (!question.correctAnswer) {
    return { isCorrect: null, pointsEarned: 0, pendingReview: true };
  }

  const normalized = (answer || '').trim().toLowerCase();
  const correct = question.correctAnswer.trim().toLowerCase();
  const isCorrect = normalized === correct;
  return { isCorrect, pointsEarned: isCorrect ? points : 0, pendingReview: false };
}

/**
 * Atomically claim submit: only one concurrent submit wins.
 * Returns false if already completed/expired/not writable.
 */
export async function claimAssignmentForSubmit(assignmentId: string): Promise<boolean> {
  const result = await prisma.assessmentAssignment.updateMany({
    where: {
      id: assignmentId,
      status: { in: ['pending', 'in_progress'] },
    },
    data: {
      status: 'completed',
      submittedAt: new Date(),
    },
  });
  return result.count === 1;
}

export async function recomputeAssignmentScore(assignmentId: string) {
  const assignment = await prisma.assessmentAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      template: { include: { questions: true } },
      responses: true,
    },
  });
  if (!assignment) return null;

  const questions = assignment.template.questions;
  const maxScore = questions.reduce((s, q) => s + (q.points || 1), 0);
  let score = 0;
  let pendingManual = false;

  for (const q of questions) {
    const resp = assignment.responses.find((r) => r.questionId === q.id);
    if (!resp) {
      if (needsManualReview(q.type) || isCodingType(q.type)) {
        pendingManual = true;
      }
      continue;
    }
    // null isCorrect means awaiting manual review
    if (resp.isCorrect === null) {
      pendingManual = true;
    }
    score += resp.pointsEarned || 0;
  }

  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const reviewStatus = pendingManual ? 'pending_review' : 'reviewed';
  const passed = pendingManual ? null : percentage >= (assignment.template.passingScore || 70);

  return prisma.assessmentAssignment.update({
    where: { id: assignmentId },
    data: {
      score,
      maxScore,
      percentage,
      passed,
      reviewStatus,
    },
  });
}

export async function notifyRecruiterAssessmentEvent(opts: {
  assignedById: string;
  candidateName: string;
  templateName: string;
  assignmentId: string;
  candidateId: string;
  kind: 'completed' | 'expired';
}) {
  const title =
    opts.kind === 'completed'
      ? 'Assessment completed'
      : 'Assessment expired';
  const message =
    opts.kind === 'completed'
      ? `${opts.candidateName} completed "${opts.templateName}".`
      : `${opts.candidateName}'s assessment "${opts.templateName}" expired without a complete submission.`;

  try {
    await prisma.notification.create({
      data: {
        userId: opts.assignedById,
        candidateId: opts.candidateId,
        title,
        message,
        type: opts.kind === 'completed' ? 'success' : 'warning',
        category: 'assessment',
        priority: opts.kind === 'expired' ? 'high' : 'medium',
        href: `/dashboard/assessments?assignment=${opts.assignmentId}`,
        metadata: { assignmentId: opts.assignmentId, kind: opts.kind },
      },
    });
  } catch (e) {
    console.error('[assessments] notify recruiter failed', e);
  }
}

export async function sendAssessmentInvite(opts: {
  candidateName: string;
  candidateEmail: string;
  templateName: string;
  duration: number | null;
  expiresAt: Date | null;
  takeUrl: string;
}) {
  const email = generateAssessmentInviteEmail(opts);
  return sendEmail({
    to: opts.candidateEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}

export async function sendAssessmentReminder(opts: {
  candidateName: string;
  candidateEmail: string;
  templateName: string;
  expiresAt: Date;
  takeUrl: string;
}) {
  const email = generateAssessmentReminderEmail(opts);
  return sendEmail({
    to: opts.candidateEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}

export function buildTakeUrl(accessToken: string): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  const appUrl = raw.replace(/\/$/, '');
  if (!appUrl) {
    console.warn('[assessments] NEXT_PUBLIC_APP_URL is unset — invite links will be relative');
  }
  return `${appUrl}/assess/${accessToken}`;
}

/** Strip secrets before returning assignment rows to recruiters */
export function sanitizeAssignmentForRecruiter<T extends { accessToken?: string | null }>(
  a: T,
): Omit<T, 'accessToken'> & { takeUrl: string | null; hasAccessToken: boolean } {
  const { accessToken, ...rest } = a;
  return {
    ...(rest as Omit<T, 'accessToken'>),
    hasAccessToken: Boolean(accessToken),
    takeUrl: accessToken ? buildTakeUrl(accessToken) : null,
  };
}

/** Org scope helper for recruiter APIs */
export function assertAssignmentOrgAccess(
  sessionOrgId: string | null | undefined,
  candidateOrgId: string | null | undefined,
): boolean {
  if (!sessionOrgId) return true; // platform/admin without org
  if (!candidateOrgId) return true;
  return candidateOrgId === sessionOrgId;
}

/** Expire overdue assignments; returns count flipped */
export async function expireOverdueAssignments(): Promise<number> {
  const now = new Date();
  const overdue = await prisma.assessmentAssignment.findMany({
    where: {
      status: { in: ['pending', 'in_progress'] },
      expiresAt: { lt: now },
    },
    include: {
      template: { select: { name: true } },
      candidate: { select: { name: true } },
    },
    take: 200,
  });

  let count = 0;
  for (const a of overdue) {
    await prisma.assessmentAssignment.update({
      where: { id: a.id },
      data: { status: 'expired' },
    });
    await notifyRecruiterAssessmentEvent({
      assignedById: a.assignedById,
      candidateName: a.candidate.name,
      templateName: a.template.name,
      assignmentId: a.id,
      candidateId: a.candidateId,
      kind: 'expired',
    });
    count++;
  }
  return count;
}

/** Send reminder emails for assignments expiring within `withinHours` */
export async function sendAssessmentReminders(withinHours = 48): Promise<number> {
  const now = new Date();
  const until = new Date(now.getTime() + withinHours * 60 * 60 * 1000);

  const due = await prisma.assessmentAssignment.findMany({
    where: {
      status: { in: ['pending', 'in_progress'] },
      reminderSentAt: null,
      accessToken: { not: null },
      expiresAt: { gte: now, lte: until },
    },
    include: {
      template: { select: { name: true } },
      candidate: { select: { name: true, email: true } },
    },
    take: 100,
  });

  let sent = 0;
  for (const a of due) {
    if (!a.accessToken || !a.expiresAt || !a.candidate.email) continue;
    const ok = await sendAssessmentReminder({
      candidateName: a.candidate.name,
      candidateEmail: a.candidate.email,
      templateName: a.template.name,
      expiresAt: a.expiresAt,
      takeUrl: buildTakeUrl(a.accessToken),
    });
    if (ok) {
      await prisma.assessmentAssignment.update({
        where: { id: a.id },
        data: { reminderSentAt: new Date() },
      });
      sent++;
    }
  }
  return sent;
}

const MAX_ANSWER_CHARS = 100_000;
const MAX_CODE_CHARS = 50_000;

export function validateAnswerPayload(body: {
  answer?: unknown;
  codeSubmission?: unknown;
}): { answer: string | null; codeSubmission: string | null; error?: string } {
  let answer: string | null = null;
  let codeSubmission: string | null = null;

  if (body.answer != null) {
    answer = String(body.answer);
    if (answer.length > MAX_ANSWER_CHARS) {
      return { answer: null, codeSubmission: null, error: 'Answer too large' };
    }
  }
  if (body.codeSubmission != null) {
    codeSubmission = String(body.codeSubmission);
    if (codeSubmission.length > MAX_CODE_CHARS) {
      return { answer: null, codeSubmission: null, error: 'Code submission too large' };
    }
  }
  return { answer, codeSubmission };
}
