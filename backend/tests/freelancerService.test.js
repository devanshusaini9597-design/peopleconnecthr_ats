describe('freelancerService contracts', () => {
  it('exports mandate handoff helpers', () => {
    const svc = require('../services/freelancerService');
    expect(typeof svc.listMandates).toBe('function');
    expect(typeof svc.listOwnCandidates).toBe('function');
    expect(typeof svc.getDeskSummary).toBe('function');
    expect(typeof svc.createSubmission).toBe('function');
    expect(typeof svc.listSubmissions).toBe('function');
    expect(typeof svc.updateSubmissionStatus).toBe('function');
    expect(typeof svc.resolveMandateSpoc).toBe('function');
    expect(typeof svc.attachMandateSpoc).toBe('function');
  });

  it('attachMandateSpoc prefers the job poster (createdBy)', () => {
    const { attachMandateSpoc } = require('../services/freelancerService');
    const poster = { _id: 'a', name: 'Poster', email: 'p@x.com', role: 'admin' };
    const hm = { _id: 'b', name: 'HM', email: 'h@x.com', role: 'recruiter' };
    const row = attachMandateSpoc({ title: 'Role', createdBy: poster, hiringManager: hm });
    expect(row.mandateSpoc._id).toBe('a');
    expect(row.mandateSpoc.name).toBe('Poster');
  });
});
