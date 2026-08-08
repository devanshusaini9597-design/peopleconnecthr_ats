/**
 * Smoke contracts for integrationService.
 */
describe('integrationService contracts', () => {
  it('exports integration helpers', () => {
    const svc = require('../services/integrationService');
    expect(typeof svc.toSafeJson).toBe('function');
    expect(typeof svc.assertCategoryEntitlement).toBe('function');
    expect(typeof svc.listIntegrations).toBe('function');
    expect(typeof svc.upsertIntegration).toBe('function');
    expect(typeof svc.testIntegration).toBe('function');
    expect(typeof svc.setIntegrationActive).toBe('function');
    expect(typeof svc.deleteIntegration).toBe('function');
  });
});
