/**
 * PLAN_FEATURES — single source of truth for feature entitlements by plan.
 *
 * This is the second, independent axis of access control alongside RBAC
 * (`rbacMiddleware.requireRole`). RBAC answers "can this *role* do this action?".
 * This module answers "does this *org's plan* include this feature at all?".
 *
 * How it works:
 * - Each feature key maps to the minimum plan tier required to use it.
 * - `free_trial` is treated as the Professional tier for feature checks (a
 *   full-featured trial), matching Organization.plan's enum default.
 * - To move a feature between tiers later, change one line here — no need to
 *   touch route files or frontend components.
 *
 * Consumed by:
 * - Backend: middleware/featureMiddleware.js -> requireFeature('key')
 * - Frontend: src/config/planFeatures.js (kept in sync) -> <FeatureGate feature="key">
 */

// Order matters: index = rank. Higher index = more access.
const PLAN_ORDER = ['starter', 'professional', 'enterprise'];

// free_trial gives prospects the full Professional experience (PLG pattern).
const PLAN_ALIASES = {
  free_trial: 'professional'
};

const FEATURES = {
  // Core recruiting
  'dashboard.basic': 'starter',
  'careers.customDomain': 'enterprise',
  'jobs.customPipeline': 'professional',
  'jobs.bulkImport': 'professional',
  'candidates.advancedSearch': 'professional',
  'candidates.savedSearches': 'professional',

  // Analytics & reporting
  'analytics.basic': 'starter',
  'analytics.advanced': 'professional',
  'reports.custom': 'enterprise',

  // Team & administration
  'audit.log': 'professional',
  'audit.export': 'enterprise',
  'team.customRoles': 'enterprise',
  'export.data': 'professional',

  // Integrations (BYOK)
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

  // Agency / recruiting-firm mode
  'agency.multiClient': 'professional',
  'agency.clientSharing': 'enterprise',
  'agency.clientPortal': 'enterprise',

  // Enterprise-only table stakes
  'sso': 'enterprise'
};

const rankOf = (plan) => {
  const resolved = PLAN_ALIASES[plan] || plan;
  const idx = PLAN_ORDER.indexOf(resolved);
  return idx === -1 ? -1 : idx;
};

/**
 * @param {string} plan Organization.plan value
 * @param {string} featureKey key from FEATURES above
 * @returns {boolean}
 */
const planHasFeature = (plan, featureKey) => {
  const requiredPlan = FEATURES[featureKey];
  if (!requiredPlan) {
    // Unknown feature key -> fail closed (treat as not entitled) rather than
    // silently allowing access to something that was never registered.
    return false;
  }
  return rankOf(plan) >= rankOf(requiredPlan);
};

/**
 * Returns the full list of feature keys a plan is entitled to.
 * Useful for sending `entitlements: string[]` to the frontend at login.
 * @param {string} plan
 * @returns {string[]}
 */
const getEntitlements = (plan) => {
  return Object.keys(FEATURES).filter((key) => planHasFeature(plan, key));
};

module.exports = {
  PLAN_ORDER,
  PLAN_ALIASES,
  FEATURES,
  planHasFeature,
  getEntitlements
};
