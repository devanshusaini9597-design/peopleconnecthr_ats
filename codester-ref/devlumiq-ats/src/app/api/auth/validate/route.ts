import { NextRequest, NextResponse } from 'next/server';
import { resolveBearerAuth } from '@/lib/with-api-key';

/**
 * GET /api/auth/validate
 * Chrome extension settings check — validates Authorization: Bearer token.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ valid: false, error: 'Missing Authorization header' }, { status: 401 });
  }

  const rawKey = authHeader.slice(7).trim();
  const record = await resolveBearerAuth(rawKey);

  if (!record) {
    return NextResponse.json({ valid: false, error: 'Invalid API key' }, { status: 401 });
  }

  return NextResponse.json({
    valid: true,
    user: {
      id: record.user.id,
      name: record.user.name,
      email: record.user.email,
      organizationId: record.user.organizationId,
    },
  });
}
