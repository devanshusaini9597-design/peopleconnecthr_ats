import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

async function assertCandidateInOrg(candidateId: string, orgId: string) {
  return prisma.candidate.findFirst({
    where: { id: candidateId, organizationId: orgId },
    select: { id: true },
  });
}

export const GET = withAuth(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  session,
) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id } = await params;
    const candidate = await assertCandidateInOrg(id, orgId);
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const raw = await prisma.comment.findMany({
      where: { candidateId: id },
      orderBy: { createdAt: 'desc' },
    });
    const comments = raw.map((c) => ({
      id: c.id,
      candidateId: c.candidateId,
      authorName: c.authorName,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      mentions: c.mentions || [],
    }));
    return NextResponse.json({ comments });
  } catch {
    return NextResponse.json({ comments: [] }, { status: 500 });
  }
});

export const POST = withAuth(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  session,
) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id } = await params;
    const candidate = await assertCandidateInOrg(id, orgId);
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const data = await req.json();
    const comment = await prisma.comment.create({
      data: {
        candidateId: id,
        body: data.body,
        authorName: data.authorName || session.name || 'HR Manager',
        authorEmail: data.authorEmail || session.email || 'hr@company.com',
        mentions: Array.isArray(data.mentions) ? data.mentions : [],
      },
    });
    return NextResponse.json({
      id: comment.id,
      candidateId: comment.candidateId,
      authorName: comment.authorName,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      mentions: comment.mentions || [],
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/candidates/[id]/comments', error);
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
  }
});

export const DELETE = withPermission('USE_TEAM_COMMENTS', async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  session,
) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id } = await params;
    const candidate = await assertCandidateInOrg(id, orgId);
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get('commentId');
    if (!commentId) {
      return NextResponse.json({ error: 'commentId required' }, { status: 400 });
    }

    // Only delete comments belonging to this org-scoped candidate
    const comment = await prisma.comment.findFirst({
      where: { id: commentId, candidateId: id },
    });
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    await prisma.comment.delete({ where: { id: commentId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/candidates/[id]/comments', error);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
});
