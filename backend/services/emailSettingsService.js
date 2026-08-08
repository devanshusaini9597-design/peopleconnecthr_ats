/**
 * Per-user email settings — SMTP/Zoho probe + save helpers.
 * Routes stay thin HTTP wrappers.
 */
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const axios = require('axios');
const logger = require('../utils/logger');
const { getZohoAuthHeaderValue } = require('./emailService');

const MASK = '••••••••••••••••';

const SERVICE_PROVIDERS = { gmail: 'gmail', yahoo: 'Yahoo', outlook: 'Outlook365' };
const HOST_PROVIDERS = {
  zoho: { host: 'smtp.zoho.com', port: 587 },
  hostinger: { host: 'smtp.hostinger.com', port: 587 },
  godaddy: { host: 'smtpout.secureserver.net', port: 465 },
  namecheap: { host: 'mail.privateemail.com', port: 587 },
};

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function createSmtpTransporter({
  smtpEmail,
  password,
  smtpProvider,
  smtpHost,
  smtpPort,
  timeouts = { connectionTimeout: 30000, greetingTimeout: 30000, socketTimeout: 30000 },
}) {
  const provider = smtpProvider || 'gmail';
  const commonOpts = {
    family: 4,
    ...timeouts,
    tls: { rejectUnauthorized: false },
  };

  if (SERVICE_PROVIDERS[provider]) {
    return nodemailer.createTransport({
      service: SERVICE_PROVIDERS[provider],
      auth: { user: smtpEmail, pass: password },
      ...commonOpts,
    });
  }
  if (HOST_PROVIDERS[provider]) {
    const hp = HOST_PROVIDERS[provider];
    return nodemailer.createTransport({
      host: hp.host,
      port: hp.port,
      secure: hp.port === 465,
      auth: { user: smtpEmail, pass: password },
      ...commonOpts,
    });
  }
  const port = smtpPort || 587;
  return nodemailer.createTransport({
    host: smtpHost || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user: smtpEmail, pass: password },
    ...commonOpts,
  });
}

function mapSmtpError(msg) {
  if (
    msg.includes('Invalid login') ||
    msg.includes('AUTHENTICATIONFAILED') ||
    msg.includes('authentication failed')
  ) {
    return 'Authentication failed. Check your email and App Password. Make sure you use a Google App Password, not your regular password.';
  }
  if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
    return 'Cannot connect to mail server. Check your SMTP settings.';
  }
  if (
    msg.includes('ETIMEDOUT') ||
    msg.includes('ESOCKET') ||
    msg.includes('ECONNRESET') ||
    msg.includes('timeout') ||
    msg.includes('ENETUNREACH')
  ) {
    return 'Connection timeout. The SMTP server is not reachable from this hosting. Try using Gmail with App Password instead, or check if your email provider allows connections from cloud servers.';
  }
  return msg;
}

function mapZohoError(apiError) {
  if (apiError.response?.status === 401) {
    return 'Invalid Zoho Zeptomail API Key. Please check your credentials.';
  }
  if (apiError.response?.status === 400) {
    return `Invalid request: ${apiError.response.data?.message || 'Check your API URL and From Email'}`;
  }
  if (apiError.code === 'ECONNABORTED') {
    return 'Connection timeout. Check your API URL or network connection.';
  }
  return 'Zoho Zeptomail API test failed';
}

function getMaskedSettings(user) {
  const settings = user.emailSettings || {};
  const envZohoConfigured = !!(
    process.env.ZOHO_ZEPTOMAIL_API_KEY && process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL
  );
  const isConfigured = !!(settings.isConfigured || envZohoConfigured);

  return {
    smtpEmail: settings.smtpEmail || '',
    smtpAppPassword: settings.smtpAppPassword ? MASK : '',
    smtpProvider: settings.smtpProvider || 'hostinger',
    smtpHost: settings.smtpHost || 'smtp.hostinger.com',
    smtpPort: settings.smtpPort || 587,
    emailProvider: envZohoConfigured ? 'zoho-zeptomail' : settings.emailProvider || 'smtp',
    zohoZeptomailFromEmail:
      process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL || settings.zohoZeptomailFromEmail || '',
    isConfigured,
    hasPassword: !!settings.smtpAppPassword,
    hasZohoApiKey: !!(envZohoConfigured || settings.zohoZeptomailApiKey),
    configSource: envZohoConfigured
      ? 'zeptomail-env'
      : settings.isConfigured
        ? 'user-smtp'
        : 'none',
  };
}

async function resolveSmtpPassword(userId, smtpAppPassword) {
  if (smtpAppPassword !== MASK) return smtpAppPassword;
  const User = mongoose.model('User');
  const user = await User.findById(userId);
  const saved = user?.emailSettings?.smtpAppPassword;
  if (!saved) throw httpError('No saved password found. Please enter your App Password.');
  return saved;
}

async function resolveZohoApiKey(userId, zohoZeptomailApiKey) {
  if (zohoZeptomailApiKey !== MASK) return zohoZeptomailApiKey;
  const User = mongoose.model('User');
  const user = await User.findById(userId);
  const saved = user?.emailSettings?.zohoZeptomailApiKey;
  if (!saved) {
    throw httpError('No saved API Key found. Please enter your Zoho Zeptomail API Key.');
  }
  return saved;
}

async function sendZohoTestEmail({
  apiKey,
  apiUrl,
  fromEmail,
  senderName,
}) {
  const base = apiUrl || 'https://api.zeptomail.com/';
  const apiEndpoint = base.endsWith('/') ? `${base}v1.1/email` : `${base}/v1.1/email`;

  await axios.post(
    apiEndpoint,
    {
      from: { address: fromEmail.trim(), name: senderName || 'Skillnix' },
      to: [{ email_address: { address: fromEmail.trim() } }],
      subject: '✅ Skillnix Zoho Zeptomail Configuration Test',
      htmlbody:
        '<p>If you received this email, your Zoho Zeptomail configuration is working correctly!</p>',
      textbody: 'If you received this email, your Zoho Zeptomail configuration is working correctly!',
    },
    {
      headers: {
        Authorization: getZohoAuthHeaderValue(apiKey),
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );
}

async function saveZohoSettings(userId, body) {
  const {
    zohoZeptomailApiKey,
    zohoZeptomailApiUrl,
    zohoZeptomailFromEmail,
    zohoZeptomailBounceAddress,
  } = body;

  if (!zohoZeptomailApiKey || !zohoZeptomailFromEmail) {
    throw httpError('Zoho Zeptomail API Key and From Email are required');
  }

  const User = mongoose.model('User');
  const user = await User.findById(userId);
  if (!user) throw httpError('User not found', 404);

  try {
    await sendZohoTestEmail({
      apiKey: zohoZeptomailApiKey,
      apiUrl: zohoZeptomailApiUrl,
      fromEmail: zohoZeptomailFromEmail,
      senderName: user.name,
    });
  } catch (apiError) {
    logger.error({ err: apiError.response?.data || apiError.message }, 'Zoho Zeptomail API error');
    throw httpError(mapZohoError(apiError));
  }

  user.emailSettings = {
    ...user.emailSettings,
    emailProvider: 'zoho-zeptomail',
    zohoZeptomailApiKey: zohoZeptomailApiKey.trim(),
    zohoZeptomailApiUrl: zohoZeptomailApiUrl || 'https://api.zeptomail.com/',
    zohoZeptomailFromEmail: zohoZeptomailFromEmail.trim(),
    zohoZeptomailBounceAddress: zohoZeptomailBounceAddress || '',
    isConfigured: true,
  };
  await user.save();

  return {
    message: '✅ Zoho Zeptomail configuration verified & saved successfully!',
    settings: {
      emailProvider: 'zoho-zeptomail',
      zohoZeptomailApiKey: MASK,
      zohoZeptomailFromEmail: user.emailSettings.zohoZeptomailFromEmail,
      zohoZeptomailApiUrl: user.emailSettings.zohoZeptomailApiUrl,
      isConfigured: true,
      hasZohoApiKey: true,
    },
  };
}

async function saveSmtpSettings(userId, body) {
  const { smtpEmail, smtpAppPassword, smtpProvider, smtpHost, smtpPort } = body;
  if (!smtpEmail) throw httpError('Email address is required');

  const User = mongoose.model('User');
  const user = await User.findById(userId);
  if (!user) throw httpError('User not found', 404);

  const actualPassword =
    smtpAppPassword === MASK
      ? user.emailSettings?.smtpAppPassword || ''
      : smtpAppPassword;
  if (!actualPassword) throw httpError('Password is required');

  const transporter = createSmtpTransporter({
    smtpEmail: smtpEmail.trim(),
    password: actualPassword,
    smtpProvider,
    smtpHost,
    smtpPort,
    timeouts: {
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
    },
  });

  try {
    await transporter.verify();
  } catch (verifyErr) {
    const mapped = mapSmtpError(verifyErr.message);
    if (mapped.includes('Authentication failed')) {
      throw httpError(
        `Authentication failed. The password for ${smtpEmail} is incorrect. Please check and re-enter your email password or App Password.`
      );
    }
    if (mapped.includes('Cannot connect')) {
      throw httpError('Cannot connect to the email server. Check your SMTP settings.');
    }
    if (mapped.includes('timeout') || mapped.includes('Connection timeout')) {
      throw httpError(
        'Connection to email server timed out. The server may not be reachable from this hosting. Try using Gmail with App Password instead.'
      );
    }
    throw httpError(`SMTP verification failed: ${verifyErr.message}`);
  }

  user.emailSettings = {
    ...user.emailSettings,
    emailProvider: 'smtp',
    smtpEmail: smtpEmail.trim(),
    smtpAppPassword: actualPassword,
    smtpProvider: smtpProvider || 'gmail',
    smtpHost: smtpHost || '',
    smtpPort: smtpPort || 587,
    isConfigured: true,
  };
  await user.save();

  return {
    message: 'Email settings verified & saved successfully! ✅',
    settings: {
      emailProvider: 'smtp',
      smtpEmail: user.emailSettings.smtpEmail,
      smtpAppPassword: MASK,
      smtpProvider: user.emailSettings.smtpProvider,
      smtpHost: user.emailSettings.smtpHost,
      smtpPort: user.emailSettings.smtpPort,
      isConfigured: true,
      hasPassword: true,
    },
  };
}

async function testSmtpSettings(userId, body) {
  const { smtpEmail, smtpAppPassword, smtpProvider, smtpHost, smtpPort } = body;
  if (!smtpEmail || !smtpAppPassword) {
    throw httpError('Email and App Password are required');
  }

  const actualPassword = await resolveSmtpPassword(userId, smtpAppPassword);
  const User = mongoose.model('User');
  const user = await User.findById(userId);

  const transporter = createSmtpTransporter({
    smtpEmail,
    password: actualPassword,
    smtpProvider,
    smtpHost,
    smtpPort,
  });

  try {
    await transporter.verify();
    await transporter.sendMail({
      from: `"${user?.name || 'Skillnix'}" <${smtpEmail}>`,
      to: smtpEmail,
      subject: '✅ Skillnix Email Settings — Test Successful',
      html: `<p>Your email settings are working correctly for <strong>${smtpEmail}</strong>.</p>`,
    });
  } catch (err) {
    throw httpError(mapSmtpError(err.message));
  }

  return { message: `Test email sent to ${smtpEmail}. Check your inbox!` };
}

async function testZohoSettings(userId, body) {
  const { zohoZeptomailApiKey, zohoZeptomailApiUrl, zohoZeptomailFromEmail } = body;
  if (!zohoZeptomailApiKey || !zohoZeptomailFromEmail) {
    throw httpError('Zoho Zeptomail API Key and From Email are required');
  }

  const actualApiKey = await resolveZohoApiKey(userId, zohoZeptomailApiKey);
  const User = mongoose.model('User');
  const user = await User.findById(userId);

  try {
    await sendZohoTestEmail({
      apiKey: actualApiKey,
      apiUrl: zohoZeptomailApiUrl,
      fromEmail: zohoZeptomailFromEmail,
      senderName: user?.name,
    });
  } catch (apiError) {
    logger.error({ err: apiError.response?.data || apiError.message }, 'Zoho Zeptomail test error');
    throw httpError(mapZohoError(apiError));
  }

  return {
    message: `Test email sent to ${zohoZeptomailFromEmail.trim()} via Zoho Zeptomail. Check your inbox!`,
  };
}

module.exports = {
  MASK,
  getMaskedSettings,
  saveZohoSettings,
  saveSmtpSettings,
  testSmtpSettings,
  testZohoSettings,
  createSmtpTransporter,
};
