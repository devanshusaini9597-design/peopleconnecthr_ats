/**
 * Auth domain logic — login, register, password reset, refresh.
 */
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Organization = require('../models/Organization');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { issueAuthToken } = require('./sessionService');
const { getEntitlements, planHasFeature } = require('../config/planFeatures');
const { ensureOrgPlanForDomain } = require('../utils/orgDomain');
const { sendEmail } = require('./emailService');
const { wrapBrandedEmailHtml, brandButtonHtml, loadPlatformEmailBrand, loadOrgEmailBrand, escapeHtml: escapeHtmlLocal } = require('./emailBrandLayout');
const { normalizeText } = require('../utils/textNormalize');
const logger = require('../utils/logger');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

async function login(email, password, req) {
  if (!email || !password) {
    throw httpError('Email and password required', 400);
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+mfaEnabled');

  if (!user) {
    throw httpError('invalid_credentials', 401, {
      displayMessage: 'Invalid email or password.',
    });
  }

  if (!user.isActive) {
    throw httpError('account_deactivated', 401, {
      displayMessage: 'Your account has been deactivated. Please contact your administrator.',
    });
  }

  if (!user.password.startsWith('$2')) {
    logger.warn({ email: user.email }, 'Legacy plaintext password — forcing reset');
    throw httpError('password_upgrade_required', 401, {
      displayMessage:
        'Your account requires a password reset for security. Please use "Forgot Password" to set a new password.',
    });
  }

  let passwordMatch = false;
  try {
    passwordMatch = await bcrypt.compare(password, user.password);
  } catch (bcryptErr) {
    logger.error({ err: bcryptErr }, 'bcrypt.compare failed');
    throw httpError('Internal server error during authentication', 500);
  }

  if (!passwordMatch) {
    throw httpError('invalid_credentials', 401, {
      displayMessage: 'Invalid email or password.',
    });
  }

  // Password is correct but email never verified — send them back to verify step
  if (!user.isEmailVerified) {
    throw httpError('email_unverified', 403, {
      displayMessage:
        'Your email is not verified yet. Please verify your email to continue, or request a new verification link.',
      email: user.email,
    });
  }

  let organization = null;
  let entitlements = [];
  if (user.organizationId) {
    await ensureOrgPlanForDomain(user.organizationId, user.email);
    organization = await Organization.findById(user.organizationId)
      .select('name slug logo plan planExpiresAt atsSettings settings securitySettings domain')
      .lean();
    if (organization) {
      entitlements = getEntitlements(organization.plan);
    }
  }

  if (
    organization?.securitySettings?.mfaEnforced &&
    planHasFeature(organization.plan, 'security.mfaEnforcement') &&
    !user.mfaEnabled
  ) {
    const enrollmentToken = jwt.sign(
      { id: user._id, purpose: 'mfa_enrollment' },
      JWT_SECRET,
      { expiresIn: '30m' }
    );
    return {
      kind: 'mfa_enrollment',
      payload: {
        message: 'MFA enrollment required',
        requiresMfaEnrollment: true,
        enrollmentToken,
        user: { email: user.email, name: user.name || '' },
      },
    };
  }

  if (user.mfaEnabled) {
    const mfaToken = jwt.sign(
      { id: user._id, purpose: 'mfa_pending' },
      JWT_SECRET,
      { expiresIn: '5m' }
    );
    return {
      kind: 'mfa_pending',
      payload: {
        message: 'MFA required',
        requiresMfa: true,
        mfaToken,
        user: { email: user.email, name: user.name || '' },
      },
    };
  }

  user.lastLoginAt = new Date();
  // Invited / joined users with an org should never remain stuck on org-setup
  if (user.organizationId && user.onboardingCompleted === false) {
    user.onboardingCompleted = true;
  }
  await user.save();

  const token = await issueAuthToken(user, req);
  const { getEffectivePermissions } = require('../middleware/permissionMiddleware');
  const permissions = await getEffectivePermissions(user);

  return {
    kind: 'success',
    token,
    payload: {
      message: 'Login Successful',
      user: {
        name: user.name || '',
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        organizationId: user.organizationId,
        isEmailVerified: user.isEmailVerified,
        onboardingCompleted: user.onboardingCompleted,
        profilePicture: user.profilePicture || '',
        mfaEnabled: user.mfaEnabled,
        customRoleId: user.customRoleId || null,
        permissions,
      },
      organization,
      entitlements,
    },
  };
}

async function register({ name, email, phone, password }) {
  if (!email || !password) {
    throw httpError('Email and password required', 400);
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw httpError('User already exists', 400);
  }

  const newUser = new User({
    name: normalizeText(name || ''),
    email: email.toLowerCase().trim(),
    phone: phone?.trim() || '',
    password,
  });
  await newUser.save();
  return { message: 'Registration successful' };
}

async function forgotPassword(email) {
  if (!email) throw httpError('Email is required', 400, { success: false });

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    return {
      success: true,
      message: 'If this email is registered, you will receive a reset link.',
    };
  }

  const resetToken = jwt.sign(
    { id: user._id, email: user.email, purpose: 'password-reset' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

  try {
    const brand = user.organizationId
      ? await loadOrgEmailBrand(user.organizationId)
      : loadPlatformEmailBrand();
    const htmlBody = wrapBrandedEmailHtml({
      title: 'Reset your password',
      eyebrow: 'Account security',
      orgName: brand.name,
      logoUrl: brand.logoUrl,
      brandColor: brand.brandColor,
      wordmark: brand.wordmark,
      bodyHtml: `
        <p style="margin:0 0 16px 0;font-size:16px;color:#0f172a;">Hi ${escapeHtmlLocal(user.name) || 'there'},</p>
        <p style="margin:0 0 8px 0;color:#475569;line-height:1.7;">We received a request to reset the password for your <strong style="color:#0f172a;">${escapeHtmlLocal(brand.name)}</strong> account. Use the button below to choose a new password.</p>
        <div style="text-align:center;">
          ${brandButtonHtml({ href: resetUrl, label: 'Reset my password', brandColor: brand.brandColor })}
        </div>
        <p style="margin:24px 0 0 0;color:#64748b;font-size:13px;line-height:1.6;">This one-time link expires in <strong style="color:#334155;">15 minutes</strong>. If you didn't request this, you can ignore this email — your password will not change.</p>
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #eef0f3;">
          <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">Button not working? Copy and paste this link into your browser:<br><a href="${resetUrl}" style="color:${brand.brandColor};word-break:break-all;">${resetUrl}</a></p>
        </div>`,
    });

    await sendEmail(
      user.email,
      `Reset your password – ${brand.name}`,
      htmlBody,
      `Reset your password: ${resetUrl} (expires in 15 minutes)`,
      { senderName: brand.name, userId: user._id, organizationId: user.organizationId || undefined, system: true }
    );
  } catch (emailErr) {
    logger.error({ err: emailErr }, 'PASSWORD-RESET email send failed');
    if (emailErr.message === 'EMAIL_NOT_CONFIGURED') {
      if (process.env.NODE_ENV !== 'production') {
        logger.warn({ resetUrl }, 'Dev-only reset URL (NOT sent to client)');
      }
      throw httpError(
        'Password reset email could not be sent. Please contact your administrator to configure email, or try again later.',
        503,
        { success: false }
      );
    }
  }

  return {
    success: true,
    message: 'If this email is registered, you will receive a reset link.',
  };
}

function verifyResetToken(token) {
  if (!token) throw httpError('Token is required', 400, { success: false });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.purpose !== 'password-reset') {
      throw httpError('Invalid token type', 400, { success: false });
    }
    return { success: true, email: decoded.email };
  } catch (err) {
    if (err.statusCode) throw err;
    if (err.name === 'TokenExpiredError') {
      throw httpError('Reset link has expired. Please request a new one.', 400, { success: false });
    }
    throw httpError('Invalid or expired reset link', 400, { success: false });
  }
}

async function resetPassword(token, newPassword) {
  if (!token || !newPassword) {
    throw httpError('Token and new password required', 400, { success: false });
  }
  if (newPassword.length < 8) {
    throw httpError('Password must be at least 8 characters', 400, { success: false });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw httpError('Reset link has expired. Please request a new one.', 400, { success: false });
    }
    throw httpError('Failed to reset password', 500, { success: false });
  }

  if (decoded.purpose !== 'password-reset') {
    throw httpError('Invalid token type', 400, { success: false });
  }

  const user = await User.findById(decoded.id);
  if (!user) throw httpError('User not found', 404, { success: false });

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  return {
    success: true,
    message: 'Password reset successfully. You can now login with your new password.',
  };
}

async function refreshSession(userId, req) {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw httpError('Invalid session', 401, { success: false });
  }
  const token = await issueAuthToken(user, req);
  return { token, payload: { success: true, message: 'Token refreshed' } };
}

module.exports = {
  login,
  register,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  refreshSession,
};
