import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-permission';
import { sanitizeHtml } from '@/lib/sanitize';
import { requireOrgId, isOrgError } from '@/lib/require-org';

export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  session
) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id: candidateId } = await params;
    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, organizationId: orgId },
      select: { id: true },
    });
    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

    const notes = await prisma.candidateNote.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(
      notes.map((n) => ({
        id: n.id,
        authorName: n.authorName,
        body: n.body,
        createdAt: n.createdAt.toISOString(),
      }))
    );
  } catch (e) {
    console.error('GET /api/candidates/[id]/notes', e);
    return NextResponse.json({ error: 'Failed to load notes' }, { status: 500 });
  }
});

export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  session
) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { id: candidateId } = await params;
    const body = await request.json();
    const authorName = (body?.authorName ?? body?.author ?? 'Recruiter').toString().trim() || 'Recruiter';
    const noteBody = sanitizeHtml((body?.body ?? body?.text ?? '').toString().trim());
    if (!noteBody) {
      return NextResponse.json({ error: 'Body is required' }, { status: 400 });
    }
    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, organizationId: orgId },
    });
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }
    const note = await prisma.candidateNote.create({
      data: { candidateId, authorName, body: noteBody },
    });
    return NextResponse.json({
      id: note.id,
      authorName: note.authorName,
      body: note.body,
      createdAt: note.createdAt.toISOString(),
    });
  } catch (e) {
    console.error('POST /api/candidates/[id]/notes', e);
    return NextResponse.json({ error: 'Failed to add note' }, { status: 500 });
  }
});
