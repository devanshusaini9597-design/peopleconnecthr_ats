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
 * ZOHO_CAMPAIGNS_FROM_SKILLNIXRECRUITMENT_COM=noreply@skillnixrecruitment.com
 * or MAIL_PROFILE_*_FROM for the matching brand.
 */
const mappedFromForDomain = (domain) => {
  const d = String(domain || '').toLowerCase();
  if (!d) return '';
  const envKey = `ZOHO_CAMPAIGNS_FROM_${d.replace(/\./g, '_').toUpperCase()}`;
  const direct = (process.env[envKey] || '').trim();
  if (direct) return direct;
  if (d === 'skillnixrecruitment.com' || d === 'skillnix.com') {
    return (process.env.MAIL_PROFILE_SKILLNIXRECRUITMENT_FROM || '').trim();
  }
  if (d === 'peopleconnecthr.com') {
    return (process.env.MAIL_PROFILE_PEOPLECONNECTHR_FROM || '').trim();
  }
  if (d === 'skillnix.com') {
    return (process.env.MAIL_PROFILE_SKILLNIX_FROM || '').trim();
  }
  return '';
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
 * Look up the organization owner's email from the database.
 * The owner mailbox is always verified in Zoho Campaigns.
 */
const getOrgOwnerEmail = async (organizationId) => {
  if (!organizationId) return '';
  try {
    const Organization = mongoose.model('Organization');
    const org = await Organization.findById(organizationId).select('ownerId').lean();
    if (!org?.ownerId) return '';
    const User = mongoose.model('User');
    const owner = await User.findById(org.ownerId).select('email').lean();
    return (owner?.email || '').trim().toLowerCase();
  } catch (_) {
    return '';
  }
};

/**
 * Ordered From list for Zoho Campaigns.
 * Zoho Campaigns requires each individual sender mailbox to be verified
 * (domain auth alone is NOT enough — unlike ZeptoMail).
 *
 * Strategy: put the org-verified sender (owner / ZOHO_CAMPAIGNS_FROM_EMAIL)
 * FIRST so it always succeeds, then the teammate email as a secondary
 * (in case the teammate has also been individually verified).
 * The teammate's email is always set as reply-to so replies reach them.
 */
const collectCampaignFromCandidates = ({ fromEmail, userEmail, orgFrom, ownerEmail } = {}) =>
  uniqueAllowedFroms([
    // Verified org senders first (these are known-verified in Zoho Campaigns)
    ownerEmail,
    orgFrom,
    getFromEmail(),
    mappedFromForDomain(emailDomain(fromEmail)),
    mappedFromForDomain(emailDomain(userEmail)),
    // Teammate email last (may or may not be individually verified)
    fromEmail,
    userEmail,
  ]);

/**
 * Resolve campaign From address.
 *
 * Works like ZeptoMail: the org's verified sender is used as the From address,
 * and the actual team member's email is set as reply-to.
 * This ensures all campaign emails go through Zoho Campaigns (no fallback needed)
 * since the From address is always the one that's individually verified.
 */
const resolveCampaignFrom = async ({ fromEmail, senderName, userId, settings, organizationId } = {}) => {
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

  // Auto-discover org owner's email — the one mailbox always verified in Zoho Campaigns
  const ownerEmail = await getOrgOwnerEmail(userOrgId);

  const orgFrom = (settings?.fromEmail || getFromEmail()).trim();
  const fromCandidates = collectCampaignFromCandidates({
    fromEmail,
    userEmail,
    orgFrom,
    ownerEmail,
  });

  if (!fromCandidates.length) {
    const err = new Error(
      'No verified work-domain From address for Zoho Campaigns. Use a @skillnixrecruitment.com / @peopleconnecthr.com / @skillnix.com / @devlumiq.com sender, or set ZOHO_CAMPAIGNS_FROM_EMAIL.'
    );
    err.code = 'CAMPAIGNS_FROM_EMAIL';
    err.displayMessage =
      'Marketing From must be a company domain email verified in Zoho Campaigns (Settings → Domain Authentication).';
    throw err;
  }

  // reply-to = the team member who initiated the send (so replies reach them)
  const replyTo = uniqueAllowedFroms([userEmail, fromEmail])[0] || fromCandidates[0];
  return {
    email: fromCandidates[0],
    fromCandidates,
    replyTo,
    name: (senderName || userName || 'HR Team').trim() || 'HR Team',
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

const addContact = async (listKey, email, firstName = '', lastName = '', topicId = '', settings = null) => {
  const contactinfo = JSON.stringify({
    'Contact Email': email,
    'First Name': firstName || '',
    'Last Name': lastName || '',
  });
  const params = {
    resfmt: 'JSON',
    listkey: listKey,
    contactinfo,
    source: 'Skillnix ATS',
  };
  const tid = topicId || runtimeSettings(settings).topicId;
  if (tid) params.topic_id = tid;
  const res = await campaignsRequest(
    'POST',
    'json/listsubscribe',
    new URLSearchParams(params).toString(),
    settings
  );
  return res;
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

const countActiveContacts = async (listkey, settings = null) => {
  const res = await campaignsRequest(
    'GET',
    'getlistsubscribers',
    {
      resfmt: 'JSON',
      listkey,
      status: 'active',
      fromindex: '1',
      range: '100',
      sort: 'asc',
    },
    settings
  );
  const code = zohoCode(res);
  if (code && code !== '0' && code !== '200') return 0;

  const details =
    res?.list_of_details ||
    res?.subscribers ||
    res?.result_of_subscribers ||
    res?.contacts ||
    [];
  if (Array.isArray(details) && details.length) return details.length;

  const no =
    res?.list_details?.noofcontacts ||
    res?.noofcontacts ||
    res?.list_details?.[0]?.noofcontacts ||
    0;
  return Number(no) || 0;
};

const waitForActiveContacts = async (listkey, minCount, timeoutMs = 40000, settings = null) => {
  const started = Date.now();
  let last = 0;
  while (Date.now() - started < timeoutMs) {
    try {
      last = await countActiveContacts(listkey, settings);
      if (last >= minCount) return last;
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

  // Reinforce: listsubscribe often activates contacts on private lists faster than bulk create alone.
  let topicId = '';
  try {
    topicId = await resolveTopicId(settings);
  } catch (_) {}
  for (const email of unique) {
    try {
      await addContact(listkey, email, '', '', topicId, settings);
    } catch (err) {
      logger.warn({ email, err: err.message }, '[Campaigns] temp listsubscribe failed');
    }
  }

  const active = await waitForActiveContacts(listkey, 1, 40000, settings);
  if (active < 1) {
    const err = new Error(
      'Zoho mailing list has no active contacts yet. Contact may be waiting for subscription confirmation.'
    );
    err.code = 'CAMPAIGNS_LIST_EMPTY';
    err.listkey = listkey;
    err.displayMessage =
      'Zoho list is empty/pending. In Zoho Campaigns → Settings → Manage Opt-in, allow API contacts without confirmation (or confirm the subscription email), then retry. Meanwhile we can still deliver via ZeptoMail.';
    throw err;
  }

  return { listkey, listName, count: unique.length, active };
};

const isUnverifiedSenderError = (err) =>
  err?.code === 'CAMPAIGNS_FROM_UNVERIFIED' ||
  err?.zohoCode === '6610' ||
  /not verified/i.test(String(err?.message || ''));

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
      e.displayMessage = `Zoho Campaigns: "${fromEmail}" is not a verified sender mailbox. Domain authentication is not enough — add this address under Settings → Sender Address, or we will send as the org verified sender.`;
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
  const campaignKey = createRes.campaignKey || createRes.campaignkey || createRes.response?.campaignKey;
  if (!campaignKey) {
    const err = new Error(`Zoho Campaigns createCampaign missing campaignKey: ${zohoMessage(createRes)}`);
    err.code = 'CAMPAIGNS_API';
    err.zohoData = createRes;
    throw err;
  }

  const sendRes = await campaignsRequest(
    'POST',
    'sendcampaign',
    new URLSearchParams({
      resfmt: 'JSON',
      campaignkey: String(campaignKey),
    }).toString(),
    settings
  );
  assertZohoOk(sendRes, 'sendcampaign');

  return {
    campaignKey: String(campaignKey),
    contentUrl: publicUrl,
    send: sendRes,
    create: createRes,
    fromEmail,
  };
};

/**
 * Try teammate From first; if Zoho 6610 (mailbox not a verified sender),
 * retry remaining org-verified From addresses with the teammate display name.
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

  let lastUnverified = null;
  for (let i = 0; i < emailsToTry.length; i += 1) {
    const addr = emailsToTry[i];
    try {
      const sent = await createAndSendCampaignOnce({
        campaignName,
        subject,
        htmlBody,
        fromEmail: addr,
        fromName,
        replyTo,
        listKey,
        settings,
        publicUrl,
        topicId,
      });
      if (i > 0) {
        logger.info(
          { tried: emailsToTry[0], used: addr, replyTo },
          '[Campaigns] Teammate mailbox is not a Zoho sender — sent as org verified From'
        );
      }
      return sent;
    } catch (e) {
      if (isUnverifiedSenderError(e)) {
        lastUnverified = e;
        if (i < emailsToTry.length - 1) {
          logger.warn(
            { from: addr, next: emailsToTry[i + 1] },
            '[Campaigns] From mailbox not verified in Zoho — retrying org sender'
          );
          continue;
        }
        // Last candidate also failed — ensure error is tagged for ZeptoMail fallback
        logger.warn(
          { from: addr, tried: emailsToTry },
          '[Campaigns] All From candidates rejected by Zoho — will fall back to ZeptoMail'
        );
        e.code = 'CAMPAIGNS_FROM_UNVERIFIED';
        throw e;
      }
      throw e;
    }
  }
  if (lastUnverified) {
    lastUnverified.code = 'CAMPAIGNS_FROM_UNVERIFIED';
    throw lastUnverified;
  }
};

/**
 * Send marketing email via Zoho Campaigns (real create + send).
 */
const sendMarketingEmail = async (to, subject, htmlBody, options = {}) => {
  const { senderName, fromEmail, userId, campaignName, organizationId, listPurpose } = options;

  const {
    resolveCampaignsSettings,
    isSettingsConfigured,
    enrollInMarketingList,
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

  // Prefer recruiter work email, then org-verified Zoho sender (mailbox, not just domain).
  const resolved = await resolveCampaignFrom({
    fromEmail: fromEmail || settings.fromEmail,
    senderName,
    userId,
    settings,
    organizationId,
  });
  const senderAddr = resolved.email;
  const fromName = resolved.name;
  const replyTo = resolved.replyTo || senderAddr;

  const recipients = (Array.isArray(to) ? to : [to]).map((r) => ({
    email: typeof r === 'string' ? r : r.email,
    name: typeof r === 'string' ? '' : r.name || '',
  })).filter((r) => r.email);

  if (!recipients.length) {
    const err = new Error('No recipients');
    err.code = 'CAMPAIGNS_NO_RECIPIENTS';
    throw err;
  }

  // Purpose list + ATS consent (enterprise enroll)
  for (const r of recipients) {
    try {
      const nameParts = (r.name || '').trim().split(/\s+/);
      await enrollInMarketingList({
        organizationId,
        email: r.email,
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        source: 'marketing_send',
        purpose,
      });
    } catch (addErr) {
      logger.warn(
        { email: r.email, purpose, err: addErr.message },
        '[Campaigns] Purpose list enroll failed (continuing to send)'
      );
    }
  }

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
      htmlBody,
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
      },
      '[Campaigns] Campaign created and send started'
    );

    return {
      success: true,
      sent: recipients.length,
      data: {
        message: 'Campaign created and send started in Zoho Campaigns.',
        campaignKey: sent.campaignKey,
        contentUrl: sent.contentUrl,
        provider: 'zoho_campaigns',
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

    // Deliver via ZeptoMail so teammates are not blocked when Zoho only verifies the owner mailbox.
    if (emptyList || unverifiedFrom) {
      try {
        const { sendEmail } = require('./emailService');
        for (const r of recipients) {
          await sendEmail(r.email, subject, htmlBody, String(htmlBody).replace(/<[^>]*>/g, ' '), {
            userId,
            organizationId,
            senderName: fromName,
            senderEmail: replyTo || senderAddr,
            replyToEmail: replyTo || senderAddr,
          });
        }
        logger.info(
          { recipients: recipients.length, zoho: msg, reason: unverifiedFrom ? 'from_unverified' : 'list_empty' },
          '[Campaigns] Zoho send blocked — delivered via ZeptoMail fallback'
        );
        return {
          success: true,
          sent: recipients.length,
          data: {
            message: 'Email delivered successfully.',
            provider: 'zeptomail_fallback',
          },
        };
      } catch (fallbackErr) {
        logger.error({ err: fallbackErr.message }, '[Campaigns] ZeptoMail fallback failed');
        err.displayMessage =
          (err.displayMessage || msg) +
          ' ZeptoMail fallback also failed: ' +
          (fallbackErr.displayMessage || fallbackErr.message);
        throw err;
      }
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
  sendMarketingEmail,
  isCampaignsConfigured,
  getFromEmail,
  collectCampaignFromCandidates,
  resolveCampaignFrom,
  isAllowedCampaignFrom,
};
