import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withPermission } from '@/lib/with-permission';

// Zapier Integration API
// POST /api/integrations/zapier/trigger - Trigger Zapier webhook
export const POST = withPermission('MANAGE_INTEGRATIONS', async (request: NextRequest) => {
  try {
    const { 
      event,
      data,
      zapId 
    } = await request.json();

    // Get Zapier webhook URL from environment or database
    const webhookUrl = process.env.ZAPIER_WEBHOOK_URL || 
      'https://hooks.zapier.com/hooks/catch/your-webhook-id';

    // Prepare payload for Zapier
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      data: {
        ...data,
        source: 'ats',
        environment: process.env.NODE_ENV,
      },
    };

    // Send to Zapier
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Zapier responded with ${response.status}`);
      }
    } catch (zapierError) {
      console.error('Zapier webhook failed:', zapierError);
      // Continue - we don't want to fail the user request if Zapier is down
    }

    // Log the trigger
    await prisma.webhookEvent.create({
      data: {
        webhookId: zapId || 'zapier-default',
        eventType: event,
        payload: payload,
        status: 'delivered',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Event "${event}" triggered successfully`,
    });
  } catch (error) {
    console.error('Error triggering Zapier:', error);
    return NextResponse.json({ error: 'Failed to trigger' }, { status: 500 });
  }
});

// GET /api/integrations/zapier/events - Get available Zapier events
export const GET = withAuth(async () => {
  const events = [
    {
      id: 'candidate.created',
      name: 'New Candidate Added',
      description: 'Triggers when a new candidate is added to the system',
      samplePayload: {
        candidate: {
          id: 'cand_123',
          name: 'John Doe',
          email: 'john@example.com',
          source: 'linkedin',
        },
      },
    },
    {
      id: 'application.submitted',
      name: 'New Application Received',
      description: 'Triggers when a candidate applies to a job',
      samplePayload: {
        application: {
          id: 'app_123',
          candidate: { name: 'John Doe', email: 'john@example.com' },
          job: { title: 'Software Engineer', department: 'Engineering' },
        },
      },
    },
    {
      id: 'interview.scheduled',
      name: 'Interview Scheduled',
      description: 'Triggers when an interview is scheduled',
      samplePayload: {
        interview: {
          id: 'int_123',
          candidate: { name: 'John Doe' },
          job: { title: 'Software Engineer' },
          startTime: '2024-01-15T14:00:00Z',
          type: 'technical',
        },
      },
    },
    {
      id: 'offer.extended',
      name: 'Offer Extended',
      description: 'Triggers when an offer letter is sent',
      samplePayload: {
        offer: {
          id: 'off_123',
          candidate: { name: 'John Doe', email: 'john@example.com' },
          job: { title: 'Software Engineer' },
          salary: 120000,
          startDate: '2024-02-01',
        },
      },
    },
    {
      id: 'candidate.hired',
      name: 'Candidate Hired',
      description: 'Triggers when a candidate is marked as hired',
      samplePayload: {
        candidate: {
          id: 'cand_123',
          name: 'John Doe',
          email: 'john@example.com',
          job: { title: 'Software Engineer' },
          hireDate: '2024-02-01',
        },
      },
    },
    {
      id: 'application.rejected',
      name: 'Application Rejected',
      description: 'Triggers when an application is rejected',
      samplePayload: {
        application: {
          id: 'app_123',
          candidate: { name: 'John Doe', email: 'john@example.com' },
          job: { title: 'Software Engineer' },
          rejectionReason: 'Not enough experience',
          stage: 'technical_interview',
        },
      },
    },
  ];

  return NextResponse.json(events);
});

// POST /api/integrations/zapier/subscribe - Subscribe to Zapier triggers
export const PATCH = withPermission('MANAGE_INTEGRATIONS', async (request: NextRequest) => {
  try {
    const { targetUrl, event, authentication } = await request.json();

    // Store subscription
    const subscription = await prisma.webhookSubscription.create({
      data: {
        url: targetUrl,
        events: [event],
        secret: authentication?.secret,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      message: `Subscribed to ${event} events`,
    });
  } catch (error) {
    console.error('Error subscribing:', error);
    return NextResponse.json({ error: 'Subscription failed' }, { status: 500 });
  }
});

// DELETE /api/integrations/zapier/unsubscribe - Unsubscribe from triggers
export const DELETE = withPermission('MANAGE_INTEGRATIONS', async (request: NextRequest) => {
  try {
    const { subscriptionId } = await request.json();

    await prisma.webhookSubscription.update({
      where: { id: subscriptionId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unsubscribing:', error);
    return NextResponse.json({ error: 'Unsubscribe failed' }, { status: 500 });
  }
});
