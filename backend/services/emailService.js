const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const axios = require('axios');

/**
 * EMAIL SERVICE
 * 
 * Priority (both getUserTransporter AND checkUserEmailConfigured):
 *   0. .env ZOHO_ZEPTOMAIL_API_KEY  →  ZeptoMail (always default when set)
 *   1. User personal SMTP/Zoho      →  Hostinger or custom SMTP
 *   2. Company-wide config           →  CompanyEmailConfig collection
 *   3. Nothing configured            →  Error
 */

// ─── Default (global) transporter from .env ───
let defaultTransporter;

const initializeTransporter = () => {
  const emailProvider = process.env.EMAIL_PROVIDER || 'gmail';
  
  if (emailProvider === 'gmail') {
    defaultTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_EMAIL,
        pass: process.env.GMAIL_APP_PASSWORD
      },
      family: 4
    });
  } else {
    defaultTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      family: 4
    });
  }

  console.log('📧 Email Service Initialized:', {
    provider: emailProvider,
    fromEmail: process.env.FROM_EMAIL || process.env.GMAIL_EMAIL
  });
};

initializeTransporter();

// ─── Zoho Zeptomail: normalize Authorization header value ───
// ZeptoMail sends token as "Zoho-enczapikey <key>". Accept that or raw key; never duplicate prefix.
const getZohoAuthHeaderValue = (apiKey) => {
  if (!apiKey || typeof apiKey !== 'string') return '';
  const k = apiKey.trim();
  if (k.toLowerCase().startsWith('zoho-enczapikey')) return k;
  return `Zoho-enczapikey ${k}`;
};

// ─── Zoho Zeptomail API Helper ───
/**
 * Sends email via Zoho Zeptomail API (REST-based, not SMTP)
 * 
 * How it works:
 * 1. Receives Zoho API key (from user or company config)
 * 2. Formats email payload according to Zoho API spec
 * 3. Makes HTTPS POST to Zoho API with Authorization header
 * 4. Handles errors: Auth (401), Rate limit (429), Bad request (400)
 * 
 * Security:
 * - API key passed only in mem, never logged (except in error msgs)
 * - Makes HTTPS call to official Zoho endpoint
 * - Returns only message ID, not the API key
 * - Caller responsible for masking key before returning to frontend
 */
const sendViaZohoZeptomail = async (to, subject, htmlBody, textBody, options = {}) => {
  const { cc, bcc, senderName, fromEmail, zohoApiKey, zohoApiUrl, userId } = options;
  
  if (!zohoApiKey || !zohoApiUrl || !fromEmail) {
    throw new Error('ZOHO_ZEPTOMAIL_NOT_CONFIGURED');
  }

  const displayName = senderName || 'Skillnix PCHR';
  const recipients = Array.isArray(to) ? to : [to];

  // Build recipient objects
  const toList = recipients.map(email => ({
    email_address: { 
      address: email,
      name: ''
    }
  }));

  const ccList = cc ? (Array.isArray(cc) ? cc : [cc]).map(email => ({
    email_address: { 
      address: email,
      name: ''
    }
  })) : [];

  const bccList = bcc ? (Array.isArray(bcc) ? bcc : [bcc]).map(email => ({
    email_address: { 
      address: email,
      name: ''
    }
  })) : [];

  const payload = {
    from: {
      address: fromEmail,
      name: displayName
    },
    to: toList,
    subject: subject,
    htmlbody: htmlBody,
    textbody: textBody || subject,
    reply_to: {
      address: fromEmail
    }
  };

  // Add CC if provided
  if (ccList.length > 0) {
    payload.cc = ccList;
  }

  // Add BCC if provided
  if (bccList.length > 0) {
    payload.bcc = bccList;
  }

  try {
    const apiEndpoint = zohoApiUrl.endsWith('/') 
      ? `${zohoApiUrl}v1.1/email`
      : `${zohoApiUrl}/v1.1/email`;
    
    const authHeader = getZohoAuthHeaderValue(zohoApiKey);
    const keyPreview = authHeader.length > 30 
      ? `${authHeader.substring(0, 25)}...${authHeader.substring(authHeader.length - 6)}`
      : authHeader;
    console.log(`[ZeptoMail] POST ${apiEndpoint} | from=${fromEmail} | auth=${keyPreview} (${authHeader.length} chars)`);

    const response = await axios.post(
      apiEndpoint,
      payload,
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const messageId = response.data?.data?.message_id || 'zoho_' + Date.now();
    console.log(`✅ Zoho Zeptomail accepted: to=${recipients.join(', ')} from=${fromEmail} messageId=${messageId}`);
    if (cc) console.log(`   CC: ${Array.isArray(cc) ? cc.join(', ') : cc}`);
    if (bcc) console.log(`   BCC: ${Array.isArray(bcc) ? bcc.join(', ') : bcc}`);

    return { 
      success: true, 
      email: to, 
      messageId
    };
  } catch (error) {
    console.error('❌ Zoho Zeptomail Error:', {
      message: error.message,
      status: error.response?.status,
      data: JSON.stringify(error.response?.data, null, 2),
      email: to,
      from: fromEmail
    });

    const zohoError = error.response?.data?.error;
    const zohoCode = zohoError?.code;
    const details = Array.isArray(zohoError?.details) ? zohoError.details : [];
    const sm111 = details.find(d => d && d.code === 'SM_111');
    const status = error.response?.status;

    let errorMsg = error.message;
    if (sm111) {
      errorMsg = `ZeptoMail: Sender address not verified. "${sm111.target_value || 'from'}" is not verified in your ZeptoMail agent. Emails are sent from your verified address (check .env ZOHO_ZEPTOMAIL_FROM_EMAIL).`;
    } else if (status === 401) {
      errorMsg = 'ZeptoMail: Invalid API key. Check your Send Mail Token in ZeptoMail dashboard.';
    } else if (status === 403) {
      console.error('ZeptoMail 403 – IP may be blocked. Remove all IP restrictions in ZeptoMail > Agent > Settings > IP Restriction to allow all IPs.', { code: zohoCode, data: error.response?.data });
      errorMsg = 'ZeptoMail 403: Request Denied. Go to ZeptoMail > your Agent > Settings > IP Restriction and remove all IPs (empty list = allow all).';
    } else if (status === 429) {
      errorMsg = 'ZeptoMail rate limit hit. Try again later or upgrade your plan.';
    } else if (error.code === 'ECONNABORTED') {
      errorMsg = 'ZeptoMail timeout. Network issue or Zoho service is slow.';
    } else if (error.response?.data?.message) {
      errorMsg = `ZeptoMail: ${error.response.data.message}`;
    }

    const err = new Error(errorMsg);
    err.code = 'ZOHO_ZEPTOMAIL_ERROR';
    throw err;
  }
};

// ─── Get per-user transporter (supports SMTP and Zoho Zeptomail) ───
// ✅ Zoho from .env is ALWAYS DEFAULT when set; user/company config only used when env Zoho is not set
const getUserTransporter = async (userId) => {
  try {
    if (!userId) return { transporter: null, fromEmail: null, userName: '', configured: false, provider: null };
    
    const User = mongoose.model('User');
    const user = await User.findById(userId).select('emailSettings name email');
    
    // PRIORITY 0: .env Zoho ZeptoMail — only same-domain user can send; sender = user email, name = user name
    const envKey = process.env.ZOHO_ZEPTOMAIL_API_KEY;
    const envFrom = process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL;
    if (envKey && envFrom && String(envKey).trim() && String(envFrom).trim()) {
      const verifiedDomain = envFrom.includes('@') ? String(envFrom).trim().split('@')[1].toLowerCase() : '';
      const userEmail = user?.email ? String(user.email).trim() : '';
      const userDomain = userEmail.includes('@') ? userEmail.split('@')[1].toLowerCase() : '';
      const useUserAsSender = userEmail && verifiedDomain && userDomain === verifiedDomain;
      return {
        transporter: null,
        fromEmail: useUserAsSender ? userEmail : (userEmail || null),
        userName: user?.name || '',
        configured: true,
        provider: 'zoho-zeptomail',
        zohoApiKey: envKey,
        zohoApiUrl: (process.env.ZOHO_ZEPTOMAIL_API_URL || 'https://api.zeptomail.in/').replace(/\/?$/, '/'),
        userId: userId,
        configSource: 'env'
      };
    }
    
    // ✅ PRIORITY 1: User per-user configuration (only when env Zoho not set)
    if (user?.emailSettings?.isConfigured) {
      const s = user.emailSettings;

      // Check if using Zoho Zeptomail (per-user override)
      if (s.emailProvider === 'zoho-zeptomail' && s.zohoZeptomailApiKey && s.zohoZeptomailFromEmail) {
        return {
          transporter: null,
          fromEmail: s.zohoZeptomailFromEmail,
          userName: user.name || '',
          configured: true,
          provider: 'zoho-zeptomail',
          zohoApiKey: s.zohoZeptomailApiKey,
          zohoApiUrl: s.zohoZeptomailApiUrl || 'https://api.zeptomail.com/',
          userId: userId,
          configSource: 'user'  // User's own personal config
        };
      }

      // Check if using SMTP (per-user)
      if (s.smtpEmail && s.smtpAppPassword) {
        let userTransporter = createSmtpTransporter(s);
        return { 
          transporter: userTransporter, 
          fromEmail: s.smtpEmail, 
          userName: user.name || '', 
          configured: true, 
          provider: 'smtp',
          configSource: 'user'
        };
      }
    }

    // ✅ PRIORITY 2: Fall back to company-level email configuration
    // This is the MAIN way enterprise setups work - company owner configures ONCE
    // and all 30-50 employees send through the SAME Zoho API key
    let companyConfig;
    try {
      const CompanyEmailConfig = mongoose.model('CompanyEmailConfig');
      companyConfig = await CompanyEmailConfig.findOne({ companyId: 'default-company' });
    } catch (configErr) {
      // If model doesn't exist yet, continue without company config
      companyConfig = null;
    }

    if (companyConfig?.isConfigured) {
      // Use company's Zoho Zeptomail (all employees share this)
      if (companyConfig.primaryProvider === 'zoho-zeptomail' && companyConfig.zohoZeptomailApiKey && companyConfig.zohoZeptomailFromEmail) {
        return {
          transporter: null,
          fromEmail: companyConfig.zohoZeptomailFromEmail,
          userName: user?.name || '',
          configured: true,
          provider: 'zoho-zeptomail',
          zohoApiKey: companyConfig.zohoZeptomailApiKey,
          zohoApiUrl: companyConfig.zohoZeptomailApiUrl || 'https://api.zeptomail.com/',
          userId: userId,
          configSource: 'company'  // Company-wide shared config
        };
      }

      // Use company's SMTP settings (fallback)
      if (companyConfig.smtpEmail && companyConfig.smtpAppPassword) {
        let companyTransporter = createSmtpTransporter(companyConfig);
        return {
          transporter: companyTransporter,
          fromEmail: companyConfig.smtpEmail,
          userName: user?.name || '',
          configured: true,
          provider: 'smtp',
          configSource: 'company'  // Company-wide shared config
        };
      }
    }

    // ❌ No configuration found (env Zoho not set, no user config, no company config)
    return { 
      transporter: null, 
      fromEmail: null, 
      userName: user?.name || '', 
      configured: false, 
      provider: null,
      configSource: 'none'
    };
  } catch (err) {
    console.error('getUserTransporter error:', err.message);
    return { transporter: null, fromEmail: null, userName: '', configured: false, provider: null, configSource: 'error' };
  }
};

// ─── Helper: Create SMTP transporter (reusable for both user and company config) ───
// Avoids code duplication between user and company email setup
const createSmtpTransporter = (emailSettings) => {
  const s = emailSettings;
  
  const serviceProviders = { gmail: 'gmail', yahoo: 'Yahoo', outlook: 'Outlook365' };
  const hostProviders = {
    zoho:      { host: 'smtp.zoho.com',            port: 587 },
    hostinger: { host: 'smtp.hostinger.com',        port: 587 },
    godaddy:   { host: 'smtpout.secureserver.net',  port: 465 },
    namecheap: { host: 'mail.privateemail.com',     port: 587 },
  };

  const commonOpts = {
    family: 4,
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
    tls: { rejectUnauthorized: false }
  };

  const provider = s.smtpProvider || 'gmail';

  if (serviceProviders[provider]) {
    return nodemailer.createTransport({
      service: serviceProviders[provider],
      auth: { user: s.smtpEmail, pass: s.smtpAppPassword },
      ...commonOpts
    });
  } else if (hostProviders[provider]) {
    const hp = hostProviders[provider];
    return nodemailer.createTransport({
      host: hp.host,
      port: hp.port,
      secure: hp.port === 465,
      auth: { user: s.smtpEmail, pass: s.smtpAppPassword },
      ...commonOpts
    });
  } else {
    // Custom SMTP
    const port = s.smtpPort || 587;
    return nodemailer.createTransport({
      host: s.smtpHost,
      port: port,
      secure: port === 465,
      auth: { user: s.smtpEmail, pass: s.smtpAppPassword },
      ...commonOpts
    });
  }
};

// Generic email sender — uses per-user transporter if userId provided
const sendEmail = async (to, subject, htmlBody, textBody, options = {}) => {
  const { cc, bcc, senderName, senderEmail, userId } = options;
  
  const { transporter: activeTransporter, fromEmail, userName, configured, provider, zohoApiKey, zohoApiUrl } = await getUserTransporter(userId);
  
  if (!configured || !fromEmail) {
    throw new Error('EMAIL_NOT_CONFIGURED');
  }
  
  if (provider === 'zoho-zeptomail' && userId) {
    const senderStatus = await canUserSendViaZepto(userId);
    if (!senderStatus.canSend) {
      const err = new Error(senderStatus.reason || 'USE_VERIFIED_DOMAIN');
      err.code = 'USE_VERIFIED_DOMAIN';
      throw err;
    }
  }
  
  if (provider === 'zoho-zeptomail') {
    return await sendViaZohoZeptomail(to, subject, htmlBody, textBody, {
      cc,
      bcc,
      senderName: senderName || userName,
      fromEmail,
      zohoApiKey,
      zohoApiUrl,
      userId
    });
  }

  // Otherwise use SMTP
  if (!activeTransporter) {
    throw new Error('EMAIL_NOT_CONFIGURED');
  }

  // Build "from" with display name
  const displayName = senderName || userName || '';
  const fromAddress = displayName ? `"${displayName}" <${fromEmail}>` : fromEmail;
  
  const mailOptions = {
    from: fromAddress,
    replyTo: fromEmail,  // Allow recipients to reply directly
    to: Array.isArray(to) ? to : [to],
    subject: subject,
    html: htmlBody,
    text: textBody || subject,
    headers: {
      'X-Mailer': 'Skillnix PCHR 1.0',
      'X-Priority': '3',
      'List-Unsubscribe': `<mailto:${fromEmail}?subject=unsubscribe>`,
      'Precedence': 'bulk'  // Mark as bulk mail (helps avoid spam)
    }
  };

  // Add CC if provided
  if (cc) {
    mailOptions.cc = Array.isArray(cc) ? cc : [cc];
  }

  // Add BCC if provided
  if (bcc) {
    mailOptions.bcc = Array.isArray(bcc) ? bcc : [bcc];
  }

  try {
    const info = await activeTransporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${Array.isArray(to) ? to.join(', ') : to} (from: ${fromEmail})`);
    if (cc) console.log(`   CC: ${Array.isArray(cc) ? cc.join(', ') : cc}`);
    if (bcc) console.log(`   BCC: ${Array.isArray(bcc) ? bcc.join(', ') : bcc}`);
    return { success: true, email: to, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email Error:', {
      message: error.message,
      email: to,
      from: fromEmail,
      cc: options.cc,
      bcc: options.bcc
    });
    // Translate SMTP errors into user-friendly messages
    let msg = error.message;
    if (msg.includes('Invalid login') || msg.includes('AUTHENTICATIONFAILED') || msg.includes('authentication failed')) {
      const err = new Error(`Authentication failed for ${fromEmail}. Please go to Email Settings and re-enter your correct password.`);
      err.code = 'AUTH_FAILED';
      throw err;
    } else if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
      const err = new Error('Cannot connect to the email server. Please check your SMTP settings.');
      err.code = 'CONNECTION_FAILED';
      throw err;
    } else if (msg.includes('ETIMEDOUT') || msg.includes('ESOCKET') || msg.includes('ECONNRESET') || msg.includes('timeout') || msg.includes('ENETUNREACH')) {
      const err = new Error('Email server connection timed out. The SMTP server may be unreachable from this hosting. Try using Gmail with App Password instead.');
      err.code = 'TIMEOUT';
      throw err;
    }
    throw error;
  }
};

// Interview invitation email
const sendInterviewEmail = async (email, candidateName, position, options = {}) => {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; color: white; text-align: center; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0;">📞 Interview Invitation</h2>
      </div>
      <div style="padding: 40px; background: white; border: 1px solid #ddd; border-radius: 0 0 10px 10px;">
        <p style="color: #333; font-size: 16px;">Dear ${candidateName},</p>
        <p style="color: #666; line-height: 1.6;">Congratulations! We are pleased to invite you for an interview for the <strong>${position}</strong> position.</p>
        <p style="color: #666; line-height: 1.6;">Our HR team will contact you shortly with interview details including date, time, and format.</p>
        <p style="color: #666; line-height: 1.6;">If you have any questions, please feel free to reach out to us.</p>
        <p style="color: #666; line-height: 1.6;">Best regards,<br><strong>HR Team</strong></p>
      </div>
    </div>
  `;
  
  const textBody = `Dear ${candidateName}, Congratulations! We invite you for an interview for the ${position} position. Our HR team will contact you shortly with details. Best regards, HR Team`;
  
  return await sendEmail(email, `Interview Invitation - ${position}`, htmlBody, textBody, options);
};

// Rejection email
const sendRejectionEmail = async (email, candidateName, position, options = {}) => {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #f5f5f5; padding: 40px; text-align: center; border-radius: 10px 10px 0 0;">
        <h2 style="color: #333; margin: 0;">Application Status Update</h2>
      </div>
      <div style="padding: 40px; background: white; border: 1px solid #ddd; border-radius: 0 0 10px 10px;">
        <p style="color: #333; font-size: 16px;">Dear ${candidateName},</p>
        <p style="color: #666; line-height: 1.6;">Thank you for your interest in the <strong>${position}</strong> position. After careful consideration of your application and qualifications, we regret to inform you that we have decided to move forward with other candidates whose experience more closely matches our current needs.</p>
        <p style="color: #666; line-height: 1.6;">We appreciate the time you invested in applying and interviewing with us. We encourage you to apply for future positions that match your skills and experience.</p>
        <p style="color: #666; line-height: 1.6;">Best regards,<br><strong>HR Team</strong></p>
      </div>
    </div>
  `;
  
  const textBody = `Dear ${candidateName}, Thank you for your interest in the ${position} position. We regret to inform you that we have decided to move forward with other candidates. Best regards, HR Team`;
  
  return await sendEmail(email, "Application Status Update", htmlBody, textBody, options);
};

// Document request email
const sendDocumentEmail = async (email, candidateName, position, options = {}) => {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px; color: white; text-align: center; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0;">📄 Document Submission Required</h2>
      </div>
      <div style="padding: 40px; background: white; border: 1px solid #ddd; border-radius: 0 0 10px 10px;">
        <p style="color: #333; font-size: 16px;">Dear ${candidateName},</p>
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
    </div>
  `;
  
  const textBody = `Dear ${candidateName}, Please submit the required documents for the ${position} position. Best regards, HR Team`;
  
  return await sendEmail(email, `Document Submission - ${position}`, htmlBody, textBody, options);
};

// Onboarding email
const sendOnboardingEmail = async (email, candidateName, position, department, joiningDate, options = {}) => {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 40px; color: white; text-align: center; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0;">🎉 Welcome to the Team!</h2>
      </div>
      <div style="padding: 40px; background: white; border: 1px solid #ddd; border-radius: 0 0 10px 10px;">
        <p style="color: #333; font-size: 16px;">Dear ${candidateName},</p>
        <p style="color: #666; line-height: 1.6;">Welcome aboard! We are excited to have you join our team as a <strong>${position}</strong> in the <strong>${department}</strong> department.</p>
        <p style="color: #666; line-height: 1.6;"><strong>Joining Date:</strong> ${joiningDate}</p>
        <p style="color: #666; line-height: 1.6;">Please ensure you have completed all onboarding formalities and bring the necessary documents on your first day.</p>
        <p style="color: #666; line-height: 1.6;">If you have any questions, feel free to reach out to our HR team.</p>
        <p style="color: #666; line-height: 1.6;">Best regards,<br><strong>HR Team</strong></p>
      </div>
    </div>
  `;
  
  const textBody = `Dear ${candidateName}, Welcome to our team! Your joining date is ${joiningDate}. Best regards, HR Team`;
  
  return await sendEmail(email, `Onboarding Confirmation - ${position}`, htmlBody, textBody, options);
};

// Custom email
const sendCustomEmail = async (email, subject, customMessage, options = {}) => {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="padding: 40px; background: white; border: 1px solid #ddd; border-radius: 10px;">
        <div style="color: #333; white-space: pre-wrap; line-height: 1.6;">
          ${customMessage}
        </div>
        <p style="color: #999; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
          This is an automated message. Please do not reply directly to this email.
        </p>
      </div>
    </div>
  `;
  
  return await sendEmail(email, subject, htmlBody, customMessage, options);
};

// Bulk email sender
const sendBulkEmails = async (recipients, subject, htmlBody, textBody, options = {}) => {
  const results = [];
  
  for (const recipient of recipients) {
    try {
      const result = await sendEmail(recipient, subject, htmlBody, textBody, options);
      results.push({ email: recipient, success: true, messageId: result.messageId });
    } catch (error) {
      results.push({ email: recipient, success: false, error: error.message });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  console.log(`📊 Bulk Email Results: ${successCount}/${results.length} sent successfully`);
  
  return results;
};

// Check if a user has email configured (for pre-flight checks)
// ✅ Now checks BOTH user personal config AND company-wide config
const checkUserEmailConfigured = async (userId) => {
  try {
    // PRIORITY 0: .env Zoho ZeptoMail — always available, no DB query needed
    if (process.env.ZOHO_ZEPTOMAIL_API_KEY && process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL) {
      if (String(process.env.ZOHO_ZEPTOMAIL_API_KEY).trim() && String(process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL).trim()) {
        return true;
      }
    }

    if (!userId) return false;

    const User = mongoose.model('User');
    const user = await User.findById(userId).select('emailSettings');

    // PRIORITY 1: User personal SMTP (Hostinger etc.)
    if (user?.emailSettings?.isConfigured) {
      if (user.emailSettings.emailProvider === 'zoho-zeptomail') {
        return !!(user.emailSettings.zohoZeptomailApiKey && user.emailSettings.zohoZeptomailFromEmail);
      }
      return !!(user.emailSettings.smtpEmail && user.emailSettings.smtpAppPassword);
    }

    // PRIORITY 2: Company-wide config
    try {
      const CompanyEmailConfig = mongoose.model('CompanyEmailConfig');
      const companyConfig = await CompanyEmailConfig.findOne({ companyId: 'default-company' });
      if (companyConfig?.isConfigured) {
        if (companyConfig.primaryProvider === 'zoho-zeptomail') {
          return !!(companyConfig.zohoZeptomailApiKey && companyConfig.zohoZeptomailFromEmail);
        }
        return !!(companyConfig.smtpEmail && companyConfig.smtpAppPassword);
      }
    } catch (_) { /* continue */ }

    return false;
  } catch {
    return false;
  }
};

const getVerifiedZeptoDomain = () => {
  const from = (process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL || '').trim();
  if (!from || !from.includes('@')) return '';
  return from.split('@')[1].toLowerCase();
};

/**
 * Get verified sender domain and API key: from env first, then CompanyEmailConfig (so deploy works without env vars).
 */
const getVerifiedZeptoConfig = async () => {
  let fromEmail = (process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL || '').trim();
  let apiKey = (process.env.ZOHO_ZEPTOMAIL_API_KEY || '').trim();
  if (fromEmail && fromEmail.includes('@') && apiKey) {
    return { fromEmail, apiKey, domain: fromEmail.split('@')[1].toLowerCase(), source: 'env' };
  }
  try {
    const CompanyEmailConfig = mongoose.model('CompanyEmailConfig');
    const companyConfig = await CompanyEmailConfig.findOne({ companyId: 'default-company' });
    if (companyConfig?.isConfigured && companyConfig.primaryProvider === 'zoho-zeptomail') {
      fromEmail = (companyConfig.zohoZeptomailFromEmail || '').trim();
      apiKey = (companyConfig.zohoZeptomailApiKey || '').trim();
      if (fromEmail && fromEmail.includes('@') && apiKey) {
        return { fromEmail, apiKey, domain: fromEmail.split('@')[1].toLowerCase(), source: 'company' };
      }
    }
  } catch (_) { /* ignore */ }
  return { fromEmail: '', apiKey: '', domain: '', source: '' };
};

const canUserSendViaZepto = async (userId) => {
  if (!userId) return { canSend: false, reason: 'Not logged in', verifiedDomain: '' };
  const { domain: verifiedDomain, apiKey } = await getVerifiedZeptoConfig();
  if (!verifiedDomain) return { canSend: false, reason: 'No verified sender configured', verifiedDomain: '' };
  if (!apiKey) return { canSend: false, reason: 'ZeptoMail not configured', verifiedDomain };
  try {
    const User = mongoose.model('User');
    const user = await User.findById(userId).select('email');
    const userEmail = (user?.email || '').trim();
    if (!userEmail || !userEmail.includes('@')) return { canSend: false, reason: 'Use your company verified email to send (e.g. name@' + verifiedDomain + ')', verifiedDomain };
    const userDomain = userEmail.split('@')[1].toLowerCase();
    const canSend = userDomain === verifiedDomain;
    return {
      canSend,
      verifiedDomain,
      reason: canSend ? '' : 'You cannot send emails using a personal email address. Please log in with your company verified email (e.g. name@' + verifiedDomain + ') to send emails.'
    };
  } catch {
    return { canSend: false, reason: 'Unable to verify sender', verifiedDomain };
  }
};

module.exports = {
  sendEmail,
  sendInterviewEmail,
  sendRejectionEmail,
  sendDocumentEmail,
  sendOnboardingEmail,
  sendCustomEmail,
  sendBulkEmails,
  checkUserEmailConfigured,
  getUserTransporter,
  getZohoAuthHeaderValue,
  canUserSendViaZepto,
  getVerifiedZeptoDomain
};
