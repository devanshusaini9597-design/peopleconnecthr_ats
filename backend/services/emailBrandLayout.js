/**
 * Enterprise ATS email chrome — Greenhouse / Lever / Ashby inspired.
 * Table-based + inline styles for Outlook, Gmail, Apple Mail.
 *
 * Logo note: Skillnix wordmark is white text → dark header only.
 * Logo asset MUST be a real PNG with alpha (not WebP renamed to .png).
 */
const Organization = require('../models/Organization');

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
  const base = publicSiteBase();
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
  const site = publicSiteBase();
  return site ? `${site}/skillnix-logo-email.png` : '';
}

function loadPlatformEmailBrand() {
  return {
    name: 'Skillnix Recruitment',
    logoUrl: withLogoCacheBust(skillnixEmailLogoUrl()),
    iconUrl: withLogoCacheBust(skillnixEmailLogoUrl()),
    brandColor: '#5b21b6',
    wordmark: true,
  };
}

async function loadOrgEmailBrand(organizationId) {
  const fallback = loadPlatformEmailBrand();
  if (!organizationId) return fallback;
  try {
    const org = await Organization.findById(organizationId)
      .select('name domain atsSettings.brandColor atsSettings.whiteLabel')
      .lean();
    const whiteLabelName = org?.atsSettings?.whiteLabel?.emailFromName;
    const name = String(whiteLabelName || org?.name || '').trim() || fallback.name;
    let brandColor = String(org?.atsSettings?.brandColor || '').trim() || fallback.brandColor;
    if (/skillnix/i.test(name) || /skillnix/i.test(String(org?.domain || ''))) {
      brandColor = brandColor || '#5b21b6';
    }
    return {
      name,
      logoUrl: fallback.logoUrl,
      iconUrl: fallback.iconUrl,
      brandColor,
      wordmark: true,
    };
  } catch (_) {
    return fallback;
  }
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
    marketing: 'Career update',
    security: 'Security',
    invitation: 'Invitation',
    report: 'Report',
  };
  const key = String(category || '').toLowerCase().trim();
  return map[key] || '';
}

/**
 * Enterprise branded wrapper.
 */
function wrapBrandedEmailHtml({
  bodyHtml = '',
  title = '',
  eyebrow = '',
  category = '',
  orgName = 'Skillnix Recruitment',
  logoUrl = '',
  brandColor = '#5b21b6',
  senderName = '',
  senderEmail = '',
  includeSignOff = false,
  subscribeCtaHtml = '',
  unsubscribeFooterHtml = '',
  wordmark,
} = {}) {
  const brand = escapeHtml(orgName || 'Skillnix Recruitment');
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(String(brandColor || '').trim())
    ? String(brandColor).trim()
    : '#5b21b6';
  const year = new Date().getFullYear();
  const displayTitle = cleanEmailTitle(title, orgName);
  const safeTitle = displayTitle ? escapeHtml(displayTitle) : '';
  const label = String(eyebrow || categoryEyebrow(category) || '').trim();
  const safeEyebrow = label ? escapeHtml(label) : '';
  const safeSender = escapeHtml(senderName || '');
  const safeSenderEmail = senderEmail ? escapeHtml(senderEmail) : '';
  const logo = withLogoCacheBust(resolveLogoUrl(logoUrl) || skillnixEmailLogoUrl());
  const useWordmark = wordmark === undefined ? true : Boolean(wordmark);

  const font =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const headerBg = '#1e1b4b';

  let brandHeader;
  if (logo && useWordmark) {
    brandHeader = `
      <tr>
        <td align="center" bgcolor="${headerBg}" style="background-color:${headerBg};padding:32px 36px 28px 36px;text-align:center;">
          <img src="${escapeHtml(logo)}" alt="Skillnix" width="220" style="display:block;margin:0 auto;width:220px;max-width:220px;height:auto;border:0;outline:none;text-decoration:none;" />
        </td>
      </tr>`;
  } else if (logo) {
    brandHeader = `
      <tr>
        <td align="center" bgcolor="${headerBg}" style="background-color:${headerBg};padding:28px 36px;text-align:center;">
          <img src="${escapeHtml(logo)}" alt="${brand}" width="48" height="48" style="display:inline-block;width:48px;height:48px;border:0;border-radius:10px;background-color:#ffffff;" />
          <p style="margin:10px 0 0 0;font-family:${font};font-size:16px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">${brand}</p>
        </td>
      </tr>`;
  } else {
    brandHeader = `
      <tr>
        <td align="center" bgcolor="${headerBg}" style="background-color:${headerBg};padding:28px 36px;text-align:center;">
          <p style="margin:0;font-family:${font};font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">${brand}</p>
        </td>
      </tr>`;
  }

  const signOff =
    includeSignOff && safeSender
      ? `<p style="margin:28px 0 0 0;font-family:${font};font-size:15px;line-height:1.6;color:#57534e;">Best regards,<br><strong style="color:#0f172a;">${safeSender}</strong><br><span style="color:#78716c;font-size:13px;">${brand}</span></p>`
      : '';

  const titleBlock = safeTitle
    ? `<tr>
        <td style="padding:32px 36px 0 36px;">
          ${
            safeEyebrow
              ? `<p style="margin:0 0 12px 0;"><span style="display:inline-block;padding:5px 12px;border-radius:999px;background-color:${accent}1a;font-family:${font};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${accent};">${safeEyebrow}</span></p>`
              : ''
          }
          <h1 style="margin:0;font-family:${font};font-size:22px;font-weight:700;line-height:1.35;color:#0f172a;letter-spacing:-0.02em;">${safeTitle}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 36px 0 36px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="height:1px;background-color:#e8e8ed;font-size:0;line-height:0;">&nbsp;</td>
          </tr></table>
        </td>
      </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>${safeTitle || brand}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${safeTitle || brand}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f5f7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border:1px solid #e2e5eb;border-radius:12px;overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${brandHeader}
                ${titleBlock}
                <tr>
                  <td style="padding:${safeTitle ? '22px' : '36px'} 36px 8px 36px;font-family:${font};font-size:15px;line-height:1.7;color:#334155;">
                    ${bodyHtml}
                    ${signOff}
                    ${subscribeCtaHtml || ''}
                  </td>
                </tr>

                <!-- Inner footer strip -->
                <tr>
                  <td style="padding:24px 36px 28px 36px;border-top:1px solid #eef0f3;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-family:${font};font-size:12px;line-height:1.55;color:#64748b;">
                          ${
                            safeSender
                              ? `Sent by <strong style="color:#0f172a;">${safeSender}</strong>${safeSenderEmail ? ` &middot; <a href="mailto:${safeSenderEmail}" style="color:#475569;text-decoration:none;">${safeSenderEmail}</a>` : ''}`
                              : `<strong style="color:#0f172a;">${brand}</strong>`
                          }
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Outer footer -->
          <tr>
            <td style="padding:24px 12px 8px 12px;text-align:center;">
              ${unsubscribeFooterHtml || ''}
              <p style="margin:0 0 6px 0;font-family:${font};font-size:13px;font-weight:600;color:#0f172a;">${brand}</p>
              <p style="margin:0;font-family:${font};font-size:11px;line-height:1.6;color:#94a3b8;">&copy; ${year} ${brand}. All rights reserved.</p>
              <p style="margin:10px 0 0 0;font-family:${font};font-size:10px;line-height:1.55;color:#cbd5e1;">This message was sent via an Applicant Tracking System. Do not share sensitive personal information in reply.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Solid enterprise CTA button (no gradient — Outlook-safe).
 */
function brandButtonHtml({ href, label, brandColor = '#0d9488' }) {
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(String(brandColor || '').trim())
    ? String(brandColor).trim()
    : '#0d9488';
  const font =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 12px 0;">
    <tr>
      <td align="center" bgcolor="${accent}" style="background-color:${accent};border-radius:6px;mso-padding-alt:14px 28px;">
        <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-family:${font};font-size:14px;font-weight:600;color:#ffffff !important;text-decoration:none;letter-spacing:0.01em;border-radius:6px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
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
  const body = (rows || [])
    .filter((r) => r && (r.label || r.value))
    .map(
      (r) => `<tr>
        <td style="padding:8px 0;font-family:${font};font-size:13px;color:#64748b;width:140px;vertical-align:top;">${escapeHtml(r.label)}</td>
        <td style="padding:8px 0;font-family:${font};font-size:13px;color:#0f172a;font-weight:600;vertical-align:top;">${escapeHtml(r.value)}</td>
      </tr>`
    )
    .join('');
  if (!body) return '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 20px 0;background-color:#f8fafc;border:1px solid #eef0f3;border-left:3px solid ${accent};">
    <tr><td style="padding:14px 18px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>
    </td></tr>
  </table>`;
}

/**
 * Large OTP / verification code panel (enterprise security emails).
 */
function otpCodeHtml(code, brandColor = '#0d9488') {
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(String(brandColor || '').trim())
    ? String(brandColor).trim()
    : '#0d9488';
  const font =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const safe = escapeHtml(String(code || '').trim());
  if (!safe) return '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px 0;">
    <tr>
      <td align="center" style="padding:22px 16px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
        <p style="margin:0 0 8px 0;font-family:${font};font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${accent};">Verification code</p>
        <p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:0.28em;color:#0f172a;">${safe}</p>
      </td>
    </tr>
  </table>`;
}

module.exports = {
  escapeHtml,
  resolveLogoUrl,
  loadOrgEmailBrand,
  loadPlatformEmailBrand,
  wrapBrandedEmailHtml,
  brandButtonHtml,
  infoPanelHtml,
  otpCodeHtml,
  isWordmarkLogo,
  mixHex,
  categoryEyebrow,
  cleanEmailTitle,
  publicOrgLogoUrl,
  publicSiteBase,
};
