const express = require('express');
const router = express.Router();
const {
  sendInterviewEmail,
  sendRejectionEmail,
  sendDocumentEmail,
  sendOnboardingEmail,
  sendCustomEmail,
  sendBulkEmails,
  checkUserEmailConfigured,
  canUserSendViaZepto
} = require('../services/emailService');

/**
 * Sender status for ZeptoMail — only verified-domain users can send
 * GET /api/email/sender-status
 */
router.get('/sender-status', async (req, res) => {
  try {
    const status = await canUserSendViaZepto(req.user?.id);
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * 📧 Send single email to a candidate
 * POST /api/email/send
 * Body: { email, name, position, emailType, customMessage, department, joiningDate, cc, bcc }
 */
router.post('/send', async (req, res) => {
  try {
    const { email, name, position, emailType, customMessage, department, joiningDate, cc, bcc } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid email address is required'
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Candidate name is required'
      });
    }

    if (!emailType) {
      return res.status(400).json({
        success: false,
        message: 'Email type is required (interview, rejection, document, onboarding, custom)'
      });
    }

    // Prepare email options with CC and BCC
    const emailOptions = { userId: req.user.id };
    if (cc) emailOptions.cc = cc;
    if (bcc) emailOptions.bcc = bcc;

    // Check if user has email configured
    const isConfigured = await checkUserEmailConfigured(req.user.id);
    if (!isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'EMAIL_NOT_CONFIGURED',
        displayMessage: 'Please configure your email settings first. Go to Email → Email Settings to set up your email address.'
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
        if (!customMessage) {
          return res.status(400).json({
            success: false,
            message: 'Custom message is required for custom email type'
          });
        }
        result = await sendCustomEmail(email, `Message from HR Team`, customMessage, emailOptions);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid email type. Must be: interview, rejection, document, onboarding, or custom'
        });
    }

    console.log(`✅ Email sent successfully to ${email} (Type: ${emailType})`);
    
    res.json({
      success: true,
      message: `Email sent successfully to ${email}`,
      data: result
    });

  } catch (error) {
    console.error('❌ Send Email Error:', error);
    if (error.code === 'USE_VERIFIED_DOMAIN') {
      return res.status(400).json({ success: false, message: error.message, code: 'USE_VERIFIED_DOMAIN' });
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send email'
    });
  }
});

/**
 * 📧 Send bulk emails to multiple candidates
 * POST /api/email/send-bulk
 * Body: { candidates: [{ email, name, position, department, joiningDate }], emailType, customMessage, cc, bcc }
 */
router.post('/send-bulk', async (req, res) => {
  try {
    const { candidates, emailType, customMessage, cc, bcc } = req.body;

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Candidates array is required and must not be empty'
      });
    }

    if (!emailType) {
      return res.status(400).json({
        success: false,
        message: 'Email type is required (interview, rejection, document, onboarding, custom)'
      });
    }

    // Check if user has email configured
    const isConfigured = await checkUserEmailConfigured(req.user.id);
    if (!isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'EMAIL_NOT_CONFIGURED',
        displayMessage: 'Please configure your email settings first. Go to Email → Email Settings to set up your email address.'
      });
    }

    console.log(`\n📊 BULK EMAIL CAMPAIGN STARTED:`);
    console.log(`   Type: ${emailType}`);
    console.log(`   Total Recipients: ${candidates.length}`);
    if (cc) console.log(`   CC: ${Array.isArray(cc) ? cc.join(', ') : cc}`);
    if (bcc) console.log(`   BCC: ${Array.isArray(bcc) ? bcc.join(', ') : bcc}`);
    console.log(`   Timestamp: ${new Date().toLocaleString()}\n`);

    const results = await sendBulkEmails(candidates, emailType, customMessage, { cc, bcc, userId: req.user.id });

    console.log(`\n✅ BULK EMAIL CAMPAIGN COMPLETED:`);
    console.log(`   Success: ${results.success.length}`);
    console.log(`   Failed: ${results.failed.length}`);
    console.log(`   Success Rate: ${((results.success.length / results.total) * 100).toFixed(2)}%\n`);

    res.json({
      success: true,
      message: `Bulk email campaign completed`,
      data: {
        total: results.total,
        sent: results.success.length,
        failed: results.failed.length,
        successRate: `${((results.success.length / results.total) * 100).toFixed(2)}%`,
        failedEmails: results.failed
      }
    });

  } catch (error) {
    console.error('❌ Bulk Email Error:', error);
    if (error.code === 'USE_VERIFIED_DOMAIN') {
      return res.status(400).json({ success: false, message: error.message, code: 'USE_VERIFIED_DOMAIN' });
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send bulk emails'
    });
  }
});

/**
 * 👁️ Preview email HTML (no sending)
 * POST /api/email/preview
 * Body: { name, position, emailType, customMessage, department, joiningDate }
 */
router.post('/preview', (req, res) => {
  try {
    const { name = 'Candidate', position = 'Position', emailType, customMessage, department, joiningDate } = req.body;

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
        </div>`
      },
      rejection: {
        subject: `Application Status Update`,
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
        </div>`
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
        </div>`
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
        </div>`
      },
      custom: {
        subject: `Message from HR Team`,
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="padding: 40px; background: white; border: 1px solid #ddd; border-radius: 10px;">
            <div style="color: #333; white-space: pre-wrap; line-height: 1.6;">${customMessage || 'Your custom message goes here...'}</div>
            <p style="color: #999; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">This is an automated message. Please do not reply directly to this email.</p>
          </div>
        </div>`
      }
    };

    const template = templates[emailType];
    if (!template) {
      return res.status(400).json({ success: false, message: 'Invalid email type' });
    }

    res.json({ success: true, subject: template.subject, html: template.html });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate preview' });
  }
});

/**
 * 🧪 Test email configuration
 * POST /api/email/test
 * Body: { email }
 */
router.post('/test', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid email address is required'
      });
    }

    await sendInterviewEmail(email, 'Test User', 'Test Position');

    res.json({
      success: true,
      message: `Test email sent successfully to ${email}`
    });

  } catch (error) {
    console.error('❌ Test Email Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send test email'
    });
  }
});

// ─── Marketing email via Zoho Campaigns ───
router.post('/send-marketing', async (req, res) => {
  try {
    const { recipients, subject, htmlBody, campaignName, trackOpens, trackClicks } = req.body;

    if (!recipients || !recipients.length) {
      return res.status(400).json({ success: false, message: 'Recipients are required' });
    }
    if (!subject || !htmlBody) {
      return res.status(400).json({ success: false, message: 'Subject and HTML body are required' });
    }

    const { sendMarketingEmail, isCampaignsConfigured } = require('../services/campaignService');

    if (!isCampaignsConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'CAMPAIGNS_NOT_CONFIGURED',
        displayMessage: 'Zoho Campaigns is not configured. Add ZOHO_CAMPAIGNS_CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN (or ZOHO_CAMPAIGNS_API_KEY) and ZOHO_CAMPAIGNS_LIST_KEY to backend .env.'
      });
    }

    const result = await sendMarketingEmail(
      recipients,
      subject,
      htmlBody,
      {
        userId: req.user.id,
        campaignName: campaignName || `ats_campaign_${Date.now()}`,
        trackOpens: trackOpens !== false,
        trackClicks: trackClicks !== false
      }
    );

    res.json({ success: true, message: `Marketing email queued to ${result.sent} recipient(s)`, data: result.data });
  } catch (error) {
    console.error('Marketing email error:', error);
    const displayMessage = error.displayMessage || (error.code === 'CAMPAIGNS_NOT_CONFIGURED' ? 'Add ZOHO_CAMPAIGNS_LIST_KEY in backend .env (from Zoho Campaigns → Mailing Lists → list key).' : null);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send marketing email',
      code: error.code,
      displayMessage
    });
  }
});

// ─── Check which email channels are available ───
router.get('/channels', async (req, res) => {
  try {
    const { isCampaignsConfigured } = require('../services/campaignService');
    const { checkUserEmailConfigured } = require('../services/emailService');

    const transactional = await checkUserEmailConfigured(req.user?.id);
    const marketing = isCampaignsConfigured();

    res.json({
      success: true,
      channels: {
        transactional: { available: transactional, provider: 'ZeptoMail' },
        marketing: { available: marketing, provider: 'Zoho Campaigns' }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
