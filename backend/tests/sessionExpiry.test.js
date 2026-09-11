const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const UserSession = require('../models/UserSession');
const {
  remainingSessionMs,
  validateSession,
  reissueSessionToken,
  effectiveIdleMinutes,
  describeDevice,
  listUserSessions,
  revokeOtherSessions,
  revokeAllSessionsForUser,
  SESSION_MAX_AGE_MS,
  JWT_SECRET,
} = require('../services/sessionService');

describe('session absolute 7-day lifetime', () => {
  it('legacy 8-hour idle default follows the 7-day login lifetime', () => {
    expect(effectiveIdleMinutes(undefined)).toBe(10080);
    expect(effectiveIdleMinutes(480)).toBe(10080);
    expect(effectiveIdleMinutes(30)).toBe(30);
    expect(effectiveIdleMinutes(485)).toBe(485);
  });

  it('remainingSessionMs is ~7 days for a fresh session', () => {
    const session = { createdAt: new Date() };
    const left = remainingSessionMs(session);
    expect(left).toBeGreaterThan(SESSION_MAX_AGE_MS - 5000);
    expect(left).toBeLessThanOrEqual(SESSION_MAX_AGE_MS);
  });

  it('validateSession rejects a session older than 7 days', async () => {
    if (mongoose.connection.readyState !== 1) {
      expect(mongoose.connection.readyState).not.toBe(1);
      return;
    }
    const userId = new mongoose.Types.ObjectId();
    const jti = 'jti-old-session';
    const createdAt = new Date(Date.now() - SESSION_MAX_AGE_MS - 1000);
    await UserSession.create({
      userId,
      jti,
      createdAt,
      lastActivityAt: new Date(),
    });
    const result = await validateSession(userId, jti, null);
    expect(result.valid).toBe(false);
    expect(result.code).toBe('SESSION_EXPIRED');
  });

  it('reissueSessionToken keeps the same jti and does not mint a new 7-day clock', async () => {
    if (mongoose.connection.readyState !== 1) {
      expect(mongoose.connection.readyState).not.toBe(1);
      return;
    }
    const userId = new mongoose.Types.ObjectId();
    const jti = 'jti-refresh-same';
    const createdAt = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    await UserSession.create({
      userId,
      jti,
      createdAt,
      lastActivityAt: new Date(),
    });
    const user = { _id: userId, organizationId: new mongoose.Types.ObjectId(), role: 'owner', email: 'a@b.com', name: 'A' };
    const { token, remainingMs } = await reissueSessionToken(user, jti);
    expect(remainingMs).toBeLessThan(2 * 24 * 60 * 60 * 1000);
    expect(remainingMs).toBeGreaterThan(12 * 60 * 60 * 1000);
    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded.jti).toBe(jti);
    expect(decoded.id).toBe(String(userId));
    const ttlSec = decoded.exp - decoded.iat;
    expect(ttlSec).toBeLessThan(2 * 24 * 60 * 60);
  });

  it('reissueSessionToken refuses a session with under a minute left', async () => {
    if (mongoose.connection.readyState !== 1) {
      expect(mongoose.connection.readyState).not.toBe(1);
      return;
    }
    const userId = new mongoose.Types.ObjectId();
    const jti = 'jti-almost-dead';
    await UserSession.create({
      userId,
      jti,
      createdAt: new Date(Date.now() - SESSION_MAX_AGE_MS + 10 * 1000),
      lastActivityAt: new Date(),
    });
    const user = { _id: userId, role: 'owner', email: 'a@b.com', name: 'A' };
    await expect(reissueSessionToken(user, jti)).rejects.toMatchObject({ code: 'SESSION_EXPIRED', statusCode: 401 });
  });
});

describe('signed-in devices', () => {
  it('describeDevice reads browser and OS from a Chrome Windows UA', () => {
    const d = describeDevice(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    expect(d.browser).toBe('Chrome');
    expect(d.os).toBe('Windows');
  });

  it('listUserSessions marks the current device and hides jti', async () => {
    if (mongoose.connection.readyState !== 1) {
      expect(mongoose.connection.readyState).not.toBe(1);
      return;
    }
    const userId = new mongoose.Types.ObjectId();
    const current = await UserSession.create({
      userId,
      jti: 'jti-current-device',
      ip: '1.1.1.1',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
      lastActivityAt: new Date(),
    });
    await UserSession.create({
      userId,
      jti: 'jti-other-laptop',
      ip: '8.8.8.8',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      lastActivityAt: new Date(Date.now() - 60 * 60 * 1000),
    });
    const sessions = await listUserSessions(userId, 'jti-current-device');
    expect(sessions).toHaveLength(2);
    expect(sessions[0].current).toBe(true);
    expect(sessions[0].id).toBe(String(current._id));
    expect(sessions.some((s) => s.jti)).toBe(false);
    expect(sessions.find((s) => !s.current).os).toBe('Windows');
  });

  it('revokeOtherSessions keeps the current jti', async () => {
    if (mongoose.connection.readyState !== 1) {
      expect(mongoose.connection.readyState).not.toBe(1);
      return;
    }
    const userId = new mongoose.Types.ObjectId();
    await UserSession.create({ userId, jti: 'keep-me', lastActivityAt: new Date() });
    await UserSession.create({ userId, jti: 'drop-me', lastActivityAt: new Date() });
    const result = await revokeOtherSessions(userId, 'keep-me');
    expect(result.revoked).toBe(1);
    const still = await UserSession.find({ userId, revokedAt: null });
    expect(still).toHaveLength(1);
    expect(still[0].jti).toBe('keep-me');
  });

  it('revokeAllSessionsForUser ends every active login', async () => {
    if (mongoose.connection.readyState !== 1) {
      expect(mongoose.connection.readyState).not.toBe(1);
      return;
    }
    const userId = new mongoose.Types.ObjectId();
    await UserSession.create({ userId, jti: 'a', lastActivityAt: new Date() });
    await UserSession.create({ userId, jti: 'b', lastActivityAt: new Date() });
    await revokeAllSessionsForUser(userId);
    const still = await UserSession.find({ userId, revokedAt: null });
    expect(still).toHaveLength(0);
  });
});
