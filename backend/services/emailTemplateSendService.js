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

function buildHtmlContent(emailBody, { isSubscribeInvite }) {
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(emailBody);
  if (looksLikeHtml) {
    return emailBody
      .replace(/Subscribe now:\s*/gi, '')
      .replace(/\{\{subscribeLink\}\}/gi, '');
  }

  const bodyLines = emailBody.split('\n');
  let htmlContent = '';
  let inList = false;
  let inDetailBlock = false;
  let detailRows = '';

  const closeDetailBlock = () => {
    if (!inDetailBlock) return;
    htmlContent += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 18px 0;background-color:#f8fafc;border:1px solid #eef0f3;border-left:3px solid #5b21b6;"><tr><td style="padding:12px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailRows}</table></td></tr></table>`;
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
    } else if (isSubscribeInvite && /^Subscribe now:\s*(.+)?$/i.test(trimmed)) {
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
      if (!inList) {
        htmlContent +=
          '<ul style="margin:8px 0 14px 0;padding:0 0 0 18px;color:#334155;">';
        inList = true;
      }
      htmlContent += `<li style="margin:0 0 6px 0;font-size:14.5px;line-height:1.65;color:#334155;">${trimmed.replace(/^(\d+[\.\)]|[-•●])\s*/, '')}</li>`;
    } else if (trimmed.startsWith('Dear ')) {
      if (inList) {
        htmlContent += '</ul>';
        inList = false;
      }
      closeDetailBlock();
      htmlContent += `<p style="margin:0 0 16px 0;font-size:15px;color:#0f172a;font-weight:600;">${trimmed}</p>`;
    } else if (/^(Best regards|Regards|Sincerely|Thank you|Warm regards)/i.test(trimmed)) {
      if (inList) {
        htmlContent += '</ul>';
        inList = false;
      }
      closeDetailBlock();
      htmlContent += `<div style="margin-top:24px;"><p style="margin:0 0 2px 0;font-size:14px;color:#64748b;">${trimmed}</p>`;
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
      htmlContent += `<p style="margin:0 0 1px 0;font-size:14px;color:#0f172a;font-weight:700;">${trimmed}</p>`;
    } else if (/^[A-Z][A-Za-z\s\/]+:\s/.test(trimmed) || /^[•●\-]\s*[A-Za-z].+:\s/.test(trimmed)) {
      if (inList) {
        htmlContent += '</ul>';
        inList = false;
      }
      const cleaned = trimmed.replace(/^[•●\-]\s*/, '');
      const colonIdx = cleaned.indexOf(':');
      const key = cleaned.substring(0, colonIdx).trim();
      const val = cleaned.substring(colonIdx + 1).trim();
      inDetailBlock = true;
      detailRows += `<tr>
        <td style="padding:6px 0;font-size:13px;color:#64748b;width:140px;vertical-align:top;">${key}</td>
        <td style="padding:6px 0;font-size:13px;color:#0f172a;font-weight:600;vertical-align:top;">${val}</td>
      </tr>`;
    } else {
      if (inList) {
        htmlContent += '</ul>';
        inList = false;
      }
      closeDetailBlock();
      htmlContent += `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.7;color:#334155;">${trimmed}</p>`;
    }
  });
  if (inList) htmlContent += '</ul>';
  closeDetailBlock();
  if (htmlContent.includes('margin-top:24px;')) htmlContent += '</div>';
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
}) {
  const { wrapBrandedEmailHtml, categoryEyebrow } = require('./emailBrandLayout');
  return wrapBrandedEmailHtml({
    title: emailSubject,
    category: category || '',
    eyebrow: categoryEyebrow(category),
    bodyHtml: htmlContent,
    orgName: orgBrand || companyName || 'Skillnix Recruitment',
    logoUrl: logoUrl || '',
    brandColor: brandColor || '#5b21b6',
    senderName: senderName || '',
    senderEmail: senderEmail || '',
    includeSignOff: false,
    subscribeCtaHtml,
    unsubscribeFooterHtml,
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
      'Campaign email could not be sent. Your sender address is not yet verified for campaigns. Please contact your admin to verify the sender address, or try again.';
  } else if (err.code === 'CAMPAIGNS_LIST_EMPTY') {
    errMsg =
      err.displayMessage ||
      'Zoho list has no active contacts (pending opt-in). Confirm subscription email or adjust Manage Opt-in, then retry.';
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
  try {
    const { loadOrgEmailBrand } = require('./emailBrandLayout');
    const brand = await loadOrgEmailBrand(user.organizationId);
    orgBrand = brand.name;
    orgLogoUrl = brand.logoUrl;
    orgBrandColor = brand.brandColor;
  } catch (_) {
    orgBrand = '';
  }
  if (!orgBrand) orgBrand = 'Talent Acquisition';

  for (const recipient of recipientList) {
    try {
      const vars = {
        ...variables,
        candidateName: recipient.name || variables?.candidateName || 'Candidate',
        // Job / client company in body — do not overwrite with org brand if user set it
        company: (variables?.company || '').trim() || orgBrand,
      };
      if (isMarketing) {
        vars.unsubscribeLink =
          (
            process.env.ZOHO_CAMPAIGNS_UNSUBSCRIBE_URL ||
            (process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/unsubscribe` : '') ||
            '#unsubscribe'
          ).trim() || '#unsubscribe';
        const base = (process.env.FRONTEND_URL || '').trim() || '';
        vars.subscribeLink = base ? `${base.replace(/\/$/, '')}/subscribe` : '#subscribe';
        if (recipient.email) vars.subscribeLink += `?email=${encodeURIComponent(recipient.email)}`;
      }

      const isSubscribeInviteTemplate =
        template.name === 'Subscribe for Updates' && template.category === 'marketing';
      const backendBase = (
        process.env.EMAIL_LINKS_BACKEND_URL ||
        process.env.BACKEND_URL ||
        process.env.API_URL ||
        ''
      )
        .trim()
        .replace(/\/$/, '');
      if (isSubscribeInviteTemplate) {
        if (backendBase && recipient.email) {
          vars.subscribeLink = `${backendBase}/api/public/subscribe/confirm?email=${encodeURIComponent(recipient.email)}&sig=${signEmail(recipient.email)}`;
        } else if (!vars.subscribeLink) {
          const base = (process.env.FRONTEND_URL || '').trim() || '';
          vars.subscribeLink = base ? `${base.replace(/\/$/, '')}/subscribe` : '#subscribe';
          if (recipient.email) vars.subscribeLink += `?email=${encodeURIComponent(recipient.email)}`;
        }
      }
      if (isMarketing && recipient.email && backendBase) {
        vars.unsubscribeLink = `${backendBase}/api/public/unsubscribe/confirm?email=${encodeURIComponent(recipient.email)}&sig=${signEmail(recipient.email)}`;
      }

      let emailSubject = applyVariables(
        typeof subjectOverride === 'string' && subjectOverride.length
          ? subjectOverride
          : template.subject,
        vars
      );
      let emailBody = applyVariables(
        typeof bodyOverride === 'string' && bodyOverride.length
          ? bodyOverride
          : template.body,
        vars
      );

      const isSubscribeInvite =
        template.name === 'Subscribe for Updates' && template.category === 'marketing';
      const htmlContent = buildHtmlContent(emailBody, { isSubscribeInvite });

      const unsubscribeUrl =
        isMarketing && vars.unsubscribeLink && vars.unsubscribeLink !== '#unsubscribe'
          ? vars.unsubscribeLink
          : '';
      const unsubscribeFooterHtml =
        unsubscribeUrl && !isSubscribeInvite
          ? `<p style="margin:0 0 12px 0;font-size:11px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"><a href="${unsubscribeUrl}" style="color:#0f766e;text-decoration:underline;">Unsubscribe</a> or <a href="${unsubscribeUrl}" style="color:#0f766e;text-decoration:underline;">update email preferences</a></p>`
          : '';
      const subscribeUrl =
        vars.subscribeLink &&
        typeof vars.subscribeLink === 'string' &&
        vars.subscribeLink.startsWith('http')
          ? vars.subscribeLink
          : '';
      const { brandButtonHtml } = require('./emailBrandLayout');
      const subscribeCtaHtml = subscribeUrl
        ? `<div style="margin:20px 0 4px 0;text-align:center;">${brandButtonHtml({ href: subscribeUrl, label: 'Subscribe for updates', brandColor: orgBrandColor })}</div>`
        : '';

      const htmlBody = wrapEmailHtml({
        emailSubject,
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
          userId: user.id,
          senderName,
          fromEmail: senderEmail,
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
          emailOptions
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
  wrapEmailHtml,
};
