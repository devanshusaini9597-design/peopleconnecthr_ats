const logger = require('../utils/logger');
const axios = require('axios');
const mongoose = require('mongoose');
const { storeCampaignHtml } = require('./campaignContentStore');

/**
 * Zoho Campaigns — OAuth2 or API key (Zoho-zapikey)
 * India: accounts.zoho.in, API: https://campaigns.zoho.in/api/v1.1
 *
 * sendMarketingEmail:
 *  1) subscribe recipients to ZOHO_CAMPAIGNS_LIST_KEY (master list)
 *  2) create a private temp list with only those recipients (so we do not blast the whole list)
 *  3) host HTML at a public content_url Zoho can fetch
 *  4) createCampaign + sendcampaign
 */

const TOKEN_URL = process.env.ZOHO_CAMPAIGNS_ACCOUNTS_URL || 'https://accounts.zoho.in/oauth/v2/token';

const getClientId = () => (process.env.ZOHO_CAMPAIGNS_CLIENT_ID || '').trim();
const getClientSecret = () => (process.env.ZOHO_CAMPAIGNS_CLIENT_SECRET || '').trim();
const getRefreshToken = () => (process.env.ZOHO_CAMPAIGNS_REFRESH_TOKEN || '').trim();
const getApiKey = () => (process.env.ZOHO_CAMPAIGNS_API_KEY || '').trim();
const getBaseUrl = () => {
  const url = (process.env.ZOHO_CAMPAIGNS_BASE_URL || 'https://campaigns.zoho.in/api/v1.1').trim();
  return url.endsWith('/') ? url : url + '/';
};
const getFromEmail = () =>
  (process.env.ZOHO_CAMPAIGNS_FROM_EMAIL || process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL || process.env.ZEPTOMAIL_FROM_EMAIL || '').trim();
const getTopicId = () => (process.env.ZOHO_CAMPAIGNS_TOPIC_ID || '').trim();

const runtimeSettings = (settings) => ({
  clientId: (settings?.clientId || getClientId()).trim(),
  clientSecret: (settings?.clientSecret || getClientSecret()).trim(),
  refreshToken: (settings?.refreshToken || getRefreshToken()).trim(),
  apiKey: (settings?.apiKey || getApiKey()).trim(),
  baseUrl: (settings?.baseUrl || getBaseUrl()).trim(),
  accountsUrl: (settings?.accountsUrl || TOKEN_URL).trim(),
  topicId: (settings?.topicId || getTopicId()).trim(),
  fromEmail: (settings?.fromEmail || getFromEmail()).trim(),
  listKey: (settings?.listKey || (process.env.ZOHO_CAMPAIGNS_LIST_KEY || '').trim()).trim(),
});

let cachedTopicId = null;
const tokenCache = new Map(); // key -> { token, expiry }

/**
 * Newer Zoho Campaigns orgs require topicId on createCampaign (error 903 without it).
 * Resolve from settings/env or GET /topics (first topic).
 */
const resolveTopicId = async (settings = null) => {
  const s = runtimeSettings(settings);
  if (s.topicId) {
    cachedTopicId = s.topicId;
    return s.topicId;
  }
  if (cachedTopicId) return cachedTopicId;

  let res;
  try {
    res = await campaignsRequest('GET', 'topics', { from_index: 0, range: 50 }, settings);
  } catch (err) {
    try {
      res = await campaignsRequest(
        'GET',
        'topics',
        {
          details: '{from_index:0,range:50}',
        },
        settings
      );
    } catch (err2) {
      const e = new Error(`Zoho Campaigns topics lookup failed: ${err2.message || err.message}`);
      e.code = 'CAMPAIGNS_TOPIC';
      throw e;
    }
  }

  const details = res?.topicDetails || res?.topics || res?.response?.topicDetails || [];
  const first = Array.isArray(details) ? details[0] : null;
  const topicId = String(first?.topicId || first?.topic_id || '').trim();
  if (!topicId) {
    const err = new Error(
      'Zoho Campaigns requires a topicId but none were found. Create a Topic in Zoho Campaigns (Contacts → Topics) or set ZOHO_CAMPAIGNS_TOPIC_ID.'
    );
    err.code = 'CAMPAIGNS_TOPIC';
    err.displayMessage =
      'Create a Topic in Zoho Campaigns (Contacts → Topics), or set ZOHO_CAMPAIGNS_TOPIC_ID on the backend.';
    err.zohoData = res;
    throw err;
  }

  cachedTopicId = topicId;
  logger.info({ topicId }, '[Campaigns] Using Zoho topicId');
  return topicId;
};

const emailDomain = (email) => {
  const m = String(email || '')
    .trim()
    .toLowerCase()
    .match(/@([^@\s>]+)/);
  return m ? m[1] : '';
};

/** Domains allowed as Zoho Campaigns From (work domains only — not Gmail). */
const allowedCampaignFromDomains = () => {
  const defaults = [
    'skillnixrecruitment.com',
    'skillnix.com',
    'peopleconnecthr.com',
    'devlumiq.com',
  ];
  const fromEnv = String(
    process.env.ZOHO_CAMPAIGNS_ALLOWED_FROM_DOMAINS || process.env.ENTERPRISE_ORG_DOMAINS || ''
  )
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...defaults, ...fromEnv])];
};

const isAllowedCampaignFrom = (email) => {
  const d = emailDomain(email);
  return Boolean(d && allowedCampaignFromDomains().includes(d));
};

/**
 * Optional per-domain default From:
 * ZOHO_CAMPAIGNS_FROM_SKILLNIXRECRUITMENT_COM=alert@skillnixrecruitment.com
 * or MAIL_PROFILE_*_FROM for the matching brand.
 */
const mappedFromForDomain = (domain) => {
  const d = String(domain || '').toLowerCase();
  if (!d) return '';
  const envKey = `ZOHO_CAMPAIGNS_FROM_${d.replace(/\./g, '_').toUpperCase()}`;
  const direct = (process.env[envKey] || '').trim();
  if (direct) return direct;
  if (d === 'skillnixrecruitment.com') {
    return (
      process.env.MAIL_PROFILE_SKILLNIXRECRUITMENT_FROM ||
      'alert@skillnixrecruitment.com'
    ).trim();
  }
  if (d === 'skillnix.com') {
    return (
      process.env.MAIL_PROFILE_SKILLNIXRECRUITMENT_FROM ||
      process.env.MAIL_PROFILE_SKILLNIX_FROM ||
      ''
    ).trim();
  }
  if (d === 'peopleconnecthr.com') {
    return (process.env.MAIL_PROFILE_PEOPLECONNECTHR_FROM || '').trim();
  }
  return '';
};

/**
 * Optional allowlist of Zoho Campaigns Manage Senders (max ~5).
 * ZOHO_CAMPAIGNS_VERIFIED_SENDERS=asmita@...,sarbjeet@...,alert@...
 * When set: login must be in this list or send fails with a clear error (no alert@ fallback).
 */
const verifiedCampaignSenders = () => {
  const raw = String(process.env.ZOHO_CAMPAIGNS_VERIFIED_SENDERS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set(raw);
};

/**
 * Orgs that use Skillnix-style verified-sender rules (login must be in Manage Senders).
 * Only skillnixrecruitment.com by default — not applied to every org.
 */
const sharedCampaignFromOrgDomains = () => {
  const defaults = ['skillnixrecruitment.com'];
  const fromEnv = String(process.env.ZOHO_CAMPAIGNS_SHARED_FROM_ORG_DOMAINS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set(fromEnv.length ? fromEnv : defaults);
};

const sharedCampaignFromAddress = (domain) => {
  const d = String(domain || '').toLowerCase();
  if (!d || !sharedCampaignFromOrgDomains().has(d)) return '';
  return (
    mappedFromForDomain(d) ||
    `alert@${d}`
  ).trim().toLowerCase();
};

const uniqueAllowedFroms = (emails) => {
  const seen = new Set();
  const out = [];
  for (const raw of emails || []) {
    const email = String(raw || '').trim().toLowerCase();
    if (!email || seen.has(email) || !isAllowedCampaignFrom(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
};

/**
 * Load org domain fields for campaign From scoping.
 */
const getOrgMailDomains = async (organizationId) => {
  if (!organizationId) return { orgDomain: '', allowedDomains: [] };
  try {
    const Organization = mongoose.model('Organization');
    const org = await Organization.findById(organizationId)
      .select('domain allowedDomains')
      .lean();
    const orgDomain = emailDomain(org?.domain) || String(org?.domain || '').trim().toLowerCase();
    const allowedDomains = (org?.allowedDomains || [])
      .map((d) => String(d || '').trim().toLowerCase())
      .filter(Boolean);
    return { orgDomain, allowedDomains };
  } catch (_) {
    return { orgDomain: '', allowedDomains: [] };
  }
};

/**
 * Ordered From candidates for Zoho Campaigns.
 * Skillnix (strictVerified): login only — must match a Zoho Manage Senders address.
 * Other orgs: login work email only.
 */
const collectCampaignFromCandidates = ({ fromEmail, userEmail, sharedFrom } = {}) => {
  // Skillnix and others: send only as the login work email (no alert@ auto-fallback)
  void sharedFrom;
  return uniqueAllowedFroms([fromEmail, userEmail]);
};

const notVerifiedSenderError = (email) => {
  const err = new Error(
    `"${email}" is not a verified sender in Zoho Campaigns. Add and verify this address under Settings → Deliverability → Manage Senders, then retry.`
  );
  err.code = 'CAMPAIGNS_FROM_UNVERIFIED';
  err.displayMessage =
    `"${email}" is not verified in Zoho Campaigns. ` +
    'Only verified Manage Senders can send marketing campaigns. ' +
    'Go to Zoho Campaigns → Settings → Deliverability → Manage Senders, add this login, verify it, then try again.';
  return err;
};

/**
 * Resolve campaign From / Reply-To.
 *
 * Skillnix: From + Reply-To = login only when that login is a verified Zoho sender.
 * If not verified → clear error (no silent fallback to alert@).
 * Other orgs: From = login work email.
 */
const resolveCampaignFrom = async ({
  fromEmail,
  senderName,
  userId,
  settings,
  organizationId,
  replyToEmail,
} = {}) => {
  let userEmail = '';
  let userName = '';
  let userOrgId = organizationId || '';
  if (userId) {
    try {
      const User = mongoose.model('User');
      const user = await User.findById(userId).select('email name organizationId');
      userEmail = (user?.email || '').trim();
      userName = (user?.name || '').trim();
      if (!userOrgId) userOrgId = user?.organizationId || '';
    } catch (_) {}
  }

  const { orgDomain, allowedDomains } = await getOrgMailDomains(userOrgId);
  const domainCandidates = [orgDomain, ...allowedDomains, emailDomain(userEmail)].filter(Boolean);
  let sharedFrom = '';
  for (const d of domainCandidates) {
    sharedFrom = sharedCampaignFromAddress(d);
    if (sharedFrom) break;
  }
  const orgMatch = [orgDomain, ...allowedDomains].some((d) => sharedCampaignFromOrgDomains().has(d));
  if (!orgMatch) sharedFrom = '';

  const fromCandidates = collectCampaignFromCandidates({
    fromEmail,
    userEmail,
    sharedFrom,
  });

  if (!fromCandidates.length) {
    const err = new Error(
      'No work-domain From address for Zoho Campaigns. Marketing must send from a company email (e.g. @skillnixrecruitment.com), not Gmail.'
    );
    err.code = 'CAMPAIGNS_FROM_EMAIL';
    err.displayMessage =
      'Marketing From must be your company login email. Public emails (Gmail, etc.) cannot be used as campaign senders.';
    throw err;
  }

  const primary = fromCandidates[0];
  const verified = verifiedCampaignSenders();
  // Skillnix (or any org with allowlist): login must be in Manage Senders list
  if ((sharedFrom || verified.size) && verified.size && !verified.has(primary)) {
    throw notVerifiedSenderError(primary);
  }

  return {
    email: primary,
    fromCandidates: [primary],
    replyTo: primary,
    contactEmail: uniqueAllowedFroms([replyToEmail, userEmail, fromEmail])[0] || primary,
    name: (senderName || userName || 'HR Team').trim() || 'HR Team',
    sharedFrom: Boolean(sharedFrom),
    strictVerified: Boolean(sharedFrom || verified.size),
  };
};

const getAccessToken = async (settings = null) => {
  const s = runtimeSettings(settings);
  const cacheKey = `${s.clientId}:${s.refreshToken.slice(0, 12)}`;
  const now = Date.now();
  const cached = tokenCache.get(cacheKey);
  if (cached?.token && cached.expiry > now + 60000) return cached.token;

  if (!s.clientId || !s.clientSecret || !s.refreshToken) throw new Error('CAMPAIGNS_NOT_CONFIGURED');

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: s.clientId,
    client_secret: s.clientSecret,
    refresh_token: s.refreshToken,
  });

  const response = await axios.post(s.accountsUrl || TOKEN_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15000,
  });

  const data = response.data;
  if (!data.access_token) throw new Error('Zoho Campaigns: No access_token in refresh response');

  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiry: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  });
  logger.info('[Campaigns] OAuth access token refreshed');
  return data.access_token;
};

const isCampaignsConfigured = (settings = null) => {
  const s = runtimeSettings(settings);
  const hasOAuth = !!(s.clientId && s.clientSecret && s.refreshToken);
  const hasApiKey = !!s.apiKey;
  return hasOAuth || hasApiKey;
};

const campaignsRequest = async (method, path, bodyOrParams = null, settings = null) => {
  const s = runtimeSettings(settings);
  const baseUrl = s.baseUrl.endsWith('/') ? s.baseUrl : `${s.baseUrl}/`;
  let url = path.startsWith('http') ? path : `${baseUrl.replace(/\/?$/, '')}/${path.replace(/^\//, '')}`;
  let authHeader;
  if (s.apiKey) {
    authHeader = s.apiKey.toLowerCase().startsWith('zoho-zapikey') ? s.apiKey : `Zoho-zapikey ${s.apiKey}`;
  } else {
    const token = await getAccessToken(settings);
    authHeader = `Zoho-oauthtoken ${token}`;
  }
  const config = {
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 60000,
    validateStatus: () => true,
  };

  // Zoho Campaigns expects params once. Putting the same keys in both query and body
  // returns: "Multiple key entries are not supported."
  if (bodyOrParams && method === 'POST') {
    const queryString =
      typeof bodyOrParams === 'string' ? bodyOrParams : new URLSearchParams(bodyOrParams).toString();
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}${queryString}`;
  }
  if (bodyOrParams && method === 'GET') config.params = bodyOrParams;

  const res = await axios({ method, url, ...config });
  return res.data;
};

const zohoCode = (data) => String(data?.code ?? data?.response?.code ?? '').trim();

const zohoMessage = (data) =>
  data?.message ||
  data?.response?.message ||
  data?.status ||
  (typeof data === 'string' ? data : JSON.stringify(data || {}));

const assertZohoOk = (data, context) => {
  const code = zohoCode(data);
  // Zoho mixes "0" and "200" for success across endpoints
  if (code && code !== '0' && code !== '200') {
    const err = new Error(`Zoho Campaigns ${context}: ${zohoMessage(data)} (code ${code})`);
    err.code = 'CAMPAIGNS_API';
    err.zohoCode = code;
    err.zohoData = data;
    if (/scope|permission|INVALID_OAUTHTOKEN|INVALID_SCOPE/i.test(zohoMessage(data))) {
      err.code = 'CAMPAIGNS_SCOPE';
      err.displayMessage =
        'Zoho Campaigns OAuth scopes are missing campaign create/send. Regenerate Self Client code with ZohoCampaigns.campaign.CREATE,ZohoCampaigns.campaign.UPDATE (plus contact scopes), exchange for a new refresh token, and update ZOHO_CAMPAIGNS_REFRESH_TOKEN.';
    }
    throw err;
  }
  return data;
};

function emailApiBase(settings = null) {
  const s = runtimeSettings(settings);
  // https://campaigns.zoho.in/api/v1.1 → https://campaigns.zoho.in/emailapi/v2
  try {
    const u = new URL(s.baseUrl.replace(/\/api\/v1\.1\/?$/i, ''));
    return `${u.origin}/emailapi/v2`;
  } catch (_) {
    return 'https://campaigns.zoho.in/emailapi/v2';
  }
}

/**
 * Remove email from Zoho Email API suppression list (often overlaps Do-Not-Mail).
 * Safe no-op if the address is not suppressed or the API scope is unavailable.
 */
const removeFromSuppressionList = async (email, settings = null) => {
  const emailNorm = String(email || '').trim().toLowerCase();
  if (!emailNorm) return { attempted: false };
  const s = runtimeSettings(settings);
  let authHeader;
  if (s.apiKey) {
    authHeader = s.apiKey.toLowerCase().startsWith('zoho-zapikey') ? s.apiKey : `Zoho-zapikey ${s.apiKey}`;
  } else {
    const token = await getAccessToken(settings);
    authHeader = `Zoho-oauthtoken ${token}`;
  }
  const url = `${emailApiBase(settings)}/recipients/suppression`;
  try {
    const res = await axios({
      method: 'DELETE',
      url,
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      data: { recipients: [{ address: emailNorm }] },
      timeout: 30000,
      validateStatus: () => true,
    });
    const deleted = res.data?.suppressions_deleted || [];
    const ignored = res.data?.suppressions_ignored || [];
    logger.info(
      {
        email: emailNorm,
        http: res.status,
        deleted: deleted.length,
        ignored: ignored.length,
        code: res.data?.response?.code || res.data?.code,
      },
      '[Campaigns] suppression clear'
    );
    return {
      attempted: true,
      ok: res.status >= 200 && res.status < 300,
      deleted,
      ignored,
      data: res.data,
    };
  } catch (err) {
    logger.warn({ email: emailNorm, err: err.message }, '[Campaigns] suppression clear failed');
    return { attempted: true, ok: false, error: err.message };
  }
};

function isDoNotMailError(code, msg) {
  return String(code) === '2006' || /do-?not-?mail|donotmail|suppression/i.test(String(msg || ''));
}

/**
 * Enable Zoho signup form on a list (public). Required so previously
 * Do-Not-Mail / self-unsubscribed contacts can re-opt-in via confirmation email —
 * Zoho blocks admin delete and API force-resubscribe for those contacts.
 */
const enableListSignupForm = async (listKey, listName = 'ATS Subscribe', settings = null) => {
  const key = String(listKey || '').trim();
  if (!key) return { ok: false };
  try {
    const res = await campaignsRequest(
      'POST',
      'updatelistdetails',
      new URLSearchParams({
        resfmt: 'JSON',
        listkey: key,
        newlistname: String(listName || 'ATS Subscribe').slice(0, 100),
        signupform: 'public',
      }).toString(),
      settings
    );
    const code = String(res?.code ?? '').trim();
    const ok = !code || code === '0' || code === '200';
    logger.info({ listKeyPrefix: key.slice(0, 8), code, ok }, '[Campaigns] enable signup form');
    return { ok, data: res };
  } catch (err) {
    logger.warn({ err: err.message }, '[Campaigns] enable signup form failed');
    return { ok: false, error: err.message };
  }
};

const addContact = async (listKey, email, firstName = '', lastName = '', topicId = '', settings = null) => {
  const params = {
    resfmt: 'JSON',
    listkey: listKey,
    source: 'Skillnix ATS',
  };
  const tid = topicId || runtimeSettings(settings).topicId;
  if (tid) params.topic_id = tid;

  const runSubscribe = (extraFields = null) => {
    const contactinfo = {
      'Contact Email': email,
      'First Name': firstName || '',
      'Last Name': lastName || '',
      ...(extraFields || {}),
    };
    return campaignsRequest(
      'POST',
      'json/listsubscribe',
      new URLSearchParams({ ...params, contactinfo: JSON.stringify(contactinfo) }).toString(),
      settings
    );
  };

  let res = await runSubscribe();
  let code = String(res?.code ?? res?.status ?? '').trim();
  let msg = String(res?.message || res?.Message || res?.status_message || '');

  // Self-unsubscribed contacts sit on Zoho Do-Not-Mail. API cannot force-remove DNM;
  // Zoho requires the contact to complete a public signup form (double opt-in).
  if (isDoNotMailError(code, msg)) {
    logger.warn(
      { email, code, msg },
      '[Campaigns] listsubscribe blocked by Do-Not-Mail — attempting recovery'
    );
    await removeFromSuppressionList(email, settings);
    await enableListSignupForm(listKey, 'ATS Subscribe', settings);

    res = await runSubscribe();
    code = String(res?.code ?? res?.status ?? '').trim();
    msg = String(res?.message || res?.Message || res?.status_message || '');

    // Helps some "Manually Suppressed" contacts (not true self-DNM)
    if (isDoNotMailError(code, msg)) {
      try {
        res = await runSubscribe({ 'Subscription Type': 'Marketing' });
        code = String(res?.code ?? res?.status ?? '').trim();
        msg = String(res?.message || res?.Message || res?.status_message || '');
      } catch (e) {
        logger.warn({ err: e.message }, '[Campaigns] Marketing subscription-type retry failed');
      }
    }

    if (isDoNotMailError(code, msg)) {
      try {
        const bulkRes = await campaignsRequest(
          'POST',
          'addlistsubscribersinbulk',
          new URLSearchParams({
            resfmt: 'JSON',
            listkey: listKey,
            emailids: String(email).trim().toLowerCase(),
          }).toString(),
          settings
        );
        const bulkCode = String(bulkRes?.code ?? '').trim();
        const bulkMsg = String(bulkRes?.message || bulkRes?.Message || '');
        logger.info({ email, bulkCode, bulkMsg }, '[Campaigns] bulk re-add after DNM');
        if (
          !bulkCode ||
          bulkCode === '0' ||
          bulkCode === '200' ||
          /success|added|already/i.test(bulkMsg)
        ) {
          res = await runSubscribe();
          code = String(res?.code ?? res?.status ?? '').trim();
          msg = String(res?.message || res?.Message || res?.status_message || '');
        }
      } catch (e) {
        logger.warn({ err: e.message }, '[Campaigns] bulk re-add after DNM failed');
      }
    }
  }

  const ok =
    !code ||
    code === '0' ||
    code === '200' ||
    /already|exist|subscribed|duplicate/i.test(msg);
  if (!ok) {
    const err = new Error(`Zoho listsubscribe failed (${code}): ${msg || JSON.stringify(res)}`);
    err.code = 'CAMPAIGNS_API';
    err.zohoCode = code;
    err.zoho = res;
    if (isDoNotMailError(code, msg)) err.zohoBlocked = 'donotmail';
    throw err;
  }
  // Zoho often returns code 0 while the contact is only "pending" until they click confirm.
  const pendingConfirm = /confirmation email|needs to confirm|pending|opt-?in/i.test(msg);
  return { ...res, pendingConfirm, message: msg, code };
};

const removeContact = async (listKey, email, settings = null) => {
  const contactinfo = JSON.stringify({
    'Contact Email': email,
  });
  const res = await campaignsRequest(
    'POST',
    'json/listunsubscribe',
    new URLSearchParams({
      resfmt: 'JSON',
      listkey: listKey,
      contactinfo,
    }).toString(),
    settings
  );
  return res;
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function extractSubscriberCount(res) {
  if (!res || typeof res !== 'object') return 0;
  const candidates = [
    res.list_of_details,
    res.subscribers,
    res.result_of_subscribers,
    res.contacts,
    res.list_details?.contacts,
  ];
  for (const details of candidates) {
    if (Array.isArray(details) && details.length) return details.length;
    if (details && typeof details === 'object' && !Array.isArray(details)) {
      const keys = Object.keys(details);
      if (keys.length) return keys.length;
    }
  }
  const no =
    res?.list_details?.noofcontacts ||
    res?.noofcontacts ||
    res?.list_details?.[0]?.noofcontacts ||
    res?.list_details?.['noofcontacts'] ||
    0;
  return Number(no) || 0;
}

const countListContacts = async (listkey, status = 'active', settings = null) => {
  const res = await campaignsRequest(
    'GET',
    'getlistsubscribers',
    {
      resfmt: 'JSON',
      listkey,
      status,
      fromindex: '1',
      range: '100',
      sort: 'asc',
    },
    settings
  );
  const code = zohoCode(res);
  if (code && code !== '0' && code !== '200') return 0;
  return extractSubscriberCount(res);
};

const countActiveContacts = async (listkey, settings = null) =>
  countListContacts(listkey, 'active', settings);

const waitForActiveContacts = async (listkey, minCount, timeoutMs = 45000, settings = null) => {
  const started = Date.now();
  let last = 0;
  while (Date.now() - started < timeoutMs) {
    try {
      last = await countActiveContacts(listkey, settings);
      if (last >= minCount) return last;
      // "recent" sometimes appears before Zoho flips status to active
      const recent = await countListContacts(listkey, 'recent', settings);
      if (recent >= minCount) return recent;
    } catch (err) {
      logger.warn({ err: err.message }, '[Campaigns] getlistsubscribers poll failed');
    }
    await sleep(2500);
  }
  return last;
};

/**
 * Create a private mailing list containing only these emails (max 10 per Zoho call).
 * Then re-subscribe each contact and wait until Zoho reports active contacts
 * (avoids createCampaign error 6606 empty list).
 */
const createTempListWithContacts = async (emails, listName, settings = null) => {
  const unique = [...new Set(emails.map((e) => String(e || '').trim().toLowerCase()).filter(Boolean))];
  if (!unique.length) {
    const err = new Error('No valid recipient emails for Zoho Campaigns');
    err.code = 'CAMPAIGNS_NO_RECIPIENTS';
    throw err;
  }

  const firstBatch = unique.slice(0, 10);
  const createRes = await campaignsRequest(
    'POST',
    'addlistandcontacts',
    new URLSearchParams({
      resfmt: 'JSON',
      listname: listName,
      // private = signup form disabled → Zoho docs: contacts added without confirmation
      // (account-level Manage Opt-in can still force a confirmation email)
      signupform: 'private',
      mode: 'newlist',
      listdescription: 'ATS marketing send (auto)',
      emailids: firstBatch.join(','),
    }).toString(),
    settings
  );
  assertZohoOk(createRes, 'addlistandcontacts');
  const listkey = String(createRes.listkey || createRes.listKey || '').trim();
  if (!listkey) {
    const err = new Error(`Zoho Campaigns did not return listkey: ${zohoMessage(createRes)}`);
    err.code = 'CAMPAIGNS_API';
    err.zohoData = createRes;
    throw err;
  }

  const remaining = unique.slice(10);
  for (const batch of chunk(remaining, 10)) {
    const bulkRes = await campaignsRequest(
      'POST',
      'addlistsubscribersinbulk',
      new URLSearchParams({
        resfmt: 'JSON',
        listkey,
        emailids: batch.join(','),
      }).toString(),
      settings
    );
    assertZohoOk(bulkRes, 'addlistsubscribersinbulk');
  }

  // Newer Zoho orgs use Topics: contacts must join the topic or createCampaign returns 6606
  // even when Double opt-in is off and the list looks fine.
  let topicId = '';
  try {
    topicId = await resolveTopicId(settings);
  } catch (err) {
    logger.warn({ err: err.message }, '[Campaigns] topic resolve failed for temp list');
  }

  let pendingConfirmCount = 0;
  for (const email of unique) {
    try {
      const sub = await addContact(listkey, email, '', '', topicId, settings);
      if (sub?.pendingConfirm) pendingConfirmCount += 1;
    } catch (err) {
      logger.warn({ email, err: err.message }, '[Campaigns] temp listsubscribe failed');
    }
  }

  const active = await waitForActiveContacts(listkey, 1, 45000, settings);
  if (active < 1) {
    // Don't hard-fail here — getlistsubscribers is often slow/wrong while createCampaign
    // still works (especially with Double opt-in off). Caller falls back to Zepto on 6606.
    logger.warn(
      {
        listkeyPrefix: listkey.slice(0, 10),
        recipients: unique.length,
        pendingConfirmCount,
        topicId: topicId || null,
      },
      '[Campaigns] No active contacts reported yet — continuing to createCampaign anyway'
    );
  }

  return {
    listkey,
    listName,
    count: unique.length,
    active,
    pendingConfirm: pendingConfirmCount > 0,
    topicId: topicId || '',
  };
};

const isUnverifiedSenderError = (err) =>
  err?.code === 'CAMPAIGNS_FROM_UNVERIFIED' ||
  err?.zohoCode === '6610' ||
  /not verified/i.test(String(err?.message || ''));

const extractCampaignKey = (data) => {
  if (!data || typeof data !== 'object') return '';
  const direct = String(
    data.campaignKey ||
      data.campaignkey ||
      data.CampaignKey ||
      data.campaign_key ||
      data.response?.campaignKey ||
      data.response?.campaignkey ||
      ''
  ).trim();
  if (direct) return direct;

  const details = data['campaign-details'] || data.campaign_details || data.campaignDetails;
  if (Array.isArray(details) && details[0]) {
    const row = details[0];
    return String(row.campaign_key || row.campaignKey || row.campaignkey || row.key || '').trim();
  }
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    return String(details.campaign_key || details.campaignKey || '').trim();
  }
  // Clone sometimes returns campaign-details as a string blob
  if (typeof details === 'string') {
    const m = details.match(/campaign[_-]?key[=:\s]+([a-zA-Z0-9]+)/i);
    if (m) return m[1];
  }
  return '';
};

const readCampaignReplyTo = async (campaignKey, settings = null) => {
  try {
    const res = await campaignsRequest(
      'GET',
      'getcampaigndetails',
      {
        resfmt: 'JSON',
        campaignkey: String(campaignKey),
        campaigntype: 'normal',
      },
      settings
    );
    const details = res?.['campaign-details'] || res?.campaign_details || [];
    const row = Array.isArray(details) ? details[0] : details;
    return String(row?.reply_to || row?.replyTo || '')
      .trim()
      .toLowerCase();
  } catch (err) {
    logger.warn({ err: err.message, campaignKey }, '[Campaigns] getcampaigndetails failed');
    return '';
  }
};

const findNewestCampaignKeyByName = async (campaignName, settings = null) => {
  try {
    const res = await campaignsRequest(
      'GET',
      'recentcampaigns',
      {
        resfmt: 'JSON',
        sortorder: 'desc',
        fromindex: '1',
        range: '10',
      },
      settings
    );
    const list =
      res?.recent_campaigns ||
      res?.recentcampaigns ||
      res?.campaigns ||
      res?.['recent-campaigns'] ||
      [];
    const rows = Array.isArray(list) ? list : [];
    const want = String(campaignName || '').trim().toLowerCase();
    for (const row of rows) {
      const name = String(row?.campaign_name || row?.campaignname || row?.name || '').trim().toLowerCase();
      const key = String(row?.campaign_key || row?.campaignKey || row?.campaignkey || '').trim();
      if (key && (!want || name === want || name.includes(want.slice(0, 40)))) return key;
    }
    if (rows[0]) {
      return String(rows[0].campaign_key || rows[0].campaignKey || rows[0].campaignkey || '').trim();
    }
  } catch (err) {
    logger.warn({ err: err.message }, '[Campaigns] recentcampaigns lookup failed');
  }
  return '';
};

/**
 * createCampaign ignores reply_to (Zoho defaults Reply-To = From).
 * Clone supports reply_to — then we verify with getcampaigndetails.
 */
const cloneCampaignWithReplyTo = async ({
  oldCampaignKey,
  campaignName,
  subject,
  fromEmail,
  fromName,
  replyTo,
  settings = null,
}) => {
  const info = {
    campaignname: campaignName,
    subject,
    from_name: fromName || 'HR Team',
    from_add: fromEmail,
    reply_to: replyTo,
    oldcampaignkey: String(oldCampaignKey),
    encode_type: 'UTF-8',
  };

  let res;
  try {
    res = await campaignsRequest(
      'POST',
      'json/clonecampaign',
      new URLSearchParams({
        resfmt: 'JSON',
        campaigninfo: JSON.stringify(info),
      }).toString(),
      settings
    );
    assertZohoOk(res, 'clonecampaign');
  } catch (jsonErr) {
    // XML variant (some India DC accounts prefer it)
    const xml = `<xml>
      <fl val="campaignname">${String(campaignName).replace(/[<>&]/g, '')}</fl>
      <fl val="subject">${String(subject).replace(/[<>&]/g, '')}</fl>
      <fl val="from_name">${String(fromName || 'HR Team').replace(/[<>&]/g, '')}</fl>
      <fl val="from_add">${String(fromEmail).replace(/[<>&]/g, '')}</fl>
      <fl val="reply_to">${String(replyTo).replace(/[<>&]/g, '')}</fl>
      <fl val="oldcampaignkey">${String(oldCampaignKey).replace(/[<>&]/g, '')}</fl>
      <fl val="encode_type">UTF-8</fl>
    </xml>`;
    res = await campaignsRequest(
      'POST',
      'xml/clonecampaign',
      new URLSearchParams({
        resfmt: 'JSON',
        campaigninfo: xml,
      }).toString(),
      settings
    );
    assertZohoOk(res, 'xml/clonecampaign');
  }

  let key = extractCampaignKey(res);
  if (!key) {
    key = await findNewestCampaignKeyByName(campaignName, settings);
  }
  if (!key) {
    const err = new Error(`Zoho clonecampaign missing campaign key: ${zohoMessage(res)}`);
    err.code = 'CAMPAIGNS_API';
    err.zohoData = res;
    throw err;
  }

  const appliedReply = await readCampaignReplyTo(key, settings);
  if (appliedReply && appliedReply === String(replyTo).trim().toLowerCase()) {
    return { campaignKey: key, raw: res, replyToApplied: true };
  }
  // Clone may succeed but still leave reply_to = from
  return { campaignKey: key, raw: res, replyToApplied: false, actualReplyTo: appliedReply };
};

const createAndSendCampaignOnce = async ({
  campaignName,
  subject,
  htmlBody,
  fromEmail,
  fromName,
  replyTo,
  listKey,
  settings = null,
  publicUrl,
  topicId,
}) => {
  const listDetails = JSON.stringify({ [listKey]: [] });
  const params = {
    resfmt: 'JSON',
    campaignname: campaignName,
    from_email: fromEmail,
    from_name: fromName || 'Skillnix ATS',
    subject,
    content_url: publicUrl,
    list_details: listDetails,
    topicId,
  };
  const reply = String(replyTo || '').trim();
  if (reply && reply.toLowerCase() !== String(fromEmail).toLowerCase()) {
    params.reply_to = reply;
    params.replyto = reply;
  }

  const createRes = await campaignsRequest(
    'POST',
    'createCampaign',
    new URLSearchParams(params).toString(),
    settings
  );
  try {
    assertZohoOk(createRes, 'createCampaign');
  } catch (e) {
    if (isUnverifiedSenderError(e)) {
      e.code = 'CAMPAIGNS_FROM_UNVERIFIED';
      e.displayMessage = `Zoho Campaigns: "${fromEmail}" is not a verified sender mailbox. Domain authentication is not enough — add this address under Settings → Sender Address.`;
    }
    if (e.zohoCode === '6606' || /does not contain any contacts|No lists selected/i.test(e.message || '')) {
      e.code = 'CAMPAIGNS_LIST_EMPTY';
      e.displayMessage =
        'Zoho says the mailing list has no active contacts (often pending opt-in confirmation). Confirm the subscription email or turn off forced opt-in under Settings → Manage Opt-in.';
    }
    if (e.zohoCode === '903' || /Mandatory Fields/i.test(e.message || '')) {
      e.code = 'CAMPAIGNS_MANDATORY';
      e.displayMessage =
        'Zoho createCampaign missing a required field (often topicId). Ensure Contacts → Topics exists, or set ZOHO_CAMPAIGNS_TOPIC_ID.';
    }
    throw e;
  }
  let campaignKey = extractCampaignKey(createRes);
  if (!campaignKey) {
    const err = new Error(`Zoho Campaigns createCampaign missing campaignKey: ${zohoMessage(createRes)}`);
    err.code = 'CAMPAIGNS_API';
    err.zohoData = createRes;
    throw err;
  }

  let replyToApplied =
    !reply || reply.toLowerCase() === String(fromEmail).toLowerCase();
  let sendKey = campaignKey;

  // From = alert@ (verified). Reply-To = login via clone when different.
  if (!replyToApplied) {
    try {
      const cloned = await cloneCampaignWithReplyTo({
        oldCampaignKey: campaignKey,
        campaignName,
        subject,
        fromEmail,
        fromName,
        replyTo: reply,
        settings,
      });
      if (cloned.replyToApplied && cloned.campaignKey) {
        sendKey = cloned.campaignKey;
        replyToApplied = true;
        logger.info(
          { from: fromEmail, replyTo: reply, campaignKey: sendKey },
          '[Campaigns] Reply-To set to login via clone'
        );
      } else {
        logger.warn(
          {
            from: fromEmail,
            replyTo: reply,
            actualReplyTo: cloned.actualReplyTo || null,
          },
          '[Campaigns] Zoho kept Reply-To = From — sending anyway (From=alert@). Forward alert@ or verify login as sender for personal Reply-To.'
        );
      }
    } catch (cloneErr) {
      logger.warn(
        { err: cloneErr.message, from: fromEmail, replyTo: reply },
        '[Campaigns] Clone reply_to failed — sending From=alert@ without custom Reply-To'
      );
    }
  }

  const sendRes = await campaignsRequest(
    'POST',
    'sendcampaign',
    new URLSearchParams({
      resfmt: 'JSON',
      campaignkey: String(sendKey),
    }).toString(),
    settings
  );
  assertZohoOk(sendRes, 'sendcampaign');

  return {
    campaignKey: String(sendKey),
    contentUrl: publicUrl,
    send: sendRes,
    create: createRes,
    fromEmail,
    replyTo: reply || fromEmail,
    replyToApplied,
  };
};

/**
 * Send as login From+Reply-To only. No alert@ fallback.
 * If Zoho rejects as unverified → clear error for that login.
 */
const createAndSendCampaign = async ({
  campaignName,
  subject,
  htmlBody,
  fromEmail,
  fromName,
  replyTo,
  fromCandidates,
  listKey,
  settings = null,
}) => {
  const { publicUrl } = storeCampaignHtml(htmlBody);
  const topicId = await resolveTopicId(settings);
  const emailsToTry = uniqueAllowedFroms([fromEmail, ...(fromCandidates || [])]);
  if (!emailsToTry.length) {
    const err = new Error('No work-domain From address for Zoho Campaigns');
    err.code = 'CAMPAIGNS_FROM_EMAIL';
    throw err;
  }

  const addr = emailsToTry[0];
  const reply = addr; // Reply-To = From (same verified mailbox)
  try {
    return await createAndSendCampaignOnce({
      campaignName,
      subject,
      htmlBody,
      fromEmail: addr,
      fromName,
      replyTo: reply,
      listKey,
      settings,
      publicUrl,
      topicId,
    });
  } catch (e) {
    if (isUnverifiedSenderError(e)) {
      throw notVerifiedSenderError(addr);
    }
    throw e;
  }
};

/**
 * Send marketing email via Zoho Campaigns (real create + send).
 */
const sendMarketingEmail = async (to, subject, htmlBody, options = {}) => {
  const { senderName, fromEmail, userId, campaignName, organizationId, listPurpose, replyToEmail } = options;

  const {
    resolveCampaignsSettings,
    isSettingsConfigured,
    inferListPurpose,
    resolveListKeyForPurpose,
  } = require('./marketingListService');

  const settings = await resolveCampaignsSettings(organizationId);
  if (!isSettingsConfigured(settings) && !isCampaignsConfigured(settings)) {
    throw new Error('CAMPAIGNS_NOT_CONFIGURED');
  }

  const purpose = inferListPurpose({
    templateName: campaignName,
    subject,
    explicit: listPurpose,
  });
  let masterListKey = resolveListKeyForPurpose(settings, purpose);
  if (!masterListKey) {
    const { ensurePurposeListKey } = require('./marketingListService');
    masterListKey = await ensurePurposeListKey(organizationId, purpose, settings);
  }
  if (!masterListKey) {
    const err = new Error(
      `Zoho Campaigns: No list key for purpose "${purpose}" and auto-create failed.`
    );
    err.code = 'CAMPAIGNS_NOT_CONFIGURED';
    err.displayMessage =
      'Could not resolve or auto-create a Zoho mailing list. Check Zoho Campaigns OAuth credentials.';
    throw err;
  }

  if (!subject || !htmlBody) {
    const err = new Error('Subject and HTML body are required for marketing send');
    err.code = 'CAMPAIGNS_INVALID';
    throw err;
  }

  // From+Reply-To = login only. Skillnix: must be Zoho-verified sender.
  const resolved = await resolveCampaignFrom({
    fromEmail: fromEmail || undefined,
    senderName,
    userId,
    settings,
    organizationId,
    replyToEmail: replyToEmail || fromEmail || undefined,
  });
  const senderAddr = resolved.email;
  const fromName = resolved.name;
  const replyTo = resolved.replyTo || senderAddr;
  const htmlForSend = String(htmlBody || '');
  const mailtoAddr = '';

  const recipients = (Array.isArray(to) ? to : [to]).map((r) => ({
    email: typeof r === 'string' ? r : r.email,
    name: typeof r === 'string' ? '' : r.name || '',
  })).filter((r) => r.email);

  if (!recipients.length) {
    const err = new Error('No recipients');
    err.code = 'CAMPAIGNS_NO_RECIPIENTS';
    throw err;
  }

  // Recipients are added only to an ephemeral Zoho temp list for this send.
  // They are NOT enrolled on permanent purpose lists here — that looked like
  // "auto-subscribe". Consent / permanent list membership requires Subscribe.

  const stamp = Date.now();
  const safeName = String(campaignName || `ATS ${stamp}`)
    .replace(/[^\w\s\-.]/g, '')
    .slice(0, 80);
  const tempListName = `ATS ${purpose} ${stamp}`.slice(0, 100);

  try {
    const { listkey: sendListKey } = await createTempListWithContacts(
      recipients.map((r) => r.email),
      tempListName,
      settings
    );

    const sent = await createAndSendCampaign({
      campaignName: safeName || `ATS ${stamp}`,
      subject: String(subject).slice(0, 200),
      htmlBody: htmlForSend,
      fromEmail: senderAddr,
      fromName,
      replyTo,
      fromCandidates: resolved.fromCandidates,
      listKey: sendListKey,
      settings,
    });

    logger.info(
      {
        campaignKey: sent.campaignKey,
        recipients: recipients.length,
        from: senderAddr,
        replyTo,
        replyToApplied: sent.replyToApplied,
      },
      '[Campaigns] Campaign created and send started'
    );

    try {
      const { recordEmailSend } = require('./emailReportService');
      await recordEmailSend({
        organizationId: options.organizationId || null,
        userId: options.userId || null,
        channel: 'marketing',
        provider: 'zoho_campaigns',
        emailType: 'campaign',
        subject: String(subject).slice(0, 200),
        fromEmail: sent.fromEmail || senderAddr,
        replyToEmail: sent.replyTo || replyTo,
        campaignName: safeName || `ATS ${stamp}`,
        campaignKey: sent.campaignKey,
        status: 'sending',
        recipients: recipients.map((r) => ({
          email: r.email,
          name: r.name || '',
          status: 'sent',
        })),
        providerRaw: {
          contentUrl: sent.contentUrl,
          replyToApplied: sent.replyToApplied,
        },
      });
    } catch (_) { /* non-blocking */ }

    return {
      success: true,
      sent: recipients.length,
      data: {
        message: 'Campaign created and send started in Zoho Campaigns.',
        campaignKey: sent.campaignKey,
        contentUrl: sent.contentUrl,
        provider: 'zoho_campaigns',
        fromEmail: sent.fromEmail || senderAddr,
        replyTo: sent.replyTo || replyTo,
        contactEmail: mailtoAddr || undefined,
        replyToApplied: Boolean(sent.replyToApplied),
      },
    };
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data || err.zohoData;
    const msg = data?.message || data?.error || err.message;
    const emptyList =
      err.code === 'CAMPAIGNS_LIST_EMPTY' ||
      err.zohoCode === '6606' ||
      /does not contain any contacts|No lists selected|no active contacts/i.test(String(msg));
    const unverifiedFrom = isUnverifiedSenderError(err);

    if (unverifiedFrom) {
      err.code = 'CAMPAIGNS_FROM_UNVERIFIED';
      if (!err.displayMessage) {
        err.displayMessage =
          `"${senderAddr}" is not a Zoho Campaigns sender yet. ` +
          'Add it under Zoho Campaigns → Settings → Deliverability → Manage Senders, verify, then retry.';
      }
      throw err;
    }

    // Enterprise outreach: if Zoho holds contacts as pending opt-in, still deliver the
    // marketing HTML via ZeptoMail so recruiters can mail anyone. Subscribe / Unsubscribe
    // links in the body continue to sync Zoho lists when clicked.
    if (emptyList) {
      logger.warn(
        { recipients: recipients.length, err: err.message },
        '[Campaigns] Zoho list pending/empty — falling back to ZeptoMail for delivery'
      );
      const { sendEmail } = require('./emailService');
      let delivered = 0;
      const failed = [];
      for (const r of recipients) {
        try {
          const text = htmlForSend.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          await sendEmail(r.email, String(subject).slice(0, 200), htmlForSend, text, {
            senderName: fromName || senderName || '',
            senderEmail: fromEmail || senderAddr,
            userId,
            organizationId,
            channel: 'marketing',
            emailType: 'campaign_fallback',
          });
          delivered += 1;
        } catch (sendErr) {
          failed.push({ email: r.email, error: sendErr.message });
          logger.warn(
            { email: r.email, err: sendErr.message },
            '[Campaigns] ZeptoMail fallback failed'
          );
        }
      }
      if (delivered < 1) {
        err.code = 'CAMPAIGNS_LIST_EMPTY';
        err.displayMessage =
          err.displayMessage ||
          'Zoho could not activate contacts (pending opt-in), and ZeptoMail fallback also failed. Check email settings, then retry.';
        throw err;
      }
      return {
        success: true,
        sent: delivered,
        data: {
          message:
            'Email delivered via ZeptoMail because Zoho still has contacts pending opt-in. Subscribe / Unsubscribe links still update Zoho lists when clicked.',
          provider: 'zeptomail_fallback',
          zohoPending: true,
          fromEmail: senderAddr,
          failed,
        },
      };
    }

    if (err.code === 'CAMPAIGNS_SCOPE' || status === 403 || /scope|permission|INVALID_SCOPE/i.test(msg)) {
      const e = new Error(
        'Zoho Campaigns: OAuth token missing campaign create/send scopes (ZohoCampaigns.campaign.CREATE + ZohoCampaigns.campaign.UPDATE).'
      );
      e.code = 'CAMPAIGNS_SCOPE';
      e.displayMessage =
        err.displayMessage ||
        'Regenerate Self Client grant with campaign CREATE+UPDATE scopes, exchange for refresh token, update ZOHO_CAMPAIGNS_REFRESH_TOKEN on Railway.';
      throw e;
    }
    if (data?.code === 2501 || err.zohoCode === '2501') {
      const e = new Error(
        'Zoho Campaigns: Invalid or empty ZOHO_CAMPAIGNS_LIST_KEY. Get the list key from Zoho Campaigns > Mailing Lists.'
      );
      e.code = 'CAMPAIGNS_NOT_CONFIGURED';
      throw e;
    }
    logger.error({ err: msg, data }, '[Campaigns] Send failed');
    throw err;
  }
};

module.exports = {
  getAccessToken,
  campaignsRequest,
  addContact,
  removeContact,
  removeFromSuppressionList,
  enableListSignupForm,
  sendMarketingEmail,
  isCampaignsConfigured,
  getFromEmail,
  collectCampaignFromCandidates,
  resolveCampaignFrom,
  isAllowedCampaignFrom,
  sharedCampaignFromAddress,
  sharedCampaignFromOrgDomains,
};
