import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

/**
 * DELETE /api/admin/gdpr/candidates/erase?candidateId=
 * Anonymize candidate PII (GDPR Art. 17), including DEI self-ID special-category data.
 */
export const DELETE = withPermission('MANAGE_USERS', async (request: NextRequest, _ctx, session) => {
  const orgId = requireOrgId(session);
  if (isOrgError(orgId)) return orgId;

  const { searchParams } = new URL(request.url);
  const candidateId = searchParams.get('candidateId');
  if (!candidateId) {
    return NextResponse.json({ error: 'candidateId query param is required' }, { status: 400 });
  }

  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId: orgId },
    select: { id: true },
  });

  if (!candidate) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
  }

  const anonymizedEmail = `erased-${candidateId}@gdpr.deleted`;
  const anonymizedName = '[Erased Candidate]';

  await prisma.$transaction(async (tx) => {
    await tx.candidate.update({
      where: { id: candidateId },
      data: {
        name: anonymizedName,
        email: anonymizedEmail,
        phone: null,
        avatarUrl: null,
        resumeUrl: null,
        resumeText: null,
        linkedInUrl: null,
        portfolioUrl: null,
        githubUrl: null,
        websiteUrl: null,
        location: null,
        city: null,
        country: null,
        currentTitle: null,
        currentCompany: null,
        skills: [],
        tags: [],
        smsOptIn: false,
        whatsappOptIn: false,
        phoneVerifiedAt: null,
        messagingConsentAt: null,
        messagingConsentIp: null,
        talentPoolConsent: false,
        talentPoolConsentAt: null,
        sourceDetail: null,
      },
    });

    // Erase special-category DEI self-ID (Art. 9)
    await tx.candidateSelfId.deleteMany({
      where: { candidateId, organizationId: orgId },
    });

    // Anonymize notes / comments bodies
    await tx.candidateNote.updateMany({
      where: { candidateId },
      data: { body: '[Redacted — GDPR erasure]' },
    });
    await tx.comment.updateMany({
      where: { candidateId },
      data: { body: '[Redacted — GDPR erasure]' },
    });

    // Remove resume file metadata
    await tx.resume.deleteMany({ where: { candidateId } });
  });

  await prisma.userActivityLog.create({
    data: {
      userId: session.id,
      action: 'gdpr_candidate_erase',
      metadata: { targetCandidateId: candidateId, anonymizedEmail },
    },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    message: `Candidate data for ${candidateId} has been anonymized in compliance with GDPR Article 17.`,
  });
});
