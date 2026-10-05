const { mergeDirectories } = require('../services/talentMatchService');

describe('mergeDirectories', () => {
  it('keeps the stronger profile and marks a person found in both directories', () => {
    const merged = mergeDirectories([
      {
        scanned: 2,
        ranked: [
          { id: 'c1', source: 'candidate', name: 'Asha', email: 'asha@example.com', score: 80 },
          { id: 'c2', source: 'candidate', name: 'No Mail', email: '', score: 40 },
        ],
      },
      {
        scanned: 1,
        ranked: [
          { id: 'm1', source: 'mis', name: 'Asha', email: 'Asha@example.com', score: 55 },
        ],
      },
    ]);
    expect(merged.scanned).toBe(3);
    const asha = merged.ranked.find((row) => row.email.toLowerCase() === 'asha@example.com');
    expect(asha.source).toBe('both');
    expect(asha.score).toBe(80);
    expect(asha.id).toBe('c1');
    expect(merged.ranked.some((row) => row.name === 'No Mail')).toBe(true);
  });
});
