import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withPermission } from '@/lib/with-permission';
import { hasEntitlement } from '@/lib/plan-limits';
import { requireOrgId, isOrgError } from '@/lib/require-org';

/** Kit extras — colors/logo stay available to all plans (grandfathered) */
async function stripKitExtrasIfNotEntitled(
  orgId: string,
  data: Record<string, unknown>
): Promise<{ data: Record<string, unknown>; blocked?: string }> {
  const { allowed } = await hasEntitlement(orgId, 'whiteLabel');
  if (allowed) return { data };
  const blocked: string[] = [];
  if (data.customCss !== undefined && data.customCss) {
    delete data.customCss;
    blocked.push('customCss');
  }
  if (data.customDomain !== undefined && data.customDomain) {
    delete data.customDomain;
    blocked.push('customDomain');
  }
  if (blocked.length) {
    return {
      data,
      blocked: `White-Label Kit required to set: ${blocked.join(', ')}. Colors and logo remain available on all plans.`,
    };
  }
  return { data };
}
// GET /api/company - Get company profile
export const GET = withAuth(async () => {
  try {
    const company = await prisma.company.findFirst({
      include: {
        benefits: { orderBy: { sortOrder: 'asc' } },
        teamMembers: { orderBy: { sortOrder: 'asc' } },
        socialLinks: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    return NextResponse.json(company);
  } catch (error) {
    console.error('Error fetching company:', error);
    return NextResponse.json({ error: 'Failed to fetch company' }, { status: 500 });
  }
});

// POST /api/company - Create or update company profile
export const POST = withPermission('MANAGE_COMPANY', async (request: NextRequest, _ctx, session) => {
  try {
    const data = await request.json();
    
    const {
      name,
      slug,
      description,
      website,
      logoUrl,
      faviconUrl,
      primaryColor,
      secondaryColor,
      accentColor,
      fontFamily,
      customCss,
      metaTitle,
      metaDescription,
      ogImageUrl,
      twitterHandle,
      linkedinUrl,
      heroTitle,
      heroSubtitle,
      heroBackground,
      showBenefits,
      showTeamPhotos,
      customDomain,
      enableLinkedInShare,
      enableTwitterShare,
      enableFacebookShare,
      enableEmailShare,
      isPublished,
      benefits,
      teamMembers,
      socialLinks,
    } = data;

    // Check if company exists
    const existing = await prisma.company.findFirst();
    const orgIdOrErr = requireOrgId(session);
    if (isOrgError(orgIdOrErr)) return orgIdOrErr;
    const orgId = orgIdOrErr;
    let companyData: any = {
      name,
      slug,
      description,
      website,
      logoUrl,
      faviconUrl,
      primaryColor,
      secondaryColor,
      accentColor,
      fontFamily,
      customCss,
      metaTitle,
      metaDescription,
      ogImageUrl,
      twitterHandle,
      linkedinUrl,
      heroTitle,
      heroSubtitle,
      heroBackground,
      showBenefits,
      showTeamPhotos,
      customDomain,
      enableLinkedInShare,
      enableTwitterShare,
      enableFacebookShare,
      enableEmailShare,
      isPublished,
    };

    if (orgId) {
      const gated = await stripKitExtrasIfNotEntitled(orgId, companyData);
      companyData = gated.data;
      if (gated.blocked && (customCss || customDomain)) {
        // Soft-warn but still save grandfathered fields
        console.info('[white-label]', gated.blocked);
      }
    }

    let company;

    if (existing) {
      // Update existing
      company = await prisma.company.update({
        where: { id: existing.id },
        data: companyData,
      });

      // Update benefits
      if (benefits) {
        await prisma.companyBenefit.deleteMany({ where: { companyId: existing.id } });
        if (benefits.length > 0) {
          await prisma.companyBenefit.createMany({
            data: benefits.map((b: any, i: number) => ({
              title: b.title || '',
              description: b.description || '',
              icon: b.icon || '',
              companyId: existing.id,
              sortOrder: i,
            })),
          });
        }
      }

      // Update team members
      if (teamMembers) {
        await prisma.teamMember.deleteMany({ where: { companyId: existing.id } });
        if (teamMembers.length > 0) {
          await prisma.teamMember.createMany({
            data: teamMembers.map((m: any, i: number) => ({
              name: m.name || '',
              role: m.role || '',
              bio: m.bio || '',
              photoUrl: m.photoUrl || '',
              companyId: existing.id,
              sortOrder: i,
            })),
          });
        }
      }

      // Update social links
      if (socialLinks) {
        await prisma.companySocialLink.deleteMany({ where: { companyId: existing.id } });
        if (socialLinks.length > 0) {
          await prisma.companySocialLink.createMany({
            data: socialLinks.map((l: any, i: number) => ({
              platform: l.platform || '',
              url: l.url || '',
              companyId: existing.id,
              sortOrder: i,
            })),
          });
        }
      }
    } else {
      // Create new
      company = await prisma.company.create({
        data: {
          ...companyData,
          benefits: benefits?.length > 0 ? {
            createMany: {
              data: benefits.map((b: any, i: number) => ({
                title: b.title || '', description: b.description || '', icon: b.icon || '', sortOrder: i,
              })),
            },
          } : undefined,
          teamMembers: teamMembers?.length > 0 ? {
            createMany: {
              data: teamMembers.map((m: any, i: number) => ({
                name: m.name || '', role: m.role || '', bio: m.bio || '', photoUrl: m.photoUrl || '', sortOrder: i,
              })),
            },
          } : undefined,
          socialLinks: socialLinks?.length > 0 ? {
            createMany: {
              data: socialLinks.map((l: any, i: number) => ({
                platform: l.platform || '', url: l.url || '', sortOrder: i,
              })),
            },
          } : undefined,
        },
      });
    }

    return NextResponse.json(company);
  } catch (error) {
    console.error('Error saving company:', error);
    return NextResponse.json({ error: 'Failed to save company' }, { status: 500 });
  }
});

// PATCH /api/company - Partial update
export const PATCH = withPermission('MANAGE_COMPANY', async (request: NextRequest, _ctx, session) => {
  try {
    const data = await request.json();
    const existing = await prisma.company.findFirst();

    if (!existing) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const allowed: Record<string, unknown> = {};
    const scalarKeys = [
      'name', 'slug', 'description', 'website', 'logoUrl', 'faviconUrl',
      'primaryColor', 'secondaryColor', 'accentColor', 'fontFamily', 'customCss',
      'metaTitle', 'metaDescription', 'ogImageUrl', 'twitterHandle', 'linkedinUrl',
      'heroTitle', 'heroSubtitle', 'heroBackground', 'showBenefits', 'showTeamPhotos',
      'customDomain', 'enableLinkedInShare', 'enableTwitterShare', 'enableFacebookShare',
      'enableEmailShare', 'isPublished',
    ] as const;
    for (const k of scalarKeys) {
      if (data[k] !== undefined) allowed[k] = data[k];
    }
    if (data.careersFaq !== undefined) {
      if (data.careersFaq === null) {
        allowed.careersFaq = null;
      } else if (Array.isArray(data.careersFaq)) {
        allowed.careersFaq = data.careersFaq
          .map((item: { q?: string; a?: string; keywords?: string[] }) => ({
            q: typeof item?.q === 'string' ? item.q.slice(0, 500) : '',
            a: typeof item?.a === 'string' ? item.a.slice(0, 4000) : '',
            keywords: Array.isArray(item?.keywords)
              ? item.keywords.filter((k: unknown) => typeof k === 'string').slice(0, 20)
              : [],
          }))
          .filter((i: { q: string; a: string }) => i.q && i.a)
          .slice(0, 50);
      } else {
        return NextResponse.json({ error: 'careersFaq must be an array' }, { status: 400 });
      }
    }

    const orgIdOrErr = requireOrgId(session);
    if (isOrgError(orgIdOrErr)) return orgIdOrErr;
    const orgId = orgIdOrErr;
    const gated = await stripKitExtrasIfNotEntitled(orgId, allowed);
    if (gated.blocked && (data.customCss || data.customDomain)) {
      return NextResponse.json(
        { error: gated.blocked, code: 'WHITELABEL_KIT_REQUIRED' },
        { status: 403 }
      );
    }

    const company = await prisma.company.update({
      where: { id: existing.id },
      data: gated.data,
    });

    return NextResponse.json(company);
  } catch (error) {
    console.error('Error updating company:', error);
    return NextResponse.json({ error: 'Failed to update company' }, { status: 500 });
  }
});
