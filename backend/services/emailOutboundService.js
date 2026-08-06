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
  sendBulkEmails,
  checkUserEmailConfigured,
  canUserSendViaZepto,
} = require('./emailService');

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

async function sendTypedEmail(user, body) {
  const { email, name, position, emailType, customMessage, department, joiningDate, cc, bcc } = body;

  if (!email || !email.includes('@')) throw httpError('Valid email address is required');
  if (!name) throw httpError('Candidate name is required');
  if (!emailType) {
    throw httpError('Email type is required (interview, rejection, document, onboarding, custom)');
  }

  const emailOptions = { userId: user.id };
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
      result = await sendCustomEmail(email, 'Message from HR Team', customMessage, emailOptions);
      break;
    default:
      throw httpError('Invalid email type. Must be: interview, rejection, document, onboarding, or custom');
  }

  logger.info(`✅ Email sent successfully to ${email} (Type: ${emailType})`);
  await bumpEmailUsage(user.organizationId, 1);
  return { message: `Email sent successfully to ${email}`, data: result };
}

async function sendBulkTypedEmails(user, body) {
  const { candidates, emailType, customMessage, cc, bcc } = body;

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

  const results = await sendBulkEmails(candidates, emailType, customMessage, {
    cc,
    bcc,
    userId: user.id,
  });

  await bumpEmailUsage(user.organizationId, results.success.length);

  return {
    message: 'Bulk email campaign completed',
    data: {
      total: results.total,
      sent: results.success.length,
      failed: results.failed.length,
      successRate: `${((results.success.length / results.total) * 100).toFixed(2)}%`,
      failedEmails: results.failed,
    },
  };
}

function buildEmailPreview(body) {
  const {
    name = 'Candidate',
    position = 'Position',
    emailType,
    customMessage,
    department,
    joiningDate,
  } = body;

  const templates = {
    interview: {
      subject: `Interview Invitation - ${position}`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; color: white; text-align: center; border-radius: 10px 10px 0 0;">
            <h2 style="margin: 0;">📞 Interview Invitation</h2>
          </div>
          <div style="padding: 40px; background: white; border: 1px solid #ddd; border-radius: 0 0 10px 10px;">
            <p style="color: #333; font-size: 16px;">Dear ${name},</p>
            <p style="color: #666; line-height: 1.6;">Congratulations! We are pleased to invite you for an interview for the <strong>${position}</strong> position.</p>
            <p style="color: #666; line-height: 1.6;">Our HR team will contact you shortly with interview details including date, time, and format.</p>
            <p style="color: #666; line-height: 1.6;">If you have any questions, please feel free to reach out to us.</p>
            <p style="color: #666; line-height: 1.6;">Best regards,<br><strong>HR Team</strong></p>
          </div>
        </div>`,
    },
    rejection: {
      subject: 'Application Status Update',
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #f5f5f5; padding: 40px; text-align: center; border-radius: 10px 10px 0 0;">
            <h2 style="color: #333; margin: 0;">Application Status Update</h2>
          </div>
          <div style="padding: 40px; background: white; border: 1px solid #ddd; border-radius: 0 0 10px 10px;">
            <p style="color: #333; font-size: 16px;">Dear ${name},</p>
            <p style="color: #666; line-height: 1.6;">Thank you for your interest in the <strong>${position}</strong> position. After careful consideration of your application and qualifications, we regret to inform you that we have decided to move forward with other candidates whose experience more closely matches our current needs.</p>
            <p style="color: #666; line-height: 1.6;">We appreciate the time you invested in applying and interviewing with us. We encourage you to apply for future positions that match your skills and experience.</p>
            <p style="color: #666; line-height: 1.6;">Best regards,<br><strong>HR Team</strong></p>
          </div>
        </div>`,
    },
    document: {
      subject: `Document Submission - ${position}`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px; color: white; text-align: center; border-radius: 10px 10px 0 0;">
            <h2 style="margin: 0;">📄 Document Submission Required</h2>
          </div>
          <div style="padding: 40px; background: white; border: 1px solid #ddd; border-radius: 0 0 10px 10px;">
            <p style="color: #333; font-size: 16px;">Dear ${name},</p>
            <p style="color: #666; line-height: 1.6;">As the next step in our hiring process for the <strong>${position}</strong> position, we require you to submit the following documents:</p>
            <ul style="color: #666; line-height: 1.8;">
              <li>Updated Resume</li>
              <li>Valid Government ID</li>
              <li>Educational Certificates</li>
              <li>Previous Employment Letters</li>
            </ul>
            <p style="color: #666; line-height: 1.6;">Please reply to this email with the requested documents within 3 business days.</p>
            <p style="color: #666; line-height: 1.6;">Best regards,<br><strong>HR Team</strong></p>
          </div>
        </div>`,
    },
    onboarding: {
      subject: `Onboarding Confirmation - ${position}`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 40px; color: white; text-align: center; border-radius: 10px 10px 0 0;">
            <h2 style="margin: 0;">🎉 Welcome to the Team!</h2>
          </div>
          <div style="padding: 40px; background: white; border: 1px solid #ddd; border-radius: 0 0 10px 10px;">
            <p style="color: #333; font-size: 16px;">Dear ${name},</p>
            <p style="color: #666; line-height: 1.6;">Welcome aboard! We are excited to have you join our team as a <strong>${position}</strong> in the <strong>${department || 'N/A'}</strong> department.</p>
            <p style="color: #666; line-height: 1.6;"><strong>Joining Date:</strong> ${joiningDate || 'TBD'}</p>
            <p style="color: #666; line-height: 1.6;">Please ensure you have completed all onboarding formalities and bring the necessary documents on your first day.</p>
            <p style="color: #666; line-height: 1.6;">If you have any questions, feel free to reach out to our HR team.</p>
            <p style="color: #666; line-height: 1.6;">Best regards,<br><strong>HR Team</strong></p>
          </div>
        </div>`,
    },
    custom: {
      subject: 'Message from HR Team',
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="padding: 40px; background: white; border: 1px solid #ddd; border-radius: 10px;">
            <div style="color: #333; white-space: pre-wrap; line-height: 1.6;">${customMessage || 'Your custom message goes here...'}</div>
            <p style="color: #999; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">This is an automated message. Please do not reply directly to this email.</p>
          </div>
        </div>`,
    },
  };

  const template = templates[emailType];
  if (!template) throw httpError('Invalid email type');
  return template;
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
    userId: user.id,
    campaignName: campaignName || `ats_campaign_${Date.now()}`,
    trackOpens: trackOpens !== false,
    trackClicks: trackClicks !== false,
  });

  return {
    message: `Marketing email queued to ${result.sent} recipient(s)`,
    data: result.data,
  };
}

async function getEmailChannels(userId) {
  const { isCampaignsConfigured } = require('./campaignService');
  const transactional = await checkUserEmailConfigured(userId);
  const marketing = isCampaignsConfigured();
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
