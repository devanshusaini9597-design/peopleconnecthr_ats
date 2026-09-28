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
  const { homePathForDemoRole } = require('../services/demoWorkspaceService');

  it('lands each key role on a useful desk', () => {
    expect(homePathForDemoRole('owner')).toBe('/dashboard');
    expect(homePathForDemoRole('interviewer')).toBe('/interviews');
    expect(homePathForDemoRole('freelancer')).toBe('/dashboard');
    expect(homePathForDemoRole('sales')).toBe('/mis');
  });
});
