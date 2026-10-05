const { foldPipelineAggregates, emptyPipelineStats } = require('../utils/jobPipelineStats');
const mongoose = require('mongoose');

describe('jobPipelineStats', () => {
  it('folds per-job totals, careers, and stages', () => {
    const jobId = new mongoose.Types.ObjectId();
    const byJob = foldPipelineAggregates([
      { _id: { jobId, source: 'careers page', stage: 'Applied', rejected: false }, count: 2 },
      { _id: { jobId, source: 'linkedin', stage: 'Interview', rejected: false }, count: 1 },
      { _id: { jobId, source: 'careers page', stage: 'Applied', rejected: true }, count: 1 },
    ]);
    const stats = byJob.get(String(jobId));
    expect(stats.applicationCount).toBe(4);
    expect(stats.activeCount).toBe(3);
    expect(stats.rejectedCount).toBe(1);
    expect(stats.careersCount).toBe(3);
    expect(stats.addedCount).toBe(1);
    expect(stats.pipeline.Applied).toBe(2);
    expect(stats.pipeline.Interview).toBe(1);
  });

  it('empty stats default to zeros', () => {
    expect(emptyPipelineStats()).toEqual({
      applicationCount: 0,
      uniqueCandidateCount: 0,
      activeCount: 0,
      rejectedCount: 0,
      careersCount: 0,
      addedCount: 0,
      duplicateCount: 0,
      pipeline: {},
    });
  });

  it('counts duplicate applicants by shared email or phone', () => {
    const { countDuplicateApplicants } = require('../utils/jobPipelineStats');
    expect(countDuplicateApplicants([
      { _id: '1', email: 'a@x.com', contact: '9991112222' },
      { _id: '2', email: 'A@x.com', contact: '888' },
      { _id: '3', email: 'b@x.com', contact: '9991112222' },
    ])).toBe(3);
  });

  it('flags unmerged duplicates that share email with another org profile', () => {
    const { collectUnmergedDuplicateIds } = require('../utils/jobPipelineStats');
    const applicants = [{ _id: '1', email: 'a@x.com', contact: '9991112222' }];
    const siblings = [
      { _id: '1', email: 'a@x.com', contact: '9991112222' },
      { _id: '99', email: 'A@x.com', contact: '111' },
    ];
    expect(collectUnmergedDuplicateIds(applicants, siblings).has('1')).toBe(true);
  });
});
