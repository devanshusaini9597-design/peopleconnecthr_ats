import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function verifyDocuSignSignature(rawBody: string, signature: string, secret: string): boolean {
  try {
    const expected = createHmac('sha256', secret).update(rawBody).digest('base64');
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);
    if (expectedBuf.length !== signatureBuf.length) return false;
    return timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
}

// POST /api/webhooks/docusign - Handle DocuSign Connect webhook events
// This endpoint receives envelope status updates from DocuSign

export async function POST(request: Request) {
  try {
    const webhookSecret = process.env.DOCUSIGN_WEBHOOK_SECRET;
    const signature = request.headers.get('X-DocuSign-Signature-1');

    const rawBody = await request.text();

    if (webhookSecret) {
      if (!signature || !verifyDocuSignSignature(rawBody, signature, webhookSecret)) {
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);
    
    // DocuSign Connect sends an array of events
    const events = Array.isArray(payload) ? payload : [payload];
    
    console.log(`Received ${events.length} DocuSign webhook event(s)`);

    for (const event of events) {
      await processDocuSignEvent(event);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ 
      success: true, 
      received: true,
      processed: events.length 
    });
  } catch (error) {
    console.error('Error processing DocuSign webhook:', error);
    // Still return 200 to prevent DocuSign from retrying
    return NextResponse.json({ 
      success: false, 
      error: 'Error processing webhook' 
    }, { status: 200 });
  }
}

// GET /api/webhooks/docusign - Verify webhook endpoint
export async function GET(request: Request) {
  return NextResponse.json({ 
    status: 'active',
    message: 'DocuSign Connect webhook endpoint is ready',
    timestamp: new Date().toISOString(),
    docs: 'Configure this URL in your DocuSign Connect settings',
  });
}

// Process individual DocuSign event
async function processDocuSignEvent(event: any) {
  const { 
    event: eventType, 
    apiVersion, 
    uri, 
    retryCount,
    configurationId,
    generatedDateTime,
    data 
  } = event;

  console.log('Processing DocuSign event:', {
    type: eventType,
    envelopeId: data?.envelopeId,
    status: data?.envelopeSummary?.status,
  });

  const envelopeId = data?.envelopeId || data?.envelopeSummary?.envelopeId;
  
  if (!envelopeId) {
    console.warn('No envelope ID found in DocuSign event');
    return;
  }

  // Find eSignature record by external ID
  const eSignature = await prisma.eSignatureRequest.findFirst({
    where: { externalId: envelopeId },
    include: { candidate: true },
  });

  if (!eSignature) {
    console.warn(`No eSignature record found for envelope ${envelopeId}`);
    return;
  }

  const envelopeStatus = data?.envelopeSummary?.status || eventType;

  switch (envelopeStatus) {
    case 'completed':
    case 'EnvelopeComplete':
      await handleEnvelopeCompleted(eSignature, data);
      break;
      
    case 'sent':
    case 'EnvelopeSent':
      await handleEnvelopeSent(eSignature, data);
      break;
      
    case 'delivered':
    case 'EnvelopeDelivered':
      await handleEnvelopeDelivered(eSignature, data);
      break;
      
    case 'declined':
    case 'EnvelopeDeclined':
      await handleEnvelopeDeclined(eSignature, data);
      break;
      
    case 'voided':
    case 'EnvelopeVoided':
      await handleEnvelopeVoided(eSignature, data);
      break;
      
    case 'deleted':
    case 'EnvelopeDeleted':
      await handleEnvelopeDeleted(eSignature, data);
      break;
      
    default:
      console.log(`Unhandled DocuSign status: ${envelopeStatus}`);
  }
}

async function handleEnvelopeCompleted(eSignature: any, data: any) {
  const recipients = data?.envelopeSummary?.recipients || {};
  const signers = recipients?.signers || [];
  const completedSigners = signers.filter((s: any) => s.status === 'completed');
  
  // Get signed document URLs
  const documents = data?.envelopeSummary?.envelopeDocuments || [];
  const certificateUrl = documents.find((d: any) => d.type === 'summary')?.PDFBytes;
  const signedDoc = documents.find((d: any) => d.type === 'content');

  await prisma.eSignatureRequest.update({
    where: { id: eSignature.id },
    data: {
      status: 'completed',
      completedAt: new Date(),
      signedDocumentUrl: signedDoc?.PDFBytes || null,
      certificateUrl: certificateUrl || null,
      metadata: {
        ...eSignature.metadata,
        signers: completedSigners.map((s: any) => ({
          name: s.name,
          email: s.email,
          signedAt: s.signedDateTime,
          ipAddress: s.ipAddress,
        })),
        completedAt: new Date().toISOString(),
      },
    },
  });

  // Note: Candidate status is tracked via applications, not a direct field
  // In production, you might update the application stage here

  await createNotification({
    type: 'esignature_completed',
    candidateId: eSignature.candidateId,
    message: `Document signed by ${completedSigners[0]?.name || 'candidate'}`,
    metadata: { eSignatureId: eSignature.id, envelopeId: data?.envelopeSummary?.envelopeId },
  });
}

async function handleEnvelopeSent(eSignature: any, data: any) {
  await prisma.eSignatureRequest.update({
    where: { id: eSignature.id },
    data: {
      status: 'sent',
      sentAt: new Date(),
      externalId: data?.envelopeSummary?.envelopeId,
    },
  });
}

async function handleEnvelopeDelivered(eSignature: any, data: any) {
  await prisma.eSignatureRequest.update({
    where: { id: eSignature.id },
    data: {
      status: 'delivered',
      deliveredAt: new Date(),
    },
  });

  await createNotification({
    type: 'esignature_delivered',
    candidateId: eSignature.candidateId,
    message: 'Document delivered to candidate for signing',
    metadata: { eSignatureId: eSignature.id },
  });
}

async function handleEnvelopeDeclined(eSignature: any, data: any) {
  const recipients = data?.envelopeSummary?.recipients || {};
  const signers = recipients?.signers || [];
  const declinedSigner = signers.find((s: any) => s.status === 'declined');

  await prisma.eSignatureRequest.update({
    where: { id: eSignature.id },
    data: {
      status: 'declined',
      declinedAt: new Date(),
      declineReason: declinedSigner?.declinedReason || 'No reason provided',
      metadata: {
        ...eSignature.metadata,
        declinedBy: declinedSigner?.name,
        declinedEmail: declinedSigner?.email,
        declinedAt: new Date().toISOString(),
        declineReason: declinedSigner?.declinedReason,
      },
    },
  });

  await createNotification({
    type: 'esignature_declined',
    candidateId: eSignature.candidateId,
    message: `Document declined: ${declinedSigner?.declinedReason || 'No reason provided'}`,
    priority: 'high',
    metadata: { eSignatureId: eSignature.id },
  });
}

async function handleEnvelopeVoided(eSignature: any, data: any) {
  await prisma.eSignatureRequest.update({
    where: { id: eSignature.id },
    data: {
      status: 'voided',
      voidedAt: new Date(),
      voidReason: data?.envelopeSummary?.voidedReason || 'No reason provided',
    },
  });
}

async function handleEnvelopeDeleted(eSignature: any, data: any) {
  await prisma.eSignatureRequest.update({
    where: { id: eSignature.id },
    data: {
      status: 'deleted',
      deletedAt: new Date(),
    },
  });
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
        title: 'E-Signature Update',
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
