/**
 * Auth domain logic — login, register, password reset, refresh.
 */
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Organization = require('../models/Organization');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { issueAuthToken, reissueSessionToken, revokeAllSessionsForUser } = require('./sessionService');
const { getEntitlements } = require('../config/planFeatures');
const { ensureOrgPlanForDomain } = require('../utils/orgDomain');
const { sendEmail } = require('./emailService');
const { wrapBrandedEmailHtml, brandButtonHtml, loadSendingEmailBrand, escapeHtml: escapeHtmlLocal } = require('./emailBrandLayout');
const { isDevTempPasswordLogin } = require('../utils/devTempPassword');
const logger = require('../utils/logger');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

function isOwnerOtpBypassEnabledForUser(user) {
  if (String(process.env.NODE_ENV || '').trim() === 'production') return false;
  const bypassEnabled = String(process.env.OWNER_OTP_BYPASS_ENABLED || '').trim() === '1';
  const bypassEmail = String(process.env.OWNER_OTP_BYPASS_EMAIL || '').trim().toLowerCase();
  if (!bypassEnabled || !bypassEmail) return false;
  return String(user?.email || '').trim().toLowerCase() === bypassEmail;
}

async function login(email, password, req) {
  if (!email || !password) {
    throw httpError('Email and password required', 400);
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+mfaEnabled');

  if (!user) {
    throw httpError('email_not_registered', 404, {
      displayMessage: 'This email is not registered. Request access or check the address.',
      email: email.toLowerCase().trim(),
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

  // Dual login for configured domain:
  // 1) employee's own stored password (normal + OTP), AND/OR
  // 2) DEV_TEMP_PASSWORD from env (QA overlay — never written to DB).
  const usedDevTempPassword = isDevTempPasswordLogin(user.email, password, user.organizationId);
  if (usedDevTempPassword) {
    logger.warn({ email: user.email }, 'Dev temp password accepted — stored password unchanged');
    passwordMatch = true;
  }

  if (!passwordMatch) {
    throw httpError('invalid_credentials', 401, {
      displayMessage: 'Invalid email or password.',
    });
  }

  if (user.signupStatus === 'pending_approval') {
    throw httpError('signup_pending_approval', 403, {
      displayMessage:
        'Your trial request is being reviewed. Our team will contact you shortly. You can sign in after approval.',
      email: user.email,
    });
  }

  if (user.signupStatus === 'rejected') {
    throw httpError('signup_rejected', 403, {
      displayMessage:
        'This trial request was not approved. Please contact our sales team if you have questions.',
      email: user.email,
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

  // Break-glass: owner bypass, global pause, or developer temp password (QA only).
  // Employees using their own password still get the normal OTP challenge.
  const { issueLoginOtpChallenge, isLoginOtpPaused } = require('./loginOtpService');
  if (usedDevTempPassword || isOwnerOtpBypassEnabledForUser(user) || isLoginOtpPaused()) {
    if (usedDevTempPassword) {
      logger.warn({ email: user.email }, 'Dev temp password login — skipping OTP');
    } else if (isLoginOtpPaused()) {
      logger.warn({ email: user.email }, 'Login OTP paused — completing password login');
    } else {
      logger.warn({ email: user.email }, 'Owner OTP bypass used');
    }
    return completeLogin(user, req);
  }

  return issueLoginOtpChallenge(user);
}

async function completeLogin(user, req) {
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

  user.lastLoginAt = new Date();
  user.lastActiveAt = new Date();
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
        mustChangePassword: Boolean(user.mustChangePassword),
        customRoleId: user.customRoleId || null,
        isPlatformOperator: require('../utils/orgDomain').isPlatformOperator(user),
        permissions,
      },
      organization,
      entitlements,
    },
  };
}

async function register(body) {
  const onboarding = require('./onboardingService');
  return onboarding.register(body);
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
    const brand = await loadSendingEmailBrand({
      userId: user._id,
      organizationId: user.organizationId || undefined,
      system: true,
    });
    const htmlBody = wrapBrandedEmailHtml({
      title: 'Reset your password',
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
      { senderName: brand.name, senderEmail: brand.fromEmail, userId: user._id, organizationId: user.organizationId || undefined, system: true }
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

  // Hash once and $set — never store DEV_TEMP_PASSWORD and avoid double-hash via save hooks
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await User.updateOne(
    { _id: user._id },
    {
      $set: { password: passwordHash },
      $unset: {
        loginOtpHash: 1,
        loginOtpExpires: 1,
        loginOtpAttempts: 1,
        loginOtpSentAt: 1,
      },
    }
  );
  await revokeAllSessionsForUser(user._id);

  return {
    success: true,
    message: 'Password reset successfully. You can now login with your new password.',
  };
}

async function refreshSession(userId, req) {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw httpError('Invalid session', 401, { success: false, code: 'SESSION_REVOKED' });
  }
  if (user.signupStatus === 'pending_approval' || user.signupStatus === 'rejected') {
    throw httpError('Invalid session', 401, { success: false, code: 'SESSION_REVOKED' });
  }
  const jti = req.user && req.user.jti;
  const { token, remainingMs } = await reissueSessionToken(user, jti);
  return { token, remainingMs, payload: { success: true, message: 'Token refreshed' } };
}

module.exports = {
  login,
  completeLogin,
  register,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  refreshSession,
};
