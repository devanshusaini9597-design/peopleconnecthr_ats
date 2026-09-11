const { parseRecordDate, resolveAppliedAt, candidateListSortSpec } = require('../utils/candidateActivityDate');

describe('candidateActivityDate', () => {
  it('parses ISO dates', () => {
    const d = parseRecordDate('2023-06-15');
    expect(d).not.toBeNull();
    expect(d.getUTCFullYear()).toBe(2023);
    expect(d.getUTCMonth()).toBe(5);
    expect(d.getUTCDate()).toBe(15);
  });

  it('parses DD-MM-YYYY (Indian format)', () => {
    const d = parseRecordDate('15-06-2023');
    expect(d).not.toBeNull();
    expect(d.getUTCFullYear()).toBe(2023);
  });

  it('parses Excel serial numbers', () => {
    const d = parseRecordDate('45000');
    expect(d).not.toBeNull();
    expect(d.getFullYear()).toBeGreaterThan(2020);
  });

  it('parses day + month name without timezone off-by-one', () => {
    const d = parseRecordDate('02 Sept 2026');
    expect(d).not.toBeNull();
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(8);
    expect(d.getUTCDate()).toBe(2);
  });

  it('resolveAppliedAt prefers date column over createdAt', () => {
    const applied = resolveAppliedAt({
      date: '2022-01-10',
      createdAt: new Date('2026-08-21'),
    });
    expect(applied.getUTCFullYear()).toBe(2022);
  });

  it('resolveAppliedAt falls back to createdAt', () => {
    const created = new Date('2024-03-01');
    const applied = resolveAppliedAt({ date: '', createdAt: created });
    expect(applied.getTime()).toBe(created.getTime());
  });

  it('candidateListSortSpec date uses appliedAt (entry date), not only createdAt', () => {
    expect(candidateListSortSpec('date', 'desc')).toEqual({
      appliedAt: -1,
      createdAt: -1,
      _id: -1,
    });
    expect(candidateListSortSpec('date', 'asc')).toEqual({
      appliedAt: 1,
      createdAt: 1,
      _id: 1,
    });
    expect(candidateListSortSpec('', 'desc')).toEqual({
      appliedAt: -1,
      createdAt: -1,
      _id: -1,
    });
  });

  it('candidateListSortSpec name keeps secondary createdAt', () => {
    expect(candidateListSortSpec('name', 'asc')).toEqual({ name: 1, createdAt: -1 });
  });
});
