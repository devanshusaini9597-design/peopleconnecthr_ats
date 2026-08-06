/**
 * Smoke contracts for profileService.
 */
describe('profileService contracts', () => {
  it('exports profile helpers', () => {
    const svc = require('../services/profileService');
    expect(typeof svc.getProfile).toBe('function');
    expect(typeof svc.updateProfile).toBe('function');
    expect(typeof svc.updateProfilePicture).toBe('function');
    expect(typeof svc.removeProfilePicture).toBe('function');
    expect(typeof svc.changePassword).toBe('function');
    expect(typeof svc.getProfileStats).toBe('function');
  });
});
