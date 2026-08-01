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
    // ...but NOT enterprise-only features, matching the alias target (professional), not the top tier.
    expect(planHasFeature('free_trial', 'sso')).toBe(false);
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
    // And enterprise has strictly more (e.g. sso, team.customRoles).
    expect(ent.size).toBeGreaterThan(pro.size);
  });

  test('starter entitlement list is a subset of professional\'s', () => {
    const starter = new Set(getEntitlements('starter'));
    const pro = new Set(getEntitlements('professional'));
    for (const key of starter) {
      expect(pro.has(key)).toBe(true);
    }
  });
});
