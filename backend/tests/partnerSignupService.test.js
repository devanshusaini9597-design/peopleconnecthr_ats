describe('partnerSignupService contracts', () => {
  it('exports public page, apply, and owner review helpers', () => {
    const svc = require('../services/partnerSignupService');
    expect(typeof svc.getPartnerPage).toBe('function');
    expect(typeof svc.checkApplication).toBe('function');
    expect(typeof svc.submitApplication).toBe('function');
    expect(typeof svc.listApplications).toBe('function');
    expect(typeof svc.createApplication).toBe('function');
    expect(typeof svc.updateApplication).toBe('function');
    expect(typeof svc.deleteApplication).toBe('function');
    expect(typeof svc.updateApplicationStatus).toBe('function');
    expect(typeof svc.getResumeFile).toBe('function');
  });
});
