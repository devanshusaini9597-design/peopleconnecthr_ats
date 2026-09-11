/**
 * Outbound transactional / marketing email helpers used by emailRoutes.
 */
const logger = require('../utils/logger');
const Organization = require('../models/Organization');
const {
  sendInterviewEmail,
  sendRejectionEmail,
  sendDocumentEmail,
  sendOnboardingEmail,
  sendCustomEmail,
  checkUserEmailConfigured,
  canUserSendViaZepto,
} = require('./emailService');
const { buildQuickEmailContent } = require('./quickEmailContent');
const { loadOrgEmailBrand } = require('./emailBrandLayout');
const { signEmail } = require('../utils/subscribeSign');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

async function bumpEmailUsage(organizationId, count = 1) {
  if (!organizationId) return;
  try {
    await Organization.findByIdAndUpdate(organizationId, {
      $inc: { 'usageCurrent.emailsSent': count },
    });
  } catch (err) {
    logger.warn('[emailOutbound] Failed to increment emailsSent usage:', err.message);
  }
}

async function getSenderStatus(userId) {
  return canUserSendViaZepto(userId);
}

async function resolveDirectSubscribeUrl(organizationId, email) {
  const emailNorm = String(email || '').trim().toLowerCase();
  if (!emailNorm || !emailNorm.includes('@') || !organizationId) return '';

  try {
    const Candidate = require('../models/Candidate');
    const row = await Candidate.findOne({ organizationId, email: emailNorm })
      .select('marketingConsent.optedIn')
      .lean();
    if (row?.marketingConsent?.optedIn === true) return ''; // already subscribed — no CTA
  } catch (_) {
    /* show subscribe if lookup fails */
  }

  let orgSlug = '';
  try {
    const org = await Organization.findById(organizationId).select('slug').lean();
    orgSlug = String(org?.slug || '').trim();
  } catch (_) {}

  const backendBase = (
    process.env.EMAIL_LINKS_BACKEND_URL ||
    process.env.BACKEND_URL ||
    process.env.API_URL ||
    ''
  )
    .trim()
    .replace(/\/$/, '');
  const frontendBase = (process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
  const orgQs = orgSlug
    ? `&org=${encodeURIComponent(orgSlug)}`
    : `&orgId=${encodeURIComponent(String(organizationId))}`;

  if (backendBase) {
    try {
      const sig = signEmail(emailNorm);
      return `${backendBase}/api/public/subscribe/confirm?email=${encodeURIComponent(emailNorm)}&sig=${sig}${orgQs}`;
    } catch (_) {
      /* fall through */
    }
  }
  if (frontendBase) {
    return `${frontendBase}/subscribe?email=${encodeURIComponent(emailNorm)}${orgQs}`;
  }
  return '';
}

async function sendTypedEmail(user, body) {
  const { email, name, position, emailType, customMessage, department, joiningDate, cc, bcc } = body;

  if (!email || !email.includes('@')) throw httpError('Valid email address is required');
  if (!name) throw httpError('Candidate name is required');
  if (!emailType) {
    throw httpError('Email type is required (interview, rejection, document, onboarding, custom)');
  }

  const emailOptions = {
    userId: user.id,
    customMessage: customMessage || '',
    senderName: user.name || 'HR Team',
    brand: await loadOrgEmailBrand(user.organizationId),
    subscribeUrl: await resolveDirectSubscribeUrl(user.organizationId, email),
    organizationId: user.organizationId,
    emailType,
    channel: 'transactional',
  };
  if (cc) emailOptions.cc = cc;
  if (bcc) emailOptions.bcc = bcc;

  const isConfigured = await checkUserEmailConfigured(user.id);
  if (!isConfigured) {
    throw httpError('EMAIL_NOT_CONFIGURED', 400, {
      displayMessage:
        'Please configure your email settings first. Go to Email → Email Settings to set up your email address.',
    });
  }

  let result;
  switch (emailType) {
    case 'interview':
      result = await sendInterviewEmail(email, name, position, emailOptions);
      break;
    case 'rejection':
      result = await sendRejectionEmail(email, name, position, emailOptions);
      break;
    case 'document':
      result = await sendDocumentEmail(email, name, position, emailOptions);
      break;
    case 'onboarding':
      result = await sendOnboardingEmail(email, name, position, department, joiningDate, emailOptions);
      break;
    case 'custom':
      if (!customMessage) throw httpError('Custom message is required for custom email type');
      result = await sendCustomEmail(
        email,
        (body.subject || '').trim() || 'Message from recruiting team',
        customMessage,
        {
          ...emailOptions,
          candidateName: name,
        }
      );
      break;
    default:
      throw httpError('Invalid email type. Must be: interview, rejection, document, onboarding, or custom');
  }

  logger.info(`✅ Email sent successfully to ${email} (Type: ${emailType})`);
  await bumpEmailUsage(user.organizationId, 1);
  return { message: `Email sent successfully to ${email}`, data: result };
}

async function sendBulkTypedEmails(user, body) {
  const { candidates, emailType, customMessage, subject, cc, bcc } = body;

  if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
    throw httpError('Candidates array is required and must not be empty');
  }
  if (!emailType) {
    throw httpError('Email type is required (interview, rejection, document, onboarding, custom)');
  }

  const isConfigured = await checkUserEmailConfigured(user.id);
  if (!isConfigured) {
    throw httpError('EMAIL_NOT_CONFIGURED', 400, {
      displayMessage:
        'Please configure your email settings first. Go to Email → Email Settings to set up your email address.',
    });
  }

  logger.info(`\n📊 BULK EMAIL CAMPAIGN STARTED:`);
  logger.info(`   Type: ${emailType}`);
  logger.info(`   Total Recipients: ${candidates.length}`);

  const emailOptions = {
    userId: user.id,
    customMessage: customMessage || '',
    senderName: user.name || 'HR Team',
    brand: await loadOrgEmailBrand(user.organizationId),
    organizationId: user.organizationId,
    emailType,
    channel: 'transactional',
  };
  if (cc) emailOptions.cc = cc;
  if (bcc) emailOptions.bcc = bcc;

  const success = [];
  const failed = [];

  for (const candidate of candidates) {
    const email = candidate?.email;
    const name = candidate?.name || 'Candidate';
    const position = candidate?.position || '';
    const department = candidate?.department || 'N/A';
    const joiningDate = candidate?.joiningDate || 'TBD';

    if (!email || !String(email).includes('@')) {
      failed.push({ email: email || '', error: 'Invalid email address' });
      continue;
    }

    try {
      const perRecipientOptions = {
        ...emailOptions,
        subscribeUrl: await resolveDirectSubscribeUrl(user.organizationId, email),
      };
      let result;
      // Quick-send edited drafts arrive as custom + subject/body.
      if (emailType === 'custom') {
        if (!customMessage) throw httpError('Custom message is required for custom email type');
        result = await sendCustomEmail(
          email,
          (subject || '').trim() || 'Message from recruiting team',
          customMessage,
          { ...perRecipientOptions, candidateName: name }
        );
      } else if (emailType === 'interview') {
        result = await sendInterviewEmail(email, name, position, perRecipientOptions);
      } else if (emailType === 'rejection') {
        result = await sendRejectionEmail(email, name, position, perRecipientOptions);
      } else if (emailType === 'document') {
        result = await sendDocumentEmail(email, name, position, perRecipientOptions);
      } else if (emailType === 'onboarding') {
        result = await sendOnboardingEmail(email, name, position, department, joiningDate, perRecipientOptions);
      } else {
        throw httpError('Invalid email type. Must be: interview, rejection, document, onboarding, or custom');
      }
      success.push({ email, messageId: result?.messageId });
    } catch (err) {
      failed.push({
        email,
        error: err.message || 'Send failed',
        displayMessage: err.displayMessage || err.message,
      });
    }
  }

  await bumpEmailUsage(user.organizationId, success.length);

  return {
    message: 'Bulk email campaign completed',
    data: {
      total: candidates.length,
      sent: success.length,
      failed: failed.length,
      successRate: `${((success.length / candidates.length) * 100).toFixed(2)}%`,
      failedEmails: failed,
      successEmails: success,
    },
  };
}

function buildEmailPreview(body) {
  const {
    name = 'Candidate',
    position = '',
    emailType,
    customMessage,
    department,
    joiningDate,
    senderName,
    brand,
  } = body;

  const content = buildQuickEmailContent({
    emailType,
    name,
    position,
    customMessage,
    department,
    joiningDate,
    senderName: senderName || 'HR Team',
    subject: body.subject,
    brand: brand || null,
  });
  if (!content) throw httpError('Invalid email type');
  return content;
}

async function sendTestEmail(email) {
  if (!email || !email.includes('@')) throw httpError('Valid email address is required');
  await sendInterviewEmail(email, 'Test User', 'Test Position');
  return { message: `Test email sent successfully to ${email}` };
}

async function sendMarketing(user, body) {
  const { recipients, subject, htmlBody, campaignName, trackOpens, trackClicks } = body;
  if (!recipients || !recipients.length) throw httpError('Recipients are required');
  if (!subject || !htmlBody) throw httpError('Subject and HTML body are required');

  const { sendMarketingEmail, isCampaignsConfigured } = require('./campaignService');
  if (!isCampaignsConfigured()) {
    throw httpError('CAMPAIGNS_NOT_CONFIGURED', 400, {
      displayMessage:
        'Zoho Campaigns is not configured. Add ZOHO_CAMPAIGNS_CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN (or ZOHO_CAMPAIGNS_API_KEY) and ZOHO_CAMPAIGNS_LIST_KEY to backend .env.',
    });
  }

  const result = await sendMarketingEmail(recipients, subject, htmlBody, {
    userId: user.id || user._id,
    organizationId: user.organizationId,
    senderName: user.name || '',
    fromEmail: user.email || '',
    replyToEmail: user.email || '',
    campaignName: campaignName || `ats_campaign_${Date.now()}`,
    trackOpens: trackOpens !== false,
    trackClicks: trackClicks !== false,
  });

  return {
    message: `Marketing campaign started for ${result.sent} recipient(s) via Zoho Campaigns`,
    data: result.data,
  };
}

async function getEmailChannels(userId, organizationId) {
  const { isCampaignsConfigured } = require('./campaignService');
  const { resolveCampaignsSettings, isSettingsConfigured } = require('./marketingListService');
  const transactional = await checkUserEmailConfigured(userId);
  // Platform env OR org Integrations → Marketing (Zoho Campaigns)
  let marketing = isCampaignsConfigured();
  if (!marketing && organizationId) {
    try {
      const settings = await resolveCampaignsSettings(organizationId);
      marketing = isSettingsConfigured(settings);
    } catch (_) {
      marketing = false;
    }
  }
  return {
    channels: {
      transactional: { available: transactional, provider: 'ZeptoMail' },
      marketing: { available: marketing, provider: 'Zoho Campaigns' },
    },
  };
}

module.exports = {
  getSenderStatus,
  sendTypedEmail,
  sendBulkTypedEmails,
  buildEmailPreview,
  sendTestEmail,
  sendMarketing,
  getEmailChannels,
};
