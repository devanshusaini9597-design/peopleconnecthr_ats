const {
  statusStorageKey,
  statusesEqual,
  statusChangeUpdate,
  seedCreateStatusFields,
  stageEntryDateExpr,
  withStageEntryDateRange,
  buildCurrentStageEntryAgg,
} = require('../utils/candidateStatusHistory');

describe('candidateStatusHistory', () => {
  it('normalizes status keys', () => {
    expect(statusStorageKey('turn up')).toBe('TURN UP');
    expect(statusStorageKey('TURN_UP')).toBe('TURN UP');
  });

  it('statusesEqual ignores casing/spacing', () => {
    expect(statusesEqual('Turn Up', 'TURN UP')).toBe(true);
    expect(statusesEqual('Applied', 'Screening')).toBe(false);
  });

  it('statusChangeUpdate appends history and sets statusEnteredAt', () => {
    const at = new Date('2026-09-10T10:00:00.000Z');
    const change = statusChangeUpdate('APPLIED', 'TURN UP', {
      updatedAt: at,
      updatedBy: 'Ada',
      remark: 'Moved',
    });
    expect(change.$set.status).toBe('TURN UP');
    expect(change.$set.statusEnteredAt).toEqual(at);
    expect(change.$push.statusHistory.status).toBe('TURN UP');
    expect(change.$push.statusHistory.updatedBy).toBe('Ada');
  });

  it('statusChangeUpdate returns null when unchanged', () => {
    expect(statusChangeUpdate('TURN UP', 'turn up')).toBeNull();
  });

  it('seedCreateStatusFields does not wipe existing history', () => {
    const existing = [{ status: 'APPLIED', remark: 'keep', updatedAt: new Date(), updatedBy: 'X' }];
    const doc = { status: 'Applied', statusHistory: existing };
    seedCreateStatusFields(doc);
    expect(doc.statusHistory).toBe(existing);
    expect(doc.status).toBe('APPLIED');
    expect(doc.statusEnteredAt).toBeInstanceOf(Date);
  });

  it('seedCreateStatusFields fills empty history', () => {
    const doc = { status: 'Screening', appliedAt: new Date('2026-07-01') };
    seedCreateStatusFields(doc, { updatedBy: 'Sys' });
    expect(doc.statusHistory).toHaveLength(1);
    expect(doc.statusHistory[0].status).toBe('SCREENING');
    expect(doc.statusEnteredAt).toEqual(doc.appliedAt);
  });

  it('stageEntryDateExpr prefers statusEnteredAt', () => {
    expect(stageEntryDateExpr()).toEqual({
      $ifNull: ['$statusEnteredAt', { $ifNull: ['$appliedAt', '$createdAt'] }],
    });
  });

  it('withStageEntryDateRange adds $expr window', () => {
    const filter = withStageEntryDateRange({ organizationId: 'x' }, {
      $gte: new Date('2026-09-01'),
      $lt: new Date('2026-10-01'),
    });
    expect(filter.organizationId).toBe('x');
    expect(filter.$expr.$and).toHaveLength(2);
  });

  it('buildCurrentStageEntryAgg uses inventory when no date filter', () => {
    const pipeline = buildCurrentStageEntryAgg({ organizationId: 1 }, null);
    expect(pipeline).toEqual([
      { $match: { organizationId: 1 } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
  });

  it('buildCurrentStageEntryAgg filters by stage entry date', () => {
    const from = new Date('2026-09-01');
    const to = new Date('2026-10-01');
    const pipeline = buildCurrentStageEntryAgg({ organizationId: 1 }, { $gte: from, $lt: to });
    expect(pipeline[0]).toEqual({ $match: { organizationId: 1 } });
    expect(pipeline[1].$addFields.stageEntryDate).toEqual(stageEntryDateExpr());
    expect(pipeline[2].$match.$expr.$and).toHaveLength(2);
    expect(pipeline[3]).toEqual({ $group: { _id: '$status', count: { $sum: 1 } } });
  });
});
