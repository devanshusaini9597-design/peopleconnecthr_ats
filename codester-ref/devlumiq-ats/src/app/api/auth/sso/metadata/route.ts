import { NextResponse } from 'next/server';
import { spMetadataXml } from '@/lib/sso';

/**
 * GET /api/auth/sso/metadata — SP metadata for IdP configuration
 */
export async function GET() {
  return new NextResponse(spMetadataXml(), {
    status: 200,
    headers: {
      'Content-Type': 'application/samlmetadata+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
