const {
  normalizeFls,
  sanitizeDeskDefaults,
  applyDeskDefaultsToCandidate,
  canAdminSetDeskDefaults,
  mergeEffectiveDeskDefaults,
  sanitizeRoleDeskDefaultsMap,
} = require('../utils/deskDefaults');

describe('deskDefaults', () => {
  it('normalizes FLS values', () => {
    expect(normalizeFls('fls')).toBe('FLS');
    expect(normalizeFls('non fls')).toBe('NON-FLS');
    expect(normalizeFls('NON-FLS')).toBe('NON-FLS');
    expect(normalizeFls('')).toBe('');
  });

  it('employee cannot change locked fields', () => {
    const previous = {
      fls: 'FLS',
      client: 'HDFC',
      locked: { fls: true, client: false },
    };
    const next = sanitizeDeskDefaults(
      { fls: 'NON-FLS', client: 'ICICI' },
      { asAdmin: false, previous }
    );
    expect(next.fls).toBe('FLS');
    expect(next.client).toBe('ICICI');
    expect(next.locked.fls).toBe(true);
  });

  it('admin can lock and set FLS', () => {
    const next = sanitizeDeskDefaults(
      { fls: 'FLS', locked: { fls: true } },
      { asAdmin: true }
    );
    expect(next.fls).toBe('FLS');
    expect(next.locked.fls).toBe(true);
  });

  it('applyDeskDefaultsToCandidate only fills empty fields', () => {
    const out = applyDeskDefaultsToCandidate(
      { fls: '', client: 'KEEP', name: 'A' },
      { fls: 'FLS', client: 'HDFC', source: 'Naukri' }
    );
    expect(out.fls).toBe('FLS');
    expect(out.client).toBe('KEEP');
    expect(out.source).toBe('NAUKRI');
    expect(out.name).toBe('A');
  });

  it('canAdminSetDeskDefaults roles', () => {
    expect(canAdminSetDeskDefaults({ role: 'owner' })).toBe(true);
    expect(canAdminSetDeskDefaults({ role: 'hr_manager' })).toBe(true);
    expect(canAdminSetDeskDefaults({ role: 'hr_recruiter' })).toBe(false);
  });

  it('mergeEffectiveDeskDefaults: user > role (no sticky last-used)', () => {
    const effective = mergeEffectiveDeskDefaults({
      userDefaults: { client: 'USER CLIENT', locked: {} },
      roleDefaults: { fls: 'FLS', client: 'ROLE CLIENT', locked: { fls: true } },
    });
    expect(effective.fls).toBe('FLS');
    expect(effective.locked.fls).toBe(true);
    expect(effective.client).toBe('USER CLIENT');
    expect(effective.source).toBe('');
  });

  it('mergeEffectiveDeskDefaults uses role when user empty', () => {
    const effective = mergeEffectiveDeskDefaults({
      userDefaults: { locked: {} },
      roleDefaults: { source: 'NAUKRI' },
    });
    expect(effective.source).toBe('NAUKRI');
  });

  it('sanitizeRoleDeskDefaultsMap keeps known roles only', () => {
    const map = sanitizeRoleDeskDefaultsMap({
      hr_recruiter: { fls: 'FLS', locked: { fls: true } },
      ghost: { fls: 'FLS' },
    });
    expect(map.hr_recruiter.fls).toBe('FLS');
    expect(map.ghost).toBeUndefined();
  });
});
