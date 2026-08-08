import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

// POST /api/esignature/send - Send document for signature
export const POST = withPermission('USE_ESIGNATURE', async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const {
      candidateId,
      offerLetterId,
      templateId,
      emailSubject,
      emailBody,
      documents,
      recipients,
    } = await request.json();

    if (!candidateId) {
      return NextResponse.json({ error: 'candidateId is required' }, { status: 400 });
    }

    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, organizationId: orgId },
    });

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    if (offerLetterId) {
      const offer = await prisma.offerLetter.findFirst({
        where: {
          id: offerLetterId,
          candidate: { organizationId: orgId },
        },
        select: { id: true },
      });
      if (!offer) {
        return NextResponse.json({ error: 'Offer letter not found' }, { status: 404 });
      }
    }

    const eSignature = await prisma.eSignatureRequest.create({
      data: {
        candidateId,
        offerLetterId,
        provider: 'DOCUSIGN',
        status: 'sent',
        documentUrl: documents?.[0]?.url || '',
        sentAt: new Date(),
        metadata: {
          templateId,
          emailSubject,
          emailBody,
          recipients,
        },
      },
    });

    // Without DocuSign credentials, a placeholder external ID is stored so the
    // workflow (create → track → complete) still functions end-to-end.
    const externalId = process.env.DOCUSIGN_CLIENT_ID
      ? await sendToDocuSign({
          templateId,
          emailSubject,
          emailBody,
          recipients: [{ email: candidate.email, name: candidate.name, role: 'signer' }],
          documents,
        }).then(r => r.envelopeId)
      : `stub-${Date.now()}`;

    await prisma.eSignatureRequest.update({
      where: { id: eSignature.id },
      data: { externalId },
    });

    return NextResponse.json({
      success: true,
      eSignatureId: eSignature.id,
      externalId,
      message: process.env.DOCUSIGN_CLIENT_ID
        ? 'Signature request sent via DocuSign'
        : 'Signature request created (DocuSign not configured — using stub ID)',
    });
  } catch (error) {
    console.error('Error sending eSignature:', error);
    return NextResponse.json({ error: 'Failed to send signature request' }, { status: 500 });
  }
});


// GET /api/esignature/status - Check signature status
export const GET = withAuth(async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const { searchParams } = new URL(request.url);
    const candidateId = searchParams.get('candidateId');

    if (candidateId) {
      const candidate = await prisma.candidate.findFirst({
        where: { id: candidateId, organizationId: orgId },
        select: { id: true },
      });
      if (!candidate) {
        return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
      }
    }

    const requests = await prisma.eSignatureRequest.findMany({
      where: {
        candidate: { organizationId: orgId },
        ...(candidateId ? { candidateId } : {}),
      },
      include: {
        candidate: {
          select: { name: true, email: true },
        },
      },
      orderBy: { sentAt: 'desc' },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error('Error fetching eSignatures:', error);
    return NextResponse.json([], { status: 500 });
  }
});

// PATCH /api/esignature/send - Resend / status updates (staff-gated, org-scoped)
export const PATCH = withPermission('USE_ESIGNATURE', async (request: NextRequest, _ctx, session) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const payload = await request.json();
    const { event, data } = payload;

    if (event === 'resend') {
      const existing = await prisma.eSignatureRequest.findFirst({
        where: {
          id: data?.id,
          candidate: { organizationId: orgId },
        },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Signature request not found' }, { status: 404 });
      }

      await prisma.eSignatureRequest.update({
        where: { id: data.id },
        data: { status: 'sent', sentAt: new Date() },
      });
      return NextResponse.json({ received: true, status: 'resent' });
    }

    if (event === 'envelope-completed' || event === 'envelope-declined') {
      if (!data?.envelopeId) {
        return NextResponse.json({ error: 'envelopeId required' }, { status: 400 });
      }

      const existing = await prisma.eSignatureRequest.findFirst({
        where: {
          externalId: data.envelopeId,
          candidate: { organizationId: orgId },
        },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Signature request not found' }, { status: 404 });
      }

      if (event === 'envelope-completed') {
        await prisma.eSignatureRequest.update({
          where: { id: existing.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
            signedDocumentUrl: data.certificateUrl,
          },
        });
      } else {
        await prisma.eSignatureRequest.update({
          where: { id: existing.id },
          data: {
            status: 'declined',
            metadata: { declineReason: data.declinedReason },
          },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error handling eSignature update:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
});

// ── DocuSign SDK Integration Point ───────────────────────────────────────────
async function sendToDocuSign(_params: {
  templateId?: string;
  emailSubject?: string;
  emailBody?: string;
  recipients: { email: string; name: string; role: string }[];
  documents?: unknown[];
}): Promise<{ envelopeId: string }> {
  throw new Error('DocuSign SDK not implemented — set DOCUSIGN_CLIENT_ID to enable');
}
