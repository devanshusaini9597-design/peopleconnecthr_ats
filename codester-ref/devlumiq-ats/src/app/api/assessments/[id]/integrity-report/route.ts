import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';

type Ctx = { params: Promise<{ id: string }> };

/** GET integrity report for recruiters (assignment id) */
export const GET = withPermission('VIEW_ASSESSMENTS', async (_req: NextRequest, ctx: Ctx, session) => {
  try {
    const { id } = await ctx.params;
    const assignment = await prisma.assessmentAssignment.findUnique({
      where: { id },
      include: {
        template: {
          select: {
            name: true,
            proctoringEnabled: true,
            proctoringStrictness: true,
            organizationId: true,
          },
        },
        candidate: { select: { id: true, name: true, email: true, organizationId: true } },
        proctoringSession: true,
        responses: {
          select: {
            questionId: true,
            isCorrect: true,
            pointsEarned: true,
            timeSpent: true,
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const orgId = session.organizationId;
    if (
      orgId &&
      assignment.candidate.organizationId &&
      assignment.candidate.organizationId !== orgId
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sessionData = assignment.proctoringSession;
    // Don't send full huge data URLs in list — truncate for report
    const snapshots = Array.isArray(sessionData?.webcamSnapshots)
      ? (sessionData!.webcamSnapshots as Array<{ at: string; dataUrl?: string; url?: string }>).map((s) => ({
          at: s.at,
          hasImage: Boolean(s.url || s.dataUrl),
          url: s.url || null,
        }))
      : [];

    return NextResponse.json({
      assignment: {
        id: assignment.id,
        status: assignment.status,
        score: assignment.score,
        maxScore: assignment.maxScore,
        percentage:
          assignment.percentage != null ? parseFloat(assignment.percentage.toString()) : null,
        passed: assignment.passed,
        startedAt: assignment.startedAt,
        submittedAt: assignment.submittedAt,
      },
      template: assignment.template,
      candidate: assignment.candidate,
      proctoring: sessionData
        ? {
            flagged: sessionData.flagged,
            riskScore: sessionData.riskScore,
            tabSwitchCount: sessionData.tabSwitchCount,
            fullscreenExits: sessionData.fullscreenExits,
            copyPasteCount: Array.isArray(sessionData.copyPasteEvents)
              ? (sessionData.copyPasteEvents as unknown[]).length
              : 0,
            blurCount: Array.isArray(sessionData.blurEvents)
              ? (sessionData.blurEvents as unknown[]).length
              : 0,
            plagiarismScore: sessionData.plagiarismScore,
            plagiarismNotes: sessionData.plagiarismNotes,
            timeline: sessionData.timeline,
            snapshots,
          }
        : null,
      responses: assignment.responses,
    });
  } catch (e) {
    console.error('integrity-report', e);
    return NextResponse.json({ error: 'Failed to load report' }, { status: 500 });
  }
});
