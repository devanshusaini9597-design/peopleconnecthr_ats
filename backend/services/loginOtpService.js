/**
 * Email OTP for every password login.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendEmail } = require('./emailService');
const {
  wrapBrandedEmailHtml,
  otpCodeHtml,
  brandButtonHtml,
  loadSendingEmailBrand,
  loginPageUrl,
  loginOtpResendUrl,
  escapeHtml,
} = require('./emailBrandLayout');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_MS = 45 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_SELECT = '+loginOtpHash +loginOtpExpires +loginOtpAttempts +loginOtpSentAt';

/** Temporary pause — password login skips the email code. OTP code stays in place. */
function isLoginOtpPaused() {
  if (String(process.env.NODE_ENV || '').trim() === 'production') return false;
  const v = String(process.env.LOGIN_OTP_PAUSED || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashOtp(userId, code) {
  return crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${String(userId)}:${String(code).trim()}`)
    .digest('hex');
}

function otpMatches(userId, code, storedHash) {
  if (!storedHash || !code) return false;
  const expected = hashOtp(userId, code);
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(String(storedHash), 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function signOtpToken(userId) {
  return jwt.sign(
    { id: String(userId), purpose: 'login_otp' },
    JWT_SECRET,
    { expiresIn: '10m' }
  );
}

function readOtpToken(token) {
  if (!token) throw httpError('Enter the code from your email to continue.', 400);
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw httpError('This sign-in code expired. Sign in again to get a new one.', 401);
    }
    throw httpError('This sign-in session expired. Please sign in again.', 401);
  }
  if (decoded.purpose !== 'login_otp' || !decoded.id) {
    throw httpError('Invalid sign-in session. Please sign in again.', 401);
  }
  return decoded;
}

function buildOtpEmailHtml(user, code, brand, { otpToken } = {}) {
  const first = escapeHtml((user.name || 'there').split(' ')[0] || 'there');
  const signInUrl = loginPageUrl();
  const resendUrl = loginOtpResendUrl({ otpToken, email: user.email });
  return wrapBrandedEmailHtml({
    title: 'Your sign-in code',
    eyebrow: 'Account security',
    orgName: brand.name,
    logoUrl: brand.logoUrl,
    brandColor: brand.brandColor,
    wordmark: brand.wordmark,
    senderName: brand.name,
    senderEmail: brand.fromEmail,
    websiteUrl: brand.websiteUrl,
    supportEmail: brand.supportEmail,
    socialLinks: brand.socialLinks,
    bodyHtml: `
      <p style="margin:0 0 12px 0;font-size:16px;color:#0f172a;">Hi ${first},</p>
      <p style="margin:0 0 4px 0;color:#475569;line-height:1.7;">
        Use this one-time code to finish signing in to <strong style="color:#0f172a;">${escapeHtml(brand.name)}</strong>.
      </p>
      ${otpCodeHtml(code, brand.brandColor)}
      <p style="margin:16px 0 0 0;color:#64748b;font-size:13px;line-height:1.65;">
        If you did not try to sign in, you can ignore this email. Do not forward this code to anyone.
      </p>
      <div style="text-align:center;">
        ${brandButtonHtml({ href: resendUrl, label: 'Resend a new code', brandColor: brand.brandColor })}
      </div>
      <p style="margin:0 0 8px 0;text-align:center;color:#64748b;font-size:13px;line-height:1.6;">
        Already have the code?
        <a href="${escapeHtml(signInUrl)}" style="color:${brand.brandColor};font-weight:600;text-decoration:none;">Return to sign in</a>
      </p>`,
  });
}

async function sendLoginOtpEmail(user, code, otpToken) {
  const brand = await loadSendingEmailBrand({
    userId: user._id,
    organizationId: user.organizationId || undefined,
    system: true,
  });
  const html = buildOtpEmailHtml(user, code, brand, { otpToken });
  const text = [
    `Your ${brand.name} sign-in code is ${code}. It expires in 10 minutes.`,
    `Need a new code? ${loginOtpResendUrl({ otpToken, email: user.email })}`,
  ].join('\n');
  try {
    await sendEmail(
      user.email,
      `Your ${brand.name} sign-in code`,
      html,
      text,
      {
        senderName: brand.name,
        senderEmail: brand.fromEmail,
        userId: user._id,
        organizationId: user.organizationId || undefined,
        system: true,
      }
    );
    return { sent: true };
  } catch (err) {
    logger.error({ err: err.message, email: user.email }, 'Login OTP email failed');
    if (err.message === 'EMAIL_NOT_CONFIGURED' && process.env.NODE_ENV !== 'test') {
      logger.warn({ email: user.email }, 'Dev-only login OTP (email not configured)');
    }
    // Never block password login if mail delivery fails — user can tap Resend.
    return { sent: false, error: err.message };
  }
}

async function persistAndSendOtp(user) {
  const code = generateOtp();
  user.loginOtpHash = hashOtp(user._id, code);
  user.loginOtpExpires = new Date(Date.now() + OTP_TTL_MS);
  user.loginOtpAttempts = 0;
  user.loginOtpSentAt = new Date();
  await user.save();
  const otpToken = signOtpToken(user._id);
  const mail = await sendLoginOtpEmail(user, code, otpToken);
  return { otpToken, emailSent: Boolean(mail?.sent) };
}

async function issueLoginOtpChallenge(user) {
  const { otpToken, emailSent } = await persistAndSendOtp(user);
  return {
    kind: 'login_otp',
    payload: {
      message: emailSent
        ? 'Enter the 6-digit code we emailed you.'
        : 'We could not deliver the email just now. Use Resend code, or check spam.',
      requiresOtp: true,
      otpToken,
      emailSent,
      user: { email: user.email, name: user.name || '' },
    },
  };
}

async function verifyLoginOtp({ otpToken, code }, req) {
  const decoded = readOtpToken(otpToken);
  const cleaned = String(code || '').replace(/\D/g, '').slice(0, 6);
  if (cleaned.length !== 6) {
    throw httpError('Enter the 6-digit code from your email.');
  }

  const user = await User.findById(decoded.id).select(OTP_SELECT);
  if (!user || !user.isActive) {
    throw httpError('This sign-in session expired. Please sign in again.', 401);
  }
  if (user.signupStatus === 'pending_approval' || user.signupStatus === 'rejected') {
    throw httpError('Your trial request is still under review.', 403);
  }

  if (!user.loginOtpHash || !user.loginOtpExpires || user.loginOtpExpires.getTime() < Date.now()) {
    throw httpError('This sign-in code expired. Sign in again to get a new one.', 401);
  }

  const attempts = Number(user.loginOtpAttempts || 0);
  if (attempts >= OTP_MAX_ATTEMPTS) {
    user.loginOtpHash = undefined;
    user.loginOtpExpires = undefined;
    user.loginOtpAttempts = 0;
    await user.save();
    throw httpError('Too many incorrect codes. Sign in again to get a new one.', 401);
  }

  if (!otpMatches(user._id, cleaned, user.loginOtpHash)) {
    user.loginOtpAttempts = attempts + 1;
    await user.save();
    throw httpError('That code is incorrect. Check the email and try again.', 401);
  }

  user.loginOtpHash = undefined;
  user.loginOtpExpires = undefined;
  user.loginOtpAttempts = 0;
  user.loginOtpSentAt = undefined;
  await user.save();

  const withMfa = await User.findById(user._id).select('+mfaEnabled');
  if (withMfa?.mfaEnabled) {
    const mfaToken = jwt.sign(
      { id: String(user._id), purpose: 'mfa_pending' },
      JWT_SECRET,
      { expiresIn: '10m' }
    );
    return {
      kind: 'mfa_pending',
      payload: {
        requiresMfa: true,
        mfaToken,
        message: 'Enter the code from your authenticator app.',
        user: { email: user.email, name: user.name || '' },
      },
    };
  }

  const { completeLogin } = require('./authService');
  return completeLogin(user, req);
}

async function resendLoginOtp({ otpToken }) {
  const decoded = readOtpToken(otpToken);
  const user = await User.findById(decoded.id).select(OTP_SELECT);
  if (!user || !user.isActive) {
    throw httpError('This sign-in session expired. Please sign in again.', 401);
  }

  if (user.loginOtpSentAt && Date.now() - user.loginOtpSentAt.getTime() < OTP_RESEND_MS) {
    throw httpError('Please wait a few seconds before requesting another code.', 429);
  }

  const { otpToken: nextToken, emailSent } = await persistAndSendOtp(user);
  return {
    success: true,
    otpToken: nextToken,
    emailSent,
    message: emailSent
      ? 'A new sign-in code is on its way.'
      : 'We could not deliver the email just now. Please try Resend again in a moment.',
  };
}

module.exports = {
  generateOtp,
  hashOtp,
  otpMatches,
  isLoginOtpPaused,
  issueLoginOtpChallenge,
  verifyLoginOtp,
  resendLoginOtp,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
};
