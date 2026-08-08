import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';
import { postToBoard, unpublishFromBoard, type BoardCredentials } from '@/lib/jobboards';
import { decryptSecret } from '@/lib/jobboards/secrets';

function toCreds(row: {
  apiKey: string | null;
  apiSecret: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  accountName: string | null;
  settings: unknown;
} | null): BoardCredentials | null {
  if (!row) return null;
  return {
    apiKey: decryptSecret(row.apiKey),
    apiSecret: decryptSecret(row.apiSecret),
    accessToken: decryptSecret(row.accessToken),
    refreshToken: decryptSecret(row.refreshToken),
    accountName: row.accountName,
    settings: (row.settings as Record<string, unknown>) || null,
  };
}

// POST /api/jobboards/post - Post job to boards (live when credentials exist; else draft)
export const POST = withPermission('MANAGE_INTEGRATIONS', async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { jobId, boards } = await request.json();
    if (!jobId || !Array.isArray(boards) || boards.length === 0) {
      return NextResponse.json({ error: 'jobId and boards[] are required' }, { status: 400 });
    }

    const job = await prisma.job.findFirst({
      where: { id: jobId, companyId: orgId },
      include: { company: true },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
    const applyUrl = `${appUrl}/careers/${job.id}`;

    const results: Array<{ board: string; status: string; message?: string; posting?: unknown }> = [];

    for (const board of boards) {
      const boardKey = String(board).toUpperCase();
      const credRow = await prisma.jobBoardCredential.findFirst({
        where: {
          organizationId: orgId,
          board: boardKey as any,
          isActive: true,
        },
      });

      const result = await postToBoard(
        boardKey,
        {
          jobId: job.id,
          title: job.title,
          description: job.description || job.title,
          location: job.location,
          employmentType: job.type,
          companyName: job.company?.name || 'Company',
          applyUrl,
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          currency: job.salaryCurrency,
        },
        toCreds(credRow)
      );

      if (result.status === 'posted') {
        const posting = await prisma.jobBoardIntegration.create({
          data: {
            jobId,
            board: boardKey as any,
            status: 'posted',
            externalId: result.externalId,
            postUrl: result.postUrl,
            postedAt: new Date(),
          },
        });
        results.push({ board: boardKey, status: 'posted', posting });
        continue;
      }

      if (result.status === 'error') {
        const posting = await prisma.jobBoardIntegration.create({
          data: {
            jobId,
            board: boardKey as any,
            status: 'error',
            externalId: `error-${boardKey.toLowerCase()}-${Date.now()}`,
            postUrl: '',
          },
        });
        results.push({ board: boardKey, status: 'error', message: result.message, posting });
        continue;
      }

      const posting = await prisma.jobBoardIntegration.create({
        data: {
          jobId,
          board: boardKey as any,
          status: 'draft',
          externalId: `stub-${boardKey.toLowerCase()}-${Date.now()}`,
          postUrl: '',
        },
      });
      results.push({
        board: boardKey,
        status: 'draft',
        message: 'Add credentials under Job Boards settings for live posting',
        posting,
      });
    }

    const live = results.filter((p) => p.status === 'posted').length;
    const draft = results.filter((p) => p.status === 'draft').length;
    const errored = results.filter((p) => p.status === 'error').length;

    return NextResponse.json({
      success: true,
      postings: results.map((r) => r.posting),
      results,
      summary: { live, draft, errored },
      message:
        live > 0
          ? `Posted live to ${live} board(s)${draft ? `; ${draft} draft (credentials needed)` : ''}${errored ? `; ${errored} failed` : ''}`
          : `Job board records created (${draft} draft — add credentials under Job Boards settings for live posting)`,
    });
  } catch (error) {
    console.error('Error posting to job boards:', error);
    return NextResponse.json({ error: 'Failed to post job' }, { status: 500 });
  }
});

// GET /api/jobboards/post - Get job board postings for a job
export const GET = withPermission('MANAGE_INTEGRATIONS', async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    const job = await prisma.job.findFirst({ where: { id: jobId, companyId: orgId }, select: { id: true } });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const postings = await prisma.jobBoardIntegration.findMany({
      where: { jobId },
      orderBy: { postedAt: 'desc' },
    });

    return NextResponse.json(postings);
  } catch (error) {
    console.error('Error fetching board postings:', error);
    return NextResponse.json({ error: 'Failed to fetch postings' }, { status: 500 });
  }
});

// DELETE /api/jobboards/post - Unpublish from board (live) then remove DB row
export const DELETE = withPermission('MANAGE_INTEGRATIONS', async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { postingId } = await request.json();
    const posting = await prisma.jobBoardIntegration.findUnique({
      where: { id: postingId },
      include: { job: { select: { companyId: true } } },
    });
    if (!posting || posting.job.companyId !== orgId) {
      return NextResponse.json({ error: 'Posting not found' }, { status: 404 });
    }

    if (posting.status === 'posted' && posting.externalId) {
      const credRow = await prisma.jobBoardCredential.findFirst({
        where: {
          organizationId: orgId,
          board: posting.board as any,
          isActive: true,
        },
      });
      const unpub = await unpublishFromBoard(posting.board, posting.externalId, toCreds(credRow));
      if (!unpub.ok) {
        return NextResponse.json(
          { error: unpub.message || 'Failed to unpublish from board', code: 'UNPUBLISH_FAILED' },
          { status: 502 },
        );
      }
    }

    await prisma.jobBoardIntegration.delete({ where: { id: postingId } });
    return NextResponse.json({ success: true, unpublished: posting.status === 'posted' });
  } catch (error) {
    console.error('Error deleting posting:', error);
    return NextResponse.json({ error: 'Failed to delete posting' }, { status: 500 });
  }
});
