import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withSessionOrApiKey } from '@/lib/with-api-key';
import { requireOrgId, isOrgError } from '@/lib/require-org';

function normalizeLinkedInUrl(url: string): string {
  try {
    const u = new URL(url);
    // Keep /in/<slug> only — strip query/hash and trailing slash
    const match = u.pathname.match(/\/in\/([^/]+)/i);
    if (!match) return url.split('?')[0].replace(/\/$/, '');
    return `https://www.linkedin.com/in/${match[1].toLowerCase()}`;
  } catch {
    return url.split('?')[0].replace(/\/$/, '');
  }
}

function placeholderEmail(name: string, linkedInUrl: string): string {
  const slug =
    linkedInUrl.match(/\/in\/([^/]+)/i)?.[1]?.toLowerCase().replace(/[^a-z0-9-]/g, '') ||
    'unknown';
  const safeName = (name || 'candidate')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '')
    .slice(0, 40);
  return `${safeName || 'candidate'}.${slug}@linkedin.import.local`;
}

function parseLinkedInData(data: Record<string, unknown>) {
  const skills = Array.isArray(data.skills)
    ? data.skills.map(String).filter(Boolean).slice(0, 50)
    : [];

  let years = 0;
  if (typeof data.yearsOfExperience === 'number') years = data.yearsOfExperience;
  else if (Array.isArray(data.experience)) years = Math.min(40, data.experience.length * 2);

  const firstExp = Array.isArray(data.experience) ? (data.experience[0] as Record<string, unknown>) : null;

  return {
    name: String(data.name || data.fullName || '').trim() || 'LinkedIn Candidate',
    email: String(data.email || '').trim(),
    phone: String(data.phone || '').trim(),
    skills,
    experience: years,
    currentTitle: String(data.currentTitle || data.headline || firstExp?.title || '').trim(),
    currentCompany: String(data.currentCompany || firstExp?.company || '').trim(),
    location: String(data.location || '').trim(),
    about: String(data.about || '').trim(),
  };
}

// POST /api/linkedin/import - Import LinkedIn profile (cookie session OR Bearer API key)
export const POST = withSessionOrApiKey('CREATE_CANDIDATE', ['write'], async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const body = await request.json();
    const rawUrl = String(body.linkedInUrl || '').trim();
    if (!rawUrl || !/linkedin\.com\/in\//i.test(rawUrl)) {
      return NextResponse.json({ error: 'Valid linkedInUrl (/in/...) is required' }, { status: 400 });
    }

    const linkedInUrl = normalizeLinkedInUrl(rawUrl);
    const linkedInData = (body.linkedInData || {}) as Record<string, unknown>;
    const importedById = session.id;
    const candidateData = parseLinkedInData(linkedInData);

    // Dedupe: update existing candidate with same LinkedIn URL in this org
    const existing = await prisma.candidate.findFirst({
      where: {
        organizationId: orgId,
        OR: [
          { linkedInUrl },
          { linkedInUrl: { contains: linkedInUrl.split('/in/')[1] || linkedInUrl } },
        ],
      },
    });

    const email =
      candidateData.email ||
      existing?.email ||
      placeholderEmail(candidateData.name, linkedInUrl);

    const importRecord = await prisma.linkedInImport.create({
      data: {
        linkedInUrl,
        importedById,
        rawData: linkedInData as object,
        importStatus: 'processing',
      },
    });

    let candidate;
    let created = false;

    if (existing) {
      candidate = await prisma.candidate.update({
        where: { id: existing.id },
        data: {
          name: candidateData.name || existing.name,
          email: existing.email || email,
          phone: candidateData.phone || existing.phone,
          skills: candidateData.skills.length ? candidateData.skills : (existing.skills as string[]),
          experience: candidateData.experience || existing.experience,
          currentTitle: candidateData.currentTitle || existing.currentTitle,
          currentCompany: candidateData.currentCompany || existing.currentCompany,
          location: candidateData.location || existing.location,
          linkedInUrl,
          source: existing.source || 'linkedin',
          sourceDetail: linkedInUrl,
          resumeText: candidateData.about || existing.resumeText || undefined,
        },
      });
    } else {
      candidate = await prisma.candidate.create({
        data: {
          name: candidateData.name,
          email,
          phone: candidateData.phone || null,
          source: 'linkedin',
          sourceDetail: linkedInUrl,
          skills: candidateData.skills,
          experience: candidateData.experience,
          currentTitle: candidateData.currentTitle || null,
          currentCompany: candidateData.currentCompany || null,
          linkedInUrl,
          location: candidateData.location || null,
          resumeText: candidateData.about || null,
          organizationId: orgId,
        },
      });
      created = true;
    }

    await prisma.linkedInImport.update({
      where: { id: importRecord.id },
      data: {
        candidateId: candidate.id,
        importStatus: 'completed',
        parsedData: candidateData as object,
        processedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      created,
      updated: !created,
      candidate,
      candidateId: candidate.id,
      importId: importRecord.id,
      message: created
        ? 'Candidate imported from LinkedIn'
        : 'Existing candidate updated from LinkedIn',
    });
  } catch (error) {
    console.error('Error importing LinkedIn profile:', error);
    return NextResponse.json({ error: 'Failed to import profile' }, { status: 500 });
  }
});

// GET /api/linkedin/import - Get import history (org-scoped via candidates)
export const GET = withSessionOrApiKey(null, ['read'], async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const imports = await prisma.linkedInImport.findMany({
      where: {
        ...(userId ? { importedById: userId } : { importedById: session.id }),
        OR: [
          { candidate: { organizationId: orgId } },
          { candidateId: null },
        ],
      },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            organizationId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Extra filter: only return rows for this org (or incomplete imports by this user)
    const scoped = imports.filter(
      (i) => !i.candidate || i.candidate.organizationId === orgId
    );

    return NextResponse.json(scoped);
  } catch (error) {
    console.error('Error fetching imports:', error);
    return NextResponse.json({ error: 'Failed to fetch imports' }, { status: 500 });
  }
});
