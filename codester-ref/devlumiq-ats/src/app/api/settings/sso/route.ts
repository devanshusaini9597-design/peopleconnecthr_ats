import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';
import { hasEntitlement } from '@/lib/plan-limits';
import { getAcsUrl, getSpEntityId } from '@/lib/sso';

/**
 * GET /api/settings/sso — current SSO config + SP endpoints (no cert secrets in list beyond what's stored)
 */
export const GET = withPermission('MANAGE_USERS', async (_req, _ctx, session) => {
  const orgId = requireOrgId(session);
  if (isOrgError(orgId)) return orgId;

  const entitlement = await hasEntitlement(orgId, 'sso');
  const config = await prisma.orgSsoConfig.findUnique({ where: { organizationId: orgId } });

  return NextResponse.json({
    entitled: entitlement.allowed,
    plan: entitlement.plan,
    sp: {
      entityId: getSpEntityId(),
      acsUrl: getAcsUrl(),
      metadataUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/auth/sso/metadata`,
    },
    config: config
      ? {
          enabled: config.enabled,
          entryPoint: config.entryPoint,
          issuer: config.issuer,
          emailAttribute: config.emailAttribute,
          wantAssertionsSigned: config.wantAssertionsSigned,
          hasCert: !!config.cert,
        }
      : null,
  });
});

/**
 * PUT /api/settings/sso — upsert OrgSsoConfig (Enterprise / SSO add-on only)
 */
export const PUT = withPermission('MANAGE_USERS', async (req: NextRequest, _ctx, session) => {
  const orgId = requireOrgId(session);
  if (isOrgError(orgId)) return orgId;

  const entitlement = await hasEntitlement(orgId, 'sso');
  if (!entitlement.allowed) {
    return NextResponse.json(
      {
        error: 'SSO requires Enterprise plan or SSO add-on.',
        code: 'PLAN_UPGRADE_REQUIRED',
        currentPlan: entitlement.plan,
      },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const data = {
    enabled: body.enabled === true,
    entryPoint: typeof body.entryPoint === 'string' ? body.entryPoint.trim() : null,
    issuer: typeof body.issuer === 'string' ? body.issuer.trim() : null,
    cert: typeof body.cert === 'string' ? body.cert.trim() : undefined,
    emailAttribute:
      typeof body.emailAttribute === 'string' && body.emailAttribute.trim()
        ? body.emailAttribute.trim()
        : 'email',
    wantAssertionsSigned: body.wantAssertionsSigned !== false,
  };

  const existing = await prisma.orgSsoConfig.findUnique({ where: { organizationId: orgId } });
  const config = existing
    ? await prisma.orgSsoConfig.update({
        where: { organizationId: orgId },
        data: {
          enabled: data.enabled,
          entryPoint: data.entryPoint,
          issuer: data.issuer,
          ...(data.cert !== undefined ? { cert: data.cert } : {}),
          emailAttribute: data.emailAttribute,
          wantAssertionsSigned: data.wantAssertionsSigned,
        },
      })
    : await prisma.orgSsoConfig.create({
        data: {
          organizationId: orgId,
          enabled: data.enabled,
          entryPoint: data.entryPoint,
          issuer: data.issuer,
          cert: data.cert ?? null,
          emailAttribute: data.emailAttribute,
          wantAssertionsSigned: data.wantAssertionsSigned,
        },
      });

  return NextResponse.json({
    success: true,
    config: {
      enabled: config.enabled,
      entryPoint: config.entryPoint,
      issuer: config.issuer,
      emailAttribute: config.emailAttribute,
      wantAssertionsSigned: config.wantAssertionsSigned,
      hasCert: !!config.cert,
    },
  });
});
