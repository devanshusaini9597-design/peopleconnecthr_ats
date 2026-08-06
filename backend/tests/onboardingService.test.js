/**
 * Smoke contracts for onboardingService.
 */
describe('onboardingService contracts', () => {
  it('exports onboarding helpers', () => {
    const svc = require('../services/onboardingService');
    expect(typeof svc.register).toBe('function');
    expect(typeof svc.verifyEmail).toBe('function');
    expect(typeof svc.resendVerification).toBe('function');
    expect(typeof svc.createOrg).toBe('function');
    expect(typeof svc.inviteTeammate).toBe('function');
    expect(typeof svc.acceptInvite).toBe('function');
    expect(typeof svc.getInvite).toBe('function');
    expect(typeof svc.completeOnboarding).toBe('function');
  });
});
