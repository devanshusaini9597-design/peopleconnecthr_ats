/**
 * Public subscribe/unsubscribe — Zoho Campaigns list + HMAC one-click links.
 */
const logger = require('../utils/logger');
const { addContact, removeContact, isCampaignsConfigured } = require('./campaignService');
const { verifySig } = require('../utils/subscribeSign');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

const getListKey = () => (process.env.ZOHO_CAMPAIGNS_LIST_KEY || '').trim();
const getFrontendUrl = () => (process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');

function requireCampaignsReady() {
  if (!isCampaignsConfigured()) {
    throw httpError('Subscription service is not configured. Please try again later.', 503);
  }
  const listKey = getListKey();
  if (!listKey) {
    throw httpError('Mailing list is not configured. Please try again later.', 503);
  }
  return listKey;
}

function wrapZohoError(err, fallbackMessage) {
  const status = err.response?.status === 403 ? 403 : 500;
  throw httpError(err.message || fallbackMessage, status);
}

async function subscribe(body) {
  const listKey = requireCampaignsReady();
  const { email, firstName, lastName } = body || {};
  const trim = (s) => (typeof s === 'string' ? s.trim() : '') || '';
  const emailTrim = trim(email).toLowerCase();

  if (!emailTrim || !emailTrim.includes('@')) {
    throw httpError('A valid email address is required.');
  }

  try {
    await addContact(listKey, emailTrim, trim(firstName), trim(lastName));
    logger.info('[Subscribe] Added contact to Zoho list:', emailTrim);
  } catch (err) {
    logger.error('[Subscribe] Error:', err.message);
    wrapZohoError(err, 'Subscription failed. Please try again later.');
  }

  return { message: 'You have been successfully subscribed. You will receive updates from us.' };
}

/**
 * One-click confirm. Returns { redirect } or { status, body } for plain text.
 */
async function confirmSubscribe(emailRaw, sigRaw) {
  const email = (emailRaw || '').trim().toLowerCase();
  const sig = (sigRaw || '').trim();
  const frontend = getFrontendUrl();
  const thankYou = frontend ? `${frontend}/subscribe/thank-you` : null;

  if (!email || !email.includes('@')) {
    if (thankYou) return { redirect: thankYou + '?error=invalid' };
    return { status: 400, body: 'Invalid email.' };
  }
  if (!verifySig(email, sig)) {
    if (thankYou) return { redirect: thankYou + '?error=invalid_link' };
    return { status: 400, body: 'Invalid or expired link.' };
  }

  try {
    if (!isCampaignsConfigured()) {
      if (thankYou) return { redirect: thankYou + '?error=unavailable' };
      return { status: 503, body: 'Service unavailable.' };
    }
    const listKey = getListKey();
    if (!listKey) {
      if (thankYou) return { redirect: thankYou + '?error=unavailable' };
      return { status: 503, body: 'Mailing list not configured.' };
    }

    await addContact(listKey, email, '', '');
    logger.info('[Subscribe] One-click added to Zoho list:', email);

    if (thankYou) return { redirect: thankYou };
    return { status: 200, body: 'You have been successfully added to our mailing list.' };
  } catch (err) {
    logger.error('[Subscribe confirm] Error:', err.message);
    if (thankYou) return { redirect: thankYou + '?error=failed' };
    return { status: 500, body: 'Subscription failed. Please try again.' };
  }
}

async function unsubscribe(body) {
  if (!isCampaignsConfigured()) {
    throw httpError('Unsubscribe service is not configured. Please try again later.', 503);
  }
  const listKey = getListKey();
  if (!listKey) {
    throw httpError('Mailing list is not configured.', 503);
  }

  const { email } = body || {};
  const emailTrim = (typeof email === 'string' ? email.trim() : '').toLowerCase();

  if (!emailTrim || !emailTrim.includes('@')) {
    throw httpError('A valid email address is required.');
  }

  try {
    await removeContact(listKey, emailTrim);
    logger.info('[Unsubscribe] Removed from Zoho list:', emailTrim);
  } catch (err) {
    logger.error('[Unsubscribe] Error:', err.message);
    wrapZohoError(err, 'Unsubscribe failed. Please try again.');
  }

  return { message: 'You have been unsubscribed. You will no longer receive marketing emails from us.' };
}

async function confirmUnsubscribe(emailRaw, sigRaw) {
  const email = (emailRaw || '').trim().toLowerCase();
  const sig = (sigRaw || '').trim();
  const frontend = getFrontendUrl();
  const unsubThankYou = frontend ? `${frontend}/unsubscribe/thank-you` : null;

  if (!email || !email.includes('@')) {
    if (unsubThankYou) return { redirect: unsubThankYou + '?error=invalid' };
    return { status: 400, body: 'Invalid email.' };
  }
  if (!verifySig(email, sig)) {
    if (unsubThankYou) return { redirect: unsubThankYou + '?error=invalid_link' };
    return { status: 400, body: 'Invalid or expired link.' };
  }

  try {
    if (!isCampaignsConfigured()) {
      if (unsubThankYou) return { redirect: unsubThankYou + '?error=unavailable' };
      return { status: 503, body: 'Service unavailable.' };
    }
    const listKey = getListKey();
    if (!listKey) {
      if (unsubThankYou) return { redirect: unsubThankYou + '?error=unavailable' };
      return { status: 503, body: 'Mailing list not configured.' };
    }

    await removeContact(listKey, email);
    logger.info('[Unsubscribe] One-click removed from Zoho list:', email);

    if (unsubThankYou) return { redirect: unsubThankYou };
    return { status: 200, body: 'You have been unsubscribed.' };
  } catch (err) {
    logger.error('[Unsubscribe confirm] Error:', err.message);
    if (unsubThankYou) return { redirect: unsubThankYou + '?error=failed' };
    return { status: 500, body: 'Unsubscribe failed. Please try again.' };
  }
}

module.exports = {
  subscribe,
  confirmSubscribe,
  unsubscribe,
  confirmUnsubscribe,
};
