import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

// Checkr API Integration
const CHECKR_API_URL = process.env.CHECKR_API_URL || 'https://api.checkr.com/v1';
const CHECKR_API_KEY = process.env.CHECKR_API_KEY;

/** Call real Checkr API. Throws on failure. */
async function callCheckrApi(candidate: { name: string }, email: string | null, checkTypes: string[]): Promise<string> {
  if (!CHECKR_API_KEY) throw new Error('CHECKR_API_KEY not set');
  const [firstName, ...rest] = candidate.name.trim().split(' ');
  const lastName = rest.join(' ') || firstName;

  // 1. Create candidate
  const basicAuth = Buffer.from(`${CHECKR_API_KEY}:`).toString('base64');
  const headers = { 'Authorization': `Basic ${basicAuth}`, 'Content-Type': 'application/json' };

  const candRes = await fetch(`${CHECKR_API_URL}/candidates`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ first_name: firstName, last_name: lastName, ...(email ? { email } : {}) }),
  });
  if (!candRes.ok) throw new Error(`Checkr candidate creation failed: ${candRes.status}`);
  const { id: checkrCandidateId } = await candRes.json() as { id: string };

  // 2. Create report
  const pkg = checkTypes.includes('employment') ? 'driver_standard' : 'tasker_standard';
  const reportRes = await fetch(`${CHECKR_API_URL}/reports`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ package: pkg, candidate_id: checkrCandidateId }),
  });
  if (!reportRes.ok) throw new Error(`Checkr report creation failed: ${reportRes.status}`);
  const { id: reportId } = await reportRes.json() as { id: string };
  return reportId;
}

// POST /api/background-checks/request - Initiate background check
export const POST = withPermission('RUN_BACKGROUND_CHECKS', async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { 
      candidateId, 
      applicationId,
      requestedById,
      checkTypes = ['criminal', 'employment', 'education'],
    } = await request.json();

    // Get candidate details — org-scoped
    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, organizationId: orgId },
    });

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // Create background check record
    const bgCheck = await prisma.backgroundCheck.create({
      data: {
        candidateId,
        applicationId,
        provider: 'CHECKR',
        status: 'pending',
        requestedById,
        checkTypes,
        consentObtained: true,
      },
    });

    // Attempt real Checkr API call; fall back to stub if key not configured
    let externalId = `stub-${Date.now()}`;
    if (CHECKR_API_KEY) {
      try {
        const email = (candidate as { email?: string }).email ?? null;
        externalId = await callCheckrApi(candidate, email, checkTypes);
      } catch (checkrErr) {
        console.error('[Checkr] API call failed, using stub:', checkrErr);
      }
    }

    await prisma.backgroundCheck.update({
      where: { id: bgCheck.id },
      data: { externalId },
    });

    return NextResponse.json({
      success: true,
      backgroundCheckId: bgCheck.id,
      message: 'Background check initiated',
    });
  } catch (error) {
    console.error('Error initiating background check:', error);
    return NextResponse.json({ error: 'Failed to initiate check' }, { status: 500 });
  }
});

// GET /api/background-checks/request - Get background check status
export const GET = withAuth(async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { searchParams } = new URL(request.url);
    const candidateId = searchParams.get('candidateId');
    const orgFilter = { candidate: { organizationId: orgId } };

    const checks = await prisma.backgroundCheck.findMany({
      where: { ...orgFilter, ...(candidateId ? { candidateId } : {}) },
      include: {
        candidate: {
          select: { id: true, name: true, email: true },
        },
        application: {
          select: {
            job: {
              select: { title: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(checks);
  } catch (error) {
    console.error('Error fetching background checks:', error);
    return NextResponse.json({ error: 'Failed to fetch checks' }, { status: 500 });
  }
});

// NOTE: Checkr webhooks are handled at /api/webhooks/checkr (HMAC-verified).
// Do not add a staff-authenticated "webhook" handler here — Checkr's servers
// cannot present a session cookie.
