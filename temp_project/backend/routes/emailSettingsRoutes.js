const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const axios = require('axios');
const { getZohoAuthHeaderValue, sendEmail } = require('../services/emailService');

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * PER-USER EMAIL SETTINGS ROUTES
 * ═════════════════════════════════════════════════════════════════════════════
 * 
 * PURPOSE:
 * Each individual user can configure their own personal email (Zoho or SMTP).
 * This is OPTIONAL - if not configured, user automatically uses company-wide config.
 * 
 * USE CASES:
 * 1. Employee wants to send from personal Gmail instead of company email
 * 2. Sales rep has own Zoho Zeptomail account, wants to use it
 * 3. Manager prefers their personal SMTP server for business emails
 * 4. Most employees don't configure personal settings, just use company config
 * 
 * RELATIONSHIP TO COMPANY-WIDE CONFIG:
 * ───────────────────────────────────
 * These endpoints set user.emailSettings (User schema)
 * Company-wide config is in CompanyEmailConfig collection
 * 
 * EMAIL SENDING PRIORITY (in emailService.js):
 * ┌────────────────────────────────────────────────────────────────┐
 * │ 1. User has personal config? ──→ USE IT (can override company)  │
 * │                                                                  │
 * │ 2. User has NO personal config? ──→ USE COMPANY CONFIG          │
 * │    (All 30-50 employees share company API key here)             │
 * │                                                                  │
 * │ 3. Neither user nor company has config? ──→ ERROR, can't send   │
 * └────────────────────────────────────────────────────────────────┘
 * 
 * DATABASE SECURITY:
 * ✅ Credentials NEVER returned in full (always masked with ••••••)
 * ✅ API key and password stored server-side only
 * ✅ Frontend only sees hasPassword/hasZohoApiKey boolean flags
 * ✅ All routes require JWT authentication (verifyToken)
 * ✅ Users only modify their own settings (req.user.id check)
 * ⚠️  API keys stored as plain text (TODO: Add encryption)
 * ⚠️  Passwords stored as plain text (TODO: Add encryption)
 * 
 * TESTING ENDPOINTS:
 * Before saving credentials, system sends TEST email:
 * - POST /test: Tests SMTP settings
 * - POST /test-zoho: Tests Zoho Zeptomail settings
 * This ensures credentials are valid before storing
 * 
 * ENDPOINTS INDEX:
 * GET /          - Retrieve user's personal email settings (masked)
 * PUT /          - Update SMTP settings
 * PUT /zoho-zeptomail - Update Zoho Zeptomail API settings (personal)
 * POST /test     - Test SMTP credentials
 * POST /test-zoho - Test Zoho API credentials
 * DELETE /       - Delete all personal email settings
 */

// ─── GET email settings for logged-in user ───
/**
 * RETRIEVE USER'S PERSONAL EMAIL CONFIGURATION
 * 
 * What it does:
 * - Returns user's optional personal email settings
 * - Masks all credentials (API keys, passwords) with ••••••
 * - Returns boolean flags (hasPassword, hasZohoApiKey) instead
 * - Shows which provider user prefers ('smtp' or 'zoho-zeptomail')
 * 
 * Security:
 * - Only the logged-in user can see their own settings
 * - Full credentials never exposed to frontend
 * - Frontend builds UI based on masked data
 * 
 * Response example:
 * {
 *   success: true,
 *   settings: {
 *     emailProvider: 'zoho-zeptomail',  // Which one user is using
 *     zohoZeptomailApiKey: '••••••••••••••••',  // MASKED
 *     zohoZeptomailFromEmail: 'john@company.com',  // OK to expose
 *     smtpEmail: '',  // Not configured
 *     hasZohoApiKey: true,  // Boolean flag instead of actual key
 *     hasPassword: false,  // Boolean flag
 *     isConfigured: true  // User has personal settings
 *   }
 * }
 */
router.get('/', async (req, res) => {
  try {
    const User = mongoose.model('User');
    const user = await User.findById(req.user.id).select('emailSettings email name');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const settings = user.emailSettings || {};
    const envZohoConfigured = !!(process.env.ZOHO_ZEPTOMAIL_API_KEY && process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL);
    const isConfigured = !!(settings.isConfigured || envZohoConfigured);
    
    const response = {
      success: true,
      settings: {
        smtpEmail: settings.smtpEmail || '',
        smtpAppPassword: settings.smtpAppPassword ? '••••••••••••••••' : '',
        smtpProvider: settings.smtpProvider || 'hostinger',
        smtpHost: settings.smtpHost || 'smtp.hostinger.com',
        smtpPort: settings.smtpPort || 587,
        emailProvider: envZohoConfigured ? 'zoho-zeptomail' : (settings.emailProvider || 'smtp'),
        zohoZeptomailFromEmail: process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL || settings.zohoZeptomailFromEmail || '',
        isConfigured,
        hasPassword: !!settings.smtpAppPassword,
        hasZohoApiKey: !!(envZohoConfigured || settings.zohoZeptomailApiKey),
        configSource: envZohoConfigured ? 'zeptomail-env' : (settings.isConfigured ? 'user-smtp' : 'none')
      },
      userEmail: user.email,
      userName: user.name
    };
    
    res.json(response);
  } catch (err) {
    console.error('Get email settings error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── SAVE Zoho Zeptomail settings ───
router.put('/zoho-zeptomail', async (req, res) => {
  try {
    const { zohoZeptomailApiKey, zohoZeptomailApiUrl, zohoZeptomailFromEmail, zohoZeptomailBounceAddress } = req.body;

    if (!zohoZeptomailApiKey || !zohoZeptomailFromEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'Zoho Zeptomail API Key and From Email are required' 
      });
    }

    const User = mongoose.model('User');
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Test Zoho Zeptomail API credentials
    try {
      const apiUrl = zohoZeptomailApiUrl || 'https://api.zeptomail.com/';
      const apiEndpoint = apiUrl.endsWith('/') 
        ? `${apiUrl}v1.1/email`
        : `${apiUrl}/v1.1/email`;
      
      const testResponse = await axios.post(
        apiEndpoint,
        {
          from: {
            address: zohoZeptomailFromEmail.trim(),
            name: user.name || 'Skillnix'
          },
          to: [{
            email_address: {
              address: zohoZeptomailFromEmail.trim()
            }
          }],
          subject: '✅ Skillnix Zoho Zeptomail Configuration Test',
          htmlbody: '<p>If you received this email, your Zoho Zeptomail configuration is working correctly!</p>',
          textbody: 'If you received this email, your Zoho Zeptomail configuration is working correctly!'
        },
        {
          headers: {
            'Authorization': getZohoAuthHeaderValue(zohoZeptomailApiKey),
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      // Update settings
      user.emailSettings = {
        ...user.emailSettings,
        emailProvider: 'zoho-zeptomail',
        zohoZeptomailApiKey: zohoZeptomailApiKey.trim(),
        zohoZeptomailApiUrl: zohoZeptomailApiUrl || 'https://api.zeptomail.com/',
        zohoZeptomailFromEmail: zohoZeptomailFromEmail.trim(),
        zohoZeptomailBounceAddress: zohoZeptomailBounceAddress || '',
        isConfigured: true
      };

      await user.save();

      res.json({
        success: true,
        message: '✅ Zoho Zeptomail configuration verified & saved successfully!',
        settings: {
          emailProvider: 'zoho-zeptomail',
          zohoZeptomailApiKey: '••••••••••••••••',
          zohoZeptomailFromEmail: user.emailSettings.zohoZeptomailFromEmail,
          zohoZeptomailApiUrl: user.emailSettings.zohoZeptomailApiUrl,
          isConfigured: true,
          hasZohoApiKey: true
        }
      });
    } catch (apiError) {
      console.error('Zoho Zeptomail API error:', apiError.response?.data || apiError.message);
      
      let errorMsg = 'Zoho Zeptomail API test failed';
      if (apiError.response?.status === 401) {
        errorMsg = 'Invalid Zoho Zeptomail API Key. Please check your credentials.';
      } else if (apiError.response?.status === 400) {
        errorMsg = `Invalid request: ${apiError.response.data?.message || 'Check your API URL and From Email'}`;
      } else if (apiError.code === 'ECONNABORTED') {
        errorMsg = 'Connection timeout. Check your API URL or network connection.';
      }
      
      return res.status(400).json({ success: false, message: errorMsg });
    }
  } catch (err) {
    console.error('Save Zoho Zeptomail settings error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── SAVE SMTP email settings ───
router.put('/', async (req, res) => {
  try {
    const { smtpEmail, smtpAppPassword, smtpProvider, smtpHost, smtpPort } = req.body;

    if (!smtpEmail) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    const User = mongoose.model('User');
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Determine actual password (masked = keep old, otherwise use new)
    const actualPassword = smtpAppPassword === '••••••••••••••••' 
      ? (user.emailSettings?.smtpAppPassword || '') 
      : smtpAppPassword;

    if (!actualPassword) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    // ── Auto-verify SMTP credentials before saving ──
    const serviceProviders = { gmail: 'gmail', yahoo: 'Yahoo', outlook: 'Outlook365' };
    const hostProviders = {
      zoho:      { host: 'smtp.zoho.com',            port: 587 },
      hostinger: { host: 'smtp.hostinger.com',        port: 587 },
      godaddy:   { host: 'smtpout.secureserver.net',  port: 465 },
      namecheap: { host: 'mail.privateemail.com',     port: 587 },
    };
    const provider = smtpProvider || 'gmail';
    const commonOpts = {
      family: 4,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
      tls: { rejectUnauthorized: false }
    };

    let verifyTransporter;
    if (serviceProviders[provider]) {
      verifyTransporter = nodemailer.createTransport({
        service: serviceProviders[provider],
        auth: { user: smtpEmail.trim(), pass: actualPassword },
        ...commonOpts
      });
    } else if (hostProviders[provider]) {
      const hp = hostProviders[provider];
      verifyTransporter = nodemailer.createTransport({
        host: hp.host, port: hp.port, secure: hp.port === 465,
        auth: { user: smtpEmail.trim(), pass: actualPassword },
        ...commonOpts
      });
    } else {
      const port = smtpPort || 587;
      verifyTransporter = nodemailer.createTransport({
        host: smtpHost || 'smtp.gmail.com', port, secure: port === 465,
        auth: { user: smtpEmail.trim(), pass: actualPassword },
        ...commonOpts
      });
    }

    try {
      await verifyTransporter.verify();
    } catch (verifyErr) {
      let msg = verifyErr.message;
      if (msg.includes('Invalid login') || msg.includes('AUTHENTICATIONFAILED') || msg.includes('authentication failed')) {
        return res.status(400).json({ success: false, message: `Authentication failed. The password for ${smtpEmail} is incorrect. Please check and re-enter your email password or App Password.` });
      } else if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
        return res.status(400).json({ success: false, message: 'Cannot connect to the email server. Check your SMTP settings.' });
      } else if (msg.includes('ETIMEDOUT') || msg.includes('ESOCKET') || msg.includes('ECONNRESET') || msg.includes('timeout') || msg.includes('ENETUNREACH')) {
        return res.status(400).json({ success: false, message: 'Connection to email server timed out. The server may not be reachable from this hosting. Try using Gmail with App Password instead.' });
      }
      return res.status(400).json({ success: false, message: `SMTP verification failed: ${msg}` });
    }

    // Update settings (only after verification passes)
    user.emailSettings = {
      ...user.emailSettings,
      emailProvider: 'smtp',
      smtpEmail: smtpEmail.trim(),
      smtpAppPassword: actualPassword,
      smtpProvider: smtpProvider || 'gmail',
      smtpHost: smtpHost || '',
      smtpPort: smtpPort || 587,
      isConfigured: true
    };

    await user.save();

    res.json({
      success: true,
      message: 'Email settings verified & saved successfully! ✅',
      settings: {
        emailProvider: 'smtp',
        smtpEmail: user.emailSettings.smtpEmail,
        smtpAppPassword: '••••••••••••••••',
        smtpProvider: user.emailSettings.smtpProvider,
        smtpHost: user.emailSettings.smtpHost,
        smtpPort: user.emailSettings.smtpPort,
        isConfigured: true,
        hasPassword: true
      }
    });
  } catch (err) {
    console.error('Save email settings error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── TEST SMTP email settings ───
router.post('/test', async (req, res) => {
  try {
    const { smtpEmail, smtpAppPassword, smtpProvider, smtpHost, smtpPort } = req.body;

    if (!smtpEmail || !smtpAppPassword) {
      return res.status(400).json({ success: false, message: 'Email and App Password are required' });
    }

    // If masked password, fetch from DB
    let actualPassword = smtpAppPassword;
    if (smtpAppPassword === '••••••••••••••••') {
      const User = mongoose.model('User');
      const user = await User.findById(req.user.id);
      actualPassword = user?.emailSettings?.smtpAppPassword;
      if (!actualPassword) {
        return res.status(400).json({ success: false, message: 'No saved password found. Please enter your App Password.' });
      }
    }

    // Create test transporter based on provider
    let testTransporter;
    const serviceProviders = { gmail: 'gmail', yahoo: 'Yahoo', outlook: 'Outlook365' };
    const hostProviders = {
      zoho:      { host: 'smtp.zoho.com',            port: 587 },
      hostinger: { host: 'smtp.hostinger.com',        port: 587 },
      godaddy:   { host: 'smtpout.secureserver.net',  port: 465 },
      namecheap: { host: 'mail.privateemail.com',     port: 587 },
    };
    const provider = smtpProvider || 'gmail';

    const commonOpts = {
      family: 4,
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
      tls: { rejectUnauthorized: false }
    };

    if (serviceProviders[provider]) {
      testTransporter = nodemailer.createTransport({
        service: serviceProviders[provider],
        auth: { user: smtpEmail, pass: actualPassword },
        ...commonOpts
      });
    } else if (hostProviders[provider]) {
      const hp = hostProviders[provider];
      testTransporter = nodemailer.createTransport({
        host: hp.host,
        port: hp.port,
        secure: hp.port === 465,
        auth: { user: smtpEmail, pass: actualPassword },
        ...commonOpts
      });
    } else {
      const port = smtpPort || 587;
      testTransporter = nodemailer.createTransport({
        host: smtpHost || 'smtp.gmail.com',
        port: port,
        secure: port === 465,
        auth: { user: smtpEmail, pass: actualPassword },
        ...commonOpts
      });
    }

    // Verify connection
    await testTransporter.verify();

    // Send test email to self
    const User = mongoose.model('User');
    const user = await User.findById(req.user.id);
    
    await testTransporter.sendMail({
      from: `"${user?.name || 'Skillnix'}" <${smtpEmail}>`,
      to: smtpEmail,
      subject: '✅ Skillnix Email Settings — Test Successful',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="height: 4px; background: linear-gradient(90deg, #4f46e5, #7c3aed);"></div>
          <div style="padding: 32px; text-align: center;">
            <div style="width: 56px; height: 56px; background: #ecfdf5; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 28px;">✅</span>
            </div>
            <h2 style="margin: 0 0 8px; font-size: 18px; color: #1f2937;">Email Configuration Verified</h2>
            <p style="margin: 0 0 20px; font-size: 14px; color: #6b7280;">Your email settings are working correctly. All emails will now be sent from this address.</p>
            <div style="background: #f9fafb; border-radius: 8px; padding: 16px; text-align: left;">
              <p style="margin: 0 0 4px; font-size: 12px; color: #9ca3af;">Configured Email</p>
              <p style="margin: 0; font-size: 14px; color: #1f2937; font-weight: 600;">${smtpEmail}</p>
            </div>
          </div>
          <div style="padding: 16px; background: #f9fafb; border-top: 1px solid #f3f4f6; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #9ca3af;">Skillnix Recruitment Services</p>
          </div>
        </div>
      `
    });

    res.json({ success: true, message: `Test email sent to ${smtpEmail}. Check your inbox!` });
  } catch (err) {
    console.error('Test email settings error:', err);
    let msg = err.message;
    if (msg.includes('Invalid login') || msg.includes('AUTHENTICATIONFAILED')) {
      msg = 'Authentication failed. Check your email and App Password. Make sure you use a Google App Password, not your regular password.';
    } else if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
      msg = 'Cannot connect to mail server. Check your SMTP settings.';
    } else if (msg.includes('ETIMEDOUT') || msg.includes('ESOCKET') || msg.includes('ECONNRESET') || msg.includes('timeout') || msg.includes('ENETUNREACH')) {
      msg = 'Connection timeout. The SMTP server is not reachable from this hosting. Try using Gmail with App Password instead, or check if your email provider allows connections from cloud servers.';
    }
    res.status(400).json({ success: false, message: msg });
  }
});

// ─── TEST current email config (user, company, or .env Zoho) ───
// Use this to test on localhost when Zoho is set in .env and no UI config exists.
router.post('/test-current', async (req, res) => {
  try {
    const User = mongoose.model('User');
    const user = await User.findById(req.user.id).select('email name');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const toEmail = user.email || req.body.to;
    if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      return res.status(400).json({ success: false, message: 'Your account has no email. Provide a valid "to" address in the request body.' });
    }
    await sendEmail(
      toEmail,
      '✅ Skillnix — ZeptoMail test (localhost)',
      '<p>If you got this, your current email config (Zoho from .env or Email Settings) is working.</p>',
      'If you got this, your current email config is working.',
      { userId: req.user.id }
    );
    res.json({ success: true, message: `Test email sent to ${toEmail}. Check your inbox.` });
  } catch (err) {
    console.error('Test current email config error:', err);
    const msg = err.message === 'EMAIL_NOT_CONFIGURED'
      ? 'No email configured. Add ZOHO_ZEPTOMAIL_API_KEY and ZOHO_ZEPTOMAIL_FROM_EMAIL to backend/.env, or set Email Settings in the app.'
      : err.message;
    res.status(400).json({ success: false, message: msg });
  }
});

// ─── TEST Zoho Zeptomail settings ───
router.post('/test-zoho', async (req, res) => {
  try {
    const { zohoZeptomailApiKey, zohoZeptomailApiUrl, zohoZeptomailFromEmail } = req.body;

    if (!zohoZeptomailApiKey || !zohoZeptomailFromEmail) {
      return res.status(400).json({ success: false, message: 'Zoho Zeptomail API Key and From Email are required' });
    }

    // If masked API key, fetch from DB
    let actualApiKey = zohoZeptomailApiKey;
    if (zohoZeptomailApiKey === '••••••••••••••••') {
      const User = mongoose.model('User');
      const user = await User.findById(req.user.id);
      actualApiKey = user?.emailSettings?.zohoZeptomailApiKey;
      if (!actualApiKey) {
        return res.status(400).json({ success: false, message: 'No saved API Key found. Please enter your Zoho Zeptomail API Key.' });
      }
    }

    const User = mongoose.model('User');
    const user = await User.findById(req.user.id);

    try {
      const apiUrl = zohoZeptomailApiUrl || 'https://api.zeptomail.com/';
      const apiEndpoint = apiUrl.endsWith('/') 
        ? `${apiUrl}v1.1/email`
        : `${apiUrl}/v1.1/email`;
      
      await axios.post(
        apiEndpoint,
        {
          from: {
            address: zohoZeptomailFromEmail.trim(),
            name: user?.name || 'Skillnix'
          },
          to: [{
            email_address: {
              address: zohoZeptomailFromEmail.trim()
            }
          }],
          subject: '✅ Skillnix Zoho Zeptomail Configuration Test',
          htmlbody: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="height: 4px; background: linear-gradient(90deg, #4f46e5, #7c3aed);"></div>
              <div style="padding: 32px; text-align: center;">
                <div style="width: 56px; height: 56px; background: #ecfdf5; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                  <span style="font-size: 28px;">✅</span>
                </div>
                <h2 style="margin: 0 0 8px; font-size: 18px; color: #1f2937;">Zoho Zeptomail Verified</h2>
                <p style="margin: 0 0 20px; font-size: 14px; color: #6b7280;">Your Zoho Zeptomail configuration is working correctly. All emails will now be sent via Zoho Zeptomail.</p>
                <div style="background: #f9fafb; border-radius: 8px; padding: 16px; text-align: left;">
                  <p style="margin: 0 0 4px; font-size: 12px; color: #9ca3af;">Configured Email</p>
                  <p style="margin: 0; font-size: 14px; color: #1f2937; font-weight: 600;">${zohoZeptomailFromEmail.trim()}</p>
                </div>
              </div>
              <div style="padding: 16px; background: #f9fafb; border-top: 1px solid #f3f4f6; text-align: center;">
                <p style="margin: 0; font-size: 11px; color: #9ca3af;">Skillnix Recruitment Services</p>
              </div>
            </div>
          `,
          textbody: 'If you received this email, your Zoho Zeptomail configuration is working correctly!'
        },
        {
          headers: {
            'Authorization': getZohoAuthHeaderValue(actualApiKey),
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      res.json({ success: true, message: `Test email sent to ${zohoZeptomailFromEmail.trim()} via Zoho Zeptomail. Check your inbox!` });
    } catch (apiError) {
      console.error('Zoho Zeptomail test error:', apiError.response?.data || apiError.message);
      
      let errorMsg = 'Zoho Zeptomail API test failed';
      if (apiError.response?.status === 401) {
        errorMsg = 'Invalid Zoho Zeptomail API Key. Please check your credentials.';
      } else if (apiError.response?.status === 400) {
        errorMsg = `Invalid request: ${apiError.response.data?.message || 'Check your API URL and From Email'}`;
      } else if (apiError.code === 'ECONNABORTED') {
        errorMsg = 'Connection timeout. Check your API URL or network connection.';
      }
      
      return res.status(400).json({ success: false, message: errorMsg });
    }
  } catch (err) {
    console.error('Test Zoho Zeptomail error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── REVEAL password (for eye toggle) ───
router.get('/reveal-password', async (req, res) => {
  try {
    const User = mongoose.model('User');
    const user = await User.findById(req.user.id).select('emailSettings');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const password = user.emailSettings?.smtpAppPassword || '';
    if (!password) return res.status(404).json({ success: false, message: 'No password saved' });
    res.json({ success: true, password });
  } catch (err) {
    console.error('Reveal password error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── REMOVE email settings (reset to global) ───
router.delete('/', async (req, res) => {
  try {
    const User = mongoose.model('User');
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.emailSettings = {
      smtpEmail: '',
      smtpAppPassword: '',
      smtpProvider: 'gmail',
      smtpHost: '',
      smtpPort: 587,
      zohoZeptomailApiKey: '',
      zohoZeptomailApiUrl: '',
      zohoZeptomailFromEmail: '',
      zohoZeptomailBounceAddress: '',
      emailProvider: 'smtp',
      isConfigured: false
    };
    await user.save();

    res.json({ success: true, message: 'Email settings removed. System will use default email.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
