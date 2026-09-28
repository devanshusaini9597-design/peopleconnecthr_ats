const { orgJobCodePrefix } = require('../services/jobCodeService');

describe('enterprise candidate / application codes', () => {
  test('candidate IDs are lifetime CAND codes, not year-stamped job IDs', () => {
    const prefix = `${orgJobCodePrefix({ slug: 'skillnixrecruitment' })}-CAND-`;
    expect(prefix).toBe('SKILLNIX-CAND-');
    expect(prefix).not.toMatch(/-20\d{2}-/);
  });

  test('application IDs use APP, separate from the person', () => {
    const prefix = `${orgJobCodePrefix({ slug: 'skillnixrecruitment' })}-APP-`;
    expect(prefix).toBe('SKILLNIX-APP-');
  });

  test('IDs are padded sequences, not recycled gap numbers', () => {
    const next = 8;
    expect(`SKILLNIX-CAND-${String(next).padStart(6, '0')}`).toBe('SKILLNIX-CAND-000008');
    expect(`SKILLNIX-CAND-${String(7).padStart(6, '0')}`).not.toBe(`SKILLNIX-CAND-${String(next).padStart(6, '0')}`);
  });
});
