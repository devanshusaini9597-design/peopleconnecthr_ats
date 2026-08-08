/**
 * Company-wide email configuration (Zoho / SMTP).
 */
const mongoose = require('mongoose');
const axios = require('axios');
const nodemailer = require('nodemailer');
const { getZohoAuthHeaderValue } = require('./emailService');

const COMPANY_ID = 'default-company';
const MASK = '••••••••••••••••';

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function getModel() {
  return mongoose.model('CompanyEmailConfig');
}

function toPublicSettings(config) {
  return {
    primaryProvider: config.primaryProvider,
    zohoZeptomailApiKey: config.zohoZeptomailApiKey ? MASK : '',
    zohoZeptomailApiUrl: config.zohoZeptomailApiUrl || 'https://api.zeptomail.com/',
    zohoZeptomailFromEmail: config.zohoZeptomailFromEmail || '',
    zohoZeptomailBounceAddress: config.zohoZeptomailBounceAddress || '',
    hasZohoApiKey: !!config.zohoZeptomailApiKey,
    smtpEmail: config.smtpEmail || '',
    smtpProvider: config.smtpProvider || 'gmail',
    smtpHost: config.smtpHost || '',
    smtpPort: config.smtpPort || 587,
    hasSmtpPassword: !!config.smtpAppPassword,
    configuredBy: config.configuredBy,
    configuredAt: config.configuredAt,
    lastModifiedAt: config.lastModifiedAt,
  };
}

async function getCompanyEmailConfig() {
  const config = await getModel().findOne({ companyId: COMPANY_ID });
  if (!config) {
    return {
      configured: false,
      message: 'No company email configuration found. Please set up company-wide email settings.',
    };
  }
  return {
    configured: config.isConfigured,
    settings: toPublicSettings(config),
    message: '✅ Company-wide email configuration is active. All employees will use these settings.',
  };
}

async function saveZohoConfig(userId, body) {
  const {
    zohoZeptomailApiKey,
    zohoZeptomailApiUrl,
    zohoZeptomailFromEmail,
    zohoZeptomailBounceAddress,
  } = body;

  if (!zohoZeptomailApiKey || !zohoZeptomailFromEmail) {
    throw httpError('Zoho Zeptomail API Key and From Email are required');
  }

  const apiUrl = zohoZeptomailApiUrl || 'https://api.zeptomail.com/';
  const apiEndpoint = apiUrl.endsWith('/') ? `${apiUrl}v1.1/email` : `${apiUrl}/v1.1/email`;

  try {
    await axios.post(
      apiEndpoint,
      {
        from: { address: zohoZeptomailFromEmail.trim(), name: 'Skillnix (Company)' },
        to: [{ email_address: { address: zohoZeptomailFromEmail.trim() } }],
        subject: '✅ Skillnix Zoho Zeptomail Company Configuration Test',
        htmlbody:
          '<p>If you received this email, your company Zoho Zeptomail configuration is working. All employees will now send emails through this account.</p>',
        textbody:
          'If you received this email, your company Zoho Zeptomail configuration is working. All employees will now send emails through this account.',
      },
      {
        headers: {
          Authorization: getZohoAuthHeaderValue(zohoZeptomailApiKey),
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
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
    throw httpError(errorMsg);
  }

  const CompanyEmailConfig = getModel();
  let config = await CompanyEmailConfig.findOne({ companyId: COMPANY_ID });
  if (!config) config = new CompanyEmailConfig({ companyId: COMPANY_ID });

  config.primaryProvider = 'zoho-zeptomail';
  config.zohoZeptomailApiKey = zohoZeptomailApiKey.trim();
  config.zohoZeptomailApiUrl = zohoZeptomailApiUrl || 'https://api.zeptomail.com/';
  config.zohoZeptomailFromEmail = zohoZeptomailFromEmail.trim();
  config.zohoZeptomailBounceAddress = zohoZeptomailBounceAddress || '';
  config.isConfigured = true;
  config.configuredBy = userId;
  config.lastModifiedBy = userId;
  config.lastModifiedAt = new Date();
  await config.save();

  return {
    message: `✅ Company Zoho Zeptomail configuration saved! All ${30}-50 employees can now send emails through this shared account.`,
    settings: {
      primaryProvider: 'zoho-zeptomail',
      zohoZeptomailApiKey: MASK,
      zohoZeptomailFromEmail: config.zohoZeptomailFromEmail,
      zohoZeptomailApiUrl: config.zohoZeptomailApiUrl,
      isConfigured: true,
    },
  };
}

async function saveSmtpConfig(userId, body) {
  const { smtpEmail, smtpAppPassword, smtpProvider, smtpHost, smtpPort } = body;

  if (!smtpEmail || !smtpAppPassword) {
    throw httpError('Email and password are required');
  }

  const serviceProviders = { gmail: 'gmail', yahoo: 'Yahoo', outlook: 'Outlook365' };
  const hostProviders = {
    zoho: { host: 'smtp.zoho.com', port: 587 },
    hostinger: { host: 'smtp.hostinger.com', port: 587 },
    godaddy: { host: 'smtpout.secureserver.net', port: 465 },
    namecheap: { host: 'mail.privateemail.com', port: 587 },
  };

  const commonOpts = {
    family: 4,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
    tls: { rejectUnauthorized: false },
  };

  let verifyTransporter;
  const provider = smtpProvider || 'gmail';

  if (serviceProviders[provider]) {
    verifyTransporter = nodemailer.createTransport({
      service: serviceProviders[provider],
      auth: { user: smtpEmail.trim(), pass: smtpAppPassword },
      ...commonOpts,
    });
  } else if (hostProviders[provider]) {
    const hp = hostProviders[provider];
    verifyTransporter = nodemailer.createTransport({
      host: hp.host,
      port: hp.port,
      secure: hp.port === 465,
      auth: { user: smtpEmail.trim(), pass: smtpAppPassword },
      ...commonOpts,
    });
  } else {
    const port = smtpPort || 587;
    verifyTransporter = nodemailer.createTransport({
      host: smtpHost || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user: smtpEmail.trim(), pass: smtpAppPassword },
      ...commonOpts,
    });
  }

  try {
    await verifyTransporter.verify();
  } catch (verifyErr) {
    let msg = verifyErr.message;
    if (msg.includes('Invalid login') || msg.includes('AUTHENTICATIONFAILED')) {
      throw httpError(`Authentication failed. Password for ${smtpEmail} is incorrect.`);
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
      throw httpError('Cannot connect to email server. Check your SMTP settings.');
    }
    throw httpError(`SMTP verification failed: ${msg}`);
  }

  const CompanyEmailConfig = getModel();
  let config = await CompanyEmailConfig.findOne({ companyId: COMPANY_ID });
  if (!config) config = new CompanyEmailConfig({ companyId: COMPANY_ID });

  config.primaryProvider = 'smtp';
  config.smtpEmail = smtpEmail.trim();
  config.smtpAppPassword = smtpAppPassword;
  config.smtpProvider = smtpProvider || 'gmail';
  config.smtpHost = smtpHost || '';
  config.smtpPort = smtpPort || 587;
  config.isConfigured = true;
  config.configuredBy = userId;
  config.lastModifiedBy = userId;
  config.lastModifiedAt = new Date();
  await config.save();

  return {
    message: '✅ Company SMTP configuration saved! All employees can now send emails through this shared account.',
    settings: {
      primaryProvider: 'smtp',
      smtpEmail: config.smtpEmail,
      smtpProvider: config.smtpProvider,
      isConfigured: true,
    },
  };
}

async function testCompanyEmailConfig() {
  const config = await getModel().findOne({ companyId: COMPANY_ID });
  if (!config?.isConfigured) {
    throw httpError('No company email configuration found.');
  }

  if (config.primaryProvider === 'zoho-zeptomail') {
    try {
      const apiUrl = config.zohoZeptomailApiUrl || 'https://api.zeptomail.com/';
      const apiEndpoint = apiUrl.endsWith('/') ? `${apiUrl}v1.1/email` : `${apiUrl}/v1.1/email`;

      await axios.post(
        apiEndpoint,
        {
          from: { address: config.zohoZeptomailFromEmail, name: 'Skillnix Test' },
          to: [{ email_address: { address: config.zohoZeptomailFromEmail } }],
          subject: '✅ Company Zoho Zeptomail Configuration - Test Email',
          htmlbody: '<p>This confirms your company Zoho Zeptomail is working!</p>',
          textbody: 'This confirms your company Zoho Zeptomail is working!',
        },
        {
          headers: {
            Authorization: getZohoAuthHeaderValue(config.zohoZeptomailApiKey),
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );
      return {
        message: `✅ Test email sent to ${config.zohoZeptomailFromEmail} via company Zoho Zeptomail!`,
      };
    } catch (err) {
      throw httpError(`Zoho test failed: ${err.response?.data?.message || err.message}`);
    }
  }

  if (config.primaryProvider === 'smtp') {
    return { message: '✅ SMTP configuration verified!' };
  }

  throw httpError('Unknown primary provider');
}

async function clearCompanyEmailConfig(userId) {
  const config = await getModel().findOne({ companyId: COMPANY_ID });
  if (config) {
    config.isConfigured = false;
    config.primaryProvider = 'smtp';
    config.zohoZeptomailApiKey = '';
    config.zohoZeptomailApiUrl = 'https://api.zeptomail.com/';
    config.zohoZeptomailFromEmail = '';
    config.zohoZeptomailBounceAddress = '';
    config.smtpEmail = '';
    config.smtpAppPassword = '';
    config.lastModifiedBy = userId;
    config.lastModifiedAt = new Date();
    await config.save();
  }
  return { message: '✅ Company email configuration cleared. Please reconfigure.' };
}

module.exports = {
  getCompanyEmailConfig,
  saveZohoConfig,
  saveSmtpConfig,
  testCompanyEmailConfig,
  clearCompanyEmailConfig,
};
