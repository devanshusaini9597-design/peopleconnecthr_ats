import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { withPermission } from '@/lib/with-permission';
import type { SessionUser } from '@/lib/auth';
import { sendEmail, generateInviteEmail } from '@/lib/email';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/** POST /api/users/[id]/resend-invite — regenerate invite token and email (ADMIN only) */
export const POST = withPermission(
  'MANAGE_USERS',
  async (_request: NextRequest, ctx, session: SessionUser) => {
    try {
      const { id } = await (ctx.params as Promise<{ id: string }>);

      if (id === session.id) {
        return NextResponse.json({ error: 'You cannot resend your own invite' }, { status: 400 });
      }

      const target = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          organizationId: true,
          lastLoginAt: true,
          isActive: true,
        },
      });

      if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      if (session.organizationId && target.organizationId !== session.organizationId) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      if (!target.isActive) {
        return NextResponse.json({ error: 'Cannot send invite to deactivated user' }, { status: 400 });
      }

      if (target.lastLoginAt) {
        return NextResponse.json({ error: 'User has already logged in' }, { status: 400 });
      }

      const inviteToken = randomBytes(32).toString('hex');
      const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await prisma.user.update({
        where: { id },
        data: { inviteToken, inviteTokenExpiry },
      });

      // Resolve org name for the invite email
      const org = session.organizationId
        ? await prisma.company.findUnique({ where: { id: session.organizationId }, select: { name: true } })
        : null;
      const orgName = org?.name ?? 'your organisation';

      const setupUrl = `${APP_URL}/setup-account?token=${inviteToken}`;
      const { subject, html, text } = generateInviteEmail(target.name, session.name ?? 'Your administrator', orgName, setupUrl);
      await sendEmail({ to: target.email, subject, html, text });

      return NextResponse.json({ success: true });
    } catch (e) {
      console.error('POST /api/users/[id]/resend-invite', e);
      return NextResponse.json({ error: 'Failed to resend invite' }, { status: 500 });
    }
  },
);
