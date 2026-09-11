const { lastSeenAt, presenceStatus } = require('../services/presenceService');

describe('presenceService', () => {
  it('maps lastActiveAt to online, away, or offline', () => {
    expect(presenceStatus(new Date())).toBe('online');
    expect(presenceStatus(new Date(Date.now() - 3 * 60_000))).toBe('away');
    expect(presenceStatus(new Date(Date.now() - 20 * 60_000))).toBe('offline');
    expect(presenceStatus(null)).toBe('offline');
  });

  it('uses lastLoginAt when lastActiveAt is missing', () => {
    const login = new Date('2026-08-01T10:00:00.000Z');
    expect(lastSeenAt({ lastActiveAt: null, lastLoginAt: login })).toEqual(login);
    expect(lastSeenAt({ lastLoginAt: login })).toEqual(login);
    expect(lastSeenAt({ lastActiveAt: new Date('2026-08-10'), lastLoginAt: login }).toISOString())
      .toBe('2026-08-10T00:00:00.000Z');
    expect(lastSeenAt({})).toBeNull();
    expect(presenceStatus(lastSeenAt({ lastLoginAt: new Date() }))).toBe('online');
  });
});
