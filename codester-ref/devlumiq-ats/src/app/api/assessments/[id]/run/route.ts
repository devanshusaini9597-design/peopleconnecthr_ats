import { NextRequest, NextResponse } from 'next/server';
import {
  runCodeAgainstTests,
  publicTestCases,
  isCodeRunnerEnabled,
  getCodeRunnerStatus,
} from '@/lib/code-runner';
import { rateLimitAsync } from '@/lib/rate-limit';
import {
  findAssignmentByToken,
  ensureNotExpired,
  isWritableStatus,
  durationExceeded,
} from '@/lib/assessments';

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/assessments/[token]/run
 * Code runner status (Judge0 BYOK, or local node:vm when explicitly opted in).
 */
export async function GET() {
  return NextResponse.json(getCodeRunnerStatus());
}

/**
 * POST /api/assessments/[token]/run
 * Preview run against public test cases.
 * Uses Judge0 when JUDGE0_API_URL is set; local node:vm only if ASSESSMENT_CODE_RUNNER=true.
 * Force off with ASSESSMENT_CODE_RUNNER=false|0|off (even when Judge0 is configured).
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id: token } = await ctx.params;
    const rl = await rateLimitAsync(`assess:run:${token}`, 20, 60_000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    if (!isCodeRunnerEnabled()) {
      return NextResponse.json({
        ok: false,
        supported: false,
        disabled: true,
        error: 'Code runner is disabled in this environment. Solutions are graded on submit / by recruiter.',
        results: [],
        passedCount: 0,
        totalCount: 0,
      }, { status: 503 });
    }

    const body = await req.json();
    const questionId = typeof body.questionId === 'string' ? body.questionId : '';
    const code = typeof body.code === 'string' ? body.code : '';

    if (!questionId || !code.trim()) {
      return NextResponse.json({ error: 'questionId and code are required' }, { status: 400 });
    }
    if (code.length > 50_000) {
      return NextResponse.json({ error: 'Code too large' }, { status: 413 });
    }

    const assignment = await findAssignmentByToken(token);
    if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (await ensureNotExpired(assignment)) {
      return NextResponse.json({ error: 'Assessment expired' }, { status: 410 });
    }
    if (!isWritableStatus(assignment.status) || assignment.status === 'pending') {
      return NextResponse.json({ error: 'Assessment not in progress' }, { status: 400 });
    }

    const timeErr = durationExceeded(assignment);
    if (timeErr) {
      return NextResponse.json({ error: timeErr, code: 'TIME_UP' }, { status: 403 });
    }

    const question = assignment.template.questions.find((q) => q.id === questionId);
    if (!question) return NextResponse.json({ error: 'Invalid question' }, { status: 400 });

    const publicCases = publicTestCases(question.testCases).map((tc) => ({
      input: tc.input,
      output: tc.output ?? '',
      hidden: false,
    }));

    const organizationId =
      assignment.template.organizationId ?? assignment.candidate.organizationId ?? null;

    const result = await runCodeAgainstTests({
      code,
      language: question.language,
      testCases: publicCases,
      points: question.points,
      organizationId,
    });

    return NextResponse.json({
      ok: true,
      supported: result.supported,
      disabled: result.disabled ?? false,
      language: result.language,
      backend: getCodeRunnerStatus().backend,
      results: result.results.map((r) => ({
        index: r.index,
        passed: r.passed,
        input: r.input,
        expected: r.expected,
        actual: r.actual,
        error: r.error,
      })),
      passedCount: result.passedCount,
      totalCount: result.totalCount,
    });
  } catch (e) {
    console.error('POST /api/assessments/[token]/run', e);
    return NextResponse.json({ error: 'Failed to run code' }, { status: 500 });
  }
}
