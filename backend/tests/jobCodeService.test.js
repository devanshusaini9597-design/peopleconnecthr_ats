const {
  normalizeJobCode,
  validateJobCodeFormat,
  orgJobCodePrefix,
  healOrganizationJobCodes,
} = require('../services/jobCodeService');

describe('jobCodeService', () => {
  test('normalizeJobCode uppercases and hyphenates', () => {
    expect(normalizeJobCode(' skillnix-2026-001 ')).toBe('SKILLNIX-2026-001');
    expect(normalizeJobCode('Job 2026 002')).toBe('JOB-2026-002');
  });

  test('validateJobCodeFormat rejects invalid', () => {
    expect(validateJobCodeFormat('AB')).toMatch(/at least 3/);
    expect(validateJobCodeFormat('bad id!')).toMatch(/letters, numbers/);
    expect(validateJobCodeFormat('SKILLNIX-2026-0001')).toBeNull();
  });

  test('orgJobCodePrefix from slug', () => {
    expect(orgJobCodePrefix({ slug: 'skillnixrecruitment' })).toBe('SKILLNIX');
    expect(orgJobCodePrefix({ slug: 'acme-recruitment-services' })).toBe('ACME');
    expect(orgJobCodePrefix({ name: 'SkillNix Recruitment Services' })).toBe('SKILLNIX');
  });

  test('healOrganizationJobCodes returns counts when no org', async () => {
    const result = await healOrganizationJobCodes(null);
    expect(result).toEqual({ fixed: 0, assigned: 0, skipped: 0 });
  });
});
