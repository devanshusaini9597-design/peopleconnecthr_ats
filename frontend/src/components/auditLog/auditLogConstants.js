export const AUDIT_TOUR_KEY = 'skillnix_tour_audit_log_v1';

export const AUDIT_TOUR_STEPS = [
  {
    title: 'Audit Log',
    body: 'Track security-relevant actions across your organization — who did what, and when.',
  },
  {
    target: '[data-tour="audit-tip"]',
    title: 'Tips',
    body: 'Filter by action, resource, or date range. Export CSV on Enterprise when you need an offline copy.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="audit-filters"]',
    title: 'Filters',
    body: 'Narrow the trail with action, resource, and start/end dates. Clear filters anytime to reset.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="audit-table"]',
    title: 'Activity trail',
    body: 'Each row is an audited event. Expand a row when details are available.',
    placement: 'top',
  },
];

export const formatAction = (action) => (action || '').replace(/\./g, ' ').replace(/_/g, ' ');

export const actionBadgeClass = (action = '') => {
  const a = action.toLowerCase();
  if (/(delete|remove|revoke|disable)/.test(a)) return 'bg-red-50 text-red-700 border-red-100';
  if (/(create|invite|add|enable|provision)/.test(a)) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (/(update|edit|change|role)/.test(a)) return 'bg-amber-50 text-amber-800 border-amber-100';
  if (/(login|logout|auth|sso|mfa)/.test(a)) return 'bg-sky-50 text-sky-700 border-sky-100';
  if (/(export|download)/.test(a)) return 'bg-violet-50 text-violet-700 border-violet-100';
  return 'bg-stone-100 text-stone-600 border-stone-200';
};
