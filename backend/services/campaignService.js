const axios = require('axios');
const mongoose = require('mongoose');

/**
 * Zoho Campaigns — OAuth2 (client_id, client_secret, refresh_token) or API key (Zoho-zapikey)
 * India: accounts.zoho.in, Campaigns API base: https://campaigns.zoho.in/api/v1.1
 * (Not www.zohoapis.in — Campaigns uses campaigns.zoho.in / campaigns.zoho.com)
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
const getFromEmail = () => (process.env.ZOHO_CAMPAIGNS_FROM_EMAIL || process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL || '').trim();

let cachedAccessToken = null;
let cachedExpiry = 0;

const getAccessToken = async () => {
  const now = Date.now();
  if (cachedAccessToken && cachedExpiry > now + 60000) return cachedAccessToken;

  const clientId = getClientId();
  const clientSecret = getClientSecret();
  const refreshToken = getRefreshToken();
  if (!clientId || !clientSecret || !refreshToken) throw new Error('CAMPAIGNS_NOT_CONFIGURED');

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken
  });

  const response = await axios.post(TOKEN_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15000
  });

  const data = response.data;
  if (!data.access_token) throw new Error('Zoho Campaigns: No access_token in refresh response');

  cachedAccessToken = data.access_token;
  cachedExpiry = Date.now() + (Number(data.expires_in) || 3600) * 1000;
  console.log('[Campaigns] OAuth access token refreshed');
  return cachedAccessToken;
};

const isCampaignsConfigured = () => {
  const hasOAuth = !!(getClientId() && getClientSecret() && getRefreshToken());
  const hasApiKey = !!getApiKey();
  return hasOAuth || hasApiKey;
};

const campaignsRequest = async (method, path, bodyOrParams = null) => {
  const baseUrl = getBaseUrl();
  let url = path.startsWith('http') ? path : `${baseUrl.replace(/\/?$/, '')}/${path.replace(/^\//, '')}`;
  let authHeader;
  const apiKey = getApiKey();
  if (apiKey) {
    authHeader = apiKey.toLowerCase().startsWith('zoho-zapikey') ? apiKey : `Zoho-zapikey ${apiKey}`;
  } else {
    const token = await getAccessToken();
    authHeader = `Zoho-oauthtoken ${token}`;
  }
  const config = {
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    timeout: 30000
  };
  // Zoho Campaigns listsubscribe/listunsubscribe expect params in URL query string (see contact-subscribe docs)
  if (bodyOrParams && method === 'POST') {
    const queryString = typeof bodyOrParams === 'string' ? bodyOrParams : new URLSearchParams(bodyOrParams).toString();
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}${queryString}`;
    config.data = queryString;
  }
  if (bodyOrParams && method === 'GET') config.params = bodyOrParams;
  const res = await axios({ method, url, ...config });
  return res.data;
};

/**
 * Subscribe contact to a list (scope: ZohoCampaigns.contact.UPDATE or CREATE-UPDATE)
 * Path: json/listsubscribe?resfmt=JSON&listkey=...&contactinfo=URL_ENCODED_JSON
 */
const addContact = async (listKey, email, firstName = '', lastName = '') => {
  const contactinfo = JSON.stringify({
    'Contact Email': email,
    'First Name': firstName || '',
    'Last Name': lastName || ''
  });
  const res = await campaignsRequest('POST', 'json/listsubscribe', new URLSearchParams({
    resfmt: 'JSON',
    listkey: listKey,
    contactinfo: contactinfo,
    source: 'Skillnix ATS'
  }).toString());
  return res;
};

/**
 * Unsubscribe contact from a list (scope: ZohoCampaigns.contact.UPDATE)
 * Path: json/listunsubscribe
 */
const removeContact = async (listKey, email) => {
  const contactinfo = JSON.stringify({
    'Contact Email': email
  });
  const res = await campaignsRequest('POST', 'json/listunsubscribe', new URLSearchParams({
    resfmt: 'JSON',
    listkey: listKey,
    contactinfo: contactinfo
  }).toString());
  return res;
};

/**
 * Send marketing email via Campaigns API.
 * With contact.CREATE/READ only we can add contacts; to send a campaign you need campaign.UPDATE.
 * If scope allows, we add contacts; otherwise we try send and surface scope error.
 */
const sendMarketingEmail = async (to, subject, htmlBody, options = {}) => {
  const { senderName, fromEmail, userId, campaignName } = options;

  if (!isCampaignsConfigured()) throw new Error('CAMPAIGNS_NOT_CONFIGURED');

  const defaultFrom = getFromEmail();
  let senderAddr = defaultFrom;
  if (userId) {
    try {
      const User = mongoose.model('User');
      const user = await User.findById(userId).select('email name');
      if (user?.email) senderAddr = user.email;
    } catch (_) {}
  }
  if (fromEmail) senderAddr = fromEmail;

  const recipients = (Array.isArray(to) ? to : [to]).map(r => ({
    email: typeof r === 'string' ? r : r.email,
    name: typeof r === 'string' ? '' : (r.name || '')
  }));

  const listKey = (process.env.ZOHO_CAMPAIGNS_LIST_KEY || '').trim();
  if (!listKey) {
    const err = new Error('Zoho Campaigns: Set ZOHO_CAMPAIGNS_LIST_KEY in .env (get list key from Zoho Campaigns > Mailing Lists > list key).');
    err.code = 'CAMPAIGNS_NOT_CONFIGURED';
    err.displayMessage = 'Add ZOHO_CAMPAIGNS_LIST_KEY in backend .env. Get the list key from Zoho Campaigns → Mailing Lists → your list → list key.';
    throw err;
  }

  try {
    for (const r of recipients) {
      const nameParts = (r.name || '').trim().split(/\s+/);
      await addContact(listKey, r.email, nameParts[0] || '', nameParts.slice(1).join(' ') || '');
    }
    console.log(`[Campaigns] Added ${recipients.length} contact(s) to list via OAuth`);
    return { success: true, sent: recipients.length, data: { message: 'Contacts added to mailing list.' } };
  } catch (addErr) {
    const status = addErr.response?.status;
    const data = addErr.response?.data;
    const msg = data?.message || addErr.message;
    if (status === 403 || /scope|permission|INVALID_SCOPE/i.test(msg)) {
      const err = new Error('Zoho Campaigns: Add scope ZohoCampaigns.contact.UPDATE (or contact.CREATE-UPDATE) for listsubscribe.');
      err.code = 'CAMPAIGNS_SCOPE';
      throw err;
    }
    if (data?.code === 2501) {
      const err = new Error('Zoho Campaigns: Invalid or empty ZOHO_CAMPAIGNS_LIST_KEY. Get the list key from Zoho Campaigns > Mailing Lists.');
      err.code = 'CAMPAIGNS_NOT_CONFIGURED';
      throw err;
    }
    console.error('[Campaigns] Add contact error:', data || addErr.message);
    throw addErr;
  }
};

module.exports = {
  getAccessToken,
  campaignsRequest,
  addContact,
  removeContact,
  sendMarketingEmail,
  isCampaignsConfigured,
  getFromEmail
};
