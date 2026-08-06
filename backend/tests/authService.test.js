describe('authService contracts', () => {
  it('exports auth helpers', () => {
    const svc = require('../services/authService');
    expect(typeof svc.login).toBe('function');
    expect(typeof svc.demoLogin).toBe('function');
    expect(typeof svc.register).toBe('function');
    expect(typeof svc.forgotPassword).toBe('function');
    expect(typeof svc.verifyResetToken).toBe('function');
    expect(typeof svc.resetPassword).toBe('function');
    expect(typeof svc.refreshSession).toBe('function');
  });
});
