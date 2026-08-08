import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-permission';
import { validateCsrf } from '@/lib/csrf';

export const POST = withAuth(async (req: NextRequest, _ctx, session) => {
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  try {
    const body = await req.json();
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint : '';
    const p256dh = body.keys?.p256dh;
    const auth = body.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    await prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId: session.id, endpoint } },
      create: {
        userId: session.id,
        endpoint,
        p256dh,
        auth,
        userAgent: req.headers.get('user-agent') || null,
      },
      update: { p256dh, auth, userAgent: req.headers.get('user-agent') || null },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('push subscribe', e);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, _ctx, session) => {
  const body = await req.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : '';
  if (endpoint) {
    await prisma.pushSubscription.deleteMany({
      where: { userId: session.id, endpoint },
    });
  }
  return NextResponse.json({ ok: true });
});
