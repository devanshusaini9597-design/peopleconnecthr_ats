import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

/**
 * GET /api/admin/gdpr/candidates/export?candidateId=
 * Export all personal data for a candidate (GDPR Art. 20), including DEI self-ID.
 */
export const GET = withPermission('MANAGE_USERS', async (request: NextRequest, _ctx, session) => {
  const orgId = requireOrgId(session);
  if (isOrgError(orgId)) return orgId;

  const { searchParams } = new URL(request.url);
  const candidateId = searchParams.get('candidateId');
  if (!candidateId) {
    return NextResponse.json({ error: 'candidateId query param is required' }, { status: 400 });
  }

  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId: orgId },
    include: {
      applications: {
        include: { job: { select: { id: true, title: true, department: true } } },
      },
      notes: { select: { id: true, body: true, authorName: true, createdAt: true } },
      comments: { select: { id: true, body: true, authorName: true, createdAt: true } },
      resumes: {
        select: { id: true, fileName: true, fileUrl: true, mimeType: true, createdAt: true },
      },
      interviews: {
        select: { id: true, start: true, status: true, type: true },
      },
    },
  });

  if (!candidate) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
  }

  const selfIds = await prisma.candidateSelfId.findMany({
    where: { candidateId, organizationId: orgId },
  });

  const offerLetters = await prisma.offerLetter.findMany({
    where: { candidateId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      salary: true,
      currency: true,
      startDate: true,
    },
  }).catch(() => []);

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    exportedBy: session.email,
    subjectType: 'candidate',
    subject: {
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone,
      location: candidate.location,
      city: candidate.city,
      country: candidate.country,
      source: candidate.source,
      linkedInUrl: candidate.linkedInUrl,
      portfolioUrl: candidate.portfolioUrl,
      githubUrl: candidate.githubUrl,
      websiteUrl: candidate.websiteUrl,
      resumeUrl: candidate.resumeUrl,
      skills: candidate.skills,
      tags: candidate.tags,
      experience: candidate.experience,
      currentTitle: candidate.currentTitle,
      currentCompany: candidate.currentCompany,
      smsOptIn: candidate.smsOptIn,
      whatsappOptIn: candidate.whatsappOptIn,
      phoneVerifiedAt: candidate.phoneVerifiedAt,
      messagingConsentAt: candidate.messagingConsentAt,
      talentPoolConsent: candidate.talentPoolConsent,
      talentPoolConsentAt: candidate.talentPoolConsentAt,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    },
    applications: candidate.applications,
    notes: candidate.notes,
    comments: candidate.comments,
    resumes: candidate.resumes,
    interviews: candidate.interviews,
    offerLetters,
    // Special-category data (GDPR Art. 9) — voluntary DEI self-ID
    deiSelfIdentification: selfIds,
  };

  await prisma.userActivityLog.create({
    data: {
      userId: session.id,
      action: 'gdpr_candidate_export',
      metadata: { targetCandidateId: candidateId },
    },
  }).catch(() => {});

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="gdpr-candidate-${candidateId}-${Date.now()}.json"`,
    },
  });
});
