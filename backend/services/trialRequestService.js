/**
 * Sales-gated trial requests — notify sales, list queue, approve/reject.
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendEmail } = require('./emailService');
const {
  wrapBrandedEmailHtml,
  brandButtonHtml,
  infoPanelHtml,
  loadPlatformEmailBrand,
  escapeHtml,
} = require('./emailBrandLayout');
const { isPlatformOperator } = require('../utils/orgDomain');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const SALES_INBOX = 'contact@skillnixrecruitment.com';
const SALES_NOTIFY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

function salesInbox() {
  const raw = process.env.SALES_TEAM_EMAIL || process.env.SUPPORT_TEAM_EMAIL || SALES_INBOX;
  return String(raw)
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function frontendUrl() {
  return String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function assertPlatformOperator(user) {
  if (!isPlatformOperator(user)) {
    throw httpError('Only the People Connect HR sales team can review trial requests', 403, {
      code: 'not_platform_operator',
    });
  }
}

function signApproveToken(userId) {
  return jwt.sign(
    { id: String(userId), purpose: 'trial_approve' },
    JWT_SECRET,
    { expiresIn: '14d' }
  );
}

function publicApproveUrl(userId) {
  const token = signApproveToken(userId);
  // Fragment is not sent to servers, logs, or Referer. The page POSTs the token in JSON.
  return `${frontendUrl()}/trial-approve#${encodeURIComponent(token)}`;
}

function serializeRequest(user) {
  return {
    id: String(user._id),
    name: user.name || '',
    email: user.email,
    phone: user.phone || '',
    companyName: user.companyName || '',
    signupStatus: user.signupStatus,
    createdAt: user.createdAt,
    signupApprovedAt: user.signupApprovedAt || null,
  };
}

async function notifySales(user, { isUpdate = false } = {}) {
  const inbox = salesInbox();
  if (!inbox.length) return { sent: false, reason: 'NO_INBOX' };

  const brand = loadPlatformEmailBrand();
  const approveUrl = publicApproveUrl(user._id);
  const queueUrl = `${frontendUrl()}/trial-requests`;
  const html = wrapBrandedEmailHtml({
    title: isUpdate ? 'Updated trial request' : 'New trial request',
    eyebrow: 'Sales',
    orgName: brand.name,
    logoUrl: brand.logoUrl,
    brandColor: brand.brandColor,
    wordmark: brand.wordmark,
    bodyHtml: `
      <p style="margin:0 0 16px 0;font-size:16px;color:#0f172a;">
        ${isUpdate ? 'A buyer updated their trial request.' : 'A potential buyer requested a trial. Contact them, then approve access when ready.'}
      </p>
      ${infoPanelHtml([
        { label: 'Name', value: user.name || '—' },
        { label: 'Work email', value: user.email || '—' },
        user.phone ? { label: 'Phone', value: user.phone } : null,
        user.companyName ? { label: 'Company', value: user.companyName } : null,
        { label: 'Submitted', value: user.createdAt ? new Date(user.createdAt).toUTCString() : 'Just now' },
      ].filter(Boolean), brand.brandColor)}
      <div style="text-align:center;">
        ${brandButtonHtml({ href: approveUrl, label: 'Approve access', brandColor: brand.brandColor })}
      </div>
      <p style="margin:16px 0 0 0;color:#64748b;font-size:13px;line-height:1.6;">
        Or review the queue: <a href="${queueUrl}" style="color:${brand.brandColor};">${queueUrl}</a>
      </p>`,
  });

  try {
    await sendEmail(
      inbox[0],
      `${isUpdate ? 'Updated' : 'New'} trial request — ${user.name || user.email}`,
      html,
      [
        `${user.name || 'Buyer'} requested a trial.`,
        `Email: ${user.email}`,
        user.phone ? `Phone: ${user.phone}` : null,
        user.companyName ? `Company: ${user.companyName}` : null,
        `Approve: ${approveUrl}`,
      ].filter(Boolean).join('\n'),
      {
        senderName: brand.name,
        system: true,
        cc: inbox.slice(1).join(',') || undefined,
      }
    );
    return { sent: true };
  } catch (err) {
    logger.warn({ err: err.message }, 'Trial request sales email failed');
    return { sent: false, reason: err.message };
  }
}

async function notifyBuyerReceived(user) {
  if (!user?.email) return;
  const brand = loadPlatformEmailBrand();
  const html = wrapBrandedEmailHtml({
    title: 'We received your trial request',
    eyebrow: 'Trial request',
    orgName: brand.name,
    logoUrl: brand.logoUrl,
    brandColor: brand.brandColor,
    wordmark: brand.wordmark,
    bodyHtml: `
      <p style="margin:0 0 16px 0;font-size:16px;color:#0f172a;">Hi ${escapeHtml(user.name || 'there')},</p>
      <p style="margin:0 0 8px 0;color:#475569;line-height:1.7;">
        Thanks for your interest in <strong style="color:#0f172a;">${escapeHtml(brand.name)}</strong>. Our team will review your details and contact you shortly.
      </p>
      <p style="margin:0 0 8px 0;color:#475569;line-height:1.7;">
        You will be able to sign in after we approve access. No further action is needed right now.
      </p>`,
  });
  try {
    await sendEmail(
      user.email,
      `We received your ${brand.name} trial request`,
      html,
      'Our team will contact you shortly. You can sign in after we approve access.',
      { senderName: brand.name, system: true }
    );
  } catch (err) {
    logger.warn({ err: err.message }, 'Trial request buyer confirmation email failed');
  }
}

async function notifyBuyerApproved(user) {
  if (!user?.email) return;
  const brand = loadPlatformEmailBrand();
  const loginUrl = `${frontendUrl()}/login?activated=1`;
  const html = wrapBrandedEmailHtml({
    title: 'Your trial access is ready',
    eyebrow: 'Approved',
    orgName: brand.name,
    logoUrl: brand.logoUrl,
    brandColor: brand.brandColor,
    wordmark: brand.wordmark,
    bodyHtml: `
      <p style="margin:0 0 16px 0;font-size:16px;color:#0f172a;">Hi ${escapeHtml(user.name || 'there')},</p>
      <p style="margin:0 0 8px 0;color:#475569;line-height:1.7;">
        Your <strong style="color:#0f172a;">${escapeHtml(brand.name)}</strong> trial is approved. Sign in with the email and password you submitted.
      </p>
      <div style="text-align:center;">
        ${brandButtonHtml({ href: loginUrl, label: 'Sign in', brandColor: brand.brandColor })}
      </div>`,
  });
  try {
    await sendEmail(
      user.email,
      `You're approved — sign in to ${brand.name}`,
      html,
      `Your trial is approved. Sign in: ${loginUrl}`,
      { senderName: brand.name, system: true }
    );
  } catch (err) {
    logger.warn({ err: err.message }, 'Trial approval buyer email failed');
  }
}

async function notifyBuyerRejected(user) {
  if (!user?.email) return;
  const brand = loadPlatformEmailBrand();
  const html = wrapBrandedEmailHtml({
    title: 'Update on your trial request',
    eyebrow: 'Trial request',
    orgName: brand.name,
    logoUrl: brand.logoUrl,
    brandColor: brand.brandColor,
    wordmark: brand.wordmark,
    bodyHtml: `
      <p style="margin:0 0 16px 0;font-size:16px;color:#0f172a;">Hi ${escapeHtml(user.name || 'there')},</p>
      <p style="margin:0 0 8px 0;color:#475569;line-height:1.7;">
        Thank you for your interest in ${escapeHtml(brand.name)}. We are not able to open a trial for this request right now. If you have questions, reply to this email.
      </p>`,
  });
  try {
    await sendEmail(
      user.email,
      `Update on your ${brand.name} trial request`,
      html,
      'We are not able to open a trial for this request right now.',
      { senderName: brand.name, system: true }
    );
  } catch (err) {
    logger.warn({ err: err.message }, 'Trial rejection buyer email failed');
  }
}

function shouldNotifySales(user) {
  if (!user.lastSalesNotifiedAt) return true;
  return Date.now() - new Date(user.lastSalesNotifiedAt).getTime() >= SALES_NOTIFY_COOLDOWN_MS;
}

async function afterRequestSaved(user, { isUpdate = false } = {}) {
  const notify = shouldNotifySales(user);
  if (notify) {
    const result = await notifySales(user, { isUpdate });
    if (result.sent) {
      user.lastSalesNotifiedAt = new Date();
      await user.save();
    }
  }
  if (!isUpdate) {
    notifyBuyerReceived(user).catch((err) => logger.warn({ err: err.message }, 'Buyer confirmation failed'));
  }
}

async function listTrialRequests(actor, { status } = {}) {
  assertPlatformOperator(actor);
  const allowed = new Set(['pending_approval', 'active', 'rejected']);
  const signupStatus = allowed.has(status) ? status : 'pending_approval';
  const users = await User.find({ signupStatus })
    .select('name email phone companyName signupStatus createdAt signupApprovedAt')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  return users.map(serializeRequest);
}

async function approveTrialRequest(userId, actor = null) {
  const user = await User.findById(userId);
  if (!user) throw httpError('Trial request not found', 404);

  if (user.signupStatus === 'active' && user.isEmailVerified) {
    return { success: true, alreadyApproved: true, email: user.email };
  }
  if (user.signupStatus === 'rejected') {
    throw httpError('This request was declined. Ask the buyer to submit again.', 400, { code: 'already_rejected' });
  }

  user.signupStatus = 'active';
  user.isEmailVerified = true;
  user.isActive = true;
  user.signupApprovedAt = new Date();
  if (actor?.id || actor?._id) user.signupApprovedBy = actor.id || actor._id;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  notifyBuyerApproved(user).catch((err) => logger.warn({ err: err.message }, 'Buyer approval email failed'));
  logger.info({ email: user.email }, 'Trial request approved');
  return { success: true, alreadyApproved: false, email: user.email };
}

async function rejectTrialRequest(userId, actor) {
  assertPlatformOperator(actor);
  const user = await User.findById(userId);
  if (!user) throw httpError('Trial request not found', 404);
  if (user.signupStatus === 'active' && user.isEmailVerified && user.organizationId) {
    throw httpError('This account is already active and cannot be declined from the trial queue', 400);
  }

  user.signupStatus = 'rejected';
  user.isActive = false;
  user.signupApprovedAt = new Date();
  if (actor?.id || actor?._id) user.signupApprovedBy = actor.id || actor._id;
  await user.save();

  notifyBuyerRejected(user).catch((err) => logger.warn({ err: err.message }, 'Buyer rejection email failed'));
  return { success: true, email: user.email };
}

async function approveWithToken(token) {
  if (!token) throw httpError('Missing approval token', 400);
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    throw httpError('This approval link is invalid or has expired', 400, { code: 'invalid_token' });
  }
  if (decoded.purpose !== 'trial_approve' || !decoded.id) {
    throw httpError('Invalid approval token', 400, { code: 'invalid_token' });
  }
  return approveTrialRequest(decoded.id);
}

module.exports = {
  SALES_INBOX,
  salesInbox,
  isPlatformOperator,
  assertPlatformOperator,
  afterRequestSaved,
  listTrialRequests,
  approveTrialRequest,
  rejectTrialRequest,
  approveWithToken,
  signApproveToken,
  publicApproveUrl,
};
