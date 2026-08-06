/**
 * Smoke contracts for portalService.
 */
describe('portalService contracts', () => {
  it('exports portal helpers', () => {
    const svc = require('../services/portalService');
    expect(typeof svc.getLocalization).toBe('function');
    expect(typeof svc.requestMagicLink).toBe('function');
    expect(typeof svc.listApplicationStatuses).toBe('function');
    expect(typeof svc.getApplication).toBe('function');
    expect(typeof svc.exportGdprData).toBe('function');
    expect(typeof svc.eraseGdprData).toBe('function');
  });
});
