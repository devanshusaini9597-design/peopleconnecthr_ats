/**
 * Smoke contracts for careersService.
 */
describe('careersService contracts', () => {
  it('exports careers helpers', () => {
    const svc = require('../services/careersService');
    expect(typeof svc.getJobsXmlFeed).toBe('function');
    expect(typeof svc.resolveByDomain).toBe('function');
    expect(typeof svc.getCareersPage).toBe('function');
    expect(typeof svc.getPublicJob).toBe('function');
    expect(typeof svc.submitApplication).toBe('function');
  });
});
