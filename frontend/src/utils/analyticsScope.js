export const ORG_WIDE_ANALYTICS_ROLES = ['owner', 'admin', 'hr_manager'];

export function canViewOrgAnalytics(role) {
  return ORG_WIDE_ANALYTICS_ROLES.includes(role);
}

export function appendUserId(url, userId) {
  if (!userId) return url;
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}userId=${encodeURIComponent(userId)}`;
}

export function appendAnalyticsParams(url, { userId, dateRange, customFrom, customTo, cohortMonth, refresh } = {}) {
  const params = new URLSearchParams();
  if (userId) params.set('userId', userId);
  if (dateRange) params.set('dateRange', dateRange);
  if (dateRange === 'custom') {
    if (customFrom) params.set('customFrom', customFrom);
    if (customTo) params.set('customTo', customTo);
  }
  if (cohortMonth) params.set('cohortMonth', cohortMonth);
  if (refresh) params.set('refresh', '1');
  const qs = params.toString();
  if (!qs) return url;
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}${qs}`;
}
