const { planHasFeature, getEntitlements, PLAN_ORDER } = require('../config/planFeatures');

describe('planFeatures.planHasFeature', () => {
  test('starter does not get a professional-only feature', () => {
    expect(planHasFeature('starter', 'analytics.advanced')).toBe(false);
  });

  test('professional gets a professional-only feature', () => {
    expect(planHasFeature('professional', 'analytics.advanced')).toBe(true);
  });

  test('enterprise gets everything professional gets (monotonic tiers)', () => {
    expect(planHasFeature('enterprise', 'analytics.advanced')).toBe(true);
    expect(planHasFeature('enterprise', 'sso')).toBe(true);
  });

  test('professional does NOT get an enterprise-only feature', () => {
    expect(planHasFeature('professional', 'sso')).toBe(false);
    expect(planHasFeature('professional', 'team.customRoles')).toBe(false);
  });

  test('free_trial is aliased to professional (full-featured trial, PLG pattern)', () => {
    expect(planHasFeature('free_trial', 'analytics.advanced')).toBe(true);
    expect(planHasFeature('free_trial', 'integrations.byoEmail')).toBe(true);
    expect(planHasFeature('free_trial', 'sso')).toBe(false);
    expect(planHasFeature('free_trial', 'team.customRoles')).toBe(false);
  });

  test('unknown feature key fails closed (not entitled), never throws', () => {
    expect(planHasFeature('enterprise', 'this.feature.does.not.exist')).toBe(false);
  });

  test('unknown/garbage plan value fails closed', () => {
    expect(planHasFeature('not-a-real-plan', 'dashboard.basic')).toBe(false);
  });

  test('PLAN_ORDER is strictly ascending starter -> professional -> enterprise', () => {
    expect(PLAN_ORDER).toEqual(['starter', 'professional', 'enterprise']);
  });
});

describe('planFeatures.getEntitlements', () => {
  test('enterprise entitlement list is a superset of professional\'s', () => {
    const pro = new Set(getEntitlements('professional'));
    const ent = new Set(getEntitlements('enterprise'));
    for (const key of pro) {
      expect(ent.has(key)).toBe(true);
    }
    expect(ent.size).toBeGreaterThan(pro.size);
  });

  test('starter entitlement list is a subset of professional\'s', () => {
    const starter = new Set(getEntitlements('starter'));
    const pro = new Set(getEntitlements('professional'));
    for (const key of starter) {
      expect(pro.has(key)).toBe(true);
    }
  });

  test('starter gets MFA and dedupe; not video or storage BYOK', () => {
    expect(planHasFeature('starter', 'security.mfa')).toBe(true);
    expect(planHasFeature('starter', 'candidates.dedupe')).toBe(true);
    expect(planHasFeature('starter', 'integrations.video')).toBe(false);
    expect(planHasFeature('starter', 'integrations.storage')).toBe(false);
  });

  test('professional gets AI tools and video; not SCIM or KMS', () => {
    expect(planHasFeature('professional', 'ai.semanticSearch')).toBe(true);
    expect(planHasFeature('professional', 'integrations.video')).toBe(true);
    expect(planHasFeature('professional', 'sso.scim')).toBe(false);
    expect(planHasFeature('professional', 'security.byokEncryption')).toBe(false);
  });

  test('enterprise gets compliance and new BYOK categories', () => {
    expect(planHasFeature('enterprise', 'integrations.crm')).toBe(true);
    expect(planHasFeature('enterprise', 'compliance.legalHold')).toBe(true);
    expect(planHasFeature('enterprise', 'workflows.approvals')).toBe(true);
    expect(planHasFeature('enterprise', 'deployment.dedicated')).toBe(true);
  });
});
