import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimitAsync, getClientIp } from '@/lib/rate-limit';

/**
 * Public voluntary EEO self-ID (careers apply flow).
 * Stored separately — never used in ranking/scoring.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = await rateLimitAsync(`dei-selfid:${ip}`, 20, 60 * 60 * 1000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json();
    const organizationId = typeof body.organizationId === 'string' ? body.organizationId : '';
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId required' }, { status: 400 });
    }

    const settings = await prisma.orgDeiSettings.findUnique({ where: { organizationId } });
    if (settings && settings.selfIdFormEnabled === false) {
      return NextResponse.json({ error: 'Self-ID form disabled' }, { status: 403 });
    }

    const record = await prisma.candidateSelfId.create({
      data: {
        organizationId,
        candidateId: typeof body.candidateId === 'string' ? body.candidateId : null,
        applicationId: typeof body.applicationId === 'string' ? body.applicationId : null,
        gender: typeof body.gender === 'string' ? body.gender : null,
        ethnicity: typeof body.ethnicity === 'string' ? body.ethnicity : null,
        veteranStatus: typeof body.veteranStatus === 'string' ? body.veteranStatus : null,
        disability: typeof body.disability === 'string' ? body.disability : null,
        declinedToSelfId: !!body.declinedToSelfId,
      },
    });

    return NextResponse.json({ ok: true, id: record.id });
  } catch (e) {
    console.error('POST dei/self-id', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
