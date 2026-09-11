const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const UserSession = require('../models/UserSession');
const Organization = require('../models/Organization');
const { planHasFeature } = require('../config/planFeatures');
const { getClientIp } = require('../utils/clientIp');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-CHANGE-IN-PRODUCTION';
/** Absolute login lifetime. Refresh cannot extend past this. */
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_IDLE_DEFAULT_MINUTES = SESSION_MAX_AGE_MS / (60 * 1000);
/** Old schema default (8 hours). Treat as unset so overnight use stays signed in. */
const LEGACY_IDLE_DEFAULT_MINUTES = 480;
const SESSION_REFRESH_MIN_MS = 60 * 1000;

function effectiveIdleMinutes(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n === LEGACY_IDLE_DEFAULT_MINUTES) {
    return SESSION_IDLE_DEFAULT_MINUTES;
  }
  return Math.min(n, SESSION_IDLE_DEFAULT_MINUTES);
}

function remainingSessionMs(session) {
  const start = new Date(session.createdAt || session.lastActivityAt || 0).getTime();
  return start + SESSION_MAX_AGE_MS - Date.now();
}

function httpSessionError(message, code) {
  const err = new Error(message);
  err.statusCode = 401;
  err.code = code;
  err.success = false;
  return err;
}

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

  if (remainingSessionMs(session) <= 0) {
    session.revokedAt = new Date();
    await session.save();
    return {
      valid: false,
      code: 'SESSION_EXPIRED',
      message: 'Your session ended after 7 days. Please sign in again.',
    };
  }

  if (organizationId) {
    const org = await Organization.findById(organizationId).select('plan securitySettings');
    if (org && planHasFeature(org.plan, 'security.sessionPolicy')) {
      const idleMinutes = effectiveIdleMinutes(org.securitySettings?.sessionIdleMinutes);
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

const reissueSessionToken = async (user, jti) => {
  if (!jti) {
    throw httpSessionError('Invalid session', 'SESSION_REVOKED');
  }
  const session = await UserSession.findOne({ jti, userId: user._id, revokedAt: null });
  if (!session) {
    throw httpSessionError('Invalid session', 'SESSION_REVOKED');
  }
  const remainingMs = remainingSessionMs(session);
  if (remainingMs < SESSION_REFRESH_MIN_MS) {
    session.revokedAt = new Date();
    await session.save();
    throw httpSessionError('Your session ended after 7 days. Please sign in again.', 'SESSION_EXPIRED');
  }
  const expiresIn = `${Math.ceil(remainingMs / 1000)}s`;
  return {
    token: signToken(user, jti, expiresIn),
    remainingMs,
  };
};

const revokeSession = async (jti) => {
  await UserSession.updateOne({ jti }, { $set: { revokedAt: new Date() } });
};

function describeDevice(userAgent) {
  const ua = String(userAgent || '');
  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';

  let os = 'Unknown device';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'Mac';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return { browser, os, label: `${browser} on ${os}` };
}

function toPublicSession(session, currentJti) {
  const device = describeDevice(session.userAgent);
  const remainingMs = remainingSessionMs(session);
  return {
    id: String(session._id),
    current: Boolean(currentJti && session.jti === currentJti),
    browser: device.browser,
    os: device.os,
    label: device.label,
    ip: session.ip || '',
    lastActiveAt: session.lastActivityAt || session.updatedAt || session.createdAt,
    createdAt: session.createdAt,
    expiresAt: new Date(new Date(session.createdAt || session.lastActivityAt).getTime() + SESSION_MAX_AGE_MS),
    remainingMs: Math.max(0, remainingMs),
  };
}

const listUserSessions = async (userId, currentJti) => {
  const rows = await UserSession.find({ userId, revokedAt: null }).sort({ lastActivityAt: -1 });
  return rows
    .filter((row) => remainingSessionMs(row) > 0)
    .map((row) => toPublicSession(row, currentJti))
    .sort((a, b) => Number(b.current) - Number(a.current));
};

const revokeOwnSession = async (userId, sessionId, currentJti) => {
  const session = await UserSession.findOne({ _id: sessionId, userId, revokedAt: null });
  if (!session) {
    const err = new Error('Session not found');
    err.statusCode = 404;
    err.code = 'SESSION_NOT_FOUND';
    err.success = false;
    throw err;
  }
  session.revokedAt = new Date();
  await session.save();
  return { revokedCurrent: Boolean(currentJti && session.jti === currentJti) };
};

const revokeOtherSessions = async (userId, currentJti) => {
  const filter = { userId, revokedAt: null };
  if (currentJti) filter.jti = { $ne: currentJti };
  const result = await UserSession.updateMany(filter, { $set: { revokedAt: new Date() } });
  return { revoked: result.modifiedCount || 0 };
};

const revokeAllSessionsForUser = async (userId) => {
  if (!userId) return { revoked: 0 };
  const result = await UserSession.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  return { revoked: result.modifiedCount || 0 };
};

const revokeAllSessionsForOrg = async (organizationId) => {
  if (!organizationId) return { revoked: 0 };
  const result = await UserSession.updateMany(
    { organizationId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  return { revoked: result.modifiedCount || 0 };
};

module.exports = {
  createSession,
  signToken,
  issueAuthToken,
  touchSession,
  validateSession,
  reissueSessionToken,
  remainingSessionMs,
  effectiveIdleMinutes,
  describeDevice,
  listUserSessions,
  revokeOwnSession,
  revokeOtherSessions,
  revokeAllSessionsForUser,
  revokeAllSessionsForOrg,
  revokeSession,
  JWT_SECRET,
  SESSION_MAX_AGE_MS,
};
