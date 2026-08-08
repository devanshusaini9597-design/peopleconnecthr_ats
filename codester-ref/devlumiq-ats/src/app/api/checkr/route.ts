import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

// Checkr API Configuration
const CHECKR_API_URL = process.env.CHECKR_API_URL || 'https://api.checkr.com/v1';
const CHECKR_API_KEY = process.env.CHECKR_API_KEY || '';

// Helper function for Checkr API calls
async function checkrApi(endpoint: string, options: RequestInit = {}) {
  const url = `${CHECKR_API_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Token ${CHECKR_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Checkr API error: ${response.status}`);
  }

  return response.json();
}

// POST /api/checkr - Create a background check
export const POST = withPermission('VIEW_BACKGROUND_CHECKS', async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    if (!CHECKR_API_KEY) {
      return NextResponse.json(
        { error: 'Checkr API not configured. Missing CHECKR_API_KEY.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { 
      candidateId, 
      candidateEmail,
      candidatePhone,
      candidateName,
      packageType = 'standard',
      customPackages,
      workflowId,
    } = body;

    if (!candidateId) {
      return NextResponse.json({ error: 'candidateId is required' }, { status: 400 });
    }

    const ownedCandidate = await prisma.candidate.findFirst({
      where: { id: candidateId, organizationId: orgId },
      select: { id: true, name: true, email: true, phone: true },
    });
    if (!ownedCandidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const resolvedName = candidateName || ownedCandidate.name || '';
    const resolvedEmail = candidateEmail || ownedCandidate.email;
    const resolvedPhone = candidatePhone || ownedCandidate.phone;

    // Create Checkr candidate first
    const nameParts = resolvedName.split(' ') || ['', ''];
    const candidateData = await checkrApi('/candidates', {
      method: 'POST',
      body: JSON.stringify({
        first_name: nameParts[0],
        last_name: nameParts.slice(1).join(' ') || 'Unknown',
        email: resolvedEmail,
        phone: resolvedPhone,
        // Add any additional metadata
        metadata: {
          ats_candidate_id: candidateId,
        },
      }),
    });

    // Create background check (invitation)
    const invitationData = await checkrApi('/invitations', {
      method: 'POST',
      body: JSON.stringify({
        candidate_id: candidateData.id,
        package: packageType,
        ...(customPackages && { package_ids: customPackages }),
        ...(workflowId && { workflow_id: workflowId }),
        // Options for candidate experience
        email: resolvedEmail,
        custom_message: {
          subject: 'Background Check Required',
          body: 'Please complete the background check process by clicking the link below.',
        },
      }),
    });

    // Create record in database
    const bgCheck = await prisma.backgroundCheck.create({
      data: {
        candidateId,
        provider: 'CHECKR',
        providerCandidateId: candidateData.id,
        providerInvitationId: invitationData.id,
        status: 'pending',
        packageType,
        invitationUrl: invitationData.invitation_url,
        expiresAt: invitationData.expires_at ? new Date(invitationData.expires_at) : null,
        checkTypes: ['criminal', 'employment', 'education', 'mvr'], // Based on package
      },
    });

    return NextResponse.json({
      success: true,
      backgroundCheckId: bgCheck.id,
      checkrCandidateId: candidateData.id,
      invitationId: invitationData.id,
      invitationUrl: invitationData.invitation_url,
      message: 'Background check invitation sent successfully',
    });
  } catch (error) {
    console.error('Error creating Checkr background check:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create background check' },
      { status: 500 }
    );
  }
});


// GET /api/checkr - List background checks
export const GET = withAuth(async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { searchParams } = new URL(request.url);
    const candidateId = searchParams.get('candidateId');
    const status = searchParams.get('status');

    const checks = await prisma.backgroundCheck.findMany({
      where: {
        ...(candidateId && { candidateId }),
        ...(status && { status }),
        provider: 'CHECKR',
        candidate: { organizationId: orgId },
      },
      include: {
        candidate: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });


    // If real-time sync is needed, fetch from Checkr API
    if (CHECKR_API_KEY) {
      const syncedChecks = await Promise.all(
        checks.map(async (check) => {
          if (check.providerInvitationId && !['complete', 'clear', 'dispute'].includes(check.status)) {
            try {
              const checkrData = await checkrApi(`/invitations/${check.providerInvitationId}`);
              
              // Update if status changed
              if (checkrData.status !== check.status) {
                await prisma.backgroundCheck.update({
                  where: { id: check.id },
                  data: {
                    status: mapCheckrStatus(checkrData.status),
                    completedAt: checkrData.completed_at ? new Date(checkrData.completed_at) : null,
                  },
                });
              }
              
              return {
                ...check,
                status: mapCheckrStatus(checkrData.status),
                checkrData,
              };
            } catch (error) {
              console.error(`Error syncing Checkr data for check ${check.id}:`, error);
              return check;
            }
          }
          return check;
        })
      );
      
      return NextResponse.json({
        success: true,
        checks: syncedChecks,
      });
    }

    return NextResponse.json({
      success: true,
      checks,
    });
  } catch (error) {
    console.error('Error fetching background checks:', error);
    return NextResponse.json({ success: true, checks: [] }, { status: 500 });
  }
});

// PATCH /api/checkr - Update background check status
export const PATCH = withPermission('RUN_BACKGROUND_CHECKS', async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { checkId, status, reportUrl, notes } = await request.json();

    if (!checkId) {
      return NextResponse.json({ error: 'checkId is required' }, { status: 400 });
    }

    const existing = await prisma.backgroundCheck.findFirst({
      where: {
        id: checkId,
        candidate: { organizationId: orgId },
      },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Background check not found' }, { status: 404 });
    }

    const updateData: {
      status: string;
      updatedAt: Date;
      reportUrl?: string;
      notes?: string;
      completedAt?: Date;
    } = {
      status,
      updatedAt: new Date(),
    };

    if (reportUrl) updateData.reportUrl = reportUrl;
    if (notes) updateData.notes = notes;
    if (status === 'complete' || status === 'clear' || status === 'consider') {
      updateData.completedAt = new Date();
    }

    const updatedCheck = await prisma.backgroundCheck.update({
      where: { id: checkId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      check: updatedCheck,
      message: 'Background check updated successfully',
    });
  } catch (error) {
    console.error('Error updating background check:', error);
    return NextResponse.json(
      { error: 'Failed to update background check' },
      { status: 500 }
    );
  }
});

// Helper: Map Checkr status to our status
function mapCheckrStatus(checkrStatus: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'pending',
    'in_progress': 'in_progress',
    'complete': 'complete',
    'clear': 'clear',
    'consider': 'consider',
    'dispute': 'dispute',
    'expired': 'expired',
    'suspended': 'suspended',
  };
  
  return statusMap[checkrStatus] || checkrStatus;
}
