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

  bodyLines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) {
        htmlContent += '</ul>';
        inList = false;
      }
      htmlContent += '<div style="height: 12px;"></div>';
    } else if (isSubscribeInvite && /^Subscribe now:\s*(.+)?$/i.test(trimmed)) {
      if (inList) {
        htmlContent += '</ul>';
        inList = false;
      }
    } else if (/unsubscribe|email preferences|click here:\s*#?unsubscribe/i.test(trimmed)) {
      if (inList) {
        htmlContent += '</ul>';
        inList = false;
      }
    } else if (/^(\d+[\.\)]|[-•●])\s/.test(trimmed)) {
      if (!inList) {
        htmlContent +=
          '<ul style="margin: 8px 0 8px 4px; padding-left: 20px; color: #374151;">';
        inList = true;
      }
      htmlContent += `<li style="margin: 4px 0; font-size: 14px; line-height: 1.7; color: #374151;">${trimmed.replace(/^(\d+[\.\)]|[-•●])\s*/, '')}</li>`;
    } else if (trimmed.startsWith('Dear ')) {
      if (inList) {
        htmlContent += '</ul>';
        inList = false;
      }
      htmlContent += `<p style="margin: 0 0 4px 0; font-size: 15px; color: #1f2937; font-weight: 500;">${trimmed}</p>`;
    } else if (/^(Best regards|Regards|Sincerely|Thank you|Warm regards)/i.test(trimmed)) {
      if (inList) {
        htmlContent += '</ul>';
        inList = false;
      }
      htmlContent += `<div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb;"><p style="margin: 0 0 2px 0; font-size: 14px; color: #6b7280;">${trimmed}</p>`;
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
      htmlContent += `<p style="margin: 0 0 1px 0; font-size: 14px; color: #4b5563; font-weight: 600;">${trimmed}</p>`;
    } else if (/^[A-Z][A-Za-z\s\/]+:\s/.test(trimmed)) {
      if (inList) {
        htmlContent += '</ul>';
        inList = false;
      }
      const colonIdx = trimmed.indexOf(':');
      const key = trimmed.substring(0, colonIdx);
      const val = trimmed.substring(colonIdx + 1).trim();
      htmlContent += `<div style="display: flex; margin: 6px 0; font-size: 14px; line-height: 1.6;"><span style="color: #6b7280; min-width: 160px; font-weight: 500;">${key}:</span><span style="color: #1e2937; font-weight: 600;">${val}</span></div>`;
    } else {
      if (inList) {
        htmlContent += '</ul>';
        inList = false;
      }
      htmlContent += `<p style="margin: 0 0 6px 0; font-size: 14px; line-height: 1.7; color: #374151;">${trimmed}</p>`;
    }
  });
  if (inList) htmlContent += '</ul>';
  if (htmlContent.includes('border-top: 1px solid #e5e7eb')) htmlContent += '</div>';
  return htmlContent;
}

function wrapEmailHtml({
  emailSubject,
  htmlContent,
  subscribeCtaHtml,
  unsubscribeFooterHtml,
  senderName,
  senderEmail,
}) {
  const currentYear = new Date().getFullYear();
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${emailSubject}</title></head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
        <tr><td style="padding: 0 0 28px 0; text-align: center;">
          <p style="margin: 0; font-size: 22px; font-weight: 700; color: #312e81; letter-spacing: -0.4px;">Skillnix Recruitment Services</p>
          <div style="width: 48px; height: 3px; background: linear-gradient(90deg, #4f46e5, #7c3aed); margin: 12px auto 0; border-radius: 2px;"></div>
        </td></tr>
        <tr><td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.06); overflow: hidden; border: 1px solid #eef2ff;">
            <tr><td style="height: 5px; background: linear-gradient(90deg, #4f46e5, #7c3aed, #4f46e5); font-size: 0;">&nbsp;</td></tr>
            <tr><td style="padding: 32px 40px 28px 40px; border-bottom: 1px solid #f1f5f9;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #1e293b; line-height: 1.35;">${emailSubject}</h1>
            </td></tr>
            <tr><td style="padding: 32px 40px 36px 40px;">
              ${htmlContent}
              ${subscribeCtaHtml}
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding: 28px 0 0 0; text-align: center;">
          ${unsubscribeFooterHtml}
          <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">Sent by <strong>${senderName}</strong>${senderEmail ? ' &middot; ' + senderEmail : ''}</p>
          <p style="margin: 0 0 6px 0; font-size: 11px; color: #94a3b8;">Skillnix Recruitment Services</p>
          <p style="margin: 0; font-size: 10px; color: #cbd5e1;">&copy; ${currentYear} Skillnix. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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
  } else if (zohoMsg && /failed to load|client_id|client_secret|refresh_token|list key/i.test(zohoMsg)) {
    errMsg =
      'Zoho Campaigns config error. In backend .env set: ZOHO_CAMPAIGNS_CLIENT_ID, ZOHO_CAMPAIGNS_CLIENT_SECRET, ZOHO_CAMPAIGNS_REFRESH_TOKEN, ZOHO_CAMPAIGNS_LIST_KEY. Restart the backend after changes.';
  } else if (err.response?.status === 400 && !err.displayMessage) {
    errMsg =
      'Zoho Campaigns returned an error. In backend .env set: ZOHO_CAMPAIGNS_CLIENT_ID, ZOHO_CAMPAIGNS_CLIENT_SECRET, ZOHO_CAMPAIGNS_REFRESH_TOKEN, ZOHO_CAMPAIGNS_LIST_KEY. Restart the backend after changes.';
  } else if (
    /request failed with status code/i.test(errMsg) &&
    (err.response?.status === 400 || err.response?.status >= 400)
  ) {
    errMsg =
      'Zoho Campaigns rejected the request. Check ZOHO_CAMPAIGNS_* vars and list key in backend .env, then restart the backend.';
  }
  return { error: errMsg, displayMessage: err.displayMessage || errMsg };
}

/**
 * Send a template to one or more recipients.
 * @param {object} user - req.user
 * @param {object} body - { templateId, recipients, variables, cc, bcc, channel }
 */
async function sendTemplateEmail(user, body) {
  const { templateId, recipients, variables, cc, bcc, channel } = body;

  if (!templateId) throw httpError('Template ID is required');

  const template = await EmailTemplate.findOne({
    _id: templateId,
    $or: [{ createdBy: user.id }, { isDefault: true }],
  });
  if (!template) throw httpError('Template not found', 404);

  const recipientList = Array.isArray(recipients) ? recipients : [recipients];
  if (!recipientList.length || !recipientList[0]?.email) {
    throw httpError('At least one recipient email is required');
  }

  const isMarketing = channel === 'marketing';

  if (isMarketing) {
    const { isCampaignsConfigured } = require('./campaignService');
    if (!isCampaignsConfigured()) {
      throw httpError('CAMPAIGNS_NOT_CONFIGURED', 400, {
        displayMessage: 'Zoho Campaigns is not configured.',
      });
    }
    const listKey = (process.env.ZOHO_CAMPAIGNS_LIST_KEY || '').trim();
    if (!listKey) {
      throw httpError('CAMPAIGNS_NOT_CONFIGURED', 400, {
        displayMessage:
          'Add ZOHO_CAMPAIGNS_LIST_KEY in backend .env (from Zoho Campaigns → Mailing Lists → list key), then restart the backend.',
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

  for (const recipient of recipientList) {
    try {
      const vars = {
        ...variables,
        candidateName: recipient.name || variables?.candidateName || 'Candidate',
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

      let emailSubject = applyVariables(template.subject, vars);
      let emailBody = applyVariables(template.body, vars);

      const isSubscribeInvite =
        template.name === 'Subscribe for Updates' && template.category === 'marketing';
      const htmlContent = buildHtmlContent(emailBody, { isSubscribeInvite });

      const unsubscribeUrl =
        isMarketing && vars.unsubscribeLink && vars.unsubscribeLink !== '#unsubscribe'
          ? vars.unsubscribeLink
          : '';
      const unsubscribeFooterHtml =
        unsubscribeUrl && !isSubscribeInvite
          ? `<p style="margin: 0 0 8px 0; font-size: 11px;"><a href="${unsubscribeUrl}" style="color: #6366f1; text-decoration: underline;">Unsubscribe</a> or <a href="${unsubscribeUrl}" style="color: #6366f1; text-decoration: underline;">update email preferences</a></p>`
          : '';
      const subscribeUrl =
        vars.subscribeLink &&
        typeof vars.subscribeLink === 'string' &&
        vars.subscribeLink.startsWith('http')
          ? vars.subscribeLink
          : '';
      const subscribeCtaHtml = subscribeUrl
        ? `<div style="margin: 28px 0 24px 0; text-align: center;"><a href="${subscribeUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 10px; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);">Subscribe for updates</a></div>`
        : '';

      const htmlBody = wrapEmailHtml({
        emailSubject,
        htmlContent,
        subscribeCtaHtml,
        unsubscribeFooterHtml,
        senderName,
        senderEmail,
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
