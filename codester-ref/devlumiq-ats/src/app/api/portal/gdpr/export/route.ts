import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePortalUser } from '@/lib/portal-auth';

/**
 * GET /api/portal/gdpr/export
 * Candidate self-service data export (GDPR Art. 20).
 */
export async function GET(request: NextRequest) {
  const auth = await requirePortalUser(request);
  if ('error' in auth) return auth.error;

  const { user } = auth;
  const candidate = user.linkedCandidate;

  if (!candidate) {
    // Export portal account only
    const apps = await prisma.application.findMany({
      where: { portalUserId: user.id },
      include: { job: { select: { id: true, title: true, department: true } } },
    });
    const payload = {
      exportedAt: new Date().toISOString(),
      subjectType: 'portal_user',
      portalUser: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      applications: apps,
    };
    await prisma.candidateActivityLog.create({
      data: {
        candidateId: user.id,
        type: 'gdpr_export',
        description: 'Candidate exported their portal data',
      },
    }).catch(() => {});

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="gdpr-portal-${user.id}-${Date.now()}.json"`,
      },
    });
  }

  const full = await prisma.candidate.findFirst({
    where: { id: candidate.id },
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

  if (!full) {
    return NextResponse.json({ error: 'Candidate record not found' }, { status: 404 });
  }

  const orgId = full.organizationId;
  const selfIds = orgId
    ? await prisma.candidateSelfId.findMany({
        where: { candidateId: full.id, organizationId: orgId },
      })
    : [];

  const offerLetters = await prisma.offerLetter
    .findMany({
      where: { candidateId: full.id },
      select: {
        id: true,
        status: true,
        createdAt: true,
        salary: true,
        currency: true,
        startDate: true,
      },
    })
    .catch(() => []);

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    exportedBy: user.email,
    subjectType: 'candidate_self_service',
    portalUser: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
    },
    subject: {
      id: full.id,
      name: full.name,
      email: full.email,
      phone: full.phone,
      location: full.location,
      city: full.city,
      country: full.country,
      source: full.source,
      linkedInUrl: full.linkedInUrl,
      portfolioUrl: full.portfolioUrl,
      githubUrl: full.githubUrl,
      websiteUrl: full.websiteUrl,
      resumeUrl: full.resumeUrl,
      skills: full.skills,
      tags: full.tags,
      experience: full.experience,
      currentTitle: full.currentTitle,
      currentCompany: full.currentCompany,
      smsOptIn: full.smsOptIn,
      whatsappOptIn: full.whatsappOptIn,
      talentPoolConsent: full.talentPoolConsent,
      talentPoolConsentAt: full.talentPoolConsentAt,
      createdAt: full.createdAt,
      updatedAt: full.updatedAt,
    },
    applications: full.applications,
    notes: full.notes,
    comments: full.comments,
    resumes: full.resumes,
    interviews: full.interviews,
    offerLetters,
    deiSelfIdentification: selfIds,
  };

  await prisma.candidateActivityLog.create({
    data: {
      candidateId: user.id,
      type: 'gdpr_export',
      description: 'Candidate exported their personal data (Art. 20)',
      metadata: { candidateId: full.id },
    },
  }).catch(() => {});

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="gdpr-candidate-${full.id}-${Date.now()}.json"`,
    },
  });
}
