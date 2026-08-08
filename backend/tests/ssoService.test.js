/**
 * Smoke contracts for ssoService.
 */
describe('ssoService contracts', () => {
  it('exports config and public flow helpers', () => {
    const svc = require('../services/ssoService');
    expect(typeof svc.getConfig).toBe('function');
    expect(typeof svc.upsertConfig).toBe('function');
    expect(typeof svc.exchangeCode).toBe('function');
    expect(typeof svc.startSamlLogin).toBe('function');
    expect(typeof svc.handleOidcCallback).toBe('function');
    expect(typeof svc.handleSamlAcs).toBe('function');
  });

  it('exchangeCode requires code', () => {
    const { exchangeCode } = require('../services/ssoService');
    expect(() => exchangeCode(null)).toThrow(/code is required/);
  });
});
