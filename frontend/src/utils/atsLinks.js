/** Build /ats URLs that keep employee SPOC scope + analytics period in sync. */
export function buildAtsHref({
  view,
  status,
  employeeId,
  q,
  jobId,
  appSource,
  period,
  from,
  to,
  list,
  cohort,
} = {}) {
  const params = new URLSearchParams();
  if (view) params.set('view', String(view));
  if (status) params.set('status', String(status));
  if (employeeId) params.set('employee', String(employeeId));
  if (q) params.set('q', String(q));
  if (jobId) params.set('jobId', String(jobId));
  if (appSource) params.set('appSource', String(appSource));
  const range = String(period || '').trim();
  if (range && range !== 'all') params.set('period', range);
  if (range === 'custom') {
    if (from) params.set('from', String(from).slice(0, 10));
    if (to) params.set('to', String(to).slice(0, 10));
  }
  if (list) params.set('list', String(list));
  if (cohort) params.set('cohort', String(cohort));
  const qs = params.toString();
  return qs ? `/ats?${qs}` : '/ats';
}
