import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Zapier Webhook Integration API
// These endpoints allow Zapier to receive webhooks from the ATS

function verifyZapierSecret(request: Request): boolean {
  const zapierSecret = process.env.ZAPIER_WEBHOOK_SECRET;
  if (!zapierSecret) return true; // Secret not configured — skip check (dev mode)
  const incomingSecret =
    request.headers.get('x-zapier-secret') ??
    request.headers.get('authorization')?.replace('Bearer ', '') ??
    '';
  return incomingSecret === zapierSecret;
}

// POST /api/zapier/webhook - Receive webhook from Zapier
export async function POST(request: Request) {
  try {
    if (!verifyZapierSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      zapId,
      event,
      data 
    } = await request.json();

    // Validate required fields
    if (!zapId || !event) {
      return NextResponse.json({ 
        error: 'Missing required fields: zapId and event' 
      }, { status: 400 });
    }

    // Log the webhook event
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        webhookId: zapId,
        eventType: event,
        payload: data || {},
        status: 'delivered',
        deliveredAt: new Date(),
      },
    });

    // Handle different event types
    switch (event) {
      case 'candidate.created':
        // Trigger Zapier action for new candidate
        await handleCandidateCreated(data);
        break;
      case 'candidate.updated':
        // Trigger Zapier action for candidate update
        await handleCandidateUpdated(data);
        break;
      case 'application.received':
        // Trigger Zapier action for new application
        await handleApplicationReceived(data);
        break;
      case 'interview.scheduled':
        // Trigger Zapier action for interview scheduling
        await handleInterviewScheduled(data);
        break;
      case 'offer.sent':
        // Trigger Zapier action for offer sent
        await handleOfferSent(data);
        break;
      case 'offer.accepted':
        // Trigger Zapier action for offer accepted
        await handleOfferAccepted(data);
        break;
      case 'stage.changed':
        // Trigger Zapier action for pipeline stage change
        await handleStageChanged(data);
        break;
      default:
        console.log(`Unhandled Zapier event type: ${event}`);
    }

    // Send to Zapier webhook URL if configured
    const zapierWebhookUrl = process.env.ZAPIER_WEBHOOK_URL;
    if (zapierWebhookUrl && data) {
      try {
        await fetch(zapierWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event,
            timestamp: new Date().toISOString(),
            data,
          }),
        });
      } catch (error) {
        console.error('Error sending to Zapier:', error);
      }
    }

    return NextResponse.json({
      success: true,
      eventId: webhookEvent.id,
      message: `Webhook processed for event: ${event}`,
    });
  } catch (error) {
    console.error('Error processing Zapier webhook:', error);
    return NextResponse.json({ 
      error: 'Failed to process webhook' 
    }, { status: 500 });
  }
}

// GET /api/zapier/webhook - Get webhook configuration
export async function GET(request: Request) {
  try {
    if (!verifyZapierSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const zapId = searchParams.get('zapId');

    if (zapId) {
      // Get events for specific Zap
      const events = await prisma.webhookEvent.findMany({
        where: { webhookId: zapId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return NextResponse.json({ zapId, events });
    }

    // Get all Zapier webhooks
    const webhooks = await prisma.webhook.findMany({
      where: {
        url: { contains: 'zapier' },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ webhooks });
  } catch (error) {
    console.error('Error fetching Zapier webhooks:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch webhooks' 
    }, { status: 500 });
  }
}

// Event Handlers
async function handleCandidateCreated(data: any) {
  // Implement logic for candidate creation
  // e.g., send notification to Slack, update CRM, etc.
  console.log('Candidate created event:', data);
}

async function handleCandidateUpdated(data: any) {
  // Implement logic for candidate update
  console.log('Candidate updated event:', data);
}

async function handleApplicationReceived(data: any) {
  // Implement logic for new application
  console.log('Application received event:', data);
}

async function handleInterviewScheduled(data: any) {
  // Implement logic for interview scheduling
  console.log('Interview scheduled event:', data);
}

async function handleOfferSent(data: any) {
  // Implement logic for offer sent
  console.log('Offer sent event:', data);
}

async function handleOfferAccepted(data: any) {
  // Implement logic for offer accepted
  console.log('Offer accepted event:', data);
}

async function handleStageChanged(data: any) {
  // Implement logic for stage change
  console.log('Stage changed event:', data);
}
