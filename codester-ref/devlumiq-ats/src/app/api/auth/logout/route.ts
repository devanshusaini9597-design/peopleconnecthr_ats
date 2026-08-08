import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const session = await getSession().catch(() => null);
  if (session?.id && session.id !== 'demo-user') {
    await prisma.userActivityLog.create({
      data: { userId: session.id, action: 'logout', metadata: {} },
    }).catch(() => {});
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('ats_session', '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
