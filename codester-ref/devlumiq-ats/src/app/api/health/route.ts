import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();
  let dbStatus: 'connected' | 'disconnected' = 'disconnected';
  let dbLatencyMs: number | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - start;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }

  const healthy = dbStatus === 'connected';

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      db: { status: dbStatus, latencyMs: dbLatencyMs },
      env: process.env.NODE_ENV,
    },
    { status: healthy ? 200 : 503 },
  );
}
