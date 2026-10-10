/**
 * PLAN_FEATURES — single source of truth for feature entitlements by plan.
 *
 * This is the second, independent axis of access control alongside RBAC
 * (`rbacMiddleware.requireRole`). RBAC answers "can this *role* do this action?".
 * This module answers "does this *org's plan* include this feature at all?".
 *
 * How it works:
 * - Each feature key maps to the minimum plan tier required to use it.
 * - `free_trial` is treated as Professional for feature checks (PLG trial).
 * - Enterprise is granted per-org via Organization.plan (optional ENTERPRISE_ORG_DOMAINS
 *   env for product-operator auto-upgrade), not by aliasing every plan.
 * - To move a feature between tiers later, change one line here — no need to
 *   touch route files or frontend components.
 *
 * Consumed by:
 * - Backend: middleware/featureMiddleware.js -> requireFeature('key')
 * - Frontend: src/config/planFeatures.js (kept in sync) -> <FeatureGate feature="key">
 *
 * NOT in this map (always available): candidate portal GDPR self-service,
 * Chrome LinkedIn-import extension, Trust Center, public status page, SOC 2 materials.
 */

// Order matters: index = rank. Higher index = more access.
const PLAN_ORDER = ['starter', 'professional', 'enterprise'];

// free_trial gives prospects the Professional experience (not full Enterprise).
const PLAN_ALIASES = {
  free_trial: 'professional'
};

/**
 * Unfinished product surfaces. Kept in the repo. Hidden from client tenants
 * until enabled per Organization from the platform dashboard (or a product-operator org).
 * Never shown on demo workspaces.
 */
const INTERNAL_PREVIEW_FEATURES = [
  'analytics.dei',
  'candidates.collaboration',
  'careers.formBuilder',
  'messaging.sequences',
  'messaging.consent',
  'scorecards.templates',
  'referrals.program',
  'workflows.approvals',
];

const INTERNAL_PREVIEW_SET = new Set(INTERNAL_PREVIEW_FEATURES);

const FEATURES = {
  // Core recruiting
  'dashboard.basic': 'starter',
  'careers.customDomain': 'enterprise',
  'mail.sendingDomain': 'enterprise',
  'jobs.customPipeline': 'professional',
  'jobs.bulkImport': 'professional',
  'data.backup': 'professional',
  'data.oldImport': 'professional',
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

  // Integrations (BYOK) — existing categories
  'integrations.byoEmail': 'professional',
  'integrations.marketing': 'professional',
  'integrations.calendar': 'professional',
  'integrations.sms': 'enterprise',
  'integrations.jobBoard': 'enterprise',
  'integrations.backgroundCheck': 'enterprise',
  'integrations.aiScoring': 'professional',
  'integrations.webhooksReadOnly': 'professional',
  'integrations.webhooksFull': 'enterprise',
  'integrations.zapier': 'enterprise',
  'integrations.esign': 'enterprise',
  'integrations.whatsapp': 'enterprise',

  // Integrations (BYOK) — new categories
  'integrations.video': 'professional',
  'integrations.storage': 'enterprise',
  'integrations.crm': 'enterprise',
  'integrations.hris': 'enterprise',
  'integrations.siem': 'enterprise',
  'integrations.dataWarehouse': 'enterprise',
  'integrations.slackApp': 'professional',

  // Agency / recruiting-firm mode
  'agency.multiClient': 'professional',
  'agency.clientSharing': 'enterprise',
  'agency.clientPortal': 'enterprise',

  // SSO / SCIM
  'sso': 'enterprise',
  'sso.scim': 'enterprise',

  // Add-ons
  'candidates.talentPools': 'professional',
  'candidates.talentPoolAutomation': 'professional',
  'candidates.skillsTaxonomy': 'professional',
  'messaging.inbox': 'professional',
  'messaging.sequences': 'professional',
  'analytics.dei': 'enterprise',
  'assessments': 'professional',
  'assessments.proctoring': 'professional',
  'careers.formBuilder': 'professional',
  'careers.chatbot': 'professional',
  'careers.companyBrand': 'professional',
  'candidates.collaboration': 'professional',
  'scorecards.templates': 'professional',
  'messaging.consent': 'professional',
  'announcements': 'professional',
  'search.global': 'starter',
  'mis.contacts': 'starter',
  'agency.freelancerDesk': 'starter',
  'push.notifications': 'professional',
  'whiteLabel': 'enterprise',

  // Starter — trust-building / PLG
  'security.mfa': 'starter',
  'candidates.dedupe': 'starter',
  'candidates.surveys': 'starter',
  'portal.localization': 'starter',

  // Professional — productivity + self-serve BYOK
  'ai.semanticSearch': 'professional',
  'ai.jdGenerator': 'professional',
  'ai.interviewQuestions': 'professional',
  'ai.booleanGenerator': 'professional',
  'ai.emailDrafting': 'professional',
  'ai.resumeGenerator': 'professional',
  'ai.skillsExtract': 'professional',
  'ai.matchScore': 'professional',
  'candidates.anonymize': 'professional',
  'security.mfaEnforcement': 'professional',
  'security.sessionPolicy': 'professional',
  'scheduling.selfBook': 'professional',
  'careers.pageBuilder': 'professional',
  'referrals.program': 'professional',

  // Enterprise — compliance-heavy / dedicated
  'security.byokEncryption': 'enterprise',
  'security.ipAllowlist': 'enterprise',
  'compliance.retentionPolicy': 'enterprise',
  'compliance.legalHold': 'enterprise',
  'ai.interviewTranscription': 'enterprise',
  'ai.biasFlagging': 'enterprise',
  'ai.narrativeAnalytics': 'enterprise',
  'workflows.approvals': 'enterprise',
  'offers.templates': 'enterprise',
  'careers.whiteLabelBuilder': 'enterprise',
  'deployment.dedicated': 'enterprise'
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
  if (plan === 'free_trial' && (featureKey === 'data.backup' || featureKey === 'data.oldImport')) {
    return false;
  }
  return rankOf(plan) >= rankOf(requiredPlan);
};

const isInternalPreviewFeature = (featureKey) => INTERNAL_PREVIEW_SET.has(featureKey);

/**
 * Plan check plus unfinished-module gate (clients off unless org flag / operator).
 */
const canUseFeature = (plan, featureKey, ctx = {}) => {
  if (isInternalPreviewFeature(featureKey)) {
    if (ctx.isDemo) return false;
    const modules = Array.isArray(ctx.previewModules) ? ctx.previewModules : [];
    if (!ctx.internalPreviewAccess && !modules.includes(featureKey)) return false;
  }
  return planHasFeature(plan, featureKey);
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
  INTERNAL_PREVIEW_FEATURES,
  planHasFeature,
  isInternalPreviewFeature,
  canUseFeature,
  getEntitlements
};
