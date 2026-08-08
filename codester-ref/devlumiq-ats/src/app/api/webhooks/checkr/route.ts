import { createHmac } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isProduction, safeEqual } from '@/lib/webhook-auth';

function verifyCheckrSignature(rawBody: string, signature: string, secret: string): boolean {
  try {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    return safeEqual(expected, signature);
  } catch {
    return false;
  }
}

/**
 * Fail-closed Checkr webhook auth (same pattern as Twilio/WhatsApp helpers):
 * - Production: CHECKR_WEBHOOK_SECRET must be set AND signature must match
 * - Development: if secret unset, allow; if set, must match
 */
function requireCheckrSignature(
  rawBody: string,
  signature: string | null,
): NextResponse | null {
  const webhookSecret = process.env.CHECKR_WEBHOOK_SECRET || '';

  if (!webhookSecret) {
    if (isProduction()) {
      return NextResponse.json(
        { error: 'CHECKR_WEBHOOK_SECRET is required in production', code: 'SECRET_NOT_CONFIGURED' },
        { status: 503 },
      );
    }
    return null; // local/dev: open when unset
  }

  if (!signature || !verifyCheckrSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }
  return null;
}

// POST /api/webhooks/checkr - Handle Checkr webhook events
// This endpoint receives real-time updates from Checkr when background check status changes

export async function POST(request: Request) {
  try {
    const signature = request.headers.get('X-Checkr-Signature');
    const rawBody = await request.text();

    const authError = requireCheckrSignature(rawBody, signature);
    if (authError) return authError;

    const payload = JSON.parse(rawBody);
    const { type, data } = payload;

    console.log('Checkr webhook received:', { type, eventId: data?.id });

    // Handle different event types
    switch (type) {
      case 'report.completed':
        await handleReportCompleted(data);
        break;
        
      case 'report.clear':
        await handleReportClear(data);
        break;
        
      case 'report.consider':
        await handleReportConsider(data);
        break;
        
      case 'invitation.completed':
        await handleInvitationCompleted(data);
        break;
        
      case 'invitation.expired':
        await handleInvitationExpired(data);
        break;
        
      case 'candidate.created':
        await handleCandidateCreated(data);
        break;
        
      case 'report.dispute.created':
        await handleDisputeCreated(data);
        break;
        
      case 'report.dispute.resolved':
        await handleDisputeResolved(data);
        break;
        
      default:
        console.log(`Unhandled Checkr event type: ${type}`);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ 
      success: true, 
      received: true,
      eventType: type 
    });
  } catch (error) {
    console.error('Error processing Checkr webhook:', error);
    // Still return 200 to prevent Checkr from retrying
    return NextResponse.json({ 
      success: false, 
      error: 'Error processing webhook' 
    }, { status: 200 });
  }
}

// GET /api/webhooks/checkr - Verify webhook endpoint (for Checkr dashboard)
export async function GET(request: Request) {
  return NextResponse.json({ 
    status: 'active',
    message: 'Checkr webhook endpoint is ready',
    timestamp: new Date().toISOString(),
  });
}

// Event Handlers

async function handleReportCompleted(data: any) {
  const { id, candidate_id, status, adjudication, completed_at, package: pkg } = data;
  
  // Find background check by provider candidate ID
  const bgCheck = await prisma.backgroundCheck.findFirst({
    where: { providerCandidateId: candidate_id },
  });

  if (!bgCheck) {
    console.warn(`No background check found for Checkr candidate ${candidate_id}`);
    return;
  }

  await prisma.backgroundCheck.update({
    where: { id: bgCheck.id },
    data: {
      status: 'complete',
      completedAt: completed_at ? new Date(completed_at) : new Date(),
      resultSummary: adjudication,
      rawResults: {
        reportId: id,
        adjudication,
        package: pkg,
        completedAt: completed_at,
      },
    },
  });

  // Create notification for recruiters
  await createNotification({
    type: 'background_check_complete',
    candidateId: bgCheck.candidateId,
    message: `Background check completed for candidate. Status: ${adjudication || status}`,
    metadata: { checkId: bgCheck.id, reportId: id },
  });
}

async function handleReportClear(data: any) {
  const { id, candidate_id, completed_at } = data;
  
  const bgCheck = await prisma.backgroundCheck.findFirst({
    where: { providerCandidateId: candidate_id },
  });

  if (!bgCheck) return;

  await prisma.backgroundCheck.update({
    where: { id: bgCheck.id },
    data: {
      status: 'clear',
      completedAt: completed_at ? new Date(completed_at) : new Date(),
      resultSummary: 'clear',
      rawResults: {
        reportId: id,
        adjudication: 'clear',
        completedAt: completed_at,
      },
    },
  });

  await createNotification({
    type: 'background_check_clear',
    candidateId: bgCheck.candidateId,
    message: 'Background check cleared - candidate approved',
    metadata: { checkId: bgCheck.id },
  });
}

async function handleReportConsider(data: any) {
  const { id, candidate_id, report_items, completed_at } = data;
  
  const bgCheck = await prisma.backgroundCheck.findFirst({
    where: { providerCandidateId: candidate_id },
  });

  if (!bgCheck) return;

  await prisma.backgroundCheck.update({
    where: { id: bgCheck.id },
    data: {
      status: 'consider',
      completedAt: completed_at ? new Date(completed_at) : new Date(),
      resultSummary: 'consider',
      rawResults: {
        reportId: id,
        adjudication: 'consider',
        flags: report_items,
        completedAt: completed_at,
      },
    },
  });

  await createNotification({
    type: 'background_check_consider',
    candidateId: bgCheck.candidateId,
    message: 'Background check completed with items to review',
    priority: 'high',
    metadata: { checkId: bgCheck.id, flags: report_items },
  });
}

async function handleInvitationCompleted(data: any) {
  const { id, candidate_id } = data;
  
  const bgCheck = await prisma.backgroundCheck.findFirst({
    where: { providerInvitationId: id },
  });

  if (bgCheck) {
    await prisma.backgroundCheck.update({
      where: { id: bgCheck.id },
      data: {
        status: 'in_progress',
      },
    });
  }
}

async function handleInvitationExpired(data: any) {
  const { id } = data;
  
  const bgCheck = await prisma.backgroundCheck.findFirst({
    where: { providerInvitationId: id },
  });

  if (bgCheck) {
    await prisma.backgroundCheck.update({
      where: { id: bgCheck.id },
      data: {
        status: 'expired',
      },
    });
  }
}

async function handleCandidateCreated(data: any) {
  // Log new Checkr candidate creation
  console.log('Checkr candidate created:', data.id);
}

async function handleDisputeCreated(data: any) {
  const { report_id, candidate_id, reason } = data;
  
  const bgCheck = await prisma.backgroundCheck.findFirst({
    where: { providerCandidateId: candidate_id },
  });

  if (bgCheck) {
    await prisma.backgroundCheck.update({
      where: { id: bgCheck.id },
      data: {
        status: 'dispute',
        notes: `Dispute filed: ${reason}`,
      },
    });
  }
}

async function handleDisputeResolved(data: any) {
  const { report_id, candidate_id, resolution } = data;
  
  const bgCheck = await prisma.backgroundCheck.findFirst({
    where: { providerCandidateId: candidate_id },
  });

  if (bgCheck) {
    await prisma.backgroundCheck.update({
      where: { id: bgCheck.id },
      data: {
        status: resolution === 'upheld' ? 'consider' : 'clear',
        notes: `Dispute resolved: ${resolution}`,
      },
    });
  }
}

// Helper: Create notification
async function createNotification({
  type,
  candidateId,
  message,
  priority = 'medium',
  metadata,
}: {
  type: string;
  candidateId: string;
  message: string;
  priority?: string;
  metadata?: any;
}) {
  try {
    await prisma.notification.create({
      data: {
        type,
        title: 'Background Check Update',
        message,
        candidateId,
        priority,
        metadata,
        isRead: false,
      },
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

