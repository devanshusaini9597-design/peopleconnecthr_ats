/**
 * Auth domain logic — login, demo, register, password reset, refresh.
 */
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Organization = require('../models/Organization');
const { generateToken, JWT_SECRET } = require('../middleware/authMiddleware');
const { issueAuthToken } = require('./sessionService');
const { getEntitlements, planHasFeature } = require('../config/planFeatures');
const { sendEmail } = require('./emailService');
const { normalizeText } = require('../utils/textNormalize');
const { createDemoAccount } = require('./demoAccountService');
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
    organization = await Organization.findById(user.organizationId)
      .select('name slug logo plan planExpiresAt atsSettings settings securitySettings')
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

async function demoLogin() {
  const { user, organization } = await createDemoAccount();
  const token = generateToken(user);
  return {
    token,
    payload: {
      message: 'Demo login successful',
      user: {
        name: user.name || 'Demo Recruiter',
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        isEmailVerified: user.isEmailVerified,
        onboardingCompleted: user.onboardingCompleted,
        profilePicture: user.profilePicture || '',
      },
      organization,
      entitlements: getEntitlements(organization.plan),
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
    const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; padding: 30px 20px; background: linear-gradient(135deg, #4F46E5, #7C3AED); border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Password Reset</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">SkillNix ATS</p>
          </div>
          <div style="padding: 30px 20px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">Hi ${user.name || 'there'},</p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">We received a request to reset your password. Click the button below to create a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background: #4F46E5; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Reset My Password</a>
            </div>
            <p style="color: #6B7280; font-size: 13px; line-height: 1.6;">This link expires in <strong>15 minutes</strong>. If you didn't request this, you can safely ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #9CA3AF; font-size: 12px;">If the button doesn't work, copy and paste this URL:<br><a href="${resetUrl}" style="color: #4F46E5; word-break: break-all;">${resetUrl}</a></p>
          </div>
        </div>
      `;

    await sendEmail(
      user.email,
      'Reset Your Password - SkillNix ATS',
      htmlBody,
      `Reset your password: ${resetUrl} (expires in 15 minutes)`,
      { userId: user._id }
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
  demoLogin,
  register,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  refreshSession,
};
