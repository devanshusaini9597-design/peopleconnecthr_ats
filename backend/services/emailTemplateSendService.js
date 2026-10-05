/**
 * Email template send orchestration — marketing vs transactional,
 * variable merge, HTML composition, per-recipient delivery.
 */
const logger = require('../utils/logger');
const EmailTemplate = require('../models/EmailTemplate');
const { signEmail } = require('../utils/subscribeSign');
const { ensureCandidateNameToken } = require('../utils/bulkPersonalize');
const { outboundCompany, veiledEmployer, cleanApplyUrl, jobEmailSummary } = require('../utils/employerVeil');
const { convertPlainEmailBody } = require('../utils/emailBodyHtml');
const {
  polishMergedSubject,
  polishMergedBody,
} = require('../utils/emailMergePolish');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

function applyVariables(templateStr, vars) {
  let out = String(templateStr || '');
  Object.entries(vars || {}).forEach(([key, val]) => {
    const str = typeof val === 'string' ? val : (val == null ? '' : String(val));
    const regex = new RegExp(`\\{\\{\\s*${String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`, 'g');
    out = out.replace(regex, str);
  });
  return out;
}

function buildHtmlContent(emailBody, { isSubscribeInvite, brandColor = '#0f766e', subscribeUrl = '' } = {}) {
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(String(brandColor || '').trim())
    ? String(brandColor).trim()
    : '#0f766e';
  const subHref = String(subscribeUrl || '').trim();
  let raw = String(emailBody || '');
  if (isSubscribeInvite) {
    raw = raw
      .replace(/^Subscribe now:\s*.*$/gim, '')
      .replace(/^Subscribe here:\s*.*$/gim, '')
      .replace(/Subscribe now:\s*/gi, '')
      .replace(/Subscribe here:\s*/gi, '');
  }
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(raw);
  if (looksLikeHtml) {
    let html = raw
      .replace(/Subscribe now:\s*/gi, '')
      .replace(/Subscribe here:\s*/gi, '');
    if (subHref && /^https?:\/\//i.test(subHref)) {
      html = html.replace(/\{\{subscribeLink\}\}/gi, subHref);
      html = html.replace(
        /(^|>|[\s(])subscribe(?=[\s.,;:!?<)]|$)/gi,
        `$1<a href="${subHref}" style="color:${accent};font-weight:600;text-decoration:underline;">subscribe</a>`
      );
    } else {
      html = html.replace(/\{\{subscribeLink\}\}/gi, '');
    }
    return html;
  }

  let htmlContent = convertPlainEmailBody(raw, { brandColor: accent, subscribeUrl: subHref });
  if (isSubscribeInvite) {
    htmlContent = htmlContent
      .replace(/Subscribe now:\s*/gi, '')
      .replace(/Subscribe here:\s*/gi, '');
  }
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
    includeSignOff: false,
    subscribeCtaHtml,
    unsubscribeFooterHtml,
    footerReason:
      footerReason ||
      (isMarketing ? marketingFooterReason(org) : ''),
    publicLogo: publicLogo !== undefined ? Boolean(publicLogo) : isMarketing,
  });
}

function classifySendFailureReason(message = '', code = '') {
  const text = `${code} ${message}`.toLowerCase();
  if (
    /invalid email|email address is required|no valid email|missing email|malformed|bad address|not a valid email|invalid recipient|invalid.?to/i.test(
      text
    )
  ) {
    return 'invalid_address';
  }
  if (
    /bounce|hard.?bounce|soft.?bounce|mailbox (not found|unavailable|does not exist)|user unknown|recipient rejected|no such user|550\b|5\.1\.1|address rejected|undeliverable|does not exist|account does not exist|unknown recipient|inactive mailbox|mailbox full|over quota/i.test(
      text
    )
  ) {
    return 'mailbox_unavailable';
  }
  if (
    /unsubscrib|opted.?out|opt.?out|no marketing consent|not eligible for marketing|marketingConsent/i.test(
      text
    )
  ) {
    return 'unsubscribed';
  }
  if (/spam|blocked|blacklist|reputation|suppress/i.test(text)) {
    return 'blocked';
  }
  if (
    /not configured|not verified|oauth|zoho campaigns|zeptomail|smtp|sender|verified domain|credentials|api key|sm_111|CAMPAIGNS_|auth_failed|authentication failed/i.test(
      text
    )
  ) {
    return 'configuration';
  }
  return 'provider_error';
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
      'The shared Zoho Campaigns From mailbox is not a verified sender yet. Add it under Settings → Deliverability → Manage Senders. Employee addresses are Reply-To only.';
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
  const displayMessage = err.displayMessage || errMsg;
  return {
    error: errMsg,
    displayMessage,
    reasonCode: err.reasonCode || classifySendFailureReason(displayMessage, err.code || ''),
  };
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

  // Bulk drafts often substitute the first recipient's name in the UI — restore the
  // merge token so each person gets their own name.
  const isBulkSend = recipientList.length > 1;
  const bakedNames = [];
  if (isBulkSend) {
    const fromVars = String(variables?.candidateName || '').trim();
    const fromFirst = String(recipientList[0]?.name || '').trim();
    if (fromVars) bakedNames.push(fromVars);
    if (fromFirst && fromFirst !== fromVars) bakedNames.push(fromFirst);
  }
  let sharedSubjectOverride =
    typeof subjectOverride === 'string' && subjectOverride.length ? subjectOverride : '';
  let sharedBodyOverride =
    typeof bodyOverride === 'string' && bodyOverride.length ? bodyOverride : '';
  if (isBulkSend && bakedNames.length) {
    if (sharedSubjectOverride) {
      sharedSubjectOverride = ensureCandidateNameToken(sharedSubjectOverride, bakedNames);
    }
    if (sharedBodyOverride) {
      sharedBodyOverride = ensureCandidateNameToken(sharedBodyOverride, bakedNames);
    }
  }
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

  // Resolve sender once for the whole chunk — avoids N× DB lookups that held the HTTP response open after Zepto already accepted mail.
  let mailSession = null;
  if (!isMarketing) {
    try {
      const { getUserTransporter, canUserSendViaZepto } = require('./emailService');
      const [transporter, senderStatus] = await Promise.all([
        getUserTransporter(user.id || user._id, {
          organizationId: user.organizationId,
          senderName: user.name || 'HR Team',
          replyToEmail: user.email,
        }),
        canUserSendViaZepto(user.id || user._id),
      ]);
      if (!senderStatus.canSend) {
        throw httpError(senderStatus.reason || 'USE_VERIFIED_DOMAIN', 400, {
          code: 'USE_VERIFIED_DOMAIN',
          displayMessage: senderStatus.reason || 'Please use your company verified email to send.',
        });
      }
      mailSession = { demoChecked: true, transporter, senderStatus };
    } catch (err) {
      if (err.code === 'USE_VERIFIED_DOMAIN' || err.statusCode) throw err;
      logger.warn({ err: err.message }, '[EmailTemplate] mailSession warm-up failed — falling back per recipient');
    }
  }

  // ── Marketing: ONE Zoho campaign for the whole chunk (not one campaign per person).
  // Per-recipient Zoho create+wait was why Campaign sends took minutes and the UI timed out
  // even though mail still arrived later (Zoho/Zepto finished after the client aborted).
  if (isMarketing) {
    const eligible = [];
    for (const recipient of recipientList) {
      if (!recipient?.email) {
        results.failed.push({
          email: recipient?.email || '',
          error: 'Invalid email address',
          displayMessage: 'Invalid or missing email address',
          reasonCode: 'invalid_address',
        });
        continue;
      }
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
            reasonCode: 'unsubscribed',
          });
          continue;
        }
        const MisContact = require('../models/MisContact');
        const mis = await MisContact.findOne({
          organizationId: user.organizationId,
          email: String(recipient.email).trim().toLowerCase(),
        })
          .select('marketingConsent unsubscribedAt')
          .lean();
        if (mis && (mis.marketingConsent === false || mis.unsubscribedAt)) {
          results.failed.push({
            email: recipient.email,
            error: 'MIS contact is not eligible for marketing email',
            displayMessage: 'This MIS contact has no marketing consent or has unsubscribed.',
            reasonCode: 'unsubscribed',
          });
          continue;
        }
      } catch (_) {
        /* ignore consent lookup failures */
      }
      eligible.push(recipient);
    }

    if (!eligible.length) {
      return {
        message: `Sent 0 of ${recipientList.length} emails`,
        data: results,
      };
    }

    const backendBase = (
      process.env.EMAIL_LINKS_BACKEND_URL ||
      process.env.BACKEND_URL ||
      process.env.API_URL ||
      ''
    )
      .trim()
      .replace(/\/$/, '');
    const frontendBase = (process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
    if (!backendBase && !frontendBase) {
      throw httpError('EMAIL_LINKS_NOT_CONFIGURED', 400, {
        displayMessage:
          'Marketing links need BACKEND_URL (or EMAIL_LINKS_BACKEND_URL) and FRONTEND_URL set to public HTTPS URLs so Subscribe / Unsubscribe work.',
      });
    }

    const orgQuery = orgSlug
      ? `org=${encodeURIComponent(orgSlug)}`
      : user.organizationId
        ? `orgId=${encodeURIComponent(String(user.organizationId))}`
        : '';
    const sharedSubscribe =
      frontendBase && orgQuery
        ? `${frontendBase}/subscribe?${orgQuery}`
        : frontendBase
          ? `${frontendBase}/subscribe`
          : '';

    const greetingName = isBulkSend
      ? 'there'
      : eligible[0].name || variables?.candidateName || 'there';
    const vars = {
      ...variables,
      candidateName: greetingName,
      name: greetingName,
      company: outboundCompany(variables, orgBrand),
      orgName: orgBrand,
      jobEmployer:
        String(variables?.jobEmployer || '').trim() ||
        veiledEmployer(
          variables?.jobIndustry || variables?.industry || '',
          variables?.jobClient || ''
        ),
      applyLink: cleanApplyUrl(variables?.applyLink || variables?.applyUrl || ''),
      applyUrl: cleanApplyUrl(variables?.applyLink || variables?.applyUrl || ''),
      jobSummary: jobEmailSummary(variables?.jobSummary || '', ''),
      subscribeLink: sharedSubscribe,
      unsubscribeLink: sharedSubscribe
        ? sharedSubscribe.replace('/subscribe', '/unsubscribe')
        : '',
    };
    if (!String(vars.position || '').trim()) vars.position = vars.jobTitle || '';
    if (!String(vars.location || '').trim()) vars.location = vars.jobLocation || '';
    if (!String(vars.experience || '').trim()) vars.experience = vars.jobExperience || '';
    if (!String(vars.ctc || '').trim()) vars.ctc = vars.jobCtc || '';

    const tplName = String(template.name || '');
    const isSubscribeInvite =
      tplName === 'Subscribe for Updates' && template.category === 'marketing';
    const isRoleSpotlight =
      !sharedBodyOverride &&
      template.category === 'marketing' &&
      /Talent Pool Nurture|Open Role Spotlight|Job Alert/i.test(tplName);
    const isReengage =
      template.category === 'marketing' && /Re-engagement|Stay in Touch/i.test(tplName);

    let emailSubject = polishMergedSubject(
      applyVariables(
        sharedSubjectOverride.length ? sharedSubjectOverride : template.subject,
        vars
      )
    );
    let emailBody = polishMergedBody(
      applyVariables(
        sharedBodyOverride.length ? sharedBodyOverride : template.body,
        vars
      )
    );

    const {
      brandButtonHtml,
      subscribeInviteHtml,
      roleSpotlightHtml,
      reengageInviteHtml,
      zohoCampaignComplianceFooterHtml,
    } = require('./emailBrandLayout');

    let htmlContent;
    const subscribeUrlEarly = sharedSubscribe;
    if (isSubscribeInvite) {
      htmlContent = subscribeInviteHtml({
        candidateName: greetingName,
        company: (vars.company || '').trim() || orgBrand,
        brandColor: orgBrandColor,
      });
    } else if (isRoleSpotlight) {
      htmlContent = roleSpotlightHtml({
        candidateName: greetingName,
        company: orgBrand,
        employer: vars.jobEmployer || '',
        position: vars.jobTitle || vars.position || '',
        jobCode: vars.jobCode || '',
        ctc: vars.ctc || '',
        experience: vars.jobExperience || vars.experience || '',
        location: vars.jobLocation || vars.location || '',
        summary: vars.jobSummary || '',
        applyUrl: vars.applyLink || vars.applyUrl || '',
        brandColor: orgBrandColor,
      });
    } else if (isReengage) {
      htmlContent = reengageInviteHtml({
        candidateName: greetingName,
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

    const accent = orgBrandColor || '#0f766e';
    const subscribeCtaHtml = subscribeUrlEarly
      ? `<div style="margin:22px 0 8px 0;text-align:center;">${brandButtonHtml({
          href: subscribeUrlEarly,
          label: isRoleSpotlight ? 'Subscribe for role alerts' : 'Subscribe to job & career updates',
          brandColor: orgBrandColor,
          fullWidth: true,
        })}</div>
        <p style="margin:0 0 4px 0;text-align:center;font-size:12px;line-height:1.5;color:#9ca3af;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">Optional job and career updates · Change preferences anytime</p>`
      : '';
    const unsubscribeFooterHtml = zohoCampaignComplianceFooterHtml({
      brandColor: accent,
      subscribeUrl: subscribeUrlEarly,
      isSubscribed: false,
      orgName: orgBrand,
    });
    const displayTitle = isSubscribeInvite
      ? 'Subscribe for updates'
      : isRoleSpotlight
        ? (emailSubject && !/^(Open role|Open opportunity|Career opportunity|New opening)\s*:?$/i.test(emailSubject)
            ? emailSubject
            : 'Role opportunity')
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
      eyebrow: isSubscribeInvite
        ? 'Job alerts'
        : isRoleSpotlight
          ? 'Career opportunity'
          : isReengage
            ? 'Stay connected'
            : undefined,
      publicLogo: true,
      websiteUrl: orgWebsiteUrl,
      supportEmail: orgSupportEmail,
      socialLinks: orgSocialLinks,
      companyAddress: orgCompanyAddress,
      wordmark: orgWordmark,
    });

    try {
      const { sendMarketingEmail } = require('./campaignService');
      const campaignResult = await sendMarketingEmail(
        eligible.map((r) => ({ email: r.email, name: r.name || '' })),
        emailSubject,
        htmlBody,
        {
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
        }
      );
      const failedFromProvider = Array.isArray(campaignResult?.data?.failed)
        ? campaignResult.data.failed
        : [];
      const failedSet = new Set(
        failedFromProvider.map((f) => String(f.email || '').trim().toLowerCase()).filter(Boolean)
      );
      for (const r of eligible) {
        const key = String(r.email || '').trim().toLowerCase();
        if (failedSet.has(key)) {
          const row = failedFromProvider.find(
            (f) => String(f.email || '').trim().toLowerCase() === key
          );
          results.failed.push({
            email: r.email,
            error: row?.error || 'Failed to send',
            displayMessage: row?.error || row?.displayMessage || 'Failed to send',
            reasonCode: 'provider_error',
          });
        } else {
          results.success.push(r.email);
        }
      }
    } catch (err) {
      if (err.code === 'USE_VERIFIED_DOMAIN' || err.code === 'CAMPAIGNS_NOT_CONFIGURED') throw err;
      logger.error({ err: err.message, code: err.code }, 'Marketing campaign send failed');
      const mapped = mapSendError(err);
      for (const r of eligible) {
        results.failed.push({ email: r.email, ...mapped });
      }
    }

    return {
      message: `Sent ${results.success.length} of ${recipientList.length} emails`,
      data: results,
    };
  }

  for (const recipient of recipientList) {
    try {
      const vars = {
        ...variables,
        candidateName: recipient.name || variables?.candidateName || 'Candidate',
        name: recipient.name || variables?.candidateName || 'Candidate',
        company: outboundCompany(variables, orgBrand),
        orgName: orgBrand,
        jobEmployer:
          String(variables?.jobEmployer || '').trim() ||
          veiledEmployer(
            variables?.jobIndustry || variables?.industry || '',
            variables?.jobClient || ''
          ),
        applyLink: cleanApplyUrl(variables?.applyLink || variables?.applyUrl || ''),
        applyUrl: cleanApplyUrl(variables?.applyLink || variables?.applyUrl || ''),
        jobSummary: jobEmailSummary(variables?.jobSummary || '', ''),
      };
      if (!String(vars.position || '').trim()) vars.position = vars.jobTitle || '';
      if (!String(vars.location || '').trim()) vars.location = vars.jobLocation || '';
      if (!String(vars.experience || '').trim()) vars.experience = vars.jobExperience || '';
      if (!String(vars.ctc || '').trim()) vars.ctc = vars.jobCtc || '';

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
              reasonCode: 'unsubscribed',
            });
            continue;
          }
          const MisContact = require('../models/MisContact');
          const mis = await MisContact.findOne({
            organizationId: user.organizationId,
            email: String(recipient.email).trim().toLowerCase(),
          })
            .select('marketingConsent unsubscribedAt')
            .lean();
          if (mis && (mis.marketingConsent === false || mis.unsubscribedAt)) {
            results.failed.push({
              email: recipient.email,
              error: 'MIS contact is not eligible for marketing email',
              displayMessage:
                'This MIS contact has no marketing consent or has unsubscribed.',
              reasonCode: 'unsubscribed',
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
        !sharedBodyOverride &&
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
          sharedSubjectOverride.length ? sharedSubjectOverride : template.subject,
          vars
        )
      );
      let emailBody = polishMergedBody(
        applyVariables(
          sharedBodyOverride.length ? sharedBodyOverride : template.body,
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
          company: orgBrand,
          employer: vars.jobEmployer || '',
          position: vars.jobTitle || vars.position || '',
          jobCode: vars.jobCode || '',
          ctc: vars.ctc || '',
          experience: vars.jobExperience || vars.experience || '',
          location: vars.jobLocation || vars.location || '',
          summary: vars.jobSummary || '',
          applyUrl: vars.applyLink || vars.applyUrl || '',
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
      // Skip the DB hit on bulk transactional chunks — CTA is still OK if already subscribed.
      let isSubscribed = false;
      if (recipient.email && user.organizationId && (isMarketing || !isBulkSend)) {
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
          ? 'Career opportunity'
          : isReengage
            ? 'Stay connected'
            : undefined;

      // Short headline in the card (like Direct interview/rejection mail) — subject stays on the email subject line
      const displayTitle = isSubscribeInvite
        ? 'Subscribe for updates'
        : isRoleSpotlight
          ? (emailSubject && !/^(Open role|Open opportunity|Career opportunity|New opening)\s*:?$/i.test(emailSubject)
              ? emailSubject
              : 'Role opportunity')
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
      if (mailSession) emailOptions.mailSession = mailSession;
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
      // Never block the HTTP response on inbox copy — emails already accepted by provider.
      try {
        const { recordSentMail } = require('./inboxService');
        Promise.resolve(
          recordSentMail(user.organizationId, user, {
            toAddress: recipient.email,
            candidateName: recipient.name || '',
            candidateId: recipient.candidateId || recipient._id || null,
            subject: emailSubject,
            bodyHtml: htmlBody,
            body: emailBody,
          })
        ).catch(() => {});
      } catch (_) { /* inbox copy is best-effort */ }
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
