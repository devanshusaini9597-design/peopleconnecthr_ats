/**
 * Email template send orchestration — marketing vs transactional,
 * variable merge, HTML composition, per-recipient delivery.
 */
const logger = require('../utils/logger');
const EmailTemplate = require('../models/EmailTemplate');
const { signEmail } = require('../utils/subscribeSign');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

function applyVariables(templateStr, vars) {
  let out = templateStr;
  Object.entries(vars).forEach(([key, val]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    out = out.replace(regex, typeof val === 'string' ? val : val || '');
  });
  return out;
}

/** Strip leftover placeholders and empty labeled fields so marketing copy stays professional. */
function polishMergedSubject(subject) {
  let s = String(subject || '');
  s = s.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, '');
  s = s.replace(/\s*[–—]\s*/g, ' – ');
  s = s.replace(/:\s*–\s*/g, ': ');
  s = s.replace(/\s*–\s*(?=\||$)/g, '');
  s = s.replace(/:\s*(?=\||$)/g, '');
  s = s.replace(/\s*\|\s*$/g, '');
  s = s.replace(/^\s*\|\s*/g, '');
  s = s.replace(/\s*\|\s*/g, ' | ');
  s = s.replace(/\s{2,}/g, ' ').trim();
  s = s.replace(/^([A-Za-z][^|]{0,40}?)\s*\|\s*$/g, '$1');
  if (!s || /^[:–—\-|]+$/i.test(s) || /^(Hiring drive|Job alert|Update)\s*:?$/i.test(s)) {
    return 'Career update';
  }
  return s;
}

function polishMergedBody(body) {
  let s = String(body || '');
  s = s.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, '');
  // Drop labeled lines / bullets with no value (Date:, • Time:, etc.)
  s = s.replace(/^[•●\-]\s*[A-Za-z][^:\n]{0,48}:\s*$/gim, '');
  s = s.replace(/^[A-Z][A-Za-z0-9\s\/]{0,40}:\s*$/gim, '');
  // Drop orphan section headers when details were cleared
  s = s.replace(/^(Drive details|Details|Key details|Role details):\s*$/gim, '');
  // Grammar when position/company slots were empty
  s = s.replace(/\bfor\s+with\b/gi, 'with');
  s = s.replace(/\bfor\s+at\b/gi, 'at');
  s = s.replace(/\bat\s+with\b/gi, 'with');
  s = s.replace(/\s+[–—]\s*(?=[,.;]|$)/g, '');
  s = s.replace(/[ \t]{2,}/g, ' ');
  s = s.replace(/[ \t]+\n/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

function buildHtmlContent(emailBody, { isSubscribeInvite, brandColor = '#0f766e', subscribeUrl = '' } = {}) {
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(String(brandColor || '').trim())
    ? String(brandColor).trim()
    : '#0f766e';
  const subHref = String(subscribeUrl || '').trim();
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(emailBody);
  if (looksLikeHtml) {
    let html = emailBody
      .replace(/Subscribe now:\s*/gi, '')
      .replace(/Subscribe here:\s*/gi, '');
    if (subHref && /^https?:\/\//i.test(subHref)) {
      html = html.replace(/\{\{subscribeLink\}\}/gi, subHref);
      // Turn bare "subscribe" mentions into a real link when the template forgot {{subscribeLink}}
      html = html.replace(
        /(^|>|[\s(])subscribe(?=[\s.,;:!?<)]|$)/gi,
        `$1<a href="${subHref}" style="color:${accent};font-weight:600;text-decoration:underline;">subscribe</a>`
      );
    } else {
      html = html.replace(/\{\{subscribeLink\}\}/gi, '');
    }
    return html;
  }

  const bodyLines = emailBody.split('\n');
  let htmlContent = '';
  let inList = false;
  let inDetailBlock = false;
  let detailRows = '';

  const closeDetailBlock = () => {
    if (!inDetailBlock) return;
    if (detailRows) {
      htmlContent += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 18px 0;background-color:#f8fafc;border:1px solid #eef0f3;border-left:3px solid ${accent};"><tr><td style="padding:12px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailRows}</table></td></tr></table>`;
    }
    detailRows = '';
    inDetailBlock = false;
  };

  bodyLines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) {
        htmlContent += '</ul>';
        inList = false;
      }
      closeDetailBlock();
      htmlContent += '<div style="height:10px;"></div>';
    } else if (
      isSubscribeInvite &&
      /^(Subscribe now:|Subscribe here:)\s*(.+)?$/i.test(trimmed)
    ) {
      if (inList) {
        htmlContent += '</ul>';
        inList = false;
      }
      closeDetailBlock();
    } else if (/unsubscribe|email preferences|click here:\s*#?unsubscribe/i.test(trimmed)) {
      if (inList) {
        htmlContent += '</ul>';
        inList = false;
      }
      closeDetailBlock();
    } else if (/^(\d+[\.\)]|[-•●])\s/.test(trimmed)) {
      closeDetailBlock();
      const item = trimmed.replace(/^(\d+[\.\)]|[-•●])\s*/, '');
      // Skip empty labeled bullets (e.g. "Date:" with no value)
      if (/^[A-Za-z][^:]{0,40}:\s*$/.test(item) || !item) {
        return;
      }
      if (!inList) {
        htmlContent +=
          `<ul style="margin:8px 0 14px 0;padding:0 0 0 18px;color:#374151;">`;
        inList = true;
      }
      htmlContent += `<li style="margin:0 0 8px 0;font-size:14.5px;line-height:1.65;color:#374151;">${item}</li>`;
    } else if (trimmed.startsWith('Dear ')) {
      if (inList) {
        htmlContent += '</ul>';
        inList = false;
      }
      closeDetailBlock();
      htmlContent += `<p style="margin:0 0 16px 0;font-size:15px;color:#111827;font-weight:600;">${trimmed}</p>`;
    } else if (/^(Best regards|Regards|Sincerely|Thank you|Warm regards)/i.test(trimmed)) {
      if (inList) {
        htmlContent += '</ul>';
        inList = false;
      }
      closeDetailBlock();
      htmlContent += `<div style="margin-top:24px;"><p style="margin:0 0 2px 0;font-size:14px;color:#6b7280;">${trimmed}</p>`;
    } else if (
      idx > 0 &&
      /^(Best regards|Regards|Sincerely|Thank you|Warm regards)/i.test(
        bodyLines
          .slice(0, idx)
          .reverse()
          .find((l) => l.trim())
          ?.trim() || ''
      )
    ) {
      htmlContent += `<p style="margin:0 0 1px 0;font-size:14px;color:#111827;font-weight:700;">${trimmed}</p>`;
    } else if (/^[A-Z][A-Za-z\s\/]+:\s/.test(trimmed) || /^[•●\-]\s*[A-Za-z].+:\s/.test(trimmed)) {
      if (inList) {
        htmlContent += '</ul>';
        inList = false;
      }
      const cleaned = trimmed.replace(/^[•●\-]\s*/, '');
      const colonIdx = cleaned.indexOf(':');
      const key = cleaned.substring(0, colonIdx).trim();
      const val = cleaned.substring(colonIdx + 1).trim();
      if (!val || /^[–—\-]+$/.test(val)) {
        return;
      }
      inDetailBlock = true;
      detailRows += `<tr>
        <td style="padding:6px 0;font-size:13px;color:#6b7280;width:140px;vertical-align:top;">${key}</td>
        <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:600;vertical-align:top;">${val}</td>
      </tr>`;
    } else if (/^(Drive details|Details|Key details|Role details):\s*$/i.test(trimmed)) {
      // Orphan header with no following values — skip
      if (inList) {
        htmlContent += '</ul>';
        inList = false;
      }
      closeDetailBlock();
    } else {
      if (inList) {
        htmlContent += '</ul>';
        inList = false;
      }
      closeDetailBlock();
      htmlContent += `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.7;color:#374151;">${trimmed}</p>`;
    }
  });
  if (inList) htmlContent += '</ul>';
  closeDetailBlock();
  if (htmlContent.includes('margin-top:24px;')) htmlContent += '</div>';
  if (subHref && /^https?:\/\//i.test(subHref)) {
    htmlContent = htmlContent.replace(
      /(^|>|[\s(])subscribe(?=[\s.,;:!?<)&]|$)/gi,
      `$1<a href="${subHref}" style="color:${accent};font-weight:600;text-decoration:underline;">subscribe</a>`
    );
  }
  return htmlContent;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Outer email chrome. `orgBrand` = recruiter organization (e.g. Devlumiq).
 * Never use job {{company}} here — that belongs in the body only.
 */
function wrapEmailHtml({
  emailSubject,
  htmlContent,
  subscribeCtaHtml,
  unsubscribeFooterHtml,
  senderName,
  senderEmail,
  companyName,
  orgBrand,
  logoUrl,
  brandColor,
  category,
  footerReason,
  eyebrow,
  publicLogo,
  websiteUrl,
  supportEmail,
  socialLinks,
  companyAddress,
  wordmark,
}) {
  const { wrapBrandedEmailHtml, categoryEyebrow, marketingFooterReason } = require('./emailBrandLayout');
  const org = orgBrand || companyName || 'Skillnix Recruitment';
  const isMarketing = String(category || '').toLowerCase() === 'marketing';
  return wrapBrandedEmailHtml({
    title: emailSubject,
    category: category || '',
    eyebrow: eyebrow || categoryEyebrow(category),
    bodyHtml: htmlContent,
    orgName: org,
    logoUrl: logoUrl || '',
    brandColor: brandColor || '#0f766e',
    senderName: senderName || '',
    senderEmail: senderEmail || '',
    websiteUrl: websiteUrl || '',
    supportEmail: supportEmail || '',
    socialLinks: socialLinks || {},
    companyAddress: companyAddress || '',
    wordmark,
    // Match transactional Direct mail: sign-off under the body when we know the sender,
    // but skip if the template already includes Best regards / Regards (avoids double sign-off).
    includeSignOff:
      Boolean(senderName) &&
      !/\b(best\s+regards|warm\s+regards|regards|sincerely)\b/i.test(String(htmlContent || '')),
    subscribeCtaHtml,
    unsubscribeFooterHtml,
    footerReason:
      footerReason ||
      (isMarketing ? marketingFooterReason(org) : ''),
    publicLogo: publicLogo !== undefined ? Boolean(publicLogo) : isMarketing,
  });
}

function mapSendError(err) {
  let errMsg = err.displayMessage || err.message;
  const fromZoho =
    err.response?.data &&
    (err.response.status === 400 || err.response.status === 401 || err.response.status === 403);
  const zohoMsg =
    fromZoho &&
    (typeof err.response.data === 'object'
      ? err.response.data.message || err.response.data.error || ''
      : '');
  if (err.displayMessage) {
    errMsg = err.displayMessage;
  } else if (err.code === 'CAMPAIGNS_SCOPE') {
    errMsg =
      'Zoho Campaigns OAuth needs campaign CREATE + UPDATE scopes. Regenerate Self Client code with ZohoCampaigns.campaign.CREATE,ZohoCampaigns.campaign.UPDATE (and contact scopes), then update ZOHO_CAMPAIGNS_REFRESH_TOKEN.';
  } else if (err.code === 'CAMPAIGNS_FROM_EMAIL' || err.code === 'CAMPAIGNS_FROM_UNVERIFIED') {
    errMsg =
      err.displayMessage ||
      'Your login email is not a Zoho Campaigns sender yet. Add it under Zoho Campaigns → Settings → Deliverability → Manage Senders, verify the confirmation email, then retry.';
  } else if (err.code === 'CAMPAIGNS_LIST_EMPTY') {
    errMsg =
      err.displayMessage ||
      'Zoho has not activated this contact yet (often pending opt-in). Confirm Zoho’s subscription email or allow API contacts without confirmation under Manage Opt-in, then retry.';
  } else if (zohoMsg && /failed to load|client_id|client_secret|refresh_token|list key/i.test(zohoMsg)) {
    errMsg =
      'Zoho Campaigns config error. In backend .env set: ZOHO_CAMPAIGNS_CLIENT_ID, ZOHO_CAMPAIGNS_CLIENT_SECRET, ZOHO_CAMPAIGNS_REFRESH_TOKEN, ZOHO_CAMPAIGNS_LIST_KEY. Restart the backend after changes.';
  } else if (err.response?.status === 400 && !err.displayMessage) {
    errMsg =
      'Zoho Campaigns returned an error. Check sender verification, list key, and OAuth scopes, then retry.';
  } else if (
    /request failed with status code/i.test(errMsg) &&
    (err.response?.status === 400 || err.response?.status >= 400)
  ) {
    errMsg =
      'Zoho Campaigns rejected the request. Check ZOHO_CAMPAIGNS_* vars, verified from-address, and campaign scopes.';
  }
  return { error: errMsg, displayMessage: err.displayMessage || errMsg };
}

/**
 * Send a template to one or more recipients.
 * @param {object} user - req.user
 * @param {object} body - { templateId, recipients, variables, cc, bcc, channel, subjectOverride?, bodyOverride? }
 */
async function sendTemplateEmail(user, body) {
  const {
    templateId,
    recipients,
    variables,
    cc,
    bcc,
    channel,
    subjectOverride,
    bodyOverride,
  } = body;

  if (!templateId) throw httpError('Template ID is required');

  if (!user.organizationId) {
    throw httpError('Create your organization first to send template emails.', 400, {
      code: 'ORG_REQUIRED',
    });
  }
  const template = await EmailTemplate.findOne({
    _id: templateId,
    organizationId: user.organizationId,
  });
  if (!template) throw httpError('Template not found', 404);

  const recipientList = Array.isArray(recipients) ? recipients : [recipients];
  if (!recipientList.length || !recipientList[0]?.email) {
    throw httpError('At least one recipient email is required');
  }

  const isMarketing = channel === 'marketing';

  if (isMarketing) {
    const {
      resolveCampaignsSettings,
      isSettingsConfigured,
    } = require('./marketingListService');
    const settings = await resolveCampaignsSettings(user.organizationId);
    if (!isSettingsConfigured(settings)) {
      throw httpError('CAMPAIGNS_NOT_CONFIGURED', 400, {
        displayMessage:
          'Zoho Campaigns is not configured. Add it under Organization → Integrations → Marketing, or set platform ZOHO_CAMPAIGNS_* env vars.',
      });
    }
  }

  const { sendEmail, checkUserEmailConfigured } = require('./emailService');

  if (!isMarketing) {
    const isConfigured = await checkUserEmailConfigured(user.id);
    if (!isConfigured) {
      throw httpError('EMAIL_NOT_CONFIGURED', 400, {
        displayMessage:
          'Please configure your email settings first. Go to Email → Email Settings to set up your email address.',
      });
    }
  }

  const results = { success: [], failed: [] };
  const senderName = user.name || 'HR Team';
  const senderEmail = user.email || '';

  // Org brand for email chrome (header/footer). Separate from job {{company}}.
  let orgBrand = '';
  let orgLogoUrl = '';
  let orgBrandColor = '#0f766e';
  let orgWebsiteUrl = '';
  let orgSupportEmail = '';
  let orgSocialLinks = {};
  let orgCompanyAddress = '';
  let orgWordmark;
  let orgSlug = '';
  try {
    const { loadOrgEmailBrand } = require('./emailBrandLayout');
    const brand = await loadOrgEmailBrand(user.organizationId);
    orgBrand = brand.name;
    orgLogoUrl = brand.logoUrl;
    orgBrandColor = brand.brandColor || '#0f766e';
    orgWebsiteUrl = brand.websiteUrl || '';
    orgSupportEmail = brand.supportEmail || '';
    orgSocialLinks = brand.socialLinks || {};
    orgCompanyAddress = brand.companyAddress || '';
    orgWordmark = brand.wordmark;
  } catch (_) {
    orgBrand = '';
  }
  if (!orgBrand) orgBrand = 'Talent Acquisition';
  try {
    const Organization = require('../models/Organization');
    const orgRow = await Organization.findById(user.organizationId).select('slug domain').lean();
    orgSlug = String(orgRow?.slug || '').trim();
  } catch (_) {}

  const orgQs = orgSlug
    ? `&org=${encodeURIComponent(orgSlug)}`
    : user.organizationId
      ? `&orgId=${encodeURIComponent(String(user.organizationId))}`
      : '';
  const orgPageQs = orgSlug
    ? `&org=${encodeURIComponent(orgSlug)}`
    : user.organizationId
      ? `&orgId=${encodeURIComponent(String(user.organizationId))}`
      : '';

  for (const recipient of recipientList) {
    try {
      const vars = {
        ...variables,
        candidateName: recipient.name || variables?.candidateName || 'Candidate',
        company: (variables?.company || '').trim() || orgBrand,
      };

      if (isMarketing && recipient.email && user.organizationId) {
        try {
          const Candidate = require('../models/Candidate');
          const row = await Candidate.findOne({
            organizationId: user.organizationId,
            email: String(recipient.email).trim().toLowerCase(),
          })
            .select('marketingConsent')
            .lean();
          if (row?.marketingConsent?.optedIn === false && row?.marketingConsent?.optedOutAt) {
            results.failed.push({
              email: recipient.email,
              error: 'Recipient unsubscribed from marketing emails',
              displayMessage:
                'This candidate unsubscribed from marketing. Send a Direct email — it includes a Subscribe button so they can opt back in.',
            });
            continue;
          }
        } catch (_) {
          /* ignore consent lookup failures */
        }
      }

      const tplName = String(template.name || '');
      const isSubscribeInvite =
        tplName === 'Subscribe for Updates' && template.category === 'marketing';
      const isRoleSpotlight =
        template.category === 'marketing' &&
        /Talent Pool Nurture|Open Role Spotlight|Job Alert/i.test(tplName);
      const isReengage =
        template.category === 'marketing' && /Re-engagement|Stay in Touch/i.test(tplName);
      const backendBase = (
        process.env.EMAIL_LINKS_BACKEND_URL ||
        process.env.BACKEND_URL ||
        process.env.API_URL ||
        ''
      )
        .trim()
        .replace(/\/$/, '');
      const frontendBase = (process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');

      // Subscribe links for Campaign + Direct (so unsubscribed people can opt back in via transactional mail)
      if (recipient.email && (backendBase || frontendBase)) {
        if (backendBase) {
          const sig = signEmail(recipient.email);
          vars.subscribeLink = `${backendBase}/api/public/subscribe/confirm?email=${encodeURIComponent(recipient.email)}&sig=${sig}${orgQs}`;
          vars.unsubscribeLink = `${backendBase}/api/public/unsubscribe/confirm?email=${encodeURIComponent(recipient.email)}&sig=${sig}${orgQs}`;
        } else {
          vars.subscribeLink = `${frontendBase}/subscribe?email=${encodeURIComponent(recipient.email)}${orgPageQs}`;
          vars.unsubscribeLink = `${frontendBase}/unsubscribe?email=${encodeURIComponent(recipient.email)}${orgPageQs}`;
        }
      } else if (isMarketing) {
        throw httpError('EMAIL_LINKS_NOT_CONFIGURED', 400, {
          displayMessage:
            'Marketing links need BACKEND_URL (or EMAIL_LINKS_BACKEND_URL) and FRONTEND_URL set to public HTTPS URLs so Subscribe / Unsubscribe work.',
        });
      }

      let emailSubject = polishMergedSubject(
        applyVariables(
          typeof subjectOverride === 'string' && subjectOverride.length
            ? subjectOverride
            : template.subject,
          vars
        )
      );
      let emailBody = polishMergedBody(
        applyVariables(
          typeof bodyOverride === 'string' && bodyOverride.length
            ? bodyOverride
            : template.body,
          vars
        )
      );

      const {
        brandButtonHtml,
        subscribeInviteHtml,
        roleSpotlightHtml,
        reengageInviteHtml,
      } = require('./emailBrandLayout');

      let htmlContent;
      const subscribeUrlEarly =
        vars.subscribeLink &&
        typeof vars.subscribeLink === 'string' &&
        /^https?:\/\//i.test(vars.subscribeLink)
          ? vars.subscribeLink
          : '';
      if (isSubscribeInvite) {
        htmlContent = subscribeInviteHtml({
          candidateName: vars.candidateName || recipient.name || 'there',
          company: (vars.company || '').trim() || orgBrand,
          brandColor: orgBrandColor,
        });
      } else if (isRoleSpotlight) {
        htmlContent = roleSpotlightHtml({
          candidateName: vars.candidateName || recipient.name || 'there',
          company: (vars.company || '').trim() || orgBrand,
          position: vars.position || '',
          ctc: vars.ctc || '',
          experience: vars.experience || '',
          location: vars.location || '',
          brandColor: orgBrandColor,
        });
      } else if (isReengage) {
        htmlContent = reengageInviteHtml({
          candidateName: vars.candidateName || recipient.name || 'there',
          company: (vars.company || '').trim() || orgBrand,
          brandColor: orgBrandColor,
        });
      } else {
        htmlContent = buildHtmlContent(emailBody, {
          isSubscribeInvite,
          brandColor: orgBrandColor,
          subscribeUrl: subscribeUrlEarly,
        });
      }

      // Linkify bare "subscribe" in spotlight/invite bodies too
      if (
        subscribeUrlEarly &&
        (isSubscribeInvite || isRoleSpotlight || isReengage) &&
        /\bsubscribe\b/i.test(htmlContent) &&
        !/href=[^>]*subscribe/i.test(htmlContent)
      ) {
        const accentLink = orgBrandColor || '#0f766e';
        htmlContent = htmlContent.replace(
          /(^|>|[\s(])subscribe(?=[\s.,;:!?<)&]|$)/gi,
          `$1<a href="${subscribeUrlEarly}" style="color:${accentLink};font-weight:600;text-decoration:underline;">subscribe</a>`
        );
      }

      const subscribeUrl = subscribeUrlEarly;
      const unsubscribeUrl =
        vars.unsubscribeLink &&
        typeof vars.unsubscribeLink === 'string' &&
        /^https?:\/\//i.test(vars.unsubscribeLink)
          ? vars.unsubscribeLink
          : '';

      // Consent for CTA: only hide Subscribe when Zoho actually enrolled them.
      // Soft-ok / Zoho contact-from-send must still show Subscribe.
      let isSubscribed = false;
      if (recipient.email && user.organizationId) {
        try {
          const Candidate = require('../models/Candidate');
          const row = await Candidate.findOne({
            organizationId: user.organizationId,
            email: String(recipient.email).trim().toLowerCase(),
          })
            .select('marketingConsent')
            .lean();
          const mc = row?.marketingConsent || {};
          const source = String(mc.source || '');
          isSubscribed =
            mc.optedIn === true &&
            !mc.optedOutAt &&
            mc.zohoEnrolled === true &&
            source !== 'marketing_send';
        } catch (_) {
          isSubscribed = false;
        }
      }

      const ctaLabel = isSubscribeInvite
        ? 'Subscribe to job & career updates'
        : isRoleSpotlight
          ? 'Subscribe for role alerts'
          : isReengage
            ? 'Subscribe to stay connected'
            : 'Subscribe to job & career updates';
      const showSubscribeCta = Boolean(subscribeUrl) && !isSubscribed;
      if (!subscribeUrl) {
        logger.warn(
          { email: recipient.email, isMarketing },
          '[EmailTemplate] Subscribe CTA skipped — no subscribe URL (check BACKEND_URL / EMAIL_LINKS_BACKEND_URL)'
        );
      } else if (isSubscribed) {
        logger.info(
          { email: recipient.email, isMarketing },
          '[EmailTemplate] Subscribe CTA hidden — Zoho-enrolled marketingConsent'
        );
      }
      const subscribeCtaHtml = showSubscribeCta
        ? `<div style="margin:22px 0 8px 0;text-align:center;">${brandButtonHtml({
            href: subscribeUrl,
            label: ctaLabel,
            brandColor: orgBrandColor,
            fullWidth: true,
          })}</div>
          <p style="margin:0 0 4px 0;text-align:center;font-size:12px;line-height:1.5;color:#9ca3af;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${
            isMarketing
              ? 'Optional job and career updates · Change preferences anytime'
              : 'Optional — subscribe for marketing updates on jobs and hiring drives'
          }</p>`
        : '';

      const accent = orgBrandColor || '#0f766e';
      let unsubscribeFooterHtml = '';
      if (isMarketing) {
        const { zohoCampaignComplianceFooterHtml } = require('./emailBrandLayout');
        // Professional compliance footer with Zoho merge tags — prevents Zoho's
        // "Email Marketing by Zoho Campaigns / Not interested?" default block.
        unsubscribeFooterHtml = zohoCampaignComplianceFooterHtml({
          brandColor: accent,
          subscribeUrl: isSubscribed ? '' : subscribeUrl,
          isSubscribed,
          orgName: orgBrand,
        });
      } else if (!isSubscribed && subscribeUrl) {
        unsubscribeFooterHtml = `<p style="margin:16px 0 8px 0;font-size:12px;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#6b7280;">
            Optional:
            <a href="${subscribeUrl}" style="color:${accent};text-decoration:underline;font-weight:600;">Subscribe to job &amp; career updates</a>
          </p>`;
      }

      const eyebrow = isSubscribeInvite
        ? 'Job alerts'
        : isRoleSpotlight
          ? 'Open role'
          : isReengage
            ? 'Stay connected'
            : undefined;

      // Short headline in the card (like Direct interview/rejection mail) — subject stays on the email subject line
      const displayTitle = isSubscribeInvite
        ? 'Subscribe for updates'
        : isRoleSpotlight
          ? 'Role opportunity'
          : isReengage
            ? 'Stay in touch'
            : emailSubject;

      const htmlBody = wrapEmailHtml({
        emailSubject: displayTitle,
        htmlContent,
        subscribeCtaHtml,
        unsubscribeFooterHtml,
        senderName,
        senderEmail,
        orgBrand,
        companyName: orgBrand,
        logoUrl: orgLogoUrl,
        brandColor: orgBrandColor,
        category: template.category,
        eyebrow,
        publicLogo: isMarketing,
        websiteUrl: orgWebsiteUrl,
        supportEmail: orgSupportEmail,
        socialLinks: orgSocialLinks,
        companyAddress: orgCompanyAddress,
        wordmark: orgWordmark,
      });

      const emailOptions = { senderName, senderEmail, userId: user.id };
      if (cc) {
        emailOptions.cc = Array.isArray(cc)
          ? cc
          : cc
              .split(',')
              .map((e) => e.trim())
              .filter(Boolean);
      }
      if (bcc) {
        emailOptions.bcc = Array.isArray(bcc)
          ? bcc
          : bcc
              .split(',')
              .map((e) => e.trim())
              .filter(Boolean);
      }

      if (isMarketing) {
        const { sendMarketingEmail } = require('./campaignService');
        await sendMarketingEmail(recipient.email, emailSubject, htmlBody, {
          userId: user.id || user._id,
          senderName,
          fromEmail: senderEmail,
          replyToEmail: senderEmail,
          campaignName: template.name || 'ATS Marketing',
          organizationId: user.organizationId,
          listPurpose: require('./marketingListService').inferListPurpose({
            templateName: template.name,
            category: template.category,
            subject: emailSubject,
          }),
        });
      } else {
        await sendEmail(
          recipient.email,
          emailSubject,
          htmlBody,
          emailBody.replace(/<[^>]*>/g, ''),
          {
            ...emailOptions,
            organizationId: user.organizationId,
            emailType: template.category || 'template',
            channel: 'transactional',
          }
        );
      }
      results.success.push(recipient.email);
    } catch (err) {
      if (err.code === 'USE_VERIFIED_DOMAIN') throw err;
      logger.error({ email: recipient.email, err: err.message, code: err.code }, 'Template send failed');
      const mapped = mapSendError(err);
      results.failed.push({ email: recipient.email, ...mapped });
    }
  }

  return {
    message: `Sent ${results.success.length} of ${recipientList.length} emails`,
    data: results,
  };
}

module.exports = {
  sendTemplateEmail,
  buildHtmlContent,
  applyVariables,
  polishMergedSubject,
  polishMergedBody,
  wrapEmailHtml,
};
