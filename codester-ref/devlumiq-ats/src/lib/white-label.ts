/**
 * White-label brand resolution.
 * Careers colors/logo remain available to all plans (grandfathered).
 * Kit extras (hide product marks, customCss, customDomain, dashboard accents)
 * require whiteLabel plan or whiteLabelKit add-on.
 */

import { hasEntitlement } from './plan-limits';

export const PRODUCT_NAME = 'DevLumiq ATS';
export const PRODUCT_MARK = 'DevLumiq';

export interface CompanyBrandFields {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  customCss: string | null;
  customDomain: string | null;
}

export interface ResolvedBrand {
  companyName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  /** Kit-only: applied when entitled */
  customCss: string | null;
  customDomain: string | null;
  hideProductMarks: boolean;
  productName: string;
  cssVars: Record<string, string>;
}

export async function shouldHideProductMarks(orgId: string): Promise<boolean> {
  const { allowed } = await hasEntitlement(orgId, 'whiteLabel');
  return allowed;
}

/**
 * Resolve brand tokens for careers / emails.
 * Base colors always apply; kit extras only when entitled.
 */
export async function resolveBrand(company: CompanyBrandFields): Promise<ResolvedBrand> {
  const { allowed: kit } = await hasEntitlement(company.id, 'whiteLabel');

  return {
    companyName: company.name,
    logoUrl: company.logoUrl,
    faviconUrl: company.faviconUrl,
    primaryColor: company.primaryColor || '#0d9488',
    secondaryColor: company.secondaryColor || '#14b8a6',
    accentColor: company.accentColor || '#5eead4',
    fontFamily: company.fontFamily || 'inter',
    customCss: kit ? company.customCss : null,
    customDomain: kit ? company.customDomain : null,
    hideProductMarks: kit,
    productName: kit ? company.name : PRODUCT_NAME,
    cssVars: {
      '--brand-primary': company.primaryColor || '#0d9488',
      '--brand-secondary': company.secondaryColor || '#14b8a6',
      '--brand-accent': company.accentColor || '#5eead4',
    },
  };
}

export function brandFooterText(brand: ResolvedBrand): string {
  if (brand.hideProductMarks) {
    return `© ${new Date().getFullYear()} ${brand.companyName}`;
  }
  return `Powered by ${PRODUCT_MARK}`;
}
