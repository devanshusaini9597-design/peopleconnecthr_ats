const {
  canonCandidateStatus,
  foldStatusCounts,
  pipelineList,
  statusMatchValues,
} = require('../utils/statusCanon');

describe('statusCanon', () => {
  it('folds mixed-case candidate statuses onto dashboard labels', () => {
    expect(canonCandidateStatus('APPLIED')).toBe('Applied');
    expect(canonCandidateStatus('Applied')).toBe('Applied');
    expect(canonCandidateStatus('screening')).toBe('Screening');
    expect(canonCandidateStatus('PENDING REVIEW')).toBe('Applied');
    expect(canonCandidateStatus('')).toBe('Unspecified');
  });

  it('sums APPLIED and Applied into one pipeline bucket', () => {
    const pipeline = foldStatusCounts([
      { _id: 'APPLIED', count: 4 },
      { _id: 'Applied', count: 2 },
      { _id: 'SCREENING', count: 3 },
    ]);
    expect(pipeline.Applied).toBe(6);
    expect(pipeline.Screening).toBe(3);
    const list = pipelineList(pipeline);
    expect(list.find((p) => p.stage === 'Applied').count).toBe(6);
    expect(list.find((p) => p.stage === 'Interview').count).toBe(0);
  });

  it('uses org status order and still surfaces extra statuses with counts', () => {
    const pipeline = foldStatusCounts([
      { _id: 'APPLIED', count: 2 },
      { _id: 'SCREENING', count: 1 },
      { _id: 'HOLD', count: 4 },
    ]);
    const list = pipelineList(pipeline, ['Applied', 'Screening', 'Interview', 'Offer', 'Hired']);
    expect(list.map((p) => p.stage)).toEqual(['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Hold']);
    expect(list.find((p) => p.stage === 'Interview').count).toBe(0);
    expect(list.find((p) => p.stage === 'Hold').count).toBe(4);
  });

  it('preserves org drag order and only appends missing ensureStages', () => {
    const pipeline = foldStatusCounts([
      { _id: 'HIRED', count: 1 },
      { _id: 'APPLIED', count: 5 },
      { _id: 'REJECTED', count: 2 },
    ]);
    const list = pipelineList(
      pipeline,
      ['Hired', 'Applied', 'Screening / Pending', 'Shortlisted'],
      { includeZero: true, ensureStages: ['Rejected', 'Dropped'] }
    );
    expect(list.map((p) => p.stage)).toEqual([
      'Hired',
      'Applied',
      'Screening / Pending',
      'Shortlisted',
      'Rejected',
      'Dropped',
    ]);
  });
});
