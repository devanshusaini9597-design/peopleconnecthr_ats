/**
 * Smoke contracts for scimService (route domain).
 */
describe('scimService contracts', () => {
  it('exports SCIM route handlers and token helper', () => {
    const svc = require('../services/scimService');
    expect(typeof svc.scimUserResource).toBe('function');
    expect(typeof svc.scimAuth).toBe('function');
    expect(typeof svc.listUsers).toBe('function');
    expect(typeof svc.getUser).toBe('function');
    expect(typeof svc.createUser).toBe('function');
    expect(typeof svc.patchUser).toBe('function');
    expect(typeof svc.issueScimToken).toBe('function');
  });

  it('re-exports issueScimToken from scimRoutes for ssoRoutes', () => {
    const routes = require('../routes/scimRoutes');
    const svc = require('../services/scimService');
    expect(typeof routes.issueScimToken).toBe('function');
    expect(routes.issueScimToken).toBe(svc.issueScimToken);
  });
});
