const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { validateSession, touchSession } = require('../services/sessionService');
const { ipMatchesAllowlist } = require('../utils/ipMatch');
const { getClientIp } = require('../utils/clientIp');

// FAIL CLOSED: No hardcoded fallback in production
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  logger.error('FATAL: JWT_SECRET environment variable is required in production');
  process.exit(1);
}
const SECRET = JWT_SECRET || 'dev-only-secret-CHANGE-IN-PRODUCTION';
if (!JWT_SECRET) {
  logger.warn('⚠️  WARNING: Using development JWT secret. Set JWT_SECRET env var for production.');
}

/**
 * Verify JWT token and attach user to request object
 * Checks if user is still active and if org is active
 */
const verifyToken = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.ats_token) {
    token = req.cookies.ats_token;
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    
    // Check if user still exists in DB
    const User = mongoose.model('User');
    const user = await User.findById(decoded.id).select('+isActive +role +organizationId +email +name +mfaEnabled +customRoleId');
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'The user belonging to this token no longer exists.' });
    }
    
    // Check if user is active
    if (user.isActive === false) {
      return res.status(401).json({ success: false, code: 'ACCOUNT_DEACTIVATED', message: 'Your account has been deactivated.' });
    }

    // Session policy (idle timeout / revocation)
    if (decoded.jti) {
      const sessionCheck = await validateSession(user._id, decoded.jti, user.organizationId);
      if (!sessionCheck.valid) {
        return res.status(401).json({
          success: false,
          code: sessionCheck.code,
          message: sessionCheck.message
        });
      }
      await touchSession(decoded.jti);
    }

    // Check organization if attached
    if (user.organizationId) {
      const Organization = mongoose.model('Organization');
      const org = await Organization.findById(user.organizationId).select('+isActive securitySettings plan');
      
      if (org && org.isActive === false) {
        return res.status(401).json({ success: false, code: 'ORG_DEACTIVATED', message: 'Your organization has been deactivated.' });
      }

      // MFA enforcement — block API access until enrolled
      const { planHasFeature } = require('../config/planFeatures');
      if (
        org?.securitySettings?.mfaEnforced &&
        planHasFeature(org.plan, 'security.mfaEnforcement') &&
        !user.mfaEnabled &&
        decoded.purpose !== 'mfa_enrollment'
      ) {
        return res.status(403).json({
          success: false,
          code: 'MFA_ENROLLMENT_REQUIRED',
          message: 'Your organization requires multi-factor authentication. Please enroll MFA before continuing.'
        });
      }

      // IP allowlist
      if (planHasFeature(org.plan, 'security.ipAllowlist')) {
        const allowlist = org.securitySettings?.ipAllowlist || [];
        if (allowlist.length) {
          const clientIp = getClientIp(req);
          if (!ipMatchesAllowlist(clientIp, allowlist)) {
            return res.status(403).json({
              success: false,
              code: 'IP_NOT_ALLOWED',
              message: 'Access from your IP address is not permitted by your organization security policy.'
            });
          }
        }
      }
    }

    req.user = {
      id: user._id,
      organizationId: user.organizationId,
      role: user.role,
      email: user.email,
      name: user.name,
      customRoleId: user.customRoleId || null,
      jti: decoded.jti
    };
    
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

/**
 * Optional Auth - Similar to verifyToken but doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.ats_token) {
    token = req.cookies.ats_token;
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    const User = mongoose.model('User');
    const user = await User.findById(decoded.id).select('+isActive +role +organizationId +email +name');
    
    if (user && user.isActive !== false) {
      let orgActive = true;
      if (user.organizationId) {
        const Organization = mongoose.model('Organization');
        const org = await Organization.findById(user.organizationId).select('+isActive');
        if (org && org.isActive === false) orgActive = false;
      }

      if (orgActive) {
        req.user = {
          id: user._id,
          organizationId: user.organizationId,
          role: user.role,
          email: user.email,
          name: user.name,
          jti: decoded.jti
        };
      }
    }
    next();
  } catch (err) {
    // If token verification fails, just ignore and treat as unauthenticated
    next();
  }
};

/**
 * Generate JWT token for user (legacy — no session tracking).
 * Prefer issueAuthToken from sessionService for new logins.
 * @param {Object} user User document
 * @returns {string} JWT Token
 */
const generateToken = (user) => {
  return jwt.sign({
    id: user._id,
    organizationId: user.organizationId,
    role: user.role,
    email: user.email,
    name: user.name
  }, SECRET, {
    expiresIn: '7d'
  });
};

module.exports = {
  verifyToken,
  generateToken,
  optionalAuth,
  JWT_SECRET: SECRET
};
