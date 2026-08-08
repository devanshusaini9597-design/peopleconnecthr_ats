import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { requireOrgId, isOrgError } from '@/lib/require-org';
import { maybeEncryptSecret } from '@/lib/jobboards/secrets';

const BOARDS = ['LINKEDIN', 'INDEED', 'GLASSDOOR'] as const;

/**
 * GET /api/jobboards/credentials — list org board credentials (secrets masked)
 */
export const GET = withPermission('MANAGE_INTEGRATIONS', async (_req, _ctx, session) => {
  const orgId = requireOrgId(session);
  if (isOrgError(orgId)) return orgId;

  const rows = await prisma.jobBoardCredential.findMany({
    where: { organizationId: orgId },
    orderBy: { board: 'asc' },
  });

  const byBoard = BOARDS.map((board) => {
    const row = rows.find((r) => r.board === board);
    return {
      board,
      configured: !!(row && (row.apiKey || row.accessToken)),
      isActive: row?.isActive ?? false,
      accountName: row?.accountName ?? null,
      hasApiKey: !!row?.apiKey,
      hasAccessToken: !!row?.accessToken,
      hasApiSecret: !!row?.apiSecret,
      settings: row?.settings
        ? {
            companyId: (row.settings as Record<string, unknown>).companyId ?? null,
            employerId: (row.settings as Record<string, unknown>).employerId ?? null,
            partnerId: (row.settings as Record<string, unknown>).partnerId ?? null,
            endpoint: (row.settings as Record<string, unknown>).endpoint ?? null,
          }
        : null,
      id: row?.id ?? null,
    };
  });

  return NextResponse.json({ credentials: byBoard });
});

/**
 * PUT /api/jobboards/credentials
 */
export const PUT = withPermission('MANAGE_INTEGRATIONS', async (req: NextRequest, _ctx, session) => {
  const orgId = requireOrgId(session);
  if (isOrgError(orgId)) return orgId;

  const body = await req.json().catch(() => null);
  const board = String(body?.board || '').toUpperCase();
  if (!BOARDS.includes(board as (typeof BOARDS)[number])) {
    return NextResponse.json({ error: 'board must be LINKEDIN, INDEED, or GLASSDOOR' }, { status: 400 });
  }

  const existing = await prisma.jobBoardCredential.findFirst({
    where: { organizationId: orgId, board: board as any },
  });

  const data = {
    organizationId: orgId,
    board: board as any,
    accountName: typeof body.accountName === 'string' ? body.accountName : existing?.accountName,
    apiKey:
      typeof body.apiKey === 'string'
        ? maybeEncryptSecret(body.apiKey) ?? null
        : existing?.apiKey,
    apiSecret:
      typeof body.apiSecret === 'string'
        ? maybeEncryptSecret(body.apiSecret) ?? null
        : existing?.apiSecret,
    accessToken:
      typeof body.accessToken === 'string'
        ? maybeEncryptSecret(body.accessToken) ?? null
        : existing?.accessToken,
    refreshToken:
      typeof body.refreshToken === 'string'
        ? maybeEncryptSecret(body.refreshToken) ?? null
        : existing?.refreshToken,
    isActive: body.isActive !== false,
    settings: body.settings !== undefined ? body.settings : existing?.settings,
  };

  const row = existing
    ? await prisma.jobBoardCredential.update({ where: { id: existing.id }, data })
    : await prisma.jobBoardCredential.create({ data });

  return NextResponse.json({
    success: true,
    id: row.id,
    board: row.board,
    configured: !!(row.apiKey || row.accessToken),
    liveReady: board === 'LINKEDIN'
      ? !!(row.accessToken && (row.settings as any)?.companyId)
      : board === 'GLASSDOOR'
        ? !!(row.apiKey && row.apiSecret)
        : !!row.apiKey,
  });
});

/**
 * DELETE /api/jobboards/credentials — body { board }
 */
export const DELETE = withPermission('MANAGE_INTEGRATIONS', async (req: NextRequest, _ctx, session) => {
  const orgId = requireOrgId(session);
  if (isOrgError(orgId)) return orgId;

  const body = await req.json().catch(() => null);
  const board = String(body?.board || '').toUpperCase();
  await prisma.jobBoardCredential.deleteMany({
    where: { organizationId: orgId, board: board as any },
  });
  return NextResponse.json({ success: true });
});
