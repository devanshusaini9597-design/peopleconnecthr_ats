describe('freelancerService contracts', () => {
  it('exports mandate handoff helpers', () => {
    const svc = require('../services/freelancerService');
    expect(typeof svc.listMandates).toBe('function');
    expect(typeof svc.listOwnCandidates).toBe('function');
    expect(typeof svc.getDeskSummary).toBe('function');
    expect(typeof svc.createSubmission).toBe('function');
    expect(typeof svc.listSubmissions).toBe('function');
    expect(typeof svc.updateSubmissionStatus).toBe('function');
    expect(typeof svc.archiveSubmission).toBe('function');
    expect(typeof svc.restoreSubmission).toBe('function');
    expect(typeof svc.reassignSpoc).toBe('function');
    expect(typeof svc.bulkDeskAction).toBe('function');
    expect(typeof svc.hardDeleteSubmission).toBe('function');
    expect(typeof svc.updateCandidateFromDesk).toBe('function');
    expect(typeof svc.getPlacementStats).toBe('function');
    expect(typeof svc.resolveMandateSpoc).toBe('function');
    expect(typeof svc.requestFeedback).toBe('function');
    expect(typeof svc.heartbeat).toBe('function');
    expect(typeof svc.listFreelancerPresence).toBe('function');
  });

  it('presenceStatus is online, away, or offline from lastActiveAt', () => {
    const { presenceStatus } = require('../services/freelancerService');
    expect(presenceStatus(new Date())).toBe('online');
    expect(presenceStatus(new Date(Date.now() - 3 * 60_000))).toBe('away');
    expect(presenceStatus(new Date(Date.now() - 20 * 60_000))).toBe('offline');
    expect(presenceStatus(null)).toBe('offline');
  });

  it('attachMandateSpoc prefers the hiring manager over the job poster', () => {
    const { attachMandateSpoc } = require('../services/freelancerService');
    const poster = { _id: 'a', name: 'Poster', email: 'p@x.com', role: 'admin' };
    const hm = { _id: 'b', name: 'HM', email: 'h@x.com', role: 'recruiter' };
    const row = attachMandateSpoc({ title: 'Role', createdBy: poster, hiringManager: hm }, hm);
    expect(row.mandateSpoc._id).toBe('b');
    expect(row.mandateSpoc.name).toBe('HM');
    expect(row.mandateSpoc.email).toBeUndefined();
    expect(row.postedBy.name).toBe('Poster');
    expect(row.postedBy.email).toBeUndefined();
  });

  it('pickSpocFromStaff uses hiring manager email when ObjectId is unset', () => {
    const { pickSpocFromStaff } = require('../services/freelancerService');
    const poster = { _id: 'a', name: 'Poster', email: 'p@x.com', role: 'admin' };
    const hm = { _id: 'b', name: 'Hiring Manager', email: 'hm@x.com', role: 'hr_manager' };
    const picked = pickSpocFromStaff(
      { createdBy: poster, hiringManagers: ['HM@x.com'] },
      [poster, hm]
    );
    expect(picked._id).toBe('b');
  });

  it('pickSpocFromStaff falls back to the poster when no hiring manager is set', () => {
    const { pickSpocFromStaff } = require('../services/freelancerService');
    const poster = { _id: 'a', name: 'Poster', email: 'p@x.com', role: 'admin' };
    const picked = pickSpocFromStaff({ createdBy: poster, hiringManagers: [] }, [poster]);
    expect(picked._id).toBe('a');
  });

  it('presentSubmission uses the live candidate, then the snapshot, never a blank name', () => {
    const { presentSubmission } = require('../services/freelancerService');
    expect(presentSubmission({
      candidateId: { _id: 'c1', name: 'Devanshu Saini', email: 'd@x.com' },
    }).candidateId.name).toBe('Devanshu Saini');
    expect(presentSubmission({
      candidateId: 'c1',
      candidateSnapshot: { name: 'Devanshu Saini', email: 'd@x.com' },
    }).candidateId.name).toBe('Devanshu Saini');
  });
});
