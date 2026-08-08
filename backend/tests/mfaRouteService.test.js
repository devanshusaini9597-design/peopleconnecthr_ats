/**
 * Smoke contracts for mfaRouteService (route domain).
 * Crypto helpers remain in mfaService — mocked so Jest does not load otplib ESM.
 */
jest.mock('../services/mfaService', () => ({
  generateSecret: jest.fn(),
  keyUri: jest.fn(),
  encryptSecret: jest.fn(),
  verifyTotp: jest.fn(),
  generateBackupCodes: jest.fn(),
  verifyBackupCode: jest.fn()
}));

describe('mfaRouteService contracts', () => {
  it('exports MFA route handlers', () => {
    const svc = require('../services/mfaRouteService');
    expect(typeof svc.buildLoginPayload).toBe('function');
    expect(typeof svc.verifyMfaAccess).toBe('function');
    expect(typeof svc.getStatus).toBe('function');
    expect(typeof svc.setupMfa).toBe('function');
    expect(typeof svc.verifySetup).toBe('function');
    expect(typeof svc.disableMfa).toBe('function');
    expect(typeof svc.verifyMfaLogin).toBe('function');
  });
});
