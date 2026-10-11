const { assertPlatformOperator, PLANS, serializeTenant, tenantKind } = require('../services/platformOpsService');

describe('platformOpsService', () => {
  it('rejects customer users', () => {
    expect(() => assertPlatformOperator({ email: 'owner@acme.com', role: 'owner' })).toThrow(/platform team/i);
  });

  it('allows People Connect HR operators', () => {
    expect(() => assertPlatformOperator({ email: 'owner@peopleconnecthr.com', role: 'owner' })).not.toThrow();
    expect(() => assertPlatformOperator({ email: 'ada@peopleconnecthr.com', role: 'owner' })).toThrow(/platform team/i);
  });

  it('exposes the plans the dashboard can assign', () => {
    expect(PLANS).toEqual(['free_trial', 'starter', 'professional', 'enterprise']);
  });

  it('serializes tenant flags from the Organization document', () => {
    const row = serializeTenant({
      _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      name: 'Skillnix Recruitment Services',
      slug: 'skillnix-recruitment',
      domain: 'skillnixrecruitment.com',
      plan: 'enterprise',
      isDemo: false,
      atsSettings: { internalPreview: true },
      createdAt: new Date('2026-01-01'),
    }, 12);
    expect(row.internalPreview).toBe(true);
    expect(row.isDemo).toBe(false);
    expect(row.userCount).toBe(12);
    expect(row.name).toBe('Skillnix Recruitment Services');
    expect(row.kind).toBe('client');
    expect(row.isVendorProtected).toBe(true);
  });

  it('marks the sales demo workspace as demo, not a client', () => {
    expect(tenantKind({ slug: 'peopleconnect-demo', isDemo: true, domain: 'demo.peopleconnecthr.com' })).toBe('demo');
    expect(tenantKind({ slug: 'acme', isDemo: false, domain: 'acme.com' })).toBe('client');
    expect(tenantKind({ slug: 'people-connect-hr', isDemo: false, domain: 'peopleconnecthr.com' })).toBe('platform');
  });
});
