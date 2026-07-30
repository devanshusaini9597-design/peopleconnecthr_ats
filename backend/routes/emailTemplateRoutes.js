const express = require('express');
const router = express.Router();
const EmailTemplate = require('../models/EmailTemplate');
const { signEmail } = require('../utils/subscribeSign');

// ─── GET all templates for the logged-in user (includes defaults) ───
router.get('/', async (req, res) => {
  try {
    const SUBSCRIBE_TEMPLATE = {
      name: 'Subscribe for Updates',
      category: 'marketing',
      subject: 'Stay ahead with {{company}} – Job alerts and updates',
      body: `Dear {{candidateName}},

Thank you for your interest in {{company}}. We would like to keep you informed with relevant opportunities and updates.

What you'll receive when you subscribe:

• Curated job alerts matched to your skills and preferences
• Early notice of hiring drives and new openings from our partner companies
• Occasional industry insights and career tips from our HR team

Click the button below to subscribe. You will then be added to our mailing list and will receive future updates via email.

Subscribe now: {{subscribeLink}}

Best regards,
Skillnix Recruitment Services`,
      variables: ['candidateName', 'company', 'subscribeLink'],
      isDefault: true,
      createdBy: req.user.id
    };

    let templates = await EmailTemplate.find({
      $or: [{ createdBy: req.user.id }, { isDefault: true }]
    }).sort({ isDefault: -1, updatedAt: -1 });

    const hasSubscribe = templates.some(t => t.name === 'Subscribe for Updates' && t.category === 'marketing');
    if (!hasSubscribe) {
      const created = await EmailTemplate.create(SUBSCRIBE_TEMPLATE);
      templates = [created, ...templates];
    } else {
      const existingSubscribe = templates.find(t => t.name === 'Subscribe for Updates' && t.category === 'marketing');
      if (existingSubscribe && existingSubscribe.body && existingSubscribe.body.includes('unsubscribe')) {
        existingSubscribe.body = SUBSCRIBE_TEMPLATE.body;
        existingSubscribe.subject = SUBSCRIBE_TEMPLATE.subject;
        existingSubscribe.variables = SUBSCRIBE_TEMPLATE.variables;
        await existingSubscribe.save();
      }
    }
    // Show premade "Subscribe for Updates" first, then other defaults, then by updatedAt
    templates.sort((a, b) => {
      const aFirst = (a.name === 'Subscribe for Updates' && a.category === 'marketing') ? 1 : 0;
      const bFirst = (b.name === 'Subscribe for Updates' && b.category === 'marketing') ? 1 : 0;
      if (bFirst !== aFirst) return bFirst - aFirst;
      return (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0) || (new Date(b.updatedAt) - new Date(a.updatedAt));
    });

    res.json({ success: true, templates });
  } catch (err) {
    console.error('Get templates error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Ensure "Subscribe for Updates" premade template exists (call to add it if missing) ───
router.post('/ensure-subscribe', async (req, res) => {
  try {
    const existing = await EmailTemplate.findOne({ name: 'Subscribe for Updates', category: 'marketing' });
    if (existing) {
      return res.json({ success: true, template: existing, added: false });
    }
    const template = await EmailTemplate.create({
      name: 'Subscribe for Updates',
      category: 'marketing',
      subject: 'Stay ahead with {{company}} – Job alerts and updates',
      body: `Dear {{candidateName}},

Thank you for your interest in {{company}}. We would like to keep you informed with relevant opportunities and updates.

What you'll receive when you subscribe:

• Curated job alerts matched to your skills and preferences
• Early notice of hiring drives and new openings from our partner companies
• Occasional industry insights and career tips from our HR team

Click the button below to subscribe. You will then be added to our mailing list and will receive future updates via email.

Subscribe now: {{subscribeLink}}

Best regards,
Skillnix Recruitment Services`,
      variables: ['candidateName', 'company', 'subscribeLink'],
      isDefault: true,
      createdBy: req.user.id
    });
    res.json({ success: true, template, added: true });
  } catch (err) {
    console.error('Ensure subscribe template error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET single template ───
router.get('/:id', async (req, res) => {
  try {
    const template = await EmailTemplate.findOne({
      _id: req.params.id,
      $or: [{ createdBy: req.user.id }, { isDefault: true }]
    });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    res.json({ success: true, template });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── CREATE template ───
router.post('/', async (req, res) => {
  try {
    const { name, category, subject, body, variables } = req.body;
    if (!name || !subject || !body) {
      return res.status(400).json({ success: false, message: 'Name, subject and body are required' });
    }
    const template = await EmailTemplate.create({
      name, category: category || 'custom', subject, body,
      variables: variables || [],
      createdBy: req.user.id,
      isDefault: false
    });
    res.status(201).json({ success: true, template });
  } catch (err) {
    console.error('Create template error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── UPDATE template ───
router.put('/:id', async (req, res) => {
  try {
    const template = await EmailTemplate.findOne({ _id: req.params.id, createdBy: req.user.id });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found or not editable' });
    const { name, category, subject, body, variables } = req.body;
    if (name) template.name = name;
    if (category) template.category = category;
    if (subject) template.subject = subject;
    if (body) template.body = body;
    if (variables) template.variables = variables;
    await template.save();
    res.json({ success: true, template });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE template ───
router.delete('/:id', async (req, res) => {
  try {
    const template = await EmailTemplate.findOneAndDelete({ _id: req.params.id, createdBy: req.user.id, isDefault: false });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found or cannot be deleted' });
    res.json({ success: true, message: 'Template deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── SEND email using template ───
router.post('/send', async (req, res) => {
  try {
    const { templateId, recipients, variables, cc, bcc, channel } = req.body;
    // channel: 'transactional' (default, ZeptoMail) or 'marketing' (Zoho Campaigns)

    if (!templateId) return res.status(400).json({ success: false, message: 'Template ID is required' });
    
    const template = await EmailTemplate.findOne({
      _id: templateId,
      $or: [{ createdBy: req.user.id }, { isDefault: true }]
    });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

    const recipientList = Array.isArray(recipients) ? recipients : [recipients];
    if (!recipientList.length || !recipientList[0]?.email) {
      return res.status(400).json({ success: false, message: 'At least one recipient email is required' });
    }

    const isMarketing = channel === 'marketing';

    if (isMarketing) {
      const { sendMarketingEmail, isCampaignsConfigured } = require('../services/campaignService');
      if (!isCampaignsConfigured()) {
        return res.status(400).json({ success: false, message: 'CAMPAIGNS_NOT_CONFIGURED', displayMessage: 'Zoho Campaigns is not configured.' });
      }
      const listKey = (process.env.ZOHO_CAMPAIGNS_LIST_KEY || '').trim();
      if (!listKey) {
        return res.status(400).json({
          success: false,
          message: 'CAMPAIGNS_NOT_CONFIGURED',
          displayMessage: 'Add ZOHO_CAMPAIGNS_LIST_KEY in backend .env (from Zoho Campaigns → Mailing Lists → list key), then restart the backend.'
        });
      }
    }

    const { sendEmail, checkUserEmailConfigured } = require('../services/emailService');

    if (!isMarketing) {
      const isConfigured = await checkUserEmailConfigured(req.user.id);
      if (!isConfigured) {
        return res.status(400).json({
          success: false,
          message: 'EMAIL_NOT_CONFIGURED',
          displayMessage: 'Please configure your email settings first. Go to Email → Email Settings to set up your email address.'
        });
      }
    }
    
    const results = { success: [], failed: [] };

    for (const recipient of recipientList) {
      try {
        // Replace variables in subject and body
        const vars = { ...variables, candidateName: recipient.name || variables?.candidateName || 'Candidate' };
        if (isMarketing) {
          vars.unsubscribeLink = (process.env.ZOHO_CAMPAIGNS_UNSUBSCRIBE_URL || (process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/unsubscribe` : '') || '#unsubscribe').trim() || '#unsubscribe';
          const base = (process.env.FRONTEND_URL || '').trim() || '';
          vars.subscribeLink = base ? `${base.replace(/\/$/, '')}/subscribe` : '#subscribe';
          if (recipient.email) vars.subscribeLink += `?email=${encodeURIComponent(recipient.email)}`;
        }
        const isSubscribeInviteTemplate = template.name === 'Subscribe for Updates' && template.category === 'marketing';
        // Use EMAIL_LINKS_* for one-click links in emails so they work when clicked (e.g. from phone); fallback to BACKEND/FRONTEND
        const backendBase = (process.env.EMAIL_LINKS_BACKEND_URL || process.env.BACKEND_URL || process.env.API_URL || '').trim().replace(/\/$/, '');
        const frontendBase = (process.env.EMAIL_LINKS_FRONTEND_URL || process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
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
        let emailSubject = template.subject;
        let emailBody = template.body;

        Object.entries(vars).forEach(([key, val]) => {
          const regex = new RegExp(`{{${key}}}`, 'g');
          emailSubject = emailSubject.replace(regex, val || '');
          emailBody = emailBody.replace(regex, typeof val === 'string' ? val : (val || ''));
        });

        // Build professional enterprise HTML email
        const senderName = req.user.name || 'HR Team';
        const senderEmail = req.user.email || '';
        const currentYear = new Date().getFullYear();

        // Parse body into structured content blocks
        const bodyLines = emailBody.split('\n');
        let htmlContent = '';
        let inList = false;
        const isSubscribeInvite = template.name === 'Subscribe for Updates' && template.category === 'marketing';

        bodyLines.forEach((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            if (inList) { htmlContent += '</ul>'; inList = false; }
            htmlContent += '<div style="height: 12px;"></div>';
          } else if (isSubscribeInvite && /^Subscribe now:\s*(.+)?$/i.test(trimmed)) {
            // Skip this line; the Subscribe CTA button is added separately
            if (inList) { htmlContent += '</ul>'; inList = false; }
          } else if (/unsubscribe|email preferences|click here:\s*#?unsubscribe/i.test(trimmed)) {
            // Remove unsubscribe line from body (any template)
            if (inList) { htmlContent += '</ul>'; inList = false; }
          } else if (/^(\d+[\.\)]|[-•●])\s/.test(trimmed)) {
            // Numbered or bulleted list item
            if (!inList) { htmlContent += '<ul style="margin: 8px 0 8px 4px; padding-left: 20px; color: #374151;">'; inList = true; }
            htmlContent += `<li style="margin: 4px 0; font-size: 14px; line-height: 1.7; color: #374151;">${trimmed.replace(/^(\d+[\.\)]|[-•●])\s*/, '')}</li>`;
          } else if (trimmed.startsWith('Dear ')) {
            if (inList) { htmlContent += '</ul>'; inList = false; }
            htmlContent += `<p style="margin: 0 0 4px 0; font-size: 15px; color: #1f2937; font-weight: 500;">${trimmed}</p>`;
          } else if (/^(Best regards|Regards|Sincerely|Thank you|Warm regards)/i.test(trimmed)) {
            if (inList) { htmlContent += '</ul>'; inList = false; }
            htmlContent += `<div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb;"><p style="margin: 0 0 2px 0; font-size: 14px; color: #6b7280;">${trimmed}</p>`;
          } else if (idx > 0 && /^(Best regards|Regards|Sincerely|Thank you|Warm regards)/i.test(bodyLines.slice(0, idx).reverse().find(l => l.trim())?.trim() || '')) {
            // Lines after sign-off (like "HR Team", "Skillnix...")
            htmlContent += `<p style="margin: 0 0 1px 0; font-size: 14px; color: #4b5563; font-weight: 600;">${trimmed}</p>`;
          } else if (/^[A-Z][A-Za-z\s\/]+:\s/.test(trimmed)) {
            // Key-value lines like "CTC: 4 LPA", "Date: 15 Feb 2026"
            if (inList) { htmlContent += '</ul>'; inList = false; }
            const colonIdx = trimmed.indexOf(':');
            const key = trimmed.substring(0, colonIdx);
            const val = trimmed.substring(colonIdx + 1).trim();
            htmlContent += `<div style="display: flex; margin: 6px 0; font-size: 14px; line-height: 1.6;"><span style="color: #6b7280; min-width: 160px; font-weight: 500;">${key}:</span><span style="color: #1f2937; font-weight: 600;">${val}</span></div>`;
          } else {
            if (inList) { htmlContent += '</ul>'; inList = false; }
            htmlContent += `<p style="margin: 0 0 6px 0; font-size: 14px; line-height: 1.7; color: #374151;">${trimmed}</p>`;
          }
        });
        if (inList) htmlContent += '</ul>';
        // Close sign-off div if opened
        if (htmlContent.includes('border-top: 1px solid #e5e7eb')) htmlContent += '</div>';

        const unsubscribeUrl = (isMarketing && vars.unsubscribeLink && vars.unsubscribeLink !== '#unsubscribe') ? vars.unsubscribeLink : '';
        const unsubscribeFooterHtml = (unsubscribeUrl && !isSubscribeInvite)
          ? `<p style="margin: 0 0 8px 0; font-size: 11px;"><a href="${unsubscribeUrl}" style="color: #6366f1; text-decoration: underline;">Unsubscribe</a> or <a href="${unsubscribeUrl}" style="color: #6366f1; text-decoration: underline;">update email preferences</a></p>`
          : '';
        const subscribeUrl = (vars.subscribeLink && typeof vars.subscribeLink === 'string' && vars.subscribeLink.startsWith('http')) ? vars.subscribeLink : '';
        const subscribeCtaHtml = subscribeUrl
          ? `<div style="margin: 28px 0 24px 0; text-align: center;"><a href="${subscribeUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 10px; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);">Subscribe for updates</a></div>`
          : '';

        const htmlBody = `
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

        const emailOptions = { senderName, senderEmail, userId: req.user.id };
        if (cc) emailOptions.cc = Array.isArray(cc) ? cc : cc.split(',').map(e => e.trim()).filter(Boolean);
        if (bcc) emailOptions.bcc = Array.isArray(bcc) ? bcc : bcc.split(',').map(e => e.trim()).filter(Boolean);

        if (isMarketing) {
          const { sendMarketingEmail } = require('../services/campaignService');
          await sendMarketingEmail(recipient.email, emailSubject, htmlBody, { userId: req.user.id, senderName });
          // Marketing = add to Zoho list only. Do NOT send via ZeptoMail so it does not use transactional limits.
          // Recipients get the email when you send a campaign from Zoho Campaigns dashboard to this list.
        } else {
          await sendEmail(recipient.email, emailSubject, htmlBody, emailBody.replace(/<[^>]*>/g, ''), emailOptions);
        }
        results.success.push(recipient.email);
      } catch (err) {
        if (err.code === 'USE_VERIFIED_DOMAIN') throw err;
        console.error('[Send email] Failed for', recipient.email, ':', err.message, err.code || '');
        // Prefer displayMessage; never show Zoho's raw "It failed to load one of..." — use our env var names
        let errMsg = err.displayMessage || err.message;
        const fromZoho = err.response?.data && (err.response.status === 400 || err.response.status === 401 || err.response.status === 403);
        const zohoMsg = fromZoho && (typeof err.response.data === 'object' ? (err.response.data.message || err.response.data.error || '') : '');
        if (err.displayMessage) {
          errMsg = err.displayMessage;
        } else if (zohoMsg && /failed to load|client_id|client_secret|refresh_token|list key/i.test(zohoMsg)) {
          errMsg = 'Zoho Campaigns config error. In backend .env set: ZOHO_CAMPAIGNS_CLIENT_ID, ZOHO_CAMPAIGNS_CLIENT_SECRET, ZOHO_CAMPAIGNS_REFRESH_TOKEN, ZOHO_CAMPAIGNS_LIST_KEY. Restart the backend after changes.';
        } else if (err.response?.status === 400 && !err.displayMessage) {
          errMsg = 'Zoho Campaigns returned an error. In backend .env set: ZOHO_CAMPAIGNS_CLIENT_ID, ZOHO_CAMPAIGNS_CLIENT_SECRET, ZOHO_CAMPAIGNS_REFRESH_TOKEN, ZOHO_CAMPAIGNS_LIST_KEY. Restart the backend after changes.';
        } else if (/request failed with status code/i.test(errMsg) && (err.response?.status === 400 || err.response?.status >= 400)) {
          errMsg = 'Zoho Campaigns rejected the request. Check ZOHO_CAMPAIGNS_* vars and list key in backend .env, then restart the backend.';
        }
        results.failed.push({ email: recipient.email, error: errMsg, displayMessage: err.displayMessage || errMsg });
      }
    }

    res.json({
      success: true,
      message: `Sent ${results.success.length} of ${recipientList.length} emails`,
      data: results
    });
  } catch (err) {
    if (err.code === 'USE_VERIFIED_DOMAIN') {
      return res.status(400).json({ success: false, message: err.message, code: 'USE_VERIFIED_DOMAIN' });
    }
    if (err.code === 'CAMPAIGNS_NOT_CONFIGURED' || err.message === 'CAMPAIGNS_NOT_CONFIGURED') {
      return res.status(400).json({
        success: false,
        message: err.message,
        code: 'CAMPAIGNS_NOT_CONFIGURED',
        displayMessage: err.displayMessage || 'Zoho Campaigns is not configured. Add OAuth credentials (or API key) and ZOHO_CAMPAIGNS_LIST_KEY in backend .env.'
      });
    }
    console.error('[Send email] Template send error:', err.message, err);
    res.status(500).json({ success: false, message: err.message, displayMessage: err.displayMessage });
  }
});

// ─── SEED default templates (called once, or to add missing marketing template) ───
router.post('/seed-defaults', async (req, res) => {
  try {
    const existing = await EmailTemplate.countDocuments({ isDefault: true });
    const subscribeTemplate = {
      name: 'Subscribe for Updates',
      category: 'marketing',
      subject: 'Stay ahead with {{company}} – Job alerts and updates',
      body: `Dear {{candidateName}},

Thank you for your interest in {{company}}. We would like to keep you informed with relevant opportunities and updates.

What you'll receive when you subscribe:

• Curated job alerts matched to your skills and preferences
• Early notice of hiring drives and new openings from our partner companies
• Occasional industry insights and career tips from our HR team

Click the button below to subscribe. You will then be added to our mailing list and will receive future updates via email.

Subscribe now: {{subscribeLink}}

Best regards,
Skillnix Recruitment Services`,
      variables: ['candidateName', 'company', 'subscribeLink'],
      isDefault: true,
      createdBy: req.user.id
    };

    if (existing > 0) {
      await EmailTemplate.findOneAndUpdate(
        { name: 'Subscribe for Updates', category: 'marketing' },
        { $setOnInsert: subscribeTemplate },
        { upsert: true }
      );
      return res.json({ success: true, message: 'Default templates already exist; marketing template ensured', count: existing });
    }

    const defaults = [
      {
        name: 'Hiring Drive Invitation',
        category: 'hiring',
        subject: 'Hiring Drive – {{position}} | {{company}}',
        body: `Dear Candidate,

Greetings!

We are hiring for the profile of {{position}} with {{company}}.

CTC: {{ctc}}
Experience Required: {{experience}}
Location: {{location}}

If you are interested, we have an interview drive scheduled on {{date}} and timings {{time}}.

Kindly reply to this email to confirm your availability.

Best regards,
HR Team
Skillnix Recruitment Services`,
        variables: ['position', 'company', 'ctc', 'experience', 'location', 'date', 'time'],
        isDefault: true,
        createdBy: req.user.id
      },
      {
        name: 'Interview Schedule',
        category: 'interview',
        subject: 'Interview Schedule – {{position}} | {{company}}',
        body: `Dear {{candidateName}},

Greetings!

We have an upcoming interview drive for the profile of {{position}} with {{company}}. Your interview has been scheduled as per the details below:

Date: {{date}}
Time: {{time}}

Interview Location:
{{venue}}

SPOC: {{spoc}}
Reference: Skillnix Recruitment Services

Kindly ensure your availability and carry all relevant documents for the interview.

Best regards,
HR Team
Skillnix Recruitment Services`,
        variables: ['candidateName', 'position', 'company', 'date', 'time', 'venue', 'spoc'],
        isDefault: true,
        createdBy: req.user.id
      },
      {
        name: 'Application Rejection',
        category: 'rejection',
        subject: 'Application Status Update – {{position}}',
        body: `Dear {{candidateName}},

Thank you for your interest in the {{position}} position at {{company}}. After careful consideration of your application and qualifications, we regret to inform you that we have decided to move forward with other candidates whose experience more closely matches our current requirements.

We genuinely appreciate the time and effort you invested in your application. We encourage you to apply for future openings that align with your skills and experience.

We wish you the very best in your career.

Best regards,
HR Team
Skillnix Recruitment Services`,
        variables: ['candidateName', 'position', 'company'],
        isDefault: true,
        createdBy: req.user.id
      },
      {
        name: 'Document Request',
        category: 'document',
        subject: 'Document Submission Required – {{position}}',
        body: `Dear {{candidateName}},

Congratulations on progressing to the next stage for the {{position}} position at {{company}}!

As the next step in our hiring process, we kindly request you to submit the following documents:

1. Updated Resume / CV
2. Valid Government-issued Photo ID
3. Educational Certificates & Mark Sheets
4. Previous Employment / Experience Letters
5. Last 3 months Salary Slips (if applicable)

Please reply to this email with the above documents within 3 business days.

Best regards,
HR Team
Skillnix Recruitment Services`,
        variables: ['candidateName', 'position', 'company'],
        isDefault: true,
        createdBy: req.user.id
      },
      {
        name: 'Onboarding Welcome',
        category: 'onboarding',
        subject: 'Welcome Aboard – {{position}} | {{company}}',
        body: `Dear {{candidateName}},

Welcome aboard! We are thrilled to have you join our team as {{position}} at {{company}}.

Joining Date: {{date}}
Reporting Time: {{time}}
Location: {{venue}}

Please ensure you have completed all onboarding formalities and carry the following on your first day:
- Original ID Proof
- Educational Certificates
- Joining Letter (if received)
- 2 Passport-sized Photographs

If you have any questions before your start date, feel free to reach out to us.

We look forward to working with you!

Best regards,
HR Team
Skillnix Recruitment Services`,
        variables: ['candidateName', 'position', 'company', 'date', 'time', 'venue'],
        isDefault: true,
        createdBy: req.user.id
      },
      {
        name: 'Subscribe for Updates',
        category: 'marketing',
        subject: 'Stay ahead with {{company}} – Job alerts and updates',
        body: `Dear {{candidateName}},

Thank you for your interest in {{company}}. We would like to keep you informed with relevant opportunities and updates.

What you'll receive when you subscribe:

• Curated job alerts matched to your skills and preferences
• Early notice of hiring drives and new openings from our partner companies
• Occasional industry insights and career tips from our HR team

Click the button below to subscribe. You will then be added to our mailing list and will receive future updates via email.

Subscribe now: {{subscribeLink}}

Best regards,
Skillnix Recruitment Services`,
        variables: ['candidateName', 'company', 'subscribeLink'],
        isDefault: true,
        createdBy: req.user.id
      }
    ];

    await EmailTemplate.insertMany(defaults);
    res.json({ success: true, message: `${defaults.length} default templates created` });
  } catch (err) {
    console.error('Seed templates error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
