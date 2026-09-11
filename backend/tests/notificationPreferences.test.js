/**
 * Notification preferences — defaults, quiet hours, category mapping.
 */
const prefsSvc = require('../services/notificationPreferencesService');
const { defaultNotificationPreferences } = require('../config/notificationPreferences');

describe('notificationPreferences', () => {
  it('maps types to categories', () => {
    expect(prefsSvc.categoryForType('callback_today')).toBe('callbacks');
    expect(prefsSvc.categoryForType('job_opening')).toBe('jobs');
    expect(prefsSvc.categoryForType('mention')).toBe('mentions');
    expect(prefsSvc.categoryForType('report_shared')).toBe('shares');
  });

  it('sanitizes channel toggles', () => {
    const out = prefsSvc.sanitizePreferences({
      channels: {
        callbacks: { inApp: false, email: true, push: false },
      },
      quietHours: { enabled: true, start: '22:00', end: '07:00', timezone: 'UTC' },
    });
    expect(out.channels.callbacks.inApp).toBe(false);
    expect(out.channels.callbacks.email).toBe(true);
    expect(out.quietHours.enabled).toBe(true);
    expect(out.quietHours.start).toBe('22:00');
  });

  it('returns false for quiet hours when disabled', () => {
    const prefs = defaultNotificationPreferences();
    expect(prefsSvc.isQuietHours(prefs, new Date())).toBe(false);
  });

  it('blocks non-urgent during overnight window', () => {
    const prefs = defaultNotificationPreferences();
    prefs.quietHours = { enabled: true, start: '20:00', end: '08:00', timezone: 'UTC' };
    const late = new Date('2026-08-23T22:30:00.000Z');
    expect(prefsSvc.isQuietHours(prefs, late, { priority: 'medium' })).toBe(true);
    expect(prefsSvc.isQuietHours(prefs, late, { priority: 'urgent' })).toBe(false);
  });
});
