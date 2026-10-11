export const MODULE_CATALOG = [
  { key: 'analytics.dei', name: 'DEI', blurb: 'Diversity analytics and blind screening' },
  { key: 'candidates.collaboration', name: 'Collaboration', blurb: 'Shared notes and hiring threads' },
  { key: 'careers.formBuilder', name: 'Form builder', blurb: 'Custom application forms' },
  { key: 'messaging.sequences', name: 'Sequences', blurb: 'Automated candidate outreach' },
  { key: 'messaging.consent', name: 'Consent', blurb: 'Messaging consent ledger' },
  { key: 'scorecards.templates', name: 'Scorecards', blurb: 'Reusable interview scorecards' },
  { key: 'referrals.program', name: 'Referrals', blurb: 'Employee referral program' },
  { key: 'workflows.approvals', name: 'Approvals', blurb: 'Offer and hire approvals' },
];

export const PLAN_OPTIONS = [
  { id: 'free_trial', label: 'Trial' },
  { id: 'starter', label: 'Starter' },
  { id: 'professional', label: 'Professional' },
  { id: 'enterprise', label: 'Enterprise' },
];

export const PRODUCT_GROUPS = [
  { id: 'core', name: 'ATS core', keys: ['dashboard.basic', 'search.global', 'jobs.customPipeline', 'jobs.bulkImport', 'candidates.advancedSearch', 'candidates.savedSearches', 'candidates.dedupe', 'export.data'] },
  { id: 'analytics', name: 'Analytics', keys: ['analytics.basic', 'analytics.advanced', 'reports.custom'] },
  { id: 'ai', name: 'AI', keys: ['ai.semanticSearch', 'ai.jdGenerator', 'ai.interviewQuestions', 'ai.booleanGenerator', 'ai.emailDrafting', 'ai.resumeGenerator', 'ai.skillsExtract', 'ai.matchScore', 'ai.interviewTranscription', 'ai.biasFlagging', 'ai.narrativeAnalytics'] },
  { id: 'sso', name: 'SSO & security', keys: ['sso', 'sso.scim', 'security.mfa', 'security.mfaEnforcement', 'security.sessionPolicy', 'security.ipAllowlist', 'audit.log', 'audit.export', 'team.customRoles'] },
  { id: 'messaging', name: 'Messaging', keys: ['messaging.inbox', 'integrations.byoEmail', 'integrations.whatsapp', 'integrations.sms'] },
  { id: 'integrations', name: 'Integrations', keys: ['integrations.calendar', 'integrations.video', 'integrations.webhooksReadOnly', 'integrations.webhooksFull', 'integrations.zapier', 'integrations.crm', 'integrations.hris'] },
];

export function formatCount(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

export function relativeTime(value) {
  if (!value) return 'No activity';
  const ms = Date.now() - new Date(value).getTime();
  if (Number.isNaN(ms)) return '—';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
