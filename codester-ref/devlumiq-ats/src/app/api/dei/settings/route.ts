import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, withAuth } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';

export const GET = withAuth(async (_req, _ctx, session) => {
  const orgId = requireOrgId(session);
  if (isOrgError(orgId)) return orgId;

  let settings = await prisma.orgDeiSettings.findUnique({
    where: { organizationId: orgId },
  });
  if (!settings) {
    settings = await prisma.orgDeiSettings.create({
      data: { organizationId: orgId },
    });
  }
  return NextResponse.json({ settings });
});

export const PATCH = withPermission('MANAGE_SETTINGS', async (req: NextRequest, _ctx, session) => {
  const orgId = requireOrgId(session);
  if (isOrgError(orgId)) return orgId;

  const body = await req.json();
  const settings = await prisma.orgDeiSettings.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      blindScreeningEnabled: !!body.blindScreeningEnabled,
      diverseSlateAlerts: !!body.diverseSlateAlerts,
      selfIdFormEnabled: body.selfIdFormEnabled !== false,
    },
    update: {
      ...(typeof body.blindScreeningEnabled === 'boolean'
        ? { blindScreeningEnabled: body.blindScreeningEnabled }
        : {}),
      ...(typeof body.diverseSlateAlerts === 'boolean'
        ? { diverseSlateAlerts: body.diverseSlateAlerts }
        : {}),
      ...(typeof body.selfIdFormEnabled === 'boolean'
        ? { selfIdFormEnabled: body.selfIdFormEnabled }
        : {}),
    },
  });
  return NextResponse.json({ settings });
});
