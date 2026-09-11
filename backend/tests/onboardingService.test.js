/**
 * Smoke contracts for onboardingService.
 */
describe('onboardingService contracts', () => {
  it('exports onboarding helpers', () => {
    const svc = require('../services/onboardingService');
    expect(typeof svc.register).toBe('function');
    expect(typeof svc.sendSignupOtp).toBe('function');
    expect(typeof svc.verifySignupOtp).toBe('function');
    expect(typeof svc.resendSignupOtp).toBe('function');
    expect(typeof svc.verifyEmail).toBe('function');
    expect(typeof svc.resendVerification).toBe('function');
    expect(typeof svc.createOrg).toBe('function');
    expect(typeof svc.inviteTeammate).toBe('function');
    expect(typeof svc.acceptInvite).toBe('function');
    expect(typeof svc.getInvite).toBe('function');
    expect(typeof svc.completeOnboarding).toBe('function');
  });

  it('signup OTP hash matches the original code', () => {
    const { hashSignupOtp, signupOtpMatches } = require('../services/onboardingService');
    const email = 'ada@company.com';
    const hash = hashSignupOtp(email, '482193');
    expect(signupOtpMatches(email, '482193', hash)).toBe(true);
    expect(signupOtpMatches(email, '000000', hash)).toBe(false);
    expect(signupOtpMatches('other@company.com', '482193', hash)).toBe(false);
  });
});
