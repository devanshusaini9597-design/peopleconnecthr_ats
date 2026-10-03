const { hasInternalPreviewAccess } = require('../utils/vendorDomains');

describe('hasInternalPreviewAccess', () => {
  test('allows Skillnix Recruitment org members', () => {
    expect(hasInternalPreviewAccess(
      { email: 'recruiter@skillnixrecruitment.com', isDemo: false },
      { domain: 'skillnixrecruitment.com', isDemo: false }
    )).toBe(true);
  });

  test('denies customer orgs', () => {
    expect(hasInternalPreviewAccess(
      { email: 'owner@acme-staffing.com', isDemo: false },
      { domain: 'acme-staffing.com', isDemo: false }
    )).toBe(false);
  });

  test('denies demo users', () => {
    expect(hasInternalPreviewAccess(
      { email: 'owner@demo.peopleconnecthr.com', isDemo: true },
      { domain: 'demo.peopleconnecthr.com', isDemo: true }
    )).toBe(false);
  });
});
