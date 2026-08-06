/**
 * Smoke contracts for notificationService route helpers.
 */
describe('notificationService contracts', () => {
  it('exports scheduler and route helpers', () => {
    const svc = require('../services/notificationService');
    expect(typeof svc.startNotificationScheduler).toBe('function');
    expect(typeof svc.stopNotificationScheduler).toBe('function');
    expect(typeof svc.scanAndNotify).toBe('function');
    expect(typeof svc.cleanupOldNotifications).toBe('function');
    expect(typeof svc.listNotifications).toBe('function');
    expect(typeof svc.getNotificationCounts).toBe('function');
    expect(typeof svc.getUpcomingCallbacks).toBe('function');
    expect(typeof svc.markNotificationRead).toBe('function');
    expect(typeof svc.markAllNotificationsRead).toBe('function');
    expect(typeof svc.dismissNotification).toBe('function');
    expect(typeof svc.clearReadNotifications).toBe('function');
    expect(typeof svc.triggerNotificationScan).toBe('function');
  });
});
