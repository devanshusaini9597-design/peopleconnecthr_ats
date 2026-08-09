/**
 * Enterprise custom-role permission catalog.
 *
 * Two layers (standard ATS / HRIS pattern):
 *   1. modules.*  — which product areas appear in the sidebar / are reachable
 *   2. action keys — what the user can do inside those areas (create, edit, …)
 *
 * Custom roles assemble both. Users without a customRoleId fall back to
 * DEFAULT_ROLE_PERMISSIONS for their fixed system role (owner/admin/…).
 */

const MODULE_PERMISSIONS = [
  'modules.dashboard',
  'modules.analytics',
  'modules.search',
  'modules.reports',
  'modules.dei',
  'modules.announcements',
  'modules.jobs',
  'modules.applications',
  'modules.candidates',
  'modules.pipeline',
  'modules.resumeParsing',
  'modules.talentPools',
  'modules.skills',
  'modules.collaboration',
  'modules.formBuilder',
  'modules.assessments',
  'modules.aiTools',
  'modules.inbox',
  'modules.sequences',
  'modules.consent',
  'modules.interviews',
  'modules.scorecardTemplates',
  'modules.team',
  'modules.organization',
  'modules.companyBrand',
  'modules.integrations',
  'modules.auditLog',
  'modules.customRoles',
  'modules.sso',
  'modules.security',
  'modules.webhooks',
  'modules.scheduledReports',
  'modules.whiteLabel',
  'modules.chromeExtension',
  'modules.chatbot',
  'modules.referrals',
  'modules.approvals',
  'modules.emailTemplates',
  'modules.emailSettings',
  'modules.pushNotifications',
  'modules.profile',
  'modules.billing',
];

const ACTION_PERMISSIONS = [
  'jobs.create', 'jobs.edit', 'jobs.delete', 'jobs.publish',
  'candidates.create', 'candidates.edit', 'candidates.delete', 'candidates.export',
  'applications.edit', 'applications.reject',
  'interviews.schedule', 'interviews.cancel', 'scorecards.submit',
  'team.invite', 'team.remove', 'team.changeRole',
  'organization.editSettings', 'organization.manageIntegrations',
  'audit.view', 'audit.export',
  'billing.manage',
];

const PERMISSIONS = [...MODULE_PERMISSIONS, ...ACTION_PERMISSIONS];

/** Human-readable catalog for the Custom Roles UI (grouped like the product). */
const PERMISSION_CATALOG = [
  {
    id: 'main',
    label: 'Main',
    description: 'Home, insights, and company-wide visibility',
    items: [
      { key: 'modules.dashboard', label: 'Dashboard', kind: 'module' },
      { key: 'modules.analytics', label: 'Analytics', kind: 'module' },
      { key: 'modules.search', label: 'Global Search', kind: 'module' },
      { key: 'modules.reports', label: 'Reports Studio', kind: 'module' },
      { key: 'modules.dei', label: 'DEI', kind: 'module' },
      { key: 'modules.announcements', label: 'Announcements', kind: 'module' },
    ],
  },
  {
    id: 'recruitment',
    label: 'Recruitment',
    description: 'Hiring pipeline and talent workflows',
    items: [
      { key: 'modules.jobs', label: 'Jobs', kind: 'module' },
      { key: 'jobs.create', label: 'Create jobs', kind: 'action' },
      { key: 'jobs.edit', label: 'Edit jobs', kind: 'action' },
      { key: 'jobs.delete', label: 'Delete jobs', kind: 'action' },
      { key: 'jobs.publish', label: 'Publish jobs', kind: 'action' },
      { key: 'modules.applications', label: 'Applications', kind: 'module' },
      { key: 'applications.edit', label: 'Edit applications', kind: 'action' },
      { key: 'applications.reject', label: 'Reject applications', kind: 'action' },
      { key: 'modules.candidates', label: 'Candidates', kind: 'module' },
      { key: 'candidates.create', label: 'Create candidates', kind: 'action' },
      { key: 'candidates.edit', label: 'Edit candidates', kind: 'action' },
      { key: 'candidates.delete', label: 'Delete candidates', kind: 'action' },
      { key: 'candidates.export', label: 'Export candidates', kind: 'action' },
      { key: 'modules.pipeline', label: 'Pipeline Board', kind: 'module' },
      { key: 'modules.resumeParsing', label: 'Resume Parsing', kind: 'module' },
      { key: 'modules.talentPools', label: 'Talent Pools', kind: 'module' },
      { key: 'modules.skills', label: 'Skills', kind: 'module' },
      { key: 'modules.collaboration', label: 'Collaboration', kind: 'module' },
      { key: 'modules.formBuilder', label: 'Form Builder', kind: 'module' },
      { key: 'modules.assessments', label: 'Assessments', kind: 'module' },
      { key: 'modules.aiTools', label: 'AI Tools', kind: 'module' },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    description: 'Messaging and outreach',
    items: [
      { key: 'modules.inbox', label: 'Inbox', kind: 'module' },
      { key: 'modules.sequences', label: 'Sequences', kind: 'module' },
      { key: 'modules.consent', label: 'Consent', kind: 'module' },
    ],
  },
  {
    id: 'interviews',
    label: 'Interviews',
    description: 'Scheduling and scorecards',
    items: [
      { key: 'modules.interviews', label: 'Interviews', kind: 'module' },
      { key: 'interviews.schedule', label: 'Schedule interviews', kind: 'action' },
      { key: 'interviews.cancel', label: 'Cancel interviews', kind: 'action' },
      { key: 'scorecards.submit', label: 'Submit scorecards', kind: 'action' },
      { key: 'modules.scorecardTemplates', label: 'Scorecard Templates', kind: 'module' },
    ],
  },
  {
    id: 'organization',
    label: 'Organization',
    description: 'Admin, security, and company setup',
    items: [
      { key: 'modules.team', label: 'Team', kind: 'module' },
      { key: 'team.invite', label: 'Invite members', kind: 'action' },
      { key: 'team.remove', label: 'Remove members', kind: 'action' },
      { key: 'team.changeRole', label: 'Change member roles', kind: 'action' },
      { key: 'modules.organization', label: 'Organization settings', kind: 'module' },
      { key: 'organization.editSettings', label: 'Edit org settings', kind: 'action' },
      { key: 'modules.companyBrand', label: 'Company Brand', kind: 'module' },
      { key: 'modules.integrations', label: 'Integrations', kind: 'module' },
      { key: 'organization.manageIntegrations', label: 'Manage integrations', kind: 'action' },
      { key: 'modules.auditLog', label: 'Audit Log', kind: 'module' },
      { key: 'audit.view', label: 'View audit log', kind: 'action' },
      { key: 'audit.export', label: 'Export audit log', kind: 'action' },
      { key: 'modules.customRoles', label: 'Custom Roles', kind: 'module' },
      { key: 'modules.sso', label: 'Single Sign-On', kind: 'module' },
      { key: 'modules.security', label: 'Security', kind: 'module' },
      { key: 'modules.webhooks', label: 'Webhooks & API', kind: 'module' },
      { key: 'modules.scheduledReports', label: 'Scheduled Reports', kind: 'module' },
      { key: 'modules.whiteLabel', label: 'White-Label Kit', kind: 'module' },
      { key: 'modules.chromeExtension', label: 'Chrome Extension', kind: 'module' },
      { key: 'modules.chatbot', label: 'Careers Chatbot', kind: 'module' },
      { key: 'modules.referrals', label: 'Referrals', kind: 'module' },
      { key: 'modules.approvals', label: 'Approvals', kind: 'module' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Personal and notification preferences',
    items: [
      { key: 'modules.emailTemplates', label: 'Email Templates', kind: 'module' },
      { key: 'modules.emailSettings', label: 'Email Settings', kind: 'module' },
      { key: 'modules.pushNotifications', label: 'Push Notifications', kind: 'module' },
      { key: 'modules.profile', label: 'Profile', kind: 'module' },
    ],
  },
  {
    id: 'billing',
    label: 'Billing',
    description: 'Plan and payments (typically owners only)',
    items: [
      { key: 'modules.billing', label: 'Billing', kind: 'module' },
      { key: 'billing.manage', label: 'Manage billing', kind: 'action' },
    ],
  },
];

const ALL_MODULES = [...MODULE_PERMISSIONS];

const DEFAULT_ROLE_PERMISSIONS = {
  owner: [...PERMISSIONS],
  admin: [...PERMISSIONS].filter((p) => p !== 'billing.manage' && p !== 'modules.billing'),
  hr_manager: [...PERMISSIONS].filter((p) => p !== 'billing.manage' && p !== 'modules.billing'),
  hr_recruiter: [
    'modules.dashboard', 'modules.analytics', 'modules.search', 'modules.reports', 'modules.announcements',
    'modules.jobs', 'modules.applications', 'modules.candidates', 'modules.pipeline', 'modules.resumeParsing',
    'modules.talentPools', 'modules.skills', 'modules.collaboration', 'modules.formBuilder', 'modules.assessments',
    'modules.aiTools',
    'modules.inbox', 'modules.sequences', 'modules.consent',
    'modules.interviews', 'modules.scorecardTemplates',
    'modules.emailTemplates', 'modules.pushNotifications', 'modules.profile',
    'jobs.create', 'jobs.edit', 'jobs.publish',
    'candidates.create', 'candidates.edit', 'candidates.export',
    'applications.edit', 'applications.reject',
    'interviews.schedule', 'interviews.cancel', 'scorecards.submit',
  ],
  sales: [
    'modules.dashboard', 'modules.analytics', 'modules.search', 'modules.announcements',
    'modules.candidates', 'modules.pipeline', 'modules.talentPools',
    'modules.inbox', 'modules.consent',
    'modules.pushNotifications', 'modules.profile',
    'candidates.create', 'candidates.edit', 'candidates.export',
  ],
  other: [
    'modules.dashboard', 'modules.analytics', 'modules.search',
    'modules.profile',
  ],
  // Legacy aliases (existing users)
  recruiter: null, // filled below
  interviewer: [
    'modules.dashboard', 'modules.analytics', 'modules.search',
    'modules.interviews',
    'modules.pushNotifications', 'modules.profile',
    'scorecards.submit',
  ],
  readonly: [
    'modules.dashboard', 'modules.analytics', 'modules.search',
    'modules.profile',
  ],
};

DEFAULT_ROLE_PERMISSIONS.recruiter = [...DEFAULT_ROLE_PERMISSIONS.hr_recruiter];

module.exports = {
  PERMISSIONS,
  MODULE_PERMISSIONS,
  ACTION_PERMISSIONS,
  PERMISSION_CATALOG,
  ALL_MODULES,
  DEFAULT_ROLE_PERMISSIONS,
};
