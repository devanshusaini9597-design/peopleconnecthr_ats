import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { validateCsrf } from '@/lib/csrf';
import { requireOrgId, isOrgError } from '@/lib/require-org';

/** POST — set talentPoolConsent on a candidate (GDPR retention opt-in) */
export const POST = withPermission('EDIT_CANDIDATE', async (req: NextRequest, _ctx, session) => {
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const body = await req.json();
    const candidateId = typeof body.candidateId === 'string' ? body.candidateId : '';
    const consent = body.consent !== false;

    if (!candidateId) {
      return NextResponse.json({ error: 'candidateId required' }, { status: 400 });
    }

    const candidate = await prisma.candidate.findFirst({
      where: {
        id: candidateId,
        organizationId: orgId,
      },
    });
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const updated = await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        talentPoolConsent: consent,
        talentPoolConsentAt: consent ? new Date() : null,
      },
      select: { id: true, talentPoolConsent: true, talentPoolConsentAt: true },
    });

    return NextResponse.json({ candidate: updated });
  } catch (e) {
    console.error('POST /api/talent-pools/consent', e);
    return NextResponse.json({ error: 'Failed to update consent' }, { status: 500 });
  }
});
