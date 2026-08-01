/**
 * Frontend mirror of backend/config/planFeatures.js.
 *
 * Kept as a plain, dependency-free config so <FeatureGate> can render
 * synchronously from `entitlements` fetched at login, or recompute locally
 * when `organization.plan` changes (e.g. right after a plan upgrade) before
 * the next profile refresh completes.
 *
 * IMPORTANT: if you change backend/config/planFeatures.js, mirror the change
 * here too — the backend is the enforcement source of truth (every protected
 * route re-checks via requireFeature), this file only controls what the UI
 * shows/hides.
 */

const PLAN_ORDER = ['starter', 'professional', 'enterprise'];

const PLAN_ALIASES = {
  free_trial: 'professional'
};

const FEATURES = {
  'dashboard.basic': 'starter',
  'careers.customDomain': 'enterprise',
  'jobs.customPipeline': 'professional',
  'jobs.bulkImport': 'professional',
  'candidates.advancedSearch': 'professional',
  'candidates.savedSearches': 'professional',

  'analytics.basic': 'starter',
  'analytics.advanced': 'professional',
  'reports.custom': 'enterprise',

  'audit.log': 'professional',
  'audit.export': 'enterprise',
  'team.customRoles': 'enterprise',
  'export.data': 'professional',

  'integrations.byoEmail': 'professional',
  'integrations.calendar': 'professional',
  'integrations.sms': 'enterprise',
  'integrations.jobBoard': 'enterprise',
  'integrations.backgroundCheck': 'enterprise',
  'integrations.aiScoring': 'professional',
  'integrations.webhooksReadOnly': 'professional',
  'integrations.webhooksFull': 'enterprise',
  'integrations.zapier': 'enterprise',
  'integrations.esign': 'enterprise',

  'agency.multiClient': 'professional',
  'agency.clientSharing': 'enterprise',
  'agency.clientPortal': 'enterprise',

  'sso': 'enterprise',

  // ── Add-ons ──
  'candidates.talentPools': 'professional',
  'analytics.dei': 'enterprise',
  'integrations.whatsapp': 'enterprise',
  'assessments': 'professional',
  'whiteLabel': 'enterprise'
};

const rankOf = (plan) => {
  const resolved = PLAN_ALIASES[plan] || plan;
  return PLAN_ORDER.indexOf(resolved);
};

export const planHasFeature = (plan, featureKey) => {
  const requiredPlan = FEATURES[featureKey];
  if (!requiredPlan) return false;
  return rankOf(plan) >= rankOf(requiredPlan);
};

export const getEntitlements = (plan) => {
  return Object.keys(FEATURES).filter((key) => planHasFeature(plan, key));
};

export { PLAN_ORDER, FEATURES };
