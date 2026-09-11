const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const SKILLNIX_LOGO_CID = 'skillnix-logo';
const SKILLNIX_LOGO_FILE = path.join(__dirname, '..', 'public', 'email-brand', 'skillnix-logo-email.png');

function skillnixInlineImage() {
  try {
    if (!fs.existsSync(SKILLNIX_LOGO_FILE)) return null;
    return {
      content: fs.readFileSync(SKILLNIX_LOGO_FILE).toString('base64'),
      mime_type: 'image/png',
      cid: SKILLNIX_LOGO_CID,
    };
  } catch (_) {
    return null;
  }
}

function platformFromName(fromEmail) {
  try {
    const { identityForFromEmail } = require('./emailBrandLayout');
    return identityForFromEmail(
      fromEmail || process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL || process.env.ZEPTOMAIL_FROM_EMAIL
    ).name;
  } catch {
    return 'Skillnix Recruitment';
  }
}

const PLATFORM_FROM_NAME = platformFromName();

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

  logger.info('📧 Email Service Initialized:', {
    provider: emailProvider,
    fromEmail: process.env.FROM_EMAIL || process.env.GMAIL_EMAIL
  });
};

initializeTransporter();

const emailDomain = (addr) => {
  if (!addr || typeof addr !== 'string' || !addr.includes('@')) return '';
  return addr.split('@')[1].trim().toLowerCase();
};

const parseDomainList = (raw) =>
  String(raw || '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

/**
 * Domains allowed as ZeptoMail From addresses for the default mailbox.
 * Override with ZOHO_ZEPTOMAIL_ALLOWED_FROM_DOMAINS=devlumiq.com,other.com
 * (every listed domain must be Verified in that mailbox's ZeptoMail agent).
 */
const getZeptoAllowedFromDomains = (agentFromEmail = '') => {
  const fromEnv = parseDomainList(process.env.ZOHO_ZEPTOMAIL_ALLOWED_FROM_DOMAINS || '');
  if (fromEnv.length) return fromEnv;
  const d = emailDomain(agentFromEmail);
  return d ? [d] : [];
};

/**
 * Multi-domain ZeptoMail mailboxes.
 * Default: ZOHO_ZEPTOMAIL_* 
 * Extra: ZOHO_ZEPTOMAIL_MAILBOX_2_DOMAIN / _FROM / _API_KEY / _API_URL / _ALLOWED / _MATCH
 * Named: MAIL_PROFILE_SKILLNIXRECRUITMENT_* (Skillnix recruitment domain)
 *
 * - matchDomains: used to pick this mailbox (org/user domain)
 * - allowedFromDomains: domains Zepto will accept as From (must be verified on that agent)
 */
const getZeptoMailboxes = () => {
  const boxes = [];
  const envKey = (process.env.ZOHO_ZEPTOMAIL_API_KEY || process.env.ZEPTOMAIL_API_KEY || '').trim();
  const envFrom = (process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL || process.env.ZEPTOMAIL_FROM_EMAIL || '').trim();
  const envApiUrl = (
    process.env.ZOHO_ZEPTOMAIL_API_URL ||
    process.env.ZEPTOMAIL_API_URL ||
    'https://api.zeptomail.in/'
  ).replace(/\/?$/, '/');

  if (envKey && envFrom) {
    const allowed = getZeptoAllowedFromDomains(envFrom);
    boxes.push({
      id: 'default',
      fromEmail: envFrom,
      apiKey: envKey,
      apiUrl: envApiUrl,
      displayName: (process.env.ZOHO_ZEPTOMAIL_FROM_NAME || process.env.MAIL_PROFILE_DEFAULT_NAME || '').trim(),
      allowedFromDomains: allowed,
      matchDomains: allowed,
    });
  }

  for (let i = 2; i <= 9; i += 1) {
    const p = `ZOHO_ZEPTOMAIL_MAILBOX_${i}_`;
    const domain = (process.env[`${p}DOMAIN`] || '').trim().toLowerCase();
    const from = (process.env[`${p}FROM`] || '').trim();
    const key = (process.env[`${p}API_KEY`] || '').trim();
    if (!domain || !from || !key) continue;
    const url = (process.env[`${p}API_URL`] || envApiUrl || 'https://api.zeptomail.in/').replace(/\/?$/, '/');
    const allowed = parseDomainList(process.env[`${p}ALLOWED`] || domain);
    const match = parseDomainList(process.env[`${p}MATCH`] || '') || [];
    const matchDomains = [...new Set([domain, ...allowed, ...match])];
    boxes.push({
      id: `mailbox_${i}`,
      fromEmail: from,
      apiKey: key,
      apiUrl: url,
      displayName: (process.env[`${p}NAME`] || '').trim(),
      allowedFromDomains: allowed.length ? allowed : [domain],
      matchDomains,
    });
  }

  const pushNamedMailbox = ({ id, prefix, defaultAllowed, defaultMatch }) => {
    const from = (process.env[`${prefix}_FROM`] || '').trim();
    const key = (process.env[`${prefix}_API_KEY`] || '').trim();
    if (!from || !key) return;
    const allowed = parseDomainList(process.env[`${prefix}_ALLOWED`] || defaultAllowed);
    const match = parseDomainList(process.env[`${prefix}_MATCH`] || defaultMatch || defaultAllowed);
    const url = (process.env[`${prefix}_API_URL`] || envApiUrl).replace(/\/?$/, '/');
    const domain = emailDomain(from);
    boxes.push({
      id,
      fromEmail: from,
      apiKey: key,
      apiUrl: url,
      displayName: (process.env[`${prefix}_NAME`] || '').trim(),
      allowedFromDomains: allowed.length ? allowed : (domain ? [domain] : []),
      matchDomains: [...new Set([...(match.length ? match : []), ...allowed, ...(domain ? [domain] : [])])],
    });
  };

  pushNamedMailbox({
    id: 'peopleconnecthr',
    prefix: 'MAIL_PROFILE_PEOPLECONNECTHR',
    defaultAllowed: 'peopleconnecthr.com',
    defaultMatch: 'peopleconnecthr.com',
  });
  pushNamedMailbox({
    id: 'skillnix',
    prefix: 'MAIL_PROFILE_SKILLNIX',
    defaultAllowed: 'skillnix.com',
    defaultMatch: 'skillnix.com',
  });
  pushNamedMailbox({
    id: 'skillnixrecruitment',
    prefix: 'MAIL_PROFILE_SKILLNIXRECRUITMENT',
    defaultAllowed: 'skillnixrecruitment.com',
    defaultMatch: 'skillnixrecruitment.com,skillnix.com',
  });

  return boxes;
};

const resolveZeptoMailbox = async ({ userEmail, organizationId } = {}) => {
  const boxes = getZeptoMailboxes();

  try {
    const ZeptoMailbox = require('../models/ZeptoMailbox');
    const rows = await ZeptoMailbox.find({ isActive: true }).lean();
    for (const row of rows) {
      if (!row?.fromEmail || !row?.apiKey) continue;
      const allowed = (row.allowedFromDomains || []).map((d) => String(d).toLowerCase()).filter(Boolean);
      const match = (row.matchDomains || []).map((d) => String(d).toLowerCase()).filter(Boolean);
      const domain = emailDomain(row.fromEmail);
      boxes.push({
        id: `db:${row.key || row._id}`,
        fromEmail: String(row.fromEmail).trim(),
        apiKey: String(row.apiKey).trim(),
        apiUrl: String(row.apiUrl || 'https://api.zeptomail.in/').replace(/\/?$/, '/'),
        displayName: String(row.displayName || '').trim(),
        allowedFromDomains: allowed.length ? allowed : (domain ? [domain] : []),
        matchDomains: [...new Set([...(match.length ? match : []), ...allowed, ...(domain ? [domain] : [])])],
      });
    }
  } catch (_) { /* ignore */ }

  if (!boxes.length) return null;

  const userDom = emailDomain(userEmail);
  if (userDom) {
    const byUser = boxes.find((b) => mailboxMatchesDomain(b, userDom));
    if (byUser) return byUser;
  }

  if (organizationId) {
    try {
      const Organization = mongoose.model('Organization');
      const org = await Organization.findById(organizationId)
        .select('domain allowedDomains')
        .lean();
      const orgDomains = [
        ...(org?.domain ? [String(org.domain).toLowerCase()] : []),
        ...((org?.allowedDomains || []).map((d) => String(d).toLowerCase())),
      ];
      for (const d of orgDomains) {
        const byOrg = boxes.find((b) => mailboxMatchesDomain(b, d));
        if (byOrg) return byOrg;
      }
    } catch (_) { /* ignore */ }
  }

  return boxes[0];
};

/**
 * Enterprise From selection for a mailbox:
 * - If recruiter's work email domain is verified on that agent → From = login email
 * - Else → From = mailbox agent address; Reply-To = login email
 */
const resolveEnterpriseFrom = ({ agentFrom, userEmail, allowedFromDomains }) => {
  const agent = (agentFrom || '').trim().toLowerCase();
  const user = (userEmail || '').trim().toLowerCase();
  const allowed = Array.isArray(allowedFromDomains) && allowedFromDomains.length
    ? allowedFromDomains
    : getZeptoAllowedFromDomains(agent);
  const userDom = emailDomain(user);
  const sendAsUser = Boolean(user && userDom && allowed.includes(userDom));
  return {
    fromEmail: sendAsUser ? user : agent,
    replyToEmail: user || agent,
    sendAsUser,
    allowedDomains: allowed,
  };
};

/** OTP / reset / invites: company no-reply on the verified org domain. */
const resolveSystemFromAddress = ({ mailbox, userEmail, orgDomain } = {}) => {
  const agent = String(mailbox?.fromEmail || '').trim().toLowerCase();
  if (!agent) return '';
  const allowed = (mailbox?.allowedFromDomains || []).map((d) => String(d || '').toLowerCase()).filter(Boolean);
  const domain = String(orgDomain || emailDomain(userEmail) || emailDomain(agent)).trim().toLowerCase();
  if (domain && (allowed.includes(domain) || emailDomain(agent) === domain)) {
    return `noreply@${domain}`;
  }
  return agent;
};

const mailboxMatchesDomain = (box, domain) => {
  const d = String(domain || '').trim().toLowerCase();
  if (!d || !box) return false;
  return (box.matchDomains || []).includes(d)
    || (box.allowedFromDomains || []).includes(d)
    || emailDomain(box.fromEmail) === d;
};

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
  const { cc, bcc, senderName, fromEmail, replyToEmail, zohoApiKey, zohoApiUrl } = options;

  if (!zohoApiKey || !zohoApiUrl || !fromEmail) {
    throw new Error('ZOHO_ZEPTOMAIL_NOT_CONFIGURED');
  }

  const displayName = senderName || platformFromName(fromEmail);
  const preferredReply = (replyToEmail || fromEmail).trim();
  const recipients = Array.isArray(to) ? to : [to];

  const toList = recipients.map((email) => ({
    email_address: { address: email, name: '' },
  }));
  const ccList = cc
    ? (Array.isArray(cc) ? cc : [cc]).map((email) => ({
        email_address: { address: email, name: '' },
      }))
    : [];
  const bccList = bcc
    ? (Array.isArray(bcc) ? bcc : [bcc]).map((email) => ({
        email_address: { address: email, name: '' },
      }))
    : [];

  const apiEndpoint = zohoApiUrl.endsWith('/')
    ? `${zohoApiUrl}v1.1/email`
    : `${zohoApiUrl}/v1.1/email`;
  const authHeader = getZohoAuthHeaderValue(zohoApiKey);

  const postOnce = async (replyAddress) => {
    const clientReference =
      options.clientReference ||
      `ats_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const payload = {
      from: { address: fromEmail, name: displayName },
      to: toList,
      subject,
      htmlbody: htmlBody,
      textbody: textBody || subject,
      reply_to: { address: replyAddress, name: displayName },
      track_opens: options.trackOpens !== false,
      track_clicks: options.trackClicks !== false,
      client_reference: clientReference,
    };
    if (ccList.length > 0) payload.cc = ccList;
    if (bccList.length > 0) payload.bcc = bccList;
    if (String(htmlBody || '').includes(`cid:${SKILLNIX_LOGO_CID}`)) {
      const inline = skillnixInlineImage();
      if (inline) payload.inline_images = [inline];
    }

    logger.info(
      `[ZeptoMail] POST ${apiEndpoint} | from=${fromEmail} | reply_to=${replyAddress}`
    );

    const response = await axios.post(apiEndpoint, payload, {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    const dataNode = response.data?.data;
    const first =
      Array.isArray(dataNode) ? dataNode[0] : dataNode && typeof dataNode === 'object' ? dataNode : {};
    const messageId =
      first?.message_id ||
      response.data?.data?.message_id ||
      response.data?.message_id ||
      `zoho_${Date.now()}`;
    const requestId = response.data?.request_id || first?.request_id || '';
    logger.info(
      `✅ Zoho Zeptomail accepted: to=${recipients.join(', ')} from=${fromEmail} reply_to=${replyAddress} messageId=${messageId}`
    );
    return {
      success: true,
      email: to,
      messageId,
      requestId,
      clientReference,
      fromEmail,
      replyTo: replyAddress,
      provider: 'zeptomail',
    };
  };

  const formatZohoError = (error) => {
    const zohoError = error.response?.data?.error;
    const details = Array.isArray(zohoError?.details) ? zohoError.details : [];
    const sm111 = details.find((d) => d && d.code === 'SM_111');
    const status = error.response?.status;
    let errorMsg = error.message;
    if (sm111) {
      errorMsg = `ZeptoMail: Sender address not verified. "${sm111.target_value || 'from'}" is not verified in your ZeptoMail agent. Emails are sent from your verified address (check .env ZOHO_ZEPTOMAIL_FROM_EMAIL).`;
    } else if (status === 401) {
      errorMsg = 'ZeptoMail: Invalid API key. Check your Send Mail Token in ZeptoMail dashboard.';
    } else if (status === 403) {
      errorMsg =
        'ZeptoMail 403: Request Denied. Go to ZeptoMail > your Agent > Settings > IP Restriction and remove all IPs (empty list = allow all).';
    } else if (status === 429) {
      errorMsg = 'ZeptoMail rate limit hit. Try again later or upgrade your plan.';
    } else if (error.code === 'ECONNABORTED') {
      errorMsg = 'ZeptoMail timeout. Network issue or Zoho service is slow.';
    } else if (error.response?.data?.message) {
      errorMsg = `ZeptoMail: ${error.response.data.message}`;
    }
    const err = new Error(errorMsg);
    err.code = 'ZOHO_ZEPTOMAIL_ERROR';
    err.sm111 = Boolean(sm111);
    err.sm111Target = sm111?.target_value || '';
    return err;
  };

  try {
    return await postOnce(preferredReply);
  } catch (error) {
    logger.error('❌ Zoho Zeptomail Error:', {
      message: error.message,
      status: error.response?.status,
      data: JSON.stringify(error.response?.data, null, 2),
      email: to,
      from: fromEmail,
      reply_to: preferredReply,
    });

    const formatted = formatZohoError(error);
    const replyDiffers =
      preferredReply &&
      preferredReply.toLowerCase() !== String(fromEmail).toLowerCase();

    // Some Zepto agents reject unverified reply_to the same as From (SM_111).
    // Retry with verified From as reply_to so send still succeeds.
    if (formatted.sm111 && replyDiffers) {
      logger.warn(
        `[ZeptoMail] SM_111 on "${formatted.sm111Target || preferredReply}" — retrying with reply_to=${fromEmail}`
      );
      try {
        return await postOnce(fromEmail);
      } catch (retryErr) {
        logger.error('❌ Zoho Zeptomail retry failed:', {
          message: retryErr.message,
          data: JSON.stringify(retryErr.response?.data, null, 2),
        });
        throw formatZohoError(retryErr);
      }
    }

    throw formatted;
  }
};

// ─── Get per-user transporter (supports SMTP and Zoho Zeptomail) ───
// ✅ Zoho from .env is ALWAYS DEFAULT when set; user/company config only used when env Zoho is not set
const getUserTransporter = async (userId, hints = {}) => {
  try {
    // PRIORITY 0: ZeptoMail mailbox(es) from env/DB — pick by sender/org domain (never the recipient)
    const boxes = getZeptoMailboxes();
    // Always try DB mailboxes via resolve even if env empty
    let userEmail = '';
    let userName = hints.senderName || PLATFORM_FROM_NAME;
    let organizationId = hints.organizationId || null;
    let orgDomain = '';

    if (userId) {
      const User = mongoose.model('User');
      const user = await User.findById(userId).select('emailSettings name email organizationId role');
      userEmail = user?.email ? String(user.email).trim().toLowerCase() : '';
      if (!hints.senderName) userName = user?.name || userEmail || 'Recruiter';
      organizationId = organizationId || user?.organizationId || null;

      // ── Freelancers do not send via company ZeptoMail / Zoho Campaigns ──
      // Candidate mail is native-app only (mailto / Outlook). Platform Zepto
      // access + email plan limits will be added later.
      if (user && String(user.role) === 'freelancer' && !hints.system) {
        return {
          transporter: null,
          fromEmail: '',
          configured: false,
          provider: 'none',
          configSource: 'freelancer-native-mail',
          userId,
        };
      }
    }

    if (organizationId) {
      try {
        const Organization = mongoose.model('Organization');
        const org = await Organization.findById(organizationId)
          .select('name domain atsSettings.whiteLabel.emailFromName')
          .lean();
        orgDomain = String(org?.domain || '').trim().toLowerCase();
        if (!hints.senderName) {
          const branded = String(org?.atsSettings?.whiteLabel?.emailFromName || org?.name || '').trim();
          if (branded) userName = branded;
        }
      } catch (_) { /* keep fallback */ }
    }

    const mailbox = await resolveZeptoMailbox({
      userEmail,
      organizationId,
    });

    if (mailbox) {
      const systemMail = Boolean(hints.system);
      if (systemMail || !userId) {
        const fromEmail = systemMail
          ? resolveSystemFromAddress({ mailbox, userEmail, orgDomain })
          : mailbox.fromEmail;
        return {
          transporter: null,
          fromEmail,
          replyToEmail: (hints.replyToEmail || fromEmail).trim(),
          userName,
          mailboxDisplayName: String(mailbox.displayName || '').trim(),
          configured: true,
          provider: 'zoho-zeptomail',
          zohoApiKey: mailbox.apiKey,
          zohoApiUrl: mailbox.apiUrl,
          userId: userId || null,
          configSource: 'env',
          mailboxId: mailbox.id,
          sendAsUser: false,
        };
      }

      const resolved = resolveEnterpriseFrom({
        agentFrom: mailbox.fromEmail,
        userEmail,
        allowedFromDomains: mailbox.allowedFromDomains,
      });

      return {
        transporter: null,
        fromEmail: resolved.fromEmail,
        replyToEmail: resolved.replyToEmail,
        userName,
        mailboxDisplayName: String(mailbox.displayName || '').trim(),
        configured: true,
        provider: 'zoho-zeptomail',
        zohoApiKey: mailbox.apiKey,
        zohoApiUrl: mailbox.apiUrl,
        userId,
        configSource: 'env',
        sendAsUser: resolved.sendAsUser,
        mailboxId: mailbox.id,
      };
    }

    // ✅ PRIORITY 1: User per-user configuration (only when no Zepto mailbox matched)
    if (userId) {
      const User = mongoose.model('User');
      const user = await User.findById(userId).select('emailSettings name email');
      
      if (user?.emailSettings?.isConfigured) {
        const s = user.emailSettings;

        // Check if using Zoho Zeptomail (per-user override)
        if (s.emailProvider === 'zoho-zeptomail' && s.zohoZeptomailApiKey && s.zohoZeptomailFromEmail) {
          const userEmail = user?.email ? String(user.email).trim().toLowerCase() : '';
          const resolved = resolveEnterpriseFrom({
            agentFrom: s.zohoZeptomailFromEmail,
            userEmail,
            allowedFromDomains: getZeptoAllowedFromDomains(s.zohoZeptomailFromEmail),
          });
          return {
            transporter: null,
            fromEmail: resolved.fromEmail,
            replyToEmail: resolved.replyToEmail,
            userName: user.name || userEmail || 'Recruiter',
            configured: true,
            provider: 'zoho-zeptomail',
            zohoApiKey: s.zohoZeptomailApiKey,
            zohoApiUrl: s.zohoZeptomailApiUrl || 'https://api.zeptomail.com/',
            userId: userId,
            configSource: 'user',
            sendAsUser: resolved.sendAsUser,
          };
        }

        // Check if using SMTP (per-user)
        if (s.smtpEmail && s.smtpAppPassword) {
          let userTransporter = createSmtpTransporter(s);
          const userEmail = user?.email ? String(user.email).trim().toLowerCase() : '';
          return { 
            transporter: userTransporter, 
            fromEmail: s.smtpEmail,
            replyToEmail: userEmail || s.smtpEmail,
            userName: user.name || userEmail || 'Recruiter', 
            configured: true, 
            provider: 'smtp',
            configSource: 'user'
          };
        }
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
      let companyUserName = PLATFORM_FROM_NAME;
      let companyUserEmail = '';
      if (userId) {
        try {
          const User = mongoose.model('User');
          const u = await User.findById(userId).select('name email');
          companyUserName = u?.name || companyUserName;
          companyUserEmail = u?.email ? String(u.email).trim().toLowerCase() : '';
        } catch (_) { /* ignore */ }
      }

      // Use company's Zoho Zeptomail (all employees share this)
      if (companyConfig.primaryProvider === 'zoho-zeptomail' && companyConfig.zohoZeptomailApiKey && companyConfig.zohoZeptomailFromEmail) {
        const resolved = resolveEnterpriseFrom({
          agentFrom: companyConfig.zohoZeptomailFromEmail,
          userEmail: companyUserEmail,
          allowedFromDomains: getZeptoAllowedFromDomains(companyConfig.zohoZeptomailFromEmail),
        });
        return {
          transporter: null,
          fromEmail: resolved.fromEmail,
          replyToEmail: resolved.replyToEmail,
          userName: companyUserName,
          configured: true,
          provider: 'zoho-zeptomail',
          zohoApiKey: companyConfig.zohoZeptomailApiKey,
          zohoApiUrl: companyConfig.zohoZeptomailApiUrl || 'https://api.zeptomail.com/',
          userId: userId,
          configSource: 'company',
          sendAsUser: resolved.sendAsUser,
        };
      }

      // Use company's SMTP settings (fallback)
      if (companyConfig.smtpEmail && companyConfig.smtpAppPassword) {
        let companyTransporter = createSmtpTransporter(companyConfig);
        return {
          transporter: companyTransporter,
          fromEmail: companyConfig.smtpEmail,
          replyToEmail: companyUserEmail || companyConfig.smtpEmail,
          userName: companyUserName,
          configured: true,
          provider: 'smtp',
          configSource: 'company'
        };
      }
    }

    // ❌ PRIORITY 3: Platform default SMTP/Gmail from .env (OTP, support tickets, freelancers)
    // Used when Zepto/company mailbox is unavailable so product mail still leaves.
    if (hints.system || !userId) {
      const envFrom = (
        process.env.FROM_EMAIL
        || process.env.GMAIL_EMAIL
        || process.env.SMTP_USER
        || process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL
        || process.env.ZEPTOMAIL_FROM_EMAIL
        || ''
      ).trim();
      if (defaultTransporter && envFrom) {
        return {
          transporter: defaultTransporter,
          fromEmail: envFrom,
          replyToEmail: (hints.replyToEmail || envFrom).trim(),
          userName: PLATFORM_FROM_NAME,
          configured: true,
          provider: 'smtp',
          configSource: 'env-default',
          sendAsUser: false,
        };
      }
    }

    // ❌ No configuration found (env Zoho not set, no user config, no company config)
    return {
      transporter: null,
      fromEmail: null,
      replyToEmail: null,
      userName: PLATFORM_FROM_NAME,
      configured: false,
      provider: null,
      configSource: 'none'
    };
  } catch (err) {
    logger.error('getUserTransporter error:', err.message);
    return { transporter: null, fromEmail: null, replyToEmail: null, userName: PLATFORM_FROM_NAME, configured: false, provider: null, configSource: 'error' };
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
  const { cc, bcc, senderName, senderEmail, userId, organizationId, system } = options;
  const recipientEmail = Array.isArray(to) ? to[0] : to;
  
  const {
    transporter: activeTransporter,
    fromEmail: transporterFrom,
    replyToEmail: transporterReplyTo,
    userName,
    configured,
    provider,
    zohoApiKey,
    zohoApiUrl,
  } = await getUserTransporter(userId, {
    recipientEmail,
    organizationId,
    senderName,
    system,
    replyToEmail: senderEmail,
  });

  // Candidate mail: recruiter work address. System mail (OTP / reset / invite): noreply@org-domain.
  let fromEmail = (transporterFrom || '').trim();
  let replyToEmail = (transporterReplyTo || senderEmail || fromEmail || '').trim();
  
  if (!configured || !fromEmail) {
    throw new Error('EMAIL_NOT_CONFIGURED');
  }
  
  if (provider === 'zoho-zeptomail' && userId && !system) {
    const senderStatus = await canUserSendViaZepto(userId);
    if (!senderStatus.canSend) {
      const err = new Error(senderStatus.reason || 'USE_VERIFIED_DOMAIN');
      err.code = 'USE_VERIFIED_DOMAIN';
      throw err;
    }
    if (senderStatus.fromEmail) fromEmail = senderStatus.fromEmail;
    if (senderStatus.replyTo) replyToEmail = senderStatus.replyTo;
  }
  
  if (provider === 'zoho-zeptomail') {
    const zeptoResult = await sendViaZohoZeptomail(to, subject, htmlBody, textBody, {
      cc,
      bcc,
      senderName: senderName || userName,
      fromEmail,
      replyToEmail,
      zohoApiKey,
      zohoApiUrl,
      userId,
      trackOpens: options.trackOpens,
      trackClicks: options.trackClicks,
      clientReference: options.clientReference,
    });
    try {
      const { recordEmailSend } = require('./emailReportService');
      await recordEmailSend({
        organizationId,
        userId,
        channel: system ? 'system' : options.channel || 'transactional',
        provider: 'zeptomail',
        emailType: options.emailType || '',
        subject,
        fromEmail: zeptoResult.fromEmail || fromEmail,
        replyToEmail: zeptoResult.replyTo || replyToEmail,
        to: Array.isArray(to) ? to : [to],
        messageId: zeptoResult.messageId,
        requestId: zeptoResult.requestId,
        clientReference: zeptoResult.clientReference,
        status: 'accepted',
        providerRaw: { provider: 'zeptomail' },
      });
    } catch (_) { /* non-blocking */ }
    return zeptoResult;
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
    replyTo: replyToEmail,
    to: Array.isArray(to) ? to : [to],
    subject: subject,
    html: htmlBody,
    text: textBody || subject,
    headers: {
      'X-Mailer': 'Skillnix PCHR 1.0',
      'X-Priority': '3',
      'List-Unsubscribe': `<mailto:${replyToEmail}?subject=unsubscribe>`,
      'Precedence': 'bulk'
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
    logger.info(`✅ Email sent to ${Array.isArray(to) ? to.join(', ') : to} (from: ${fromEmail})`);
    if (cc) logger.info(`   CC: ${Array.isArray(cc) ? cc.join(', ') : cc}`);
    if (bcc) logger.info(`   BCC: ${Array.isArray(bcc) ? bcc.join(', ') : bcc}`);
    const smtpResult = {
      success: true,
      email: to,
      messageId: info.messageId,
      fromEmail,
      replyTo: replyToEmail,
      provider: 'smtp',
    };
    try {
      const { recordEmailSend } = require('./emailReportService');
      await recordEmailSend({
        organizationId,
        userId,
        channel: system ? 'system' : 'transactional',
        provider: 'smtp',
        emailType: options.emailType || '',
        subject,
        fromEmail,
        replyToEmail,
        to: Array.isArray(to) ? to : [to],
        messageId: info.messageId,
        status: 'sent',
      });
    } catch (_) { /* non-blocking */ }
    return smtpResult;
  } catch (error) {
    logger.error('❌ Email Error:', {
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

const { buildQuickEmailContent } = require('./quickEmailContent');

// Interview invitation email
const sendInterviewEmail = async (email, candidateName, position, options = {}) => {
  const content = buildQuickEmailContent({
    emailType: 'interview',
    name: candidateName,
    position,
    customMessage: options.customMessage || '',
    senderName: options.senderName || 'HR Team',
    brand: options.brand || null,
    subscribeUrl: options.subscribeUrl || '',
  });
  return await sendEmail(email, content.subject, content.html, content.text, options);
};

// Rejection email
const sendRejectionEmail = async (email, candidateName, position, options = {}) => {
  const content = buildQuickEmailContent({
    emailType: 'rejection',
    name: candidateName,
    position,
    customMessage: options.customMessage || '',
    senderName: options.senderName || 'HR Team',
    brand: options.brand || null,
    subscribeUrl: options.subscribeUrl || '',
  });
  return await sendEmail(email, content.subject, content.html, content.text, options);
};

// Document request email
const sendDocumentEmail = async (email, candidateName, position, options = {}) => {
  const content = buildQuickEmailContent({
    emailType: 'document',
    name: candidateName,
    position,
    customMessage: options.customMessage || '',
    senderName: options.senderName || 'HR Team',
    brand: options.brand || null,
    subscribeUrl: options.subscribeUrl || '',
  });
  return await sendEmail(email, content.subject, content.html, content.text, options);
};

// Onboarding email
const sendOnboardingEmail = async (email, candidateName, position, department, joiningDate, options = {}) => {
  const content = buildQuickEmailContent({
    emailType: 'onboarding',
    name: candidateName,
    position,
    department,
    joiningDate,
    customMessage: options.customMessage || '',
    senderName: options.senderName || 'HR Team',
    brand: options.brand || null,
    subscribeUrl: options.subscribeUrl || '',
  });
  return await sendEmail(email, content.subject, content.html, content.text, options);
};

// Custom email
const sendCustomEmail = async (email, subject, customMessage, options = {}) => {
  const content = buildQuickEmailContent({
    emailType: 'custom',
    name: options.candidateName || 'Candidate',
    customMessage,
    senderName: options.senderName || 'HR Team',
    subject,
    brand: options.brand || null,
    subscribeUrl: options.subscribeUrl || '',
  });
  return await sendEmail(email, subject || content.subject, content.html, content.text, options);
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
  logger.info(`📊 Bulk Email Results: ${successCount}/${results.length} sent successfully`);
  
  return results;
};

// Check if a user has email configured (for pre-flight checks)
// ✅ Now checks BOTH user personal config AND company-wide config
const checkUserEmailConfigured = async (userId) => {
  try {
    const envKey = (process.env.ZOHO_ZEPTOMAIL_API_KEY || process.env.ZEPTOMAIL_API_KEY || '').trim();
    const envFrom = (process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL || process.env.ZEPTOMAIL_FROM_EMAIL || '').trim();
    const envConfigured = !!(envKey && envFrom);

    const User = mongoose.model('User');
    const user = userId ? await User.findById(userId).select('emailSettings role') : null;

    // Freelancers: native mail app only — never count as in-app / Zepto configured.
    if (user && String(user.role) === 'freelancer') {
      return false;
    }

    // PRIORITY 0: .env Zoho ZeptoMail — always available for non-freelancers
    if (envConfigured) return true;

    if (!userId) return false;

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
  const from = (process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL || process.env.ZEPTOMAIL_FROM_EMAIL || '').trim();
  return emailDomain(from);
};

/**
 * Get verified sender config for a user (picks the matching Zepto mailbox).
 */
const getVerifiedZeptoConfig = async (userId = null) => {
  let userEmail = '';
  let organizationId = null;
  if (userId) {
    try {
      const User = mongoose.model('User');
      const user = await User.findById(userId).select('email organizationId').lean();
      userEmail = user?.email ? String(user.email).trim().toLowerCase() : '';
      organizationId = user?.organizationId || null;
    } catch (_) { /* ignore */ }
  }

  const mailbox = await resolveZeptoMailbox({ userEmail, organizationId });
  if (mailbox?.fromEmail && mailbox?.apiKey) {
    return {
      fromEmail: mailbox.fromEmail,
      apiKey: mailbox.apiKey,
      apiUrl: mailbox.apiUrl,
      domain: emailDomain(mailbox.fromEmail),
      allowedDomains: mailbox.allowedFromDomains || [],
      source: 'env',
      mailboxId: mailbox.id,
    };
  }

  try {
    const CompanyEmailConfig = mongoose.model('CompanyEmailConfig');
    const companyConfig = await CompanyEmailConfig.findOne({ companyId: 'default-company' });
    if (companyConfig?.isConfigured && companyConfig.primaryProvider === 'zoho-zeptomail') {
      const fromEmail = (companyConfig.zohoZeptomailFromEmail || '').trim();
      const apiKey = (companyConfig.zohoZeptomailApiKey || '').trim();
      if (fromEmail && fromEmail.includes('@') && apiKey) {
        return {
          fromEmail,
          apiKey,
          apiUrl: companyConfig.zohoZeptomailApiUrl || 'https://api.zeptomail.in/',
          domain: emailDomain(fromEmail),
          allowedDomains: getZeptoAllowedFromDomains(fromEmail),
          source: 'company',
        };
      }
    }
  } catch (_) { /* ignore */ }
  return { fromEmail: '', apiKey: '', domain: '', allowedDomains: [], source: '' };
};

const canUserSendViaZepto = async (userId) => {
  if (!userId) return { canSend: false, reason: 'Not logged in', verifiedDomain: '' };
  const {
    domain: verifiedDomain,
    apiKey,
    fromEmail: agentFrom,
    allowedDomains = [],
    source,
  } = await getVerifiedZeptoConfig(userId);
  if (!verifiedDomain) return { canSend: false, reason: 'No verified sender configured', verifiedDomain: '' };
  if (!apiKey) return { canSend: false, reason: 'ZeptoMail not configured', verifiedDomain };

  try {
    const User = mongoose.model('User');
    const user = await User.findById(userId).select('email name');
    const userEmail = (user?.email || '').trim().toLowerCase();
    const displayName = (user?.name || userEmail || 'Recruiter').trim();

    if (!userEmail || !userEmail.includes('@')) {
      return {
        canSend: false,
        reason: 'Your account needs a valid work email to send candidate mail.',
        verifiedDomain,
      };
    }

    const resolved = resolveEnterpriseFrom({
      agentFrom,
      userEmail,
      allowedFromDomains: allowedDomains,
    });
    const canSend = true;
    const domainsHint = (allowedDomains || []).join(', ') || verifiedDomain;

    return {
      canSend,
      verifiedDomain,
      source,
      fromEmail: resolved.fromEmail,
      replyTo: resolved.replyToEmail,
      displayName,
      sendAsUser: resolved.sendAsUser,
      reason: resolved.sendAsUser
        ? ''
        : `Emails send from ${agentFrom} (verified sender). Replies go to ${userEmail}.`,
      hint: resolved.sendAsUser
        ? ''
        : `Verified From domains for this mailbox: ${domainsHint}.`,
    };
  } catch {
    return { canSend: false, reason: 'Unable to verify sender', verifiedDomain };
  }
};

/**
 * Queue email when Redis is up; otherwise send inline.
 * Prefer for invites / notifications where the HTTP response should not block on SMTP.
 */
const sendEmailQueued = async (to, subject, htmlBody, textBody, options = {}) => {
  const { enqueueEmail } = require('../jobs/queue');
  return enqueueEmail({
    to,
    subject,
    html: htmlBody,
    text: textBody,
    meta: options,
  });
};

module.exports = {
  sendEmail,
  sendEmailQueued,
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
  resolveSystemFromAddress,
  getVerifiedZeptoDomain
};
