import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePortalUser } from '@/lib/portal-auth';

/**
 * POST /api/portal/gdpr/erase
 * Body: { confirmation: "DELETE MY DATA" }
 * Candidate self-service erasure (GDPR Art. 17).
 */
export async function POST(request: NextRequest) {
  const auth = await requirePortalUser(request);
  if ('error' in auth) return auth.error;

  const { user } = auth;
  const body = await request.json().catch(() => ({}));
  if (body?.confirmation !== 'DELETE MY DATA') {
    return NextResponse.json(
      { error: 'Type DELETE MY DATA to confirm erasure' },
      { status: 400 }
    );
  }

  const candidate = user.linkedCandidate;

  if (candidate) {
    const candidateId = candidate.id;
    const orgId = candidate.organizationId;
    const anonymizedEmail = `erased-${candidateId}@gdpr.deleted`;

    await prisma.$transaction(async (tx) => {
      await tx.candidate.update({
        where: { id: candidateId },
        data: {
          name: '[Erased Candidate]',
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
          portalUserId: null,
        },
      });

      if (orgId) {
        await tx.candidateSelfId.deleteMany({
          where: { candidateId, organizationId: orgId },
        });
      }

      await tx.candidateNote.updateMany({
        where: { candidateId },
        data: { body: '[Redacted — GDPR erasure]' },
      });
      await tx.comment.updateMany({
        where: { candidateId },
        data: { body: '[Redacted — GDPR erasure]' },
      });
      await tx.resume.deleteMany({ where: { candidateId } });
    });
  }

  await prisma.candidateActivityLog.create({
    data: {
      candidateId: user.id,
      type: 'gdpr_erase',
      description: 'Candidate requested erasure of personal data (Art. 17)',
    },
  }).catch(() => {});

  // Anonymize portal account so login no longer reveals PII
  const erasedPortalEmail = `erased-portal-${user.id}@gdpr.deleted`;
  await prisma.candidatePortalUser.update({
    where: { id: user.id },
    data: {
      email: erasedPortalEmail,
      name: '[Erased]',
      phone: null,
      password: '!', // unusable
      isVerified: false,
      verificationToken: null,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  const res = NextResponse.json({
    success: true,
    message: 'Your personal data has been anonymized in compliance with GDPR Article 17.',
  });
  // Clear portal cookie if present
  res.cookies.set('portal_session', '', { httpOnly: true, maxAge: 0, path: '/' });
  return res;
}
