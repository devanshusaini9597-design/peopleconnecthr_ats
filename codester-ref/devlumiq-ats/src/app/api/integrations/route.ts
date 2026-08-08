import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET /api/integrations — return list of active provider IDs for current user
export async function GET() {
  try {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await prisma.integration.findMany({
      where: { userId: user.id, isActive: true },
      select: { provider: true },
    });

    return NextResponse.json({ connected: rows.map((r) => r.provider) });
  } catch (e) {
    console.error('GET /api/integrations', e);
    return NextResponse.json({ error: 'Failed to load integrations' }, { status: 500 });
  }
}
