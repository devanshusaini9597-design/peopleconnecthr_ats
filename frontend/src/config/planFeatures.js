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
 *
 * NOT gated: Trust Center, public status page, SOC 2 materials, candidate
 * GDPR self-service, Chrome LinkedIn-import extension.
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
  'integrations.whatsapp': 'enterprise',

  'integrations.video': 'professional',
  'integrations.storage': 'enterprise',
  'integrations.crm': 'enterprise',
  'integrations.hris': 'enterprise',
  'integrations.siem': 'enterprise',
  'integrations.dataWarehouse': 'enterprise',
  'integrations.slackApp': 'professional',

  'agency.multiClient': 'professional',
  'agency.clientSharing': 'enterprise',
  'agency.clientPortal': 'enterprise',

  'sso': 'enterprise',
  'sso.scim': 'enterprise',

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
  'push.notifications': 'professional',
  'whiteLabel': 'enterprise',

  'security.mfa': 'starter',
  'candidates.dedupe': 'starter',
  'candidates.surveys': 'starter',
  'portal.localization': 'starter',

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

/** Any integration category entitlement — used to show Integrations nav. */
export const INTEGRATION_NAV_FEATURES = [
  'integrations.byoEmail',
  'integrations.calendar',
  'integrations.aiScoring',
  'integrations.video',
  'integrations.sms',
  'integrations.whatsapp',
  'integrations.jobBoard',
  'integrations.backgroundCheck',
  'integrations.esign',
  'integrations.storage',
  'integrations.crm',
  'integrations.hris',
  'integrations.siem',
  'integrations.dataWarehouse',
  'integrations.slackApp',
  'integrations.webhooksReadOnly'
];

export const planHasAnyIntegration = (plan) =>
  INTEGRATION_NAV_FEATURES.some((key) => planHasFeature(plan, key));

export { PLAN_ORDER, FEATURES };
