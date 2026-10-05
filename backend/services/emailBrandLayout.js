/**
 * Enterprise ATS email chrome — Greenhouse / Lever / Ashby inspired.
 * Table-based + inline styles for Outlook, Gmail, Apple Mail.
 *
 * Logo note: Skillnix wordmark is white text → dark header only.
 * Logo asset MUST be a real PNG with alpha (not WebP renamed to .png).
 */
const Organization = require('../models/Organization');
const { looksLikeJdDump } = require('../utils/employerVeil');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function frontendBase() {
  return String(process.env.FRONTEND_URL || '')
    .trim()
    .replace(/\/$/, '');
}

function backendBase() {
  return String(process.env.BACKEND_URL || process.env.PUBLIC_API_URL || '')
    .trim()
    .replace(/\/$/, '');
}

function publicSiteBase() {
  return (
    frontendBase() ||
    backendBase() ||
    'https://www.peopleconnecthr.com'
  );
}

function publicOrgLogoUrl(organizationId, version) {
  const base = backendBase() || publicSiteBase();
  if (!base || !organizationId) return '';
  const v = version ? `?v=${encodeURIComponent(String(version))}` : '';
  return `${base}/api/public/org-logo/${organizationId}${v}`;
}

function resolveLogoUrl(logo) {
  const raw = String(logo || '').trim();
  if (!raw) return '';
  // Gmail and most inboxes strip data: URIs — never embed them in mail HTML.
  if (/^data:/i.test(raw)) return '';
  if (/\.svg(\?|#|$)/i.test(raw)) return '';
  if (/^(https?:)/i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('/')) {
    const base = raw.startsWith('/uploads')
      ? (backendBase() || publicSiteBase())
      : publicSiteBase();
    return base ? `${base}${raw}` : raw;
  }
  return raw;
}

/** Bump cache so inboxes pick up the real transparent PNG. */
function withLogoCacheBust(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/[?&]v=\d+/i.test(u)) return u.replace(/([?&]v=)\d+/i, '$14');
  return u.includes('?') ? `${u}&v=4` : `${u}?v=4`;
}

/** Only the platform white wordmark asset — never treat a custom org logo as a wordmark. */
function isWordmarkLogo(logoUrl) {
  const url = String(logoUrl || '').toLowerCase();
  if (!url) return false;
  return url.includes('skillnix-logo');
}

/**
 * Prefer shorter titles for the H1 — strip trailing " | Company" noise that
 * already appears in the header/footer.
 */
function cleanEmailTitle(title, orgName) {
  let t = String(title || '').trim();
  if (!t) return '';
  const name = String(orgName || '').trim();
  if (name) {
    const re = new RegExp(`\\s*[|–—-]\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
    t = t.replace(re, '').trim();
  }
  return t;
}

function skillnixEmailLogoUrl() {
  const envLogo = (process.env.SKILLNIX_LOGO_URL || '').trim();
  if (envLogo) return envLogo;
  const backend = backendBase();
  if (backend) return `${backend}/email-brand/skillnix-logo-email.png`;
  const site = publicSiteBase();
  return site ? `${site}/skillnix-logo-email.png` : '';
}

function productLogoUrl() {
  const site = publicSiteBase();
  return site ? `${site}/logo.png` : '';
}

function hostedHttpLogo(logo) {
  const raw = String(logo || '').trim();
  if (!raw || /^data:/i.test(raw) || /\.svg(\?|#|$)/i.test(raw)) return '';
  if (isWordmarkLogo(raw) || /skillnix-logo/i.test(raw)) return skillnixEmailLogoUrl();
  if (/^https?:\/\//i.test(raw)) return raw;
  return '';
}

function emailDomainOf(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.includes('@')) {
    const m = raw.match(/@([^@\s>]+)/);
    return m ? m[1] : '';
  }
  return raw.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
}

function envMailboxBrandName(domain) {
  const aliases = {
    'peopleconnecthr.com': 'MAIL_PROFILE_PEOPLECONNECTHR_NAME',
    'skillnixrecruitment.com': 'MAIL_PROFILE_SKILLNIXRECRUITMENT_NAME',
    'skillnix.com': 'MAIL_PROFILE_SKILLNIX_NAME',
    'devlumiq.com': 'MAIL_PROFILE_DEVLUMIQ_NAME',
  };
  const key = aliases[domain];
  return key ? String(process.env[key] || '').trim() : '';
}

function envSocial(key) {
  const aliases = {
    linkedin: 'PLATFORM_SOCIAL_LINKEDIN',
    facebook: 'PLATFORM_SOCIAL_FACEBOOK',
    instagram: 'PLATFORM_SOCIAL_INSTAGRAM',
    twitter: 'PLATFORM_SOCIAL_TWITTER',
    youtube: 'PLATFORM_SOCIAL_YOUTUBE',
    github: 'PLATFORM_SOCIAL_GITHUB',
  };
  return String(process.env[aliases[key]] || '').trim();
}

function platformSocialLinks() {
  return {
    linkedin: envSocial('linkedin'),
    facebook: envSocial('facebook'),
    instagram: envSocial('instagram'),
    twitter: envSocial('twitter'),
    youtube: envSocial('youtube'),
    github: envSocial('github'),
  };
}

function normalizeSocialLinks(social = {}) {
  return {
    linkedin: String(social.linkedin || '').trim(),
    facebook: String(social.facebook || '').trim(),
    instagram: String(social.instagram || '').trim(),
    twitter: String(social.twitter || '').trim(),
    youtube: String(social.youtube || '').trim(),
    github: String(social.github || '').trim(),
    website: String(social.website || '').trim(),
  };
}

function hasAnySocial(social) {
  return ['linkedin', 'facebook', 'instagram', 'twitter', 'youtube', 'github']
    .some((key) => httpUrl(social?.[key]));
}

function socialIconUrl(name) {
  const file = `${String(name || '').toLowerCase()}.png`;
  const backend = backendBase();
  if (backend) return `${backend}/email-brand/social/${file}`;
  const site = publicSiteBase();
  return site ? `${site}/email-brand/social/${file}` : '';
}

function titleFromDomain(domain) {
  const label = String(domain || '').split('.')[0] || '';
  if (!label) return '';
  return label.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return String(url || '').replace(/^https?:\/\//, '').split('/')[0];
  }
}

/**
 * Mailbox identity when we only know the From address (no Organization).
 * Product domain → People Connect HR. Any other domain is a tenant mailbox.
 */
function identityForFromEmail(fromEmailOrDomain) {
  const domain = emailDomainOf(fromEmailOrDomain);
  const fromEmail = String(fromEmailOrDomain || '').includes('@')
    ? String(fromEmailOrDomain).trim().toLowerCase()
    : '';
  const site = publicSiteBase();
  const supportFallback = String(process.env.SUPPORT_TEAM_EMAIL || '')
    .split(',')[0]
    .trim();
  const productLogo = productLogoUrl();

  if (domain === 'peopleconnecthr.com') {
    return {
      name: envMailboxBrandName(domain) || 'People Connect HR',
      websiteUrl: site || 'https://www.peopleconnecthr.com',
      supportEmail: supportFallback || 'info@peopleconnecthr.com',
      brandColor: '#0d9488',
      logoUrl: productLogo,
      wordmark: false,
      socialLinks: platformSocialLinks(),
      companyAddress: '',
      fromEmail,
      domain,
      known: true,
    };
  }

  return {
    name: envMailboxBrandName(domain) || titleFromDomain(domain) || 'People Connect HR',
    websiteUrl: domain ? `https://${domain}` : (site || 'https://www.peopleconnecthr.com'),
    supportEmail: supportFallback || (domain ? `info@${domain}` : 'info@peopleconnecthr.com'),
    brandColor: '#0d9488',
    logoUrl: '',
    wordmark: false,
    fromEmail,
    domain,
    known: false,
    socialLinks: {},
    companyAddress: '',
  };
}

function loadPlatformEmailBrand(fromEmail) {
  const identity = identityForFromEmail(
    fromEmail || process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL || process.env.ZEPTOMAIL_FROM_EMAIL
  );
  return {
    name: identity.name,
    logoUrl: identity.logoUrl,
    iconUrl: identity.logoUrl,
    brandColor: identity.brandColor,
    wordmark: identity.wordmark !== false,
    fromEmail: identity.fromEmail,
    websiteUrl: identity.websiteUrl,
    supportEmail: identity.supportEmail,
    companyAddress: identity.companyAddress || '',
    socialLinks: identity.socialLinks || {},
  };
}

async function loadOrgEmailBrand(organizationId) {
  const fallback = loadPlatformEmailBrand();
  if (!organizationId) return fallback;
  try {
    const org = await Organization.findById(organizationId)
      .select('name domain logo atsSettings.brandColor atsSettings.whiteLabel atsSettings.companyBrand atsSettings.internalPreview updatedAt')
      .lean();
    if (!org) return fallback;

    const companyBrand = org.atsSettings?.companyBrand || {};
    const social = normalizeSocialLinks(companyBrand.socialLinks || {});
    const whiteLabelName = String(org.atsSettings?.whiteLabel?.emailFromName || '').trim();
    const name = whiteLabelName || String(org.name || '').trim() || fallback.name;
    const brandColor = String(org.atsSettings?.brandColor || '').trim() || fallback.brandColor;
    const orgDomain = emailDomainOf(org.domain);

    let logoUrl = '';
    let wordmark = false;
    if (isWordmarkLogo(org.logo)) {
      logoUrl = skillnixEmailLogoUrl();
      wordmark = true;
    } else {
      logoUrl = hostedHttpLogo(org.logo);
      if (!logoUrl && org.logo) {
        logoUrl = publicOrgLogoUrl(org._id, org.updatedAt || Date.now());
      }
      wordmark = isWordmarkLogo(logoUrl);
    }

    const websiteRaw = String(social.website || '').trim();
    const websiteUrl = websiteRaw
      ? (/^https?:\/\//i.test(websiteRaw) ? websiteRaw : `https://${websiteRaw}`)
      : orgDomain
        ? `https://${orgDomain}`
        : fallback.websiteUrl;

    const orgFromEmail = orgDomain
      ? `noreply@${orgDomain}`
      : (fallback.fromEmail || '');

    const brandSupport = String(companyBrand.supportEmail || '').trim();
    const brandAddress = String(companyBrand.companyAddress || '').trim();

    return {
      name,
      logoUrl,
      iconUrl: logoUrl,
      brandColor,
      wordmark,
      fromEmail: orgFromEmail,
      websiteUrl,
      supportEmail: brandSupport || (orgDomain ? `contact@${orgDomain}` : fallback.supportEmail || ''),
      companyAddress: brandAddress,
      socialLinks: {
        ...social,
        website: websiteUrl,
      },
    };
  } catch (_) {
    return fallback;
  }
}

function productMarketingBrand() {
  const site = publicSiteBase() || 'https://www.peopleconnecthr.com';
  return {
    name: 'People Connect HR',
    slug: '',
    logoUrl: `${site}/logo.png`,
    websiteUrl: site,
    supportEmail: String(process.env.SUPPORT_TEAM_EMAIL || 'info@peopleconnecthr.com').split(',')[0].trim(),
    companyAddress: '',
    brandColor: '#0d9488',
    socialLinks: platformSocialLinks(),
  };
}

/**
 * Public subscribe/unsubscribe chrome: explicit org query, else product brand.
 * Set PUBLIC_MARKETING_ORG_SLUG to pin unscoped /subscribe to a tenant.
 */
async function resolvePublicMarketingBrand({ orgSlug, orgId } = {}) {
  const slug = String(orgSlug || '').trim().toLowerCase();
  const id = String(orgId || '').trim();
  let org = null;
  try {
    if (id && /^[a-fA-F0-9]{24}$/.test(id)) {
      org = await Organization.findById(id).select('name slug').lean();
    }
    if (!org && slug) {
      org = await Organization.findOne({ slug }).select('name slug').lean();
    }
    if (!org) {
      const def = String(process.env.PUBLIC_MARKETING_ORG_SLUG || '').trim().toLowerCase();
      if (def) org = await Organization.findOne({ slug: def }).select('name slug').lean();
    }
  } catch (_) {
    org = null;
  }
  if (!org?._id) return productMarketingBrand();
  const brand = await loadOrgEmailBrand(org._id);
  return {
    name: brand.name,
    slug: org.slug || '',
    logoUrl: brand.logoUrl || '',
    websiteUrl: brand.websiteUrl || publicSiteBase(),
    supportEmail: brand.supportEmail || '',
    companyAddress: brand.companyAddress || '',
    brandColor: brand.brandColor || '#0d9488',
    socialLinks: brand.socialLinks || {},
  };
}

/**
 * Brand the email as the tenant the user belongs to.
 * The SMTP From mailbox can stay shared; the visible company must not.
 */
async function loadSendingEmailBrand({ userId, organizationId, system = true } = {}) {
  const fallback = loadPlatformEmailBrand();
  let fromEmail = fallback.fromEmail || '';
  try {
    const { getUserTransporter } = require('./emailService');
    const transporter = await getUserTransporter(userId || null, {
      organizationId: organizationId || null,
      system,
    });
    if (transporter?.fromEmail) fromEmail = String(transporter.fromEmail).trim().toLowerCase();
  } catch (_) {
    /* keep env identity */
  }

  if (organizationId) {
    const orgBrand = await loadOrgEmailBrand(organizationId);
    return {
      ...orgBrand,
      fromEmail: fromEmail || orgBrand.fromEmail || fallback.fromEmail,
    };
  }

  const identity = identityForFromEmail(
    fromEmail || process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL || process.env.ZEPTOMAIL_FROM_EMAIL
  );
  return {
    name: identity.name,
    logoUrl: identity.logoUrl,
    iconUrl: identity.logoUrl,
    brandColor: identity.brandColor,
    wordmark: identity.wordmark !== false,
    fromEmail: fromEmail || identity.fromEmail,
    websiteUrl: identity.websiteUrl,
    supportEmail: identity.supportEmail,
    socialLinks: identity.socialLinks || {},
  };
}

function mixHex(hex, target, amount) {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const t = target === 'white' ? 255 : 0;
  const mix = (c) => Math.round(c + (t - c) * amount);
  const toHex = (c) => c.toString(16).padStart(2, '0');
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

/**
 * Map template category → short label (never the generic "Message").
 */
function categoryEyebrow(category) {
  const map = {
    hiring: 'Hiring update',
    interview: 'Interview',
    assessment: 'Assessment',
    offer: 'Offer',
    rejection: 'Application update',
    document: 'Documents',
    onboarding: 'Onboarding',
    marketing: 'Career updates',
    security: 'Security',
    invitation: 'Invitation',
    report: 'Report',
  };
  const key = String(category || '').toLowerCase().trim();
  return map[key] || '';
}

function marketingFooterReason(orgName) {
  const name = String(orgName || 'our team').trim() || 'our team';
  return `This message was sent by ${name} to professionals in our talent network regarding career opportunities.`;
}

/**
 * Zoho Campaigns requires $[LI:UNSUBSCRIBE]$ (or ORG_OPTOUT) in custom HTML.
 * Without it, Zoho appends its own "Email Marketing by Zoho Campaigns" footer.
 * Use professional enterprise wording with Zoho merge tags so their default block is suppressed.
 */
function zohoCampaignComplianceFooterHtml({
  brandColor = '#0f766e',
  subscribeUrl = '',
  isSubscribed = false,
  orgName = '',
} = {}) {
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(String(brandColor || '').trim())
    ? String(brandColor).trim()
    : '#0f766e';
  const font =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const brand = escapeHtml(String(orgName || 'our team').trim() || 'our team');
  const sub = String(subscribeUrl || '').trim();
  const link = `color:${accent};text-decoration:underline;font-weight:600;`;
  const muted = '#6b7280';

  const primary = isSubscribed
    ? `<a href="$[LI:UNSUBSCRIBE]$" style="${link}">Unsubscribe</a>
       <span style="color:#c5cdd6;">&nbsp;·&nbsp;</span>
       <a href="$[LI:SUB_PREF]$" style="${link}">Email preferences</a>`
    : `${
        sub && /^https?:\/\//i.test(sub)
          ? `<a href="${escapeHtml(sub)}" style="${link}">Subscribe to updates</a>
             <span style="color:#c5cdd6;">&nbsp;·&nbsp;</span>`
          : ''
      }<a href="$[LI:UNSUBSCRIBE]$" style="${link}">Unsubscribe</a>
       <span style="color:#c5cdd6;">&nbsp;·&nbsp;</span>
       <a href="$[LI:SUB_PREF]$" style="${link}">Email preferences</a>`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0 0;">
  <tr>
    <td align="center" style="padding:0;font-family:${font};font-size:12px;line-height:1.7;color:${muted};">
      <p style="margin:0 0 10px 0;">${primary}</p>
      <p style="margin:0;font-size:11px;line-height:1.6;color:#9ca3af;">
        Sent by ${brand}. You can change how you hear from us at any time.
      </p>
      <!-- Zoho compliance (required — keeps their default marketing footer from being injected) -->
      <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
        <a href="$[LI:UNSUBSCRIBE]$">Unsubscribe</a>
        <a href="$[LI:ORG_OPTOUT]$">Opt out</a>
        <a href="$[LI:SUB_PREF]$">Preferences</a>
      </div>
    </td>
  </tr>
</table>`;
}

function httpUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^\/\//.test(raw)) return `https:${raw}`;
  return '';
}

function socialLinksHtml(socialLinks) {
  const items = [
    ['linkedin', 'LinkedIn'],
    ['facebook', 'Facebook'],
    ['instagram', 'Instagram'],
    ['twitter', 'X'],
    ['youtube', 'YouTube'],
    ['github', 'GitHub'],
  ];
  const cells = items
    .map(([key, label]) => {
      const href = httpUrl(socialLinks?.[key]);
      if (!href) return null;
      const src = socialIconUrl(key);
      if (!src) return null;
      return `<td style="padding:0 5px;">
        <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="display:block;line-height:0;text-decoration:none;border:0;">
          <img src="${escapeHtml(src)}" alt="${escapeHtml(label)}" width="36" height="36" style="display:block;width:36px;height:36px;border:0;outline:none;text-decoration:none;" />
        </a>
      </td>`;
    })
    .filter(Boolean);
  if (!cells.length) return '';
  return `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:22px auto 0 auto;">
    <tr>${cells.join('')}</tr>
  </table>`;
}

/**
 * Enterprise branded wrapper.
 */
function wrapBrandedEmailHtml({
  bodyHtml = '',
  title = '',
  eyebrow = '',
  category = '',
  orgName = '',
  logoUrl = '',
  brandColor = '#0f766e',
  senderName = '',
  senderEmail = '',
  websiteUrl = '',
  supportEmail = '',
  socialLinks = {},
  companyAddress = '',
  footerReason = '',
  includeSignOff = false,
  subscribeCtaHtml = '',
  unsubscribeFooterHtml = '',
  wordmark,
  publicLogo = false,
  logoMode = '',
} = {}) {
  const resolvedName = String(orgName || '').trim() || 'People Connect HR';
  const brand = escapeHtml(resolvedName);
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(String(brandColor || '').trim())
    ? String(brandColor).trim()
    : '#0f766e';
  const year = new Date().getFullYear();
  const displayTitle = cleanEmailTitle(title, resolvedName);
  const safeTitle = displayTitle ? escapeHtml(displayTitle) : '';
  const label = String(eyebrow || categoryEyebrow(category) || '').trim();
  const safeEyebrow = label ? escapeHtml(label) : '';
  const safeSender = escapeHtml(senderName || '');
  const site = publicSiteBase();
  const companySite = String(websiteUrl || site || '').replace(/\/$/, '');
  const helpEmail = String(supportEmail || '').trim();
  const address = String(companyAddress || '').trim();
  const logo = withLogoCacheBust(resolveLogoUrl(logoUrl));
  const useWordmark = wordmark === undefined ? isWordmarkLogo(logo) : Boolean(wordmark);
  // Zoho Campaigns fetches HTML via public content_url — CID attachments do not work there.
  const usePublicLogo = Boolean(publicLogo) || logoMode === 'https' || logoMode === 'public';
  const httpWordmark = withLogoCacheBust(skillnixEmailLogoUrl() || logo);
  const wordmarkSrc = useWordmark
    ? (usePublicLogo ? httpWordmark : 'cid:skillnix-logo')
    : logo;

  const font =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const canvas = '#f3f4f6';
  const ink = '#111827';
  const muted = '#6b7280';
  const faint = '#9ca3af';
  const line = '#e5e7eb';
  const footerLink = `color:#0f766e;text-decoration:underline;font-weight:500;`;
  const reason = escapeHtml(
    String(footerReason || '').trim() ||
      `You have received this email because you are registered at ${resolvedName}, to ensure the implementation of our Terms of Service and (or) for other legitimate matters.`
  );
  // Privacy / Help / Website must use the sending org site (e.g. skillnixrecruitment.com),
  // not the ATS product FRONTEND_URL (peopleconnecthr.com).
  const linkBase = companySite || site;
  const privacyHref = linkBase ? `${linkBase}/privacy` : '';
  const helpHref = linkBase
    ? `${linkBase}/contact`
    : helpEmail
      ? `mailto:${helpEmail}`
      : '';
  const websiteHref = httpUrl(companySite) || companySite || linkBase;

  let brandHeader;
  if (useWordmark && wordmarkSrc) {
    brandHeader = `
      <tr>
        <td class="em-pad" bgcolor="#111827" style="background-color:#111827;padding:22px 40px;">
          <a href="${escapeHtml(websiteHref || '#')}" style="text-decoration:none;border:0;">
            <img class="em-logo" src="${escapeHtml(wordmarkSrc)}" alt="${brand}" width="168" style="display:block;width:168px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />
          </a>
        </td>
      </tr>`;
  } else if (logo) {
    brandHeader = `
      <tr>
        <td class="em-pad" style="padding:20px 40px;border-bottom:1px solid ${line};background-color:#ffffff;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td valign="middle" style="padding:0;">
                <a href="${escapeHtml(websiteHref || '#')}" style="text-decoration:none;border:0;">
                  <img src="${escapeHtml(logo)}" alt="${brand}" width="36" height="36" style="display:block;width:36px;height:36px;border:0;border-radius:6px;" />
                </a>
              </td>
              <td valign="middle" style="padding:0 0 0 12px;font-family:${font};font-size:15px;font-weight:600;color:${ink};letter-spacing:-0.01em;">${brand}</td>
            </tr>
          </table>
        </td>
      </tr>`;
  } else {
    brandHeader = `
      <tr>
        <td class="em-pad" style="padding:20px 40px;border-bottom:1px solid ${line};background-color:#ffffff;">
          <p style="margin:0;font-family:${font};font-size:15px;font-weight:600;color:${ink};letter-spacing:-0.01em;">${brand}</p>
        </td>
      </tr>`;
  }

  const footerLogo = useWordmark && wordmarkSrc
    ? `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 16px auto;">
        <tr>
          <td bgcolor="#111827" style="background-color:#111827;padding:14px 22px;border-radius:4px;">
            <a href="${escapeHtml(websiteHref || '#')}" style="text-decoration:none;border:0;">
              <img src="${escapeHtml(wordmarkSrc)}" alt="${brand}" width="148" style="display:block;margin:0 auto;width:148px;max-width:148px;height:auto;border:0;outline:none;text-decoration:none;" />
            </a>
          </td>
        </tr>
      </table>`
    : logo
      ? `<a href="${escapeHtml(websiteHref || '#')}" style="text-decoration:none;border:0;"><img src="${escapeHtml(logo)}" alt="${brand}" height="36" style="display:block;margin:0 auto 16px auto;height:36px;width:auto;max-width:200px;border:0;" /></a>`
      : `<p style="margin:0 0 16px 0;font-family:${font};font-size:15px;font-weight:700;letter-spacing:0.04em;color:${accent};">${brand}</p>`;

  const legalLinks = [
    websiteHref ? { href: websiteHref, label: 'Website' } : null,
    privacyHref ? { href: privacyHref, label: 'Privacy policy' } : null,
    helpHref ? { href: helpHref, label: 'Help' } : null,
  ].filter(Boolean);
  const legalHtml = legalLinks
    .map((item, i) => {
      const sep = i === 0 ? '' : `<span style="color:#c5cdd6;">&nbsp;|&nbsp;</span>`;
      return `${sep}<a href="${escapeHtml(item.href)}" target="_blank" rel="noopener noreferrer" style="${footerLink}">${escapeHtml(item.label)}</a>`;
    })
    .join('');

  const signOff =
    includeSignOff && safeSender
      ? `<p style="margin:28px 0 0 0;font-family:${font};font-size:14px;line-height:1.7;color:${muted};">Regards,<br><span style="color:${ink};font-weight:600;">${safeSender}</span><br><span style="color:${faint};font-size:13px;">${brand}</span></p>`
      : '';

  const titleBlock = safeTitle
    ? `<tr>
        <td class="em-pad" style="padding:32px 40px 0 40px;">
          ${
            safeEyebrow
              ? `<p style="margin:0 0 8px 0;font-family:${font};font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${muted};">${safeEyebrow}</p>`
              : ''
          }
          <h1 class="em-title" style="margin:0;font-family:${font};font-size:22px;font-weight:600;line-height:1.35;color:${ink};letter-spacing:-0.02em;">${safeTitle}</h1>
        </td>
      </tr>`
    : '';

  const addressHtml = address
    ? `<p style="margin:14px 0 0 0;font-family:${font};font-size:12px;line-height:1.55;color:${faint};">${escapeHtml(address)}</p>`
    : '';

  const responsiveCss = `
  html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
  * { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
  img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; max-width: 100%; height: auto; }
  a { text-decoration: none; }
  .em-shell { width: 100% !important; max-width: 600px !important; }
  .em-card { width: 100% !important; }
  @media only screen and (max-width: 620px) {
    .em-outer { padding: 16px 10px 20px 10px !important; }
    .em-shell { width: 100% !important; max-width: 100% !important; }
    .em-pad { padding-left: 20px !important; padding-right: 20px !important; }
    .em-body-pad { padding: 20px 20px 28px 20px !important; }
    .em-footer { padding: 24px 16px 8px 16px !important; }
    .em-title { font-size: 20px !important; line-height: 1.35 !important; }
    .em-role-title { font-size: 18px !important; }
    .em-logo { width: 140px !important; max-width: 140px !important; }
    .em-btn, .em-btn table { width: 100% !important; max-width: 100% !important; }
    .em-btn-link { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    .em-detail-label {
      display: block !important;
      width: 100% !important;
      padding: 0 0 4px 0 !important;
      font-size: 10px !important;
    }
    .em-detail-value {
      display: block !important;
      width: 100% !important;
    }
    .em-detail-row { padding-top: 14px !important; padding-bottom: 14px !important; }
  }
  @media only screen and (max-width: 380px) {
    .em-pad { padding-left: 16px !important; padding-right: 16px !important; }
    .em-body-pad { padding: 18px 16px 24px 16px !important; }
    .em-title { font-size: 18px !important; }
  }`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no" />
  <title>${safeTitle || brand}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
        <o:AllowPNG/>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <style type="text/css">
    table, td { font-family: Segoe UI, Helvetica, Arial, sans-serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">${responsiveCss}
  </style>
</head>
<body style="margin:0;padding:0;background-color:${canvas};-webkit-font-smoothing:antialiased;overflow:visible;max-height:none;width:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${safeTitle || brand}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${canvas};width:100%;max-width:100%;overflow:visible;">
    <tr>
      <td class="em-outer" align="center" style="padding:32px 16px 24px 16px;overflow:visible;">
        <!--[if mso]>
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td>
        <![endif]-->
        <table role="presentation" class="em-shell" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;overflow:visible;">

          <tr>
            <td style="background-color:#ffffff;border:1px solid ${line};border-radius:10px;overflow:visible;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="overflow:visible;">
                <tr>
                  <td height="4" style="height:4px;line-height:4px;font-size:0;background-color:${accent};border-radius:10px 10px 0 0;">&nbsp;</td>
                </tr>
                ${brandHeader}
                ${titleBlock}
                <tr>
                  <td class="em-body-pad" style="padding:${safeTitle ? '20px' : '32px'} 40px 36px 40px;font-family:${font};font-size:15px;line-height:1.7;color:#374151;overflow:visible;word-break:break-word;">
                    ${bodyHtml}
                    ${subscribeCtaHtml || ''}
                    ${signOff}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="em-footer" align="center" style="padding:32px 24px 12px 24px;text-align:center;">
              ${footerLogo}
              <p style="margin:0 auto;max-width:460px;font-family:${font};font-size:13px;line-height:1.7;color:${muted};">${reason}</p>
              ${socialLinksHtml(socialLinks)}
              ${
                legalHtml
                  ? `<p style="margin:18px 0 0 0;font-family:${font};font-size:13px;line-height:1.6;">${legalHtml}</p>`
                  : ''
              }
              ${unsubscribeFooterHtml || ''}
              ${addressHtml}
              <p style="margin:16px 0 0 0;font-family:${font};font-size:12px;line-height:1.6;color:${faint};">&copy; ${year} ${brand}</p>
            </td>
          </tr>
        </table>
        <!--[if mso]>
        </td></tr></table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Solid enterprise CTA button (no gradient — Outlook-safe).
 * Full-width centered block for marketing CTAs.
 */
function brandButtonHtml({ href, label, brandColor = '#0f766e', fullWidth = false }) {
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(String(brandColor || '').trim())
    ? String(brandColor).trim()
    : '#0f766e';
  const font =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const inner = `<td align="center" bgcolor="${accent}" style="background-color:${accent};border-radius:8px;mso-padding-alt:14px 28px;">
        <a class="em-btn-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="display:${fullWidth ? 'block' : 'inline-block'};padding:15px 28px;font-family:${font};font-size:15px;font-weight:600;letter-spacing:0.01em;color:#ffffff !important;text-decoration:none;text-align:center;line-height:1.3;">${escapeHtml(label)}</a>
      </td>`;
  if (fullWidth) {
    return `<table role="presentation" class="em-btn" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px 0;">
    <tr>
      <td align="center" style="padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>${inner}</tr>
        </table>
      </td>
    </tr>
  </table>`;
  }
  return `<table role="presentation" class="em-btn" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto;">
    <tr>${inner}</tr>
  </table>`;
}

/**
 * Subscribe invite — same prose layout as transactional Direct mail (no soft cards).
 */
function subscribeInviteHtml({
  candidateName = 'Candidate',
  company = 'our talent team',
  brandColor = '#0f766e',
} = {}) {
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(String(brandColor || '').trim())
    ? String(brandColor).trim()
    : '#0f766e';
  const font =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const rawName = String(candidateName || '').trim();
  const name = escapeHtml(
    !rawName || /^there$/i.test(rawName) ? 'Candidate' : rawName
  );
  const brand = escapeHtml(String(company || 'our talent team').trim() || 'our talent team');

  return `
<p style="margin:0 0 16px 0;font-family:${font};font-size:16px;line-height:1.6;color:#0f172a;font-weight:600;">Dear ${name},</p>
<p style="margin:0 0 12px 0;font-family:${font};font-size:15px;line-height:1.7;color:#334155;">
  Thank you for your interest in <strong style="color:#0f172a;">${brand}</strong>. We would like to keep you informed about roles and hiring drives that match your profile.
</p>
<p style="margin:0 0 12px 0;font-family:${font};font-size:15px;line-height:1.7;color:#334155;">
  When you subscribe, you will receive:
</p>
<ul style="margin:0 0 16px 0;padding-left:18px;font-family:${font};font-size:15px;line-height:1.8;color:#334155;">
  <li>Curated job alerts matched to your experience</li>
  <li>Early notice of new openings and hiring drives</li>
  <li>Occasional career updates from our talent team</li>
</ul>
<p style="margin:0;font-family:${font};font-size:15px;line-height:1.7;color:#334155;">
  Use the button below to subscribe. You can unsubscribe at any time.
  <span style="color:${accent};">&#8203;</span>
</p>`;
}

/**
 * Open-role marketing body — one professional card (position + details), clear CTA.
 */
function roleSpotlightHtml({
  candidateName = 'Candidate',
  company = 'our talent team',
  employer = '',
  position = 'a new role',
  jobCode = '',
  ctc = '',
  experience = '',
  location = '',
  summary = '',
  applyUrl = '',
  brandColor = '#0f766e',
} = {}) {
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(String(brandColor || '').trim())
    ? String(brandColor).trim()
    : '#0f766e';
  const font =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const rawName = String(candidateName || '').trim();
  const name = escapeHtml(
    !rawName || /^(there|candidates?)$/i.test(rawName) ? 'Candidate' : rawName
  );
  void company;
  const roleRaw = String(position || '').trim();
  const role = escapeHtml(roleRaw || 'this opportunity');
  const code = escapeHtml(String(jobCode || '').trim());
  const employerLabel = escapeHtml(String(employer || '').trim());
  const loc = escapeHtml(String(location || '').trim());
  const exp = escapeHtml(String(experience || '').trim());
  const pay = escapeHtml(String(ctc || '').trim());
  const rawBrief = String(summary || '').trim();
  const brief = looksLikeJdDump(rawBrief) ? '' : escapeHtml(rawBrief);
  const href = String(applyUrl || '').trim().replace(/[?&]+$/g, '');
  const applyOk = /^https?:\/\//i.test(href);

  const detailRows = [
    code ? { label: 'Job ID', value: code } : null,
    employerLabel ? { label: 'Employer', value: employerLabel } : null,
    pay ? { label: 'Compensation', value: pay } : null,
    exp ? { label: 'Experience', value: exp } : null,
    loc ? { label: 'Location', value: loc } : null,
  ].filter(Boolean);

  const detailRowsHtml = detailRows
    .map((r, idx) => {
      const border = idx < detailRows.length - 1 ? 'border-bottom:1px solid #eef2f6;' : '';
      return `<tr>
        <td class="em-detail-row" style="padding:12px 0;${border}">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td class="em-detail-label" width="34%" valign="top" style="width:34%;padding:0 12px 0 0;font-family:${font};font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;line-height:1.45;">${escapeHtml(r.label)}</td>
              <td class="em-detail-value" valign="top" style="padding:0;font-family:${font};font-size:14px;font-weight:600;color:#0f172a;line-height:1.45;word-break:break-word;">${escapeHtml(r.value)}</td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join('');

  const opportunityCard = `
<table role="presentation" class="em-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 20px 0;border:1px solid #e5e7eb;border-radius:10px;border-collapse:separate !important;overflow:hidden;">
  <tr>
    <td style="border-left:4px solid ${accent};background-color:#ffffff;padding:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:20px 20px 18px 18px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:0 0 16px 0;${detailRows.length ? 'border-bottom:1px solid #eef2f6;' : ''}">
                  <p style="margin:0 0 6px 0;font-family:${font};font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${accent};">Position</p>
                  <p class="em-role-title" style="margin:0;font-family:${font};font-size:20px;font-weight:700;line-height:1.3;letter-spacing:-0.02em;color:#0f172a;">${role}</p>
                </td>
              </tr>
              ${detailRowsHtml ? `<tr><td style="padding:4px 0 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${detailRowsHtml}</table></td></tr>` : ''}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

  const applyBlock = applyOk
    ? `<div style="margin:18px 0 8px 0;text-align:center;">${brandButtonHtml({
        href,
        label: 'View role & apply',
        brandColor: accent,
        fullWidth: true,
      })}
      <p style="margin:8px 0 0 0;text-align:center;font-family:${font};font-size:12px;line-height:1.55;color:#94a3b8;">Prefer to reply by email? Respond to this message and we will follow up.</p>
    </div>`
    : '';

  return `
<p style="margin:0 0 16px 0;font-family:${font};font-size:16px;line-height:1.6;color:#0f172a;font-weight:600;">Dear ${name},</p>
<p style="margin:0 0 12px 0;font-family:${font};font-size:15px;line-height:1.7;color:#334155;">
  I am writing to share a role that may align with your experience. Key details are below for your review.
</p>
${opportunityCard}
${brief ? `<p style="margin:0 0 14px 0;font-family:${font};font-size:15px;line-height:1.7;color:#334155;">${brief}</p>` : ''}
${applyBlock}
<p style="margin:0 0 12px 0;font-family:${font};font-size:15px;line-height:1.7;color:#334155;">
  ${applyOk
    ? 'If this opportunity is of interest, please apply using the button above, or reply to this email with an updated resume.'
    : 'If this opportunity is of interest, please reply to this email with an updated resume and we will take the next step.'}
</p>
<p style="margin:0;font-family:${font};font-size:15px;line-height:1.7;color:#334155;">
  If the timing is not right, you are welcome to stay subscribed for future roles that match your profile.
</p>`;
}

/**
 * Soft re-engagement body — transactional prose, no marketing callout cards.
 */
function reengageInviteHtml({
  candidateName = 'Candidate',
  company = 'our talent team',
  brandColor = '#0f766e',
} = {}) {
  const font =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const rawName = String(candidateName || '').trim();
  const name = escapeHtml(
    !rawName || /^there$/i.test(rawName) ? 'Candidate' : rawName
  );
  const brand = escapeHtml(String(company || 'our talent team').trim() || 'our talent team');
  void brandColor;
  return `
<p style="margin:0 0 16px 0;font-family:${font};font-size:16px;line-height:1.6;color:#0f172a;font-weight:600;">Dear ${name},</p>
<p style="margin:0 0 12px 0;font-family:${font};font-size:15px;line-height:1.7;color:#334155;">
  It has been a while since we connected. <strong style="color:#0f172a;">${brand}</strong> continues to work on roles that may match your background.
</p>
<p style="margin:0 0 12px 0;font-family:${font};font-size:15px;line-height:1.7;color:#334155;">
  Stay on our talent network to receive curated openings, or unsubscribe if you prefer not to hear from us.
</p>
<p style="margin:0;font-family:${font};font-size:15px;line-height:1.7;color:#334155;">
  Use the button below to confirm you wish to receive job and career updates.
</p>`;
}

/**
 * Soft info panel for key details (dates, venue, CTC, etc.).
 */
function infoPanelHtml(rows = [], brandColor = '#0d9488') {
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(String(brandColor || '').trim())
    ? String(brandColor).trim()
    : '#0d9488';
  const font =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const filtered = (rows || []).filter((r) => r && String(r.value || '').trim());
  const body = filtered
    .map((r, idx) => {
      const border = idx < filtered.length - 1 ? 'border-bottom:1px solid #eef2f6;' : '';
      return `<tr>
        <td class="em-detail-row" style="padding:11px 0;${border}">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td class="em-detail-label" width="34%" valign="top" style="width:34%;padding:0 12px 0 0;font-family:${font};font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;line-height:1.45;">${escapeHtml(r.label)}</td>
              <td class="em-detail-value" valign="top" style="padding:0;font-family:${font};font-size:14px;font-weight:600;color:#0f172a;line-height:1.45;word-break:break-word;">${escapeHtml(r.value)}</td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join('');
  if (!body) return '';
  return `<table role="presentation" class="em-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 20px 0;border:1px solid #e5e7eb;border-radius:10px;border-collapse:separate !important;overflow:hidden;">
    <tr>
      <td style="border-left:4px solid ${accent};background-color:#ffffff;padding:4px 18px 4px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table>
      </td>
    </tr>
  </table>`;
}

/**
 * Large OTP / verification code panel (enterprise security emails).
 * Individual digit cells stay readable in Outlook, Gmail, and Apple Mail.
 */
function otpCodeHtml(code, brandColor = '#0d9488') {
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(String(brandColor || '').trim())
    ? String(brandColor).trim()
    : '#0d9488';
  const font =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const digits = String(code || '').replace(/\s/g, '').split('').slice(0, 8);
  if (!digits.length) return '';

  const cells = digits.map((digit, i) => {
    const gap = i === 0
      ? ''
      : `<td width="6" style="width:6px;font-size:0;line-height:0;">&nbsp;</td>`;
    return `${gap}<td align="center" valign="middle" style="width:40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" valign="middle" width="40" height="48" style="width:40px;height:48px;background-color:#f9fafb;border:1px solid #e5e7eb;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace;font-size:22px;font-weight:600;line-height:48px;color:#111827;">
            ${escapeHtml(digit)}
          </td>
        </tr>
      </table>
    </td>`;
  }).join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 8px 0;">
    <tr>
      <td style="padding:18px 20px;background-color:#f9fafb;border:1px solid #e5e7eb;border-left:3px solid ${accent};">
        <p style="margin:0 0 12px 0;font-family:${font};font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;">Verification code</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>${cells}</tr>
        </table>
        <p style="margin:12px 0 0 0;font-family:${font};font-size:12px;line-height:1.5;color:#6b7280;">Expires in 10 minutes. Do not share this code.</p>
      </td>
    </tr>
  </table>`;
}

function loginPageUrl(query = {}) {
  const site = publicSiteBase() || 'https://www.peopleconnecthr.com';
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `${site}/login?${qs}` : `${site}/login`;
}

function loginOtpResendUrl({ otpToken, email } = {}) {
  return loginPageUrl({
    otp: '1',
    otpResend: '1',
    otpToken,
    email,
  });
}

function registerPageUrl(query = {}) {
  const site = publicSiteBase() || 'https://www.peopleconnecthr.com';
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `${site}/register?${qs}` : `${site}/register`;
}

function hiddenHiringContactHtml(email) {
  const raw = String(email || '').trim().toLowerCase();
  if (!raw || !raw.includes('@')) return '';
  const safe = escapeHtml(raw);
  return `<!-- pc-hiring-contact:${safe} --><div aria-hidden="true" style="font-size:1px;line-height:1px;max-height:1px;overflow:hidden;opacity:0;color:#f3f4f6;">pc-hiring-contact:${safe}</div>`;
}

function signupOtpResendUrl({ signupOtpToken, email } = {}) {
  return registerPageUrl({
    signupOtp: '1',
    otpResend: '1',
    signupOtpToken,
    email,
  });
}

module.exports = {
  escapeHtml,
  resolveLogoUrl,
  loadOrgEmailBrand,
  loadPlatformEmailBrand,
  loadSendingEmailBrand,
  resolvePublicMarketingBrand,
  identityForFromEmail,
  wrapBrandedEmailHtml,
  brandButtonHtml,
  subscribeInviteHtml,
  roleSpotlightHtml,
  reengageInviteHtml,
  marketingFooterReason,
  zohoCampaignComplianceFooterHtml,
  infoPanelHtml,
  otpCodeHtml,
  isWordmarkLogo,
  mixHex,
  categoryEyebrow,
  cleanEmailTitle,
  publicOrgLogoUrl,
  publicSiteBase,
  loginPageUrl,
  loginOtpResendUrl,
  registerPageUrl,
  signupOtpResendUrl,
  hiddenHiringContactHtml,
};
