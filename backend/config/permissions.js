/**
 * Enterprise custom-role permission catalog.
 *
 * These are fine-grained permissions that Enterprise orgs can assemble into
 * custom roles (see models/CustomRole.js), on top of the 5 fixed RBAC roles
 * (owner/admin/recruiter/interviewer/readonly) that every plan gets.
 *
 * DEFAULT_ROLE_PERMISSIONS gives every fixed role a sensible starting
 * permission set — used as the fallback when a user has no customRoleId,
 * so `hasPermission()` works uniformly whether or not Enterprise custom
 * roles are in use.
 */

const PERMISSIONS = [
  'jobs.create', 'jobs.edit', 'jobs.delete', 'jobs.publish',
  'candidates.create', 'candidates.edit', 'candidates.delete', 'candidates.export',
  'applications.edit', 'applications.reject',
  'interviews.schedule', 'interviews.cancel', 'scorecards.submit',
  'team.invite', 'team.remove', 'team.changeRole',
  'organization.editSettings', 'organization.manageIntegrations',
  'audit.view', 'audit.export',
  'billing.manage'
];

const DEFAULT_ROLE_PERMISSIONS = {
  owner: [...PERMISSIONS],
  admin: [...PERMISSIONS].filter((p) => p !== 'billing.manage'),
  recruiter: [
    'jobs.create', 'jobs.edit', 'jobs.publish',
    'candidates.create', 'candidates.edit', 'candidates.export',
    'applications.edit', 'applications.reject',
    'interviews.schedule', 'interviews.cancel', 'scorecards.submit'
  ],
  interviewer: ['scorecards.submit'],
  readonly: []
};

module.exports = { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS };
