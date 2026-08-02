/**
 * MFA routes — TOTP enrollment and verification.
 *
 * Public:
 *   POST /verify-mfa — complete login after password step
 *
 * Protected (verifyToken):
 *   GET  /status
 *   POST /setup — requires security.mfa
 *   POST /verify-setup
 *   POST /disable
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const { verifyToken, JWT_SECRET } = require('../middleware/authMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { requireOrganization } = require('../middleware/tenantMiddleware');
const { getEntitlements } = require('../config/planFeatures');
const User = require('../models/User');
const Organization = require('../models/Organization');
const {
  generateSecret,
  keyUri,
  encryptSecret,
  verifyTotp,
  generateBackupCodes,
  verifyBackupCode
} = require('../services/mfaService');
const { issueAuthToken } = require('../services/sessionService');

const buildLoginPayload = async (user) => {
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
};

/** Accept enrollment token (MFA required by org) or normal JWT for setup routes */
const verifyMfaAccess = async (req, res, next) => {
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
};

router.get('/status', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('mfaEnabled mfaBackupCodes');
    const remaining = user?.mfaBackupCodes?.filter((c) => !c.used).length || 0;
    res.json({
      success: true,
      data: { mfaEnabled: !!user?.mfaEnabled, backupCodesRemaining: remaining }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/setup', verifyMfaAccess, requireOrganization, requireFeature('security.mfa'), async (req, res) => {
  try {
    const user = req.mfaUser || await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.mfaEnabled) {
      return res.status(400).json({ success: false, message: 'MFA is already enabled' });
    }

    const secret = generateSecret();
    user.mfaSecret = encryptSecret(secret);
    await user.save();

    res.json({
      success: true,
      data: {
        secret,
        otpauthUrl: keyUri(user.email, secret)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/verify-setup', verifyMfaAccess, requireOrganization, requireFeature('security.mfa'), async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Verification code is required' });

    const user = await User.findById(req.user.id).select('+mfaSecret +mfaBackupCodes');
    if (!user?.mfaSecret) {
      return res.status(400).json({ success: false, message: 'Run MFA setup first' });
    }

    if (!verifyTotp(user.mfaSecret, code)) {
      return res.status(400).json({ success: false, message: 'Invalid verification code' });
    }

    const { plainCodes, hashedCodes } = await generateBackupCodes();
    user.mfaEnabled = true;
    user.mfaBackupCodes = hashedCodes;
    await user.save();

    // If enrolling under org enforcement, issue full session token
    let token = null;
    let loginPayload = null;
    if (req.user.purpose === 'mfa_enrollment') {
      token = await issueAuthToken(user, req);
      loginPayload = await buildLoginPayload(user);
    }

    res.json({
      success: true,
      message: 'MFA enabled successfully',
      backupCodes: plainCodes,
      token,
      ...loginPayload
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/disable', verifyToken, requireOrganization, requireFeature('security.mfa'), async (req, res) => {
  try {
    const { password, code } = req.body;
    const user = await User.findById(req.user.id).select('+password +mfaSecret +mfaBackupCodes');
    if (!user?.mfaEnabled) {
      return res.status(400).json({ success: false, message: 'MFA is not enabled' });
    }

    const passwordOk = await user.comparePassword(password);
    if (!passwordOk) {
      return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    const totpOk = code && verifyTotp(user.mfaSecret, code);
    const backupOk = !totpOk && await verifyBackupCode(user, code);
    if (!totpOk && !backupOk) {
      return res.status(400).json({ success: false, message: 'Invalid MFA code' });
    }

    // Block disable when org enforces MFA
    const org = await Organization.findById(user.organizationId).select('plan securitySettings');
    const { planHasFeature } = require('../config/planFeatures');
    if (org?.securitySettings?.mfaEnforced && planHasFeature(org.plan, 'security.mfaEnforcement')) {
      return res.status(403).json({
        success: false,
        code: 'MFA_ENFORCED',
        message: 'Your organization requires MFA and it cannot be disabled.'
      });
    }

    user.mfaEnabled = false;
    user.mfaSecret = null;
    user.mfaBackupCodes = [];
    await user.save();

    res.json({ success: true, message: 'MFA disabled' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/verify-mfa', async (req, res) => {
  try {
    const { mfaToken, code } = req.body;
    if (!mfaToken || !code) {
      return res.status(400).json({ success: false, message: 'mfaToken and code are required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(mfaToken, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'MFA session expired. Please sign in again.' });
    }

    if (decoded.purpose !== 'mfa_pending') {
      return res.status(401).json({ success: false, message: 'Invalid MFA token' });
    }

    const user = await User.findById(decoded.id).select('+mfaSecret +mfaBackupCodes');
    if (!user || !user.mfaEnabled) {
      return res.status(401).json({ success: false, message: 'MFA not configured for this account' });
    }

    const totpOk = verifyTotp(user.mfaSecret, code);
    let backupUsed = false;
    if (!totpOk) {
      backupUsed = await verifyBackupCode(user, code);
      if (backupUsed) await user.save();
    }

    if (!totpOk && !backupUsed) {
      return res.status(401).json({ success: false, message: 'Invalid verification code' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = await issueAuthToken(user, req);
    const payload = await buildLoginPayload(user);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      ...payload
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
