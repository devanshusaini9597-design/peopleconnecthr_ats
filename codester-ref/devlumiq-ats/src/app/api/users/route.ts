import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { withPermission } from '@/lib/with-permission';
import { ROLES } from '@/lib/roles';
import { checkOrgLimit } from '@/lib/plan-limits';
import type { SessionUser } from '@/lib/auth';
import { sendEmail, generateInviteEmail } from '@/lib/email';
import { requireOrgId, requireOrgFilter, isOrgError } from '@/lib/require-org';

/** GET /api/users — list users in the same org (ADMIN only) */
export const GET = withPermission('MANAGE_USERS', async (_req: NextRequest, _ctx, session: SessionUser) => {
  try {
    const orgFilter = requireOrgFilter(session);
    if (isOrgError(orgFilter)) return orgFilter;
    const users = await prisma.user.findMany({
      where: orgFilter,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ users });
  } catch (e) {
    console.error('GET /api/users', e);
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
  }
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/** POST /api/users — invite a user into the same org (ADMIN only) */
export const POST = withPermission('MANAGE_USERS', async (request: NextRequest, _ctx, session: SessionUser) => {
  try {
    const orgId = requireOrgId(session);
    if (isOrgError(orgId)) return orgId;

    const body = await request.json();
    const name = (body?.name ?? '').toString().trim();
    const email = (body?.email ?? '').toString().trim().toLowerCase();
    const role = (body?.role ?? 'RECRUITER').toString().toUpperCase();

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    if (!Object.keys(ROLES).includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Enforce plan seat limit
    const limitCheck = await checkOrgLimit(orgId, 'seats');
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: `Seat limit reached (${limitCheck.current}/${limitCheck.limit}). Upgrade your plan to add more users.`, code: 'PLAN_LIMIT_REACHED' },
        { status: 403 }
      );
    }

    // Check email uniqueness within the same organization
    const existing = await prisma.user.findFirst({
      where: {
        email,
        organizationId: orgId,
      },
    });
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists in this organization' }, { status: 409 });
    }

    const inviteToken = randomBytes(32).toString('hex');
    const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const user = await prisma.user.create({
      data: {
        name,
        email,
        role: role as keyof typeof ROLES,
        organizationId: orgId,
        isEmailVerified: false,
        inviteToken,
        inviteTokenExpiry,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });

    // Resolve org name for the invite email
    const org = await prisma.company.findUnique({ where: { id: orgId }, select: { name: true } });
    const orgName = org?.name ?? 'your organisation';

    const setupUrl = `${APP_URL}/setup-account?token=${inviteToken}`;
    const { subject, html, text } = generateInviteEmail(name, session.name, orgName, setupUrl);
    await sendEmail({ to: email, subject, html, text });

    return NextResponse.json({ user }, { status: 201 });
  } catch (e) {
    console.error('POST /api/users', e);
    return NextResponse.json({ error: 'Failed to invite user' }, { status: 500 });
  }
});
