import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/with-permission';
import { generateExtensionToken } from '@/lib/with-api-key';
import { requireOrgId, isOrgError } from '@/lib/require-org';

/**
 * GET /api/settings/extension-token
 * List active Chrome extension tokens for the current user (token values masked).
 */
export const GET = withPermission('CREATE_CANDIDATE', async (_req, _ctx, session) => {
  const orgId = requireOrgId(session);
  if (isOrgError(orgId)) return orgId;

  const tokens = await prisma.chromeExtensionToken.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      token: true,
      isActive: true,
      lastUsedAt: true,
      createdAt: true,
      expiresAt: true,
    },
  });

  return NextResponse.json({
    tokens: tokens.map((t) => ({
      id: t.id,
      maskedToken: `${t.token.slice(0, 8)}…${t.token.slice(-4)}`,
      isActive: t.isActive,
      lastUsedAt: t.lastUsedAt,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
    })),
  });
});

/**
 * POST /api/settings/extension-token
 * Create a Chrome extension token for the current user. Raw token returned once.
 */
export const POST = withPermission('CREATE_CANDIDATE', async (req: NextRequest, _ctx, session) => {
  const orgId = requireOrgId(session);
  if (isOrgError(orgId)) return orgId;

  const body = await req.json().catch(() => ({}));
  const expiresInDays = typeof body?.expiresInDays === 'number' ? body.expiresInDays : 365;

  const token = generateExtensionToken();
  const expiresAt =
    expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

  const record = await prisma.chromeExtensionToken.create({
    data: {
      userId: session.id,
      token,
      isActive: true,
      expiresAt,
    },
  });

  return NextResponse.json({
    id: record.id,
    token, // shown once — store in the Chrome extension settings
    expiresAt: record.expiresAt,
    hint: 'Paste this token as the API key in the Chrome extension. It will not be shown again.',
  });
});

/**
 * DELETE /api/settings/extension-token
 * Body: { id: string } — revoke a token.
 */
export const DELETE = withPermission('CREATE_CANDIDATE', async (req: NextRequest, _ctx, session) => {
  const body = await req.json().catch(() => null);
  const id = body?.id;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const existing = await prisma.chromeExtensionToken.findFirst({
    where: { id, userId: session.id },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 });
  }

  await prisma.chromeExtensionToken.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ revoked: true });
});
