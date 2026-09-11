/**
 * Public subscribe/unsubscribe — Zoho Campaigns list + HMAC one-click links.
 * Supports optional orgSlug so each org can use its Integrations marketing list.
 */
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const { isCampaignsConfigured } = require('./campaignService');
const { verifySig } = require('../utils/subscribeSign');
const {
  enrollInMarketingList,
  unenrollFromMarketingList,
  resolveCampaignsSettings,
  isSettingsConfigured,
} = require('./marketingListService');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

const getFrontendUrl = () => (process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');

async function resolveOrganizationId(orgSlug, orgId) {
  const id = String(orgId || '').trim();
  if (id && mongoose.Types.ObjectId.isValid(id)) {
    return id;
  }
  const slug = String(orgSlug || '').trim();
  if (!slug) return null;
  try {
    const Organization = mongoose.model('Organization');
    const org = await Organization.findOne({ slug }).select('_id').lean();
    return org?._id || null;
  } catch (_) {
    return null;
  }
}

async function assertReady(organizationId) {
  const settings = await resolveCampaignsSettings(organizationId);
  if (!isSettingsConfigured(settings) && !isCampaignsConfigured(settings)) {
    throw httpError('Subscription service is not configured. Please try again later.', 503);
  }
  return settings;
}

function wrapZohoError(err, fallbackMessage) {
  const status = err.response?.status === 403 ? 403 : 500;
  throw httpError(err.message || fallbackMessage, status);
}

async function subscribe(body) {
  const { email, firstName, lastName, orgSlug, orgId } = body || {};
  const organizationId = await resolveOrganizationId(orgSlug, orgId);
  await assertReady(organizationId);

  const trim = (s) => (typeof s === 'string' ? s.trim() : '') || '';
  const emailTrim = trim(email).toLowerCase();

  if (!emailTrim || !emailTrim.includes('@')) {
    throw httpError('A valid email address is required.');
  }

  let result;
  try {
    result = await enrollInMarketingList({
      organizationId,
      email: emailTrim,
      firstName: trim(firstName),
      lastName: trim(lastName),
      source: 'subscribe',
      purpose: 'subscribe',
      recordConsent: true,
    });
    logger.info(
      {
        email: emailTrim,
        organizationId,
        zohoEnrolled: result?.zohoEnrolled,
        zohoBlocked: result?.zohoBlocked,
      },
      '[Subscribe] Enrolled on marketing list'
    );
  } catch (err) {
    logger.error('[Subscribe] Error:', err.message);
    wrapZohoError(err, 'Subscription failed. Please try again later.');
  }

  const zohoEnrolled = Boolean(result?.zohoEnrolled);
  const zohoPending = Boolean(result?.zohoPending);
  const zohoBlocked = result?.zohoBlocked || null;
  // Prefer Skillnix-branded reactivate page; fall back to Zoho hosted form URL
  const frontend = getFrontendUrl();
  const brandedReactivate = frontend ? `${frontend}/subscribe/reactivate` : '';
  const signupFormUrl = String(
    brandedReactivate ||
      result?.signupFormUrl ||
      process.env.ZOHO_CAMPAIGNS_SIGNUP_FORM_URL ||
      ''
  ).trim();

  let status = 'ok';
  if (zohoPending) status = 'pending';
  else if (!zohoEnrolled && zohoBlocked === 'donotmail') status = 'zoho_reactivate';
  else if (!zohoEnrolled) status = 'consent_saved';

  return {
    message:
      status === 'ok'
        ? 'You have been successfully subscribed. You will receive updates from us.'
        : status === 'pending'
          ? 'Please confirm the email we sent to finish your subscription.'
          : status === 'zoho_reactivate'
            ? 'Your preference is saved. One more step is needed to reactivate marketing updates.'
            : 'Your preference is saved. Final activation on our mailing list may take a moment.',
    zohoEnrolled,
    zohoPending,
    zohoBlocked,
    status,
    signupFormUrl: signupFormUrl || undefined,
  };
}

async function confirmSubscribe(emailRaw, sigRaw, orgSlug, orgId) {
  const email = (emailRaw || '').trim().toLowerCase();
  const sig = (sigRaw || '').trim();
  const frontend = getFrontendUrl();
  const thankYou = frontend ? `${frontend}/subscribe/thank-you` : null;
  const organizationId = await resolveOrganizationId(orgSlug, orgId);

  if (!email || !email.includes('@')) {
    if (thankYou) return { redirect: thankYou + '?error=invalid' };
    return { status: 400, body: 'Invalid email.' };
  }
  if (!verifySig(email, sig)) {
    if (thankYou) return { redirect: thankYou + '?error=invalid_link' };
    return { status: 400, body: 'Invalid or expired link.' };
  }

  try {
    await assertReady(organizationId);
    const result = await enrollInMarketingList({
      organizationId,
      email,
      source: 'subscribe_confirm',
      purpose: 'subscribe',
      recordConsent: true,
    });
    logger.info(
      { email, organizationId, zohoEnrolled: result?.zohoEnrolled, zohoPending: result?.zohoPending },
      '[Subscribe] One-click enrolled'
    );

    if (thankYou) {
      let qs = '';
      if (result?.zohoPending) qs = '?status=pending';
      else if (!result?.zohoEnrolled && result?.zohoBlocked === 'donotmail') {
        const form = String(result?.signupFormUrl || process.env.ZOHO_CAMPAIGNS_SIGNUP_FORM_URL || '').trim();
        qs = form
          ? `?status=zoho_reactivate&form=${encodeURIComponent(form)}`
          : '?status=zoho_reactivate';
      } else if (!result?.zohoEnrolled) {
        qs = '?status=consent_saved';
      }
      return { redirect: `${thankYou}${qs}` };
    }
    return { status: 200, body: 'You have been successfully added to our mailing list.' };
  } catch (err) {
    logger.error('[Subscribe confirm] Error:', err.message, err.code);
    // Config missing → clear unavailable state; otherwise generic fail
    const code =
      err.code === 'CAMPAIGNS_NOT_CONFIGURED' || err.statusCode === 503
        ? 'unavailable'
        : 'failed';
    if (thankYou) return { redirect: thankYou + `?error=${code}` };
    return { status: 500, body: 'Subscription failed. Please try again.' };
  }
}

async function unsubscribe(body) {
  const { email, orgSlug, orgId } = body || {};
  const organizationId = await resolveOrganizationId(orgSlug, orgId);
  await assertReady(organizationId);

  const emailTrim = (typeof email === 'string' ? email.trim() : '').toLowerCase();

  if (!emailTrim || !emailTrim.includes('@')) {
    throw httpError('A valid email address is required.');
  }

  try {
    await unenrollFromMarketingList({
      organizationId,
      email: emailTrim,
      source: 'unsubscribe',
    });
    logger.info({ email: emailTrim, organizationId }, '[Unsubscribe] Removed from marketing list');
  } catch (err) {
    logger.error('[Unsubscribe] Error:', err.message);
    wrapZohoError(err, 'Unsubscribe failed. Please try again.');
  }

  return { message: 'You have been unsubscribed. You will no longer receive marketing emails from us.' };
}

async function confirmUnsubscribe(emailRaw, sigRaw, orgSlug, orgId) {
  const email = (emailRaw || '').trim().toLowerCase();
  const sig = (sigRaw || '').trim();
  const frontend = getFrontendUrl();
  const unsubThankYou = frontend ? `${frontend}/unsubscribe/thank-you` : null;
  const organizationId = await resolveOrganizationId(orgSlug, orgId);

  if (!email || !email.includes('@')) {
    if (unsubThankYou) return { redirect: unsubThankYou + '?error=invalid' };
    return { status: 400, body: 'Invalid email.' };
  }
  if (!verifySig(email, sig)) {
    if (unsubThankYou) return { redirect: unsubThankYou + '?error=invalid_link' };
    return { status: 400, body: 'Invalid or expired link.' };
  }

  try {
    await assertReady(organizationId);
    await unenrollFromMarketingList({
      organizationId,
      email,
      source: 'unsubscribe',
    });
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
