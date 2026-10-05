const { DEMO_ROLES, demoEmailForRole, demoEmailBlockedError } = require('../config/demoRoles');

describe('demo roles', () => {
  const allowed = new Set([
    'owner', 'admin', 'hr_manager', 'hr_recruiter', 'sales',
    'freelancer', 'interviewer', 'readonly', 'other',
  ]);

  it('covers each sales role once', () => {
    const roles = DEMO_ROLES.map((r) => r.role);
    expect(new Set(roles).size).toBe(roles.length);
    roles.forEach((role) => expect(allowed.has(role)).toBe(true));
    expect(roles).not.toContain('recruiter');
  });

  it('uses demo mailbox addresses, not customer mail', () => {
    expect(demoEmailForRole('owner')).toBe('demo.owner@demo.peopleconnecthr.com');
    expect(demoEmailForRole('freelancer')).toContain('@demo.peopleconnecthr.com');
  });

  it('blocks real email from the demo workspace', () => {
    const err = demoEmailBlockedError();
    expect(err.code).toBe('DEMO_EMAIL_BLOCKED');
    expect(err.displayMessage).toMatch(/does not send real email/i);
  });
});

describe('demo home paths', () => {
  const {
    homePathForDemoRole,
    assertDemoAccess,
  } = require('../services/demoWorkspaceService');

  const origKey = process.env.DEMO_ACCESS_KEY;
  const origPublic = process.env.DEMO_PUBLIC;

  afterEach(() => {
    if (origKey == null) delete process.env.DEMO_ACCESS_KEY;
    else process.env.DEMO_ACCESS_KEY = origKey;
    if (origPublic == null) delete process.env.DEMO_PUBLIC;
    else process.env.DEMO_PUBLIC = origPublic;
  });

  it('lands each key role on a useful desk', () => {
    expect(homePathForDemoRole('owner')).toBe('/dashboard');
    expect(homePathForDemoRole('interviewer')).toBe('/interviews');
    expect(homePathForDemoRole('freelancer')).toBe('/dashboard');
    expect(homePathForDemoRole('sales')).toBe('/mis');
  });

  it('rejects demo entry without the private share key', () => {
    process.env.DEMO_ACCESS_KEY = 'secret-walk-key';
    process.env.DEMO_PUBLIC = '1';
    expect(() => assertDemoAccess('')).toThrow(/private demo link/i);
    expect(() => assertDemoAccess('wrong')).toThrow(/private demo link/i);
    expect(() => assertDemoAccess('secret-walk-key')).not.toThrow();
  });

  it('stays locked when no access key is configured', () => {
    delete process.env.DEMO_ACCESS_KEY;
    process.env.DEMO_PUBLIC = '1';
    expect(() => assertDemoAccess('anything')).toThrow(/not available/i);
  });
});
