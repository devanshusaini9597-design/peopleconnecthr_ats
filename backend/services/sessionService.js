const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const UserSession = require('../models/UserSession');
const Organization = require('../models/Organization');
const { planHasFeature } = require('../config/planFeatures');
const { getClientIp } = require('../utils/clientIp');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-CHANGE-IN-PRODUCTION';

const createSession = async (user, req) => {
  const jti = crypto.randomUUID();
  const session = await UserSession.create({
    userId: user._id,
    organizationId: user.organizationId,
    jti,
    ip: getClientIp(req),
    userAgent: req.headers['user-agent'] || '',
    lastActivityAt: new Date()
  });

  if (user.organizationId) {
    const org = await Organization.findById(user.organizationId)
      .select('plan securitySettings');
    if (org && planHasFeature(org.plan, 'security.sessionPolicy')) {
      const max = org.securitySettings?.maxConcurrentSessions ?? 10;
      const active = await UserSession.find({
        userId: user._id,
        revokedAt: null
      }).sort({ lastActivityAt: -1 });

      if (active.length > max) {
        const toRevoke = active.slice(max);
        await UserSession.updateMany(
          { _id: { $in: toRevoke.map((s) => s._id) } },
          { $set: { revokedAt: new Date() } }
        );
      }
    }
  }

  return { jti, session };
};

const signToken = (user, jti, expiresIn = '7d') => {
  return jwt.sign({
    id: user._id,
    organizationId: user.organizationId,
    role: user.role,
    email: user.email,
    name: user.name || '',
    jti
  }, JWT_SECRET, { expiresIn });
};

const issueAuthToken = async (user, req) => {
  const { jti } = await createSession(user, req);
  return signToken(user, jti);
};

const touchSession = async (jti) => {
  if (!jti) return;
  await UserSession.findOneAndUpdate(
    { jti, revokedAt: null },
    { $set: { lastActivityAt: new Date() } }
  );
};

const validateSession = async (userId, jti, organizationId) => {
  if (!jti) return { valid: true };

  const session = await UserSession.findOne({ jti, userId, revokedAt: null });
  if (!session) {
    return { valid: false, code: 'SESSION_REVOKED', message: 'Session has been revoked or expired.' };
  }

  if (organizationId) {
    const org = await Organization.findById(organizationId).select('plan securitySettings');
    if (org && planHasFeature(org.plan, 'security.sessionPolicy')) {
      const idleMinutes = org.securitySettings?.sessionIdleMinutes ?? 480;
      const idleMs = idleMinutes * 60 * 1000;
      const elapsed = Date.now() - new Date(session.lastActivityAt).getTime();
      if (elapsed > idleMs) {
        session.revokedAt = new Date();
        await session.save();
        return { valid: false, code: 'SESSION_IDLE_TIMEOUT', message: 'Session expired due to inactivity.' };
      }
    }
  }

  return { valid: true, session };
};

const revokeSession = async (jti) => {
  await UserSession.updateOne({ jti }, { $set: { revokedAt: new Date() } });
};

module.exports = {
  createSession,
  signToken,
  issueAuthToken,
  touchSession,
  validateSession,
  revokeSession,
  JWT_SECRET
};
