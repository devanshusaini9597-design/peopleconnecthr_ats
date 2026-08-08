import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { computeRiskScore, type TimelineEvent } from '@/lib/proctoring';
import { uploadFile } from '@/lib/file-storage';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/assessments/[id]/proctoring-event
 * Public (token) — append integrity event during assessment.
 * Body: { token, type, questionId?, snapshotDataUrl?, meta? }
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const token = typeof body.token === 'string' ? body.token : '';
    const type = typeof body.type === 'string' ? body.type : '';

    if (!token || !type) {
      return NextResponse.json({ error: 'token and type required' }, { status: 400 });
    }

    const assignment = await prisma.assessmentAssignment.findUnique({
      where: { id },
      include: { template: true, proctoringSession: true },
    });
    if (!assignment || assignment.accessToken !== token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (!assignment.template.proctoringEnabled) {
      return NextResponse.json({ ok: true, ignored: true });
    }
    if (assignment.status === 'completed') {
      return NextResponse.json({ error: 'Assessment already submitted' }, { status: 400 });
    }

    let session = assignment.proctoringSession;
    if (!session) {
      session = await prisma.proctoringSession.create({
        data: { assignmentId: id },
      });
    }

    const at = new Date().toISOString();
    const event: TimelineEvent = {
      type,
      at,
      questionId: typeof body.questionId === 'string' ? body.questionId : undefined,
      meta: body.meta && typeof body.meta === 'object' ? body.meta : undefined,
    };

    const timeline = Array.isArray(session.timeline)
      ? [...(session.timeline as unknown as TimelineEvent[])]
      : [];
    timeline.push(event);
    // Cap timeline size
    const cappedTimeline = timeline.slice(-500);

    const snapshots = Array.isArray(session.webcamSnapshots)
      ? [...(session.webcamSnapshots as object[])]
      : [];
    const copyPaste = Array.isArray(session.copyPasteEvents)
      ? [...(session.copyPasteEvents as object[])]
      : [];
    const blurEvents = Array.isArray(session.blurEvents)
      ? [...(session.blurEvents as object[])]
      : [];

    let tabSwitchCount = session.tabSwitchCount;
    let fullscreenExits = session.fullscreenExits;

    if (type === 'tab_switch') tabSwitchCount += 1;
    if (type === 'window_blur') blurEvents.push({ at, ...event.meta });
    if (type === 'copy' || type === 'paste') copyPaste.push({ type, at, questionId: event.questionId });
    if (type === 'fullscreen_exit') fullscreenExits += 1;
    if (type === 'snapshot' && typeof body.snapshotDataUrl === 'string') {
      let url: string | null = null;
      try {
        const raw = body.snapshotDataUrl as string;
        const match = raw.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          const buffer = Buffer.from(match[2], 'base64');
          if (buffer.length <= 150_000) {
            const key = `proctoring/${id}/${Date.now()}-${randomBytes(4).toString('hex')}.jpg`;
            const uploaded = await uploadFile(buffer, key, match[1] || 'image/jpeg');
            url = uploaded.url;
          }
        }
      } catch {
        /* ignore upload errors */
      }
      snapshots.push(url ? { at, url } : { at, error: 'upload_failed' });
      if (snapshots.length > 40) snapshots.splice(0, snapshots.length - 40);
    }

    const { riskScore, flagged } = computeRiskScore({
      tabSwitchCount,
      copyPasteCount: copyPaste.length,
      blurCount: blurEvents.length,
      fullscreenExits,
      plagiarismScore: session.plagiarismScore,
      strictness: assignment.template.proctoringStrictness,
    });

    const updated = await prisma.proctoringSession.update({
      where: { assignmentId: id },
      data: {
        tabSwitchCount,
        fullscreenExits,
        copyPasteEvents: copyPaste.slice(-200),
        blurEvents: blurEvents.slice(-200),
        webcamSnapshots: snapshots,
        timeline: cappedTimeline as unknown as object[],
        riskScore,
        flagged,
      },
    });

    return NextResponse.json({
      ok: true,
      riskScore: updated.riskScore,
      flagged: updated.flagged,
      tabSwitchCount: updated.tabSwitchCount,
    });
  } catch (e) {
    console.error('proctoring-event', e);
    return NextResponse.json({ error: 'Failed to record event' }, { status: 500 });
  }
}
