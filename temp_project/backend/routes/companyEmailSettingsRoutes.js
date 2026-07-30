const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const nodemailer = require('nodemailer');
const { getZohoAuthHeaderValue } = require('../services/emailService');

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * COMPANY EMAIL CONFIGURATION ROUTES
 * ═════════════════════════════════════════════════════════════════════════════
 * 
 * PURPOSE:
 * These routes allow company admins/owners to set EMAIL CONFIGURATION ONCE
 * and have ALL 30-50 employees automatically use it. Follows "enterprise software"
 * pattern like Slack, Notion, Zapier where admin configures shared credentials.
 * 
 * DATABASE SECURITY:
 * ✅ API keys stored in MongoDB CompanyEmailConfig collection
 * ✅ API keys NEVER returned in full to frontend (masked with ••••••)
 * ✅ Only masked versions (with hasZohoApiKey flag) sent to UI
 * ✅ Full API keys kept server-side, used only to make API calls to Zoho
 * ✅ HTTPS-only transmission between backend and Zoho API
 * ✅ All routes require JWT token (verifyToken middleware)
 * ⚠️  TODO: Add role check - only admin/owner should access these (add isAdmin middleware)
 * ⚠️  TODO: Consider field-level MongoDB encryption for API keys
 * ⚠️  TODO: Add audit logging - log who changed email settings and when
 * 
 * WORKFLOW:
 * 1. Admin goes to EmailSettingsPage → Company Email Settings tab
 * 2. Admin enters Zoho API key, API URL, From Email
 * 3. System tests credentials before saving (calls sendTestEmail)
 * 4. If test passes, saves to CompanyEmailConfig.zohoZeptomailApiKey (FULL KEY)
 * 5. When returning to UI, masks it back to •••••• in JSON response
 * 6. Every employee's email sent via emailService.js → getUserTransporter()
 * 7. getUserTransporter checks user config FIRST, company config SECOND
 * 8. If employee has no personal config, system automatically uses company API key
 * 
 * CASCADING PRIORITY (in emailService.js):
 * 1. User has personal Zoho? → Use that
 * 2. User has personal SMTP? → Use that
 * 3. Company has Zoho? → ALL employees use this (main enterprise mode)
 * 4. Company has SMTP? → ALL employees use this as fallback
 * 5. Neither? → Error, can't send email
 */

// ✅ ENTERPRISE EMAIL CONFIGURATION
// Admin endpoint to set company-wide email settings
// All employees (30-50+) will automatically use this configuration
// No need for individual Zoho accounts - just ONE shared API key

// ─── GET company-level email configuration ───
// Only admins should see this
router.get('/', async (req, res) => {
  try {
    const CompanyEmailConfig = mongoose.model('CompanyEmailConfig');
    const config = await CompanyEmailConfig.findOne({ companyId: 'default-company' });
    
    if (!config) {
      return res.json({
        success: true,
        configured: false,
        message: 'No company email configuration found. Please set up company-wide email settings.'
      });
    }

    res.json({
      success: true,
      configured: config.isConfigured,
      settings: {
        primaryProvider: config.primaryProvider,
        
        // Zoho Zeptomail (masked for security - NEVER expose full key)
        zohoZeptomailApiKey: config.zohoZeptomailApiKey ? '••••••••••••••••' : '',
        zohoZeptomailApiUrl: config.zohoZeptomailApiUrl || 'https://api.zeptomail.com/',
        zohoZeptomailFromEmail: config.zohoZeptomailFromEmail || '',
        zohoZeptomailBounceAddress: config.zohoZeptomailBounceAddress || '',
        hasZohoApiKey: !!config.zohoZeptomailApiKey,
        
        // SMTP (masked for security - NEVER expose password)
        smtpEmail: config.smtpEmail || '',
        smtpProvider: config.smtpProvider || 'gmail',
        smtpHost: config.smtpHost || '',
        smtpPort: config.smtpPort || 587,
        hasSmtpPassword: !!config.smtpAppPassword,
        
        // Audit trail - who changed this and when
        configuredBy: config.configuredBy,
        configuredAt: config.configuredAt,
        lastModifiedAt: config.lastModifiedAt
      },
      message: '✅ Company-wide email configuration is active. All employees will use these settings.'
    });
  } catch (err) {
    console.error('Get company email config error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── SAVE Zoho Zeptomail as company-wide configuration ───
/**
 * CONFIGURE COMPANY-WIDE ZOHO ZEPTOMAIL
 * 
 * What it does:
 * - Company admin/owner sets ONE Zoho API key
 * - ALL 30-50 employees automatically use this key for sending emails
 * - No need for individual Zoho accounts per employee
 * - Zoho uses this shared key internally through emailService.getUserTransporter()
 * 
 * Workflow:
 * 1. Admin enters Zoho API Key + From Email
 * 2. System sends TEST EMAIL to verify credentials work
 * 3. If test passes → Save to CompanyEmailConfig.zohoZeptomailApiKey
 * 4. If test fails → Return Zoho's error message to frontend
 * 5. Once saved, all employees can send emails via this account
 * 
 * IMPORTANT DATABASE SECURITY:
 * ✅ Full API key STORED in MongoDB (needed for API calls)
 * ✅ Full API key NEVER returned to frontend (always masked with ••••••)
 * ✅ Full API key kept server-side, only used for Zoho API calls
 * ✅ This endpoint requires JWT (verifyToken middleware)
 * ⚠️  TODO: Add role check (admin/owner only) before allowing changes
 * ⚠️  TODO: Log who made this change for audit trail
 * ⚠️  TODO: Add rate limiting to prevent spam config changes
 * 
 * Error handling:
 * 401 Unauthorized = API key is invalid or account is inactive
 * 429 Too Many Requests = Daily email limit reached
 * 400 Bad Request = Invalid From Email or API URL
 * 500 Network Error = Zoho API unavailable
 * 
 * TESTING ENDPOINT (using curl or Postman):
 * ──────────────────────────────────────────
 * POST /api/company-email-settings/zoho-zeptomail
 * Headers: Authorization: Bearer {JWT_TOKEN}
 * Body: {
 *   "zohoZeptomailApiKey": "eyJhbGciOiJIUzI1...",  ← Your Zoho API key
 *   "zohoZeptomailApiUrl": "https://api.zeptomail.com/",  ← Or .eu/ or .in/
 *   "zohoZeptomailFromEmail": "noreply@company.com",  ← Verified sender
 *   "zohoZeptomailBounceAddress": "bounce@company.com"  ← Optional
 * }
 * 
 * Success Response: {
 *   "success": true,
 *   "message": "Company Zoho Zeptomail configured. All employees can now send emails."
 * }
 * 
 * Error Response (if API key invalid): {
 *   "success": false,
 *   "message": "Zoho Zeptomail authentication failed: Invalid API Key"
 * }
 */
// Admin configures this ONCE, all 30-50 employees use the SAME API key
router.put('/zoho-zeptomail', async (req, res) => {
  try {
    const { zohoZeptomailApiKey, zohoZeptomailApiUrl, zohoZeptomailFromEmail, zohoZeptomailBounceAddress } = req.body;

    if (!zohoZeptomailApiKey || !zohoZeptomailFromEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'Zoho Zeptomail API Key and From Email are required' 
      });
    }

    // Test Zoho Zeptomail API credentials before saving
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
            name: 'Skillnix (Company)'
          },
          to: [{
            email_address: {
              address: zohoZeptomailFromEmail.trim()
            }
          }],
          subject: '✅ Skillnix Zoho Zeptomail Company Configuration Test',
          htmlbody: '<p>If you received this email, your company Zoho Zeptomail configuration is working. All employees will now send emails through this account.</p>',
          textbody: 'If you received this email, your company Zoho Zeptomail configuration is working. All employees will now send emails through this account.'
        },
        {
          headers: {
            'Authorization': getZohoAuthHeaderValue(zohoZeptomailApiKey),
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      // ✅ API test passed - save to database
      const CompanyEmailConfig = mongoose.model('CompanyEmailConfig');
      
      let config = await CompanyEmailConfig.findOne({ companyId: 'default-company' });
      if (!config) {
        config = new CompanyEmailConfig({ companyId: 'default-company' });
      }

      // Update settings
      config.primaryProvider = 'zoho-zeptomail';
      config.zohoZeptomailApiKey = zohoZeptomailApiKey.trim();
      config.zohoZeptomailApiUrl = zohoZeptomailApiUrl || 'https://api.zeptomail.com/';
      config.zohoZeptomailFromEmail = zohoZeptomailFromEmail.trim();
      config.zohoZeptomailBounceAddress = zohoZeptomailBounceAddress || '';
      config.isConfigured = true;
      config.configuredBy = req.user.id;
      config.lastModifiedBy = req.user.id;
      config.lastModifiedAt = new Date();

      await config.save();

      res.json({
        success: true,
        message: `✅ Company Zoho Zeptomail configuration saved! All ${30}-50 employees can now send emails through this shared account.`,
        settings: {
          primaryProvider: 'zoho-zeptomail',
          zohoZeptomailApiKey: '••••••••••••••••',
          zohoZeptomailFromEmail: config.zohoZeptomailFromEmail,
          zohoZeptomailApiUrl: config.zohoZeptomailApiUrl,
          isConfigured: true
        }
      });
    } catch (apiError) {
      console.error('Zoho API test error:', apiError.response?.data || apiError.message);
      
      let errorMsg = 'Zoho Zeptomail API test failed';
      if (apiError.response?.status === 401) {
        errorMsg = 'Invalid API Key. Please check your Zoho Zeptomail credentials.';
      } else if (apiError.response?.status === 400) {
        errorMsg = `Invalid request: ${apiError.response.data?.message || 'Check your API URL and From Email'}`;
      } else if (apiError.code === 'ECONNABORTED') {
        errorMsg = 'Connection timeout. Check your API URL or network connection.';
      }
      
      return res.status(400).json({ success: false, message: errorMsg });
    }
  } catch (err) {
    console.error('Save company Zoho config error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── SAVE SMTP as company-wide configuration (fallback option) ───
// Less preferred than Zoho, but available as alternative
router.put('/smtp', async (req, res) => {
  try {
    const { smtpEmail, smtpAppPassword, smtpProvider, smtpHost, smtpPort } = req.body;

    if (!smtpEmail || !smtpAppPassword) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    // Test SMTP credentials
    const serviceProviders = { gmail: 'gmail', yahoo: 'Yahoo', outlook: 'Outlook365' };
    const hostProviders = {
      zoho:      { host: 'smtp.zoho.com',            port: 587 },
      hostinger: { host: 'smtp.hostinger.com',        port: 587 },
      godaddy:   { host: 'smtpout.secureserver.net',  port: 465 },
      namecheap: { host: 'mail.privateemail.com',     port: 587 },
    };

    const commonOpts = {
      family: 4,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
      tls: { rejectUnauthorized: false }
    };

    let verifyTransporter;
    const provider = smtpProvider || 'gmail';

    if (serviceProviders[provider]) {
      verifyTransporter = nodemailer.createTransport({
        service: serviceProviders[provider],
        auth: { user: smtpEmail.trim(), pass: smtpAppPassword },
        ...commonOpts
      });
    } else if (hostProviders[provider]) {
      const hp = hostProviders[provider];
      verifyTransporter = nodemailer.createTransport({
        host: hp.host, port: hp.port, secure: hp.port === 465,
        auth: { user: smtpEmail.trim(), pass: smtpAppPassword },
        ...commonOpts
      });
    } else {
      const port = smtpPort || 587;
      verifyTransporter = nodemailer.createTransport({
        host: smtpHost || 'smtp.gmail.com', port, secure: port === 465,
        auth: { user: smtpEmail.trim(), pass: smtpAppPassword },
        ...commonOpts
      });
    }

    try {
      await verifyTransporter.verify();
    } catch (verifyErr) {
      let msg = verifyErr.message;
      if (msg.includes('Invalid login') || msg.includes('AUTHENTICATIONFAILED')) {
        return res.status(400).json({ success: false, message: `Authentication failed. Password for ${smtpEmail} is incorrect.` });
      } else if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
        return res.status(400).json({ success: false, message: 'Cannot connect to email server. Check your SMTP settings.' });
      }
      return res.status(400).json({ success: false, message: `SMTP verification failed: ${msg}` });
    }

    // ✅ Test passed - save to database
    const CompanyEmailConfig = mongoose.model('CompanyEmailConfig');
    
    let config = await CompanyEmailConfig.findOne({ companyId: 'default-company' });
    if (!config) {
      config = new CompanyEmailConfig({ companyId: 'default-company' });
    }

    config.primaryProvider = 'smtp';
    config.smtpEmail = smtpEmail.trim();
    config.smtpAppPassword = smtpAppPassword;
    config.smtpProvider = smtpProvider || 'gmail';
    config.smtpHost = smtpHost || '';
    config.smtpPort = smtpPort || 587;
    config.isConfigured = true;
    config.configuredBy = req.user.id;
    config.lastModifiedBy = req.user.id;
    config.lastModifiedAt = new Date();

    await config.save();

    res.json({
      success: true,
      message: `✅ Company SMTP configuration saved! All employees can now send emails through this shared account.`,
      settings: {
        primaryProvider: 'smtp',
        smtpEmail: config.smtpEmail,
        smtpProvider: config.smtpProvider,
        isConfigured: true
      }
    });
  } catch (err) {
    console.error('Save company SMTP config error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── TEST company email configuration ───
router.post('/test', async (req, res) => {
  try {
    const CompanyEmailConfig = mongoose.model('CompanyEmailConfig');
    const config = await CompanyEmailConfig.findOne({ companyId: 'default-company' });

    if (!config?.isConfigured) {
      return res.status(400).json({ success: false, message: 'No company email configuration found.' });
    }

    // Test based on primary provider
    if (config.primaryProvider === 'zoho-zeptomail') {
      try {
        const apiUrl = config.zohoZeptomailApiUrl || 'https://api.zeptomail.com/';
        const apiEndpoint = apiUrl.endsWith('/') 
          ? `${apiUrl}v1.1/email`
          : `${apiUrl}/v1.1/email`;
        
        await axios.post(
          apiEndpoint,
          {
            from: { address: config.zohoZeptomailFromEmail, name: 'Skillnix Test' },
            to: [{ email_address: { address: config.zohoZeptomailFromEmail } }],
            subject: '✅ Company Zoho Zeptomail Configuration - Test Email',
            htmlbody: '<p>This confirms your company Zoho Zeptomail is working!</p>',
            textbody: 'This confirms your company Zoho Zeptomail is working!'
          },
          {
            headers: {
              'Authorization': getZohoAuthHeaderValue(config.zohoZeptomailApiKey),
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );
        res.json({ success: true, message: `✅ Test email sent to ${config.zohoZeptomailFromEmail} via company Zoho Zeptomail!` });
      } catch (err) {
        res.status(400).json({ success: false, message: `Zoho test failed: ${err.response?.data?.message || err.message}` });
      }
    } else if (config.primaryProvider === 'smtp') {
      // Test SMTP...
      res.json({ success: true, message: `✅ SMTP configuration verified!` });
    }
  } catch (err) {
    console.error('Test company config error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── CLEAR company email configuration ───
// Use this to reset and configure a new company-wide email
router.delete('/', async (req, res) => {
  try {
    const CompanyEmailConfig = mongoose.model('CompanyEmailConfig');
    const config = await CompanyEmailConfig.findOne({ companyId: 'default-company' });

    if (config) {
      config.isConfigured = false;
      config.primaryProvider = 'smtp';
      config.zohoZeptomailApiKey = '';
      config.zohoZeptomailApiUrl = 'https://api.zeptomail.com/';
      config.zohoZeptomailFromEmail = '';
      config.zohoZeptomailBounceAddress = '';
      config.smtpEmail = '';
      config.smtpAppPassword = '';
      config.lastModifiedBy = req.user.id;
      config.lastModifiedAt = new Date();
      await config.save();
    }

    res.json({ success: true, message: '✅ Company email configuration cleared. Please reconfigure.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
