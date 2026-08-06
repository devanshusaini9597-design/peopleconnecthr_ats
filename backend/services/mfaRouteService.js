/**
 * MFA route domain — enrollment, verify-setup, disable, login completion.
 * Crypto/TOTP helpers live in mfaService.js (do not duplicate).
 */
const jwt = require('jsonwebtoken');

const { verifyToken, JWT_SECRET } = require('../middleware/authMiddleware');
const { getEntitlements, planHasFeature } = require('../config/planFeatures');
const User = require('../models/User');
const Organization = require('../models/Organization');
const {
  generateSecret,
  keyUri,
  encryptSecret,
  verifyTotp,
  generateBackupCodes,
  verifyBackupCode
} = require('./mfaService');
const { issueAuthToken } = require('./sessionService');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

async function buildLoginPayload(user) {
  let organization = null;
  let entitlements = [];
  if (user.organizationId) {
    organization = await Organization.findById(user.organizationId)
      .select('name slug logo plan planExpiresAt atsSettings settings deploymentTier securitySettings')
      .lean();
    if (organization) {
      entitlements = getEntitlements(organization.plan);
    }
  }
  return {
    user: {
      name: user.name || '',
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      organizationId: user.organizationId,
      isEmailVerified: user.isEmailVerified,
      onboardingCompleted: user.onboardingCompleted,
      profilePicture: user.profilePicture || '',
      mfaEnabled: user.mfaEnabled
    },
    organization,
    entitlements
  };
}

/** Accept enrollment token (MFA required by org) or normal JWT for setup routes */
async function verifyMfaAccess(req, res, next) {
  const authHeader = req.headers.authorization;
  const bodyToken = req.body?.enrollmentToken || req.body?.token;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : bodyToken;

  if (!token) {
    return verifyToken(req, res, next);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.purpose === 'mfa_enrollment' || decoded.purpose === 'mfa_pending') {
      const user = await User.findById(decoded.id).select('+mfaSecret +mfaBackupCodes');
      if (!user || !user.isActive) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
      }
      req.user = {
        id: user._id,
        organizationId: user.organizationId,
        role: user.role,
        email: user.email,
        name: user.name,
        purpose: decoded.purpose
      };
      req.mfaUser = user;
      return next();
    }
    req.headers.authorization = `Bearer ${token}`;
    return verifyToken(req, res, next);
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

async function getStatus(userId) {
  const user = await User.findById(userId).select('mfaEnabled mfaBackupCodes');
  const remaining = user?.mfaBackupCodes?.filter((c) => !c.used).length || 0;
  return { mfaEnabled: !!user?.mfaEnabled, backupCodesRemaining: remaining };
}

async function setupMfa(reqUser, mfaUser) {
  const user = mfaUser || await User.findById(reqUser.id);
  if (!user) throw httpError('User not found', 404);
  if (user.mfaEnabled) {
    throw httpError('MFA is already enabled');
  }

  const secret = generateSecret();
  user.mfaSecret = encryptSecret(secret);
  await user.save();

  return {
    secret,
    otpauthUrl: keyUri(user.email, secret)
  };
}

async function verifySetup(reqUser, code, req) {
  if (!code) throw httpError('Verification code is required');

  const user = await User.findById(reqUser.id).select('+mfaSecret +mfaBackupCodes');
  if (!user?.mfaSecret) {
    throw httpError('Run MFA setup first');
  }

  if (!verifyTotp(user.mfaSecret, code)) {
    throw httpError('Invalid verification code');
  }

  const { plainCodes, hashedCodes } = await generateBackupCodes();
  user.mfaEnabled = true;
  user.mfaBackupCodes = hashedCodes;
  await user.save();

  let token = null;
  let loginPayload = null;
  if (reqUser.purpose === 'mfa_enrollment') {
    token = await issueAuthToken(user, req);
    loginPayload = await buildLoginPayload(user);
  }

  return {
    setCookieToken: token,
    body: {
      success: true,
      message: 'MFA enabled successfully',
      backupCodes: plainCodes,
      ...loginPayload
    }
  };
}

async function disableMfa(userId, { password, code }) {
  const user = await User.findById(userId).select('+password +mfaSecret +mfaBackupCodes');
  if (!user?.mfaEnabled) {
    throw httpError('MFA is not enabled');
  }

  const passwordOk = await user.comparePassword(password);
  if (!passwordOk) {
    throw httpError('Invalid password', 401);
  }

  const totpOk = code && verifyTotp(user.mfaSecret, code);
  const backupOk = !totpOk && await verifyBackupCode(user, code);
  if (!totpOk && !backupOk) {
    throw httpError('Invalid MFA code');
  }

  const org = await Organization.findById(user.organizationId).select('plan securitySettings');
  if (org?.securitySettings?.mfaEnforced && planHasFeature(org.plan, 'security.mfaEnforcement')) {
    throw httpError('Your organization requires MFA and it cannot be disabled.', 403, {
      code: 'MFA_ENFORCED'
    });
  }

  user.mfaEnabled = false;
  user.mfaSecret = null;
  user.mfaBackupCodes = [];
  await user.save();

  return { success: true, message: 'MFA disabled' };
}

async function verifyMfaLogin({ mfaToken, code }, req) {
  if (!mfaToken || !code) {
    throw httpError('mfaToken and code are required');
  }

  let decoded;
  try {
    decoded = jwt.verify(mfaToken, JWT_SECRET);
  } catch (err) {
    throw httpError('MFA session expired. Please sign in again.', 401);
  }

  if (decoded.purpose !== 'mfa_pending') {
    throw httpError('Invalid MFA token', 401);
  }

  const user = await User.findById(decoded.id).select('+mfaSecret +mfaBackupCodes');
  if (!user || !user.mfaEnabled) {
    throw httpError('MFA not configured for this account', 401);
  }

  const totpOk = verifyTotp(user.mfaSecret, code);
  let backupUsed = false;
  if (!totpOk) {
    backupUsed = await verifyBackupCode(user, code);
    if (backupUsed) await user.save();
  }

  if (!totpOk && !backupUsed) {
    throw httpError('Invalid verification code', 401);
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = await issueAuthToken(user, req);
  const payload = await buildLoginPayload(user);

  return {
    setCookieToken: token,
    body: {
      success: true,
      message: 'Login successful',
      ...payload
    }
  };
}

module.exports = {
  buildLoginPayload,
  verifyMfaAccess,
  getStatus,
  setupMfa,
  verifySetup,
  disableMfa,
  verifyMfaLogin
};
