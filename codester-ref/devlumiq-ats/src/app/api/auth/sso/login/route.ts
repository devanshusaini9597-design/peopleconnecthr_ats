import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildSaml, loadOrgSso } from '@/lib/sso';

/**
 * GET /api/auth/sso/login?slug=acme
 * Redirects to IdP when org has SSO enabled + entitlement. Otherwise 404/403.
 * Password login at /login is unchanged for all orgs.
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({ error: 'slug query param is required' }, { status: 400 });
  }

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  const loaded = await loadOrgSso(company.id);
  if ('error' in loaded) {
    if (loaded.error === 'SSO_NOT_ENTITLED') {
      return NextResponse.json(
        {
          error: 'SSO requires Enterprise plan or SSO add-on.',
          code: 'PLAN_UPGRADE_REQUIRED',
          currentPlan: 'plan' in loaded ? loaded.plan : undefined,
        },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'SSO is not configured for this organization. Use email/password login.' },
      { status: 404 }
    );
  }

  const { config } = loaded;
  try {
    const saml = buildSaml({
      entryPoint: config.entryPoint!,
      issuer: config.issuer!,
      cert: config.cert!,
      wantAssertionsSigned: config.wantAssertionsSigned,
      emailAttribute: config.emailAttribute,
    });
    const authorizeUrl = await saml.getAuthorizeUrlAsync('', undefined, {});
    // Stash org id for ACS (short-lived cookie)
    const res = NextResponse.redirect(authorizeUrl);
    res.cookies.set('sso_org', company.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });
    return res;
  } catch (e) {
    console.error('SSO login error', e);
    return NextResponse.json({ error: 'Failed to start SSO login' }, { status: 500 });
  }
}
