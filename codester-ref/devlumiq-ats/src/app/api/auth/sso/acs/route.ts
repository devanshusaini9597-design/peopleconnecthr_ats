import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  buildSaml,
  extractEmailFromProfile,
  getAppBaseUrl,
  loadOrgSso,
} from '@/lib/sso';
import { createUserSession, sessionCookieOptions, signSession, SESSION_COOKIE } from '@/lib/auth';

/**
 * POST /api/auth/sso/acs — SAML Assertion Consumer Service
 * Maps email → existing User in the org, issues same ats_session JWT.
 * Does not create users automatically (safer for existing buyers).
 */
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const samlResponse = form.get('SAMLResponse');
    if (typeof samlResponse !== 'string' || !samlResponse) {
      return NextResponse.json({ error: 'Missing SAMLResponse' }, { status: 400 });
    }

    const orgId = request.cookies.get('sso_org')?.value;
    if (!orgId) {
      return NextResponse.redirect(new URL('/login?error=sso_session', getAppBaseUrl()));
    }

    const loaded = await loadOrgSso(orgId);
    if ('error' in loaded) {
      return NextResponse.redirect(new URL('/login?error=sso_not_configured', getAppBaseUrl()));
    }

    const { config } = loaded;
    const saml = buildSaml({
      entryPoint: config.entryPoint!,
      issuer: config.issuer!,
      cert: config.cert!,
      wantAssertionsSigned: config.wantAssertionsSigned,
      emailAttribute: config.emailAttribute,
    });

    const { profile } = await saml.validatePostResponseAsync({
      SAMLResponse: samlResponse,
    });

    const email = extractEmailFromProfile(
      profile as Record<string, unknown>,
      config.emailAttribute
    );
    if (!email) {
      return NextResponse.redirect(new URL('/login?error=sso_no_email', getAppBaseUrl()));
    }

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        organizationId: orgId,
        isActive: true,
      },
    });

    if (!user) {
      return NextResponse.redirect(new URL('/login?error=sso_user_not_found', getAppBaseUrl()));
    }

    const token = signSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      tokenVersion: user.tokenVersion,
    });

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;
    await createUserSession(user.id, user.tokenVersion, ip, request.headers.get('user-agent'));

    const res = NextResponse.redirect(new URL('/dashboard', getAppBaseUrl()));
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    res.cookies.set('sso_org', '', { httpOnly: true, maxAge: 0, path: '/' });
    return res;
  } catch (e) {
    console.error('SSO ACS error', e);
    return NextResponse.redirect(new URL('/login?error=sso_failed', getAppBaseUrl()));
  }
}
