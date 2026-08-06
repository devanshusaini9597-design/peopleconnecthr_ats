export const SEARCH_TOUR_KEY = 'skillnix_tour_global_search_v1';

export const SEARCH_TOUR_STEPS = [
  {
    title: 'Global Search',
    body: 'Search candidates, jobs, and applications from one place across your workspace.',
  },
  {
    target: '[data-tour="search-kpis"]',
    title: 'Match counts',
    body: 'See how many hits you have overall and by entity type. Click a card to filter results.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="search-toolbar"]',
    title: 'Search bar',
    body: 'Type a name, email, or keyword. Use entity chips to narrow to candidates, jobs, or applications.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="search-results"]',
    title: 'Results',
    body: 'Open any row to jump into that record. Try an example query if you are not sure where to start.',
    placement: 'top',
  },
];

export const ENTITY_FILTERS = [
  { key: 'all', label: 'All', icon: 'Search' },
  { key: 'candidates', label: 'Candidates', icon: 'Users' },
  { key: 'jobs', label: 'Jobs', icon: 'Briefcase' },
  { key: 'applications', label: 'Applications', icon: 'GitPullRequest' }
];

export const STATUS_BADGE = {
  active: 'badge-success',
  open: 'badge-success',
  published: 'badge-success',
  hired: 'badge-brand',
  offer: 'badge-info',
  interview: 'badge-info',
  screening: 'badge-neutral',
  rejected: 'badge-danger',
  closed: 'badge-neutral',
  draft: 'badge-warning',
  on_hold: 'badge-warning',
  pending: 'badge-warning'
};

export const EXAMPLE_QUERIES = [
  { q: 'React', hint: 'Skill or role' },
  { q: 'Bangalore', hint: 'Location' },
  { q: 'Engineering', hint: 'Department' },
  { q: '@gmail.com', hint: 'Email domain' }
];

export function initials(text) {
  const parts = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function statusBadgeClass(status) {
  if (!status) return null;
  const key = String(status).toLowerCase().replace(/\s+/g, '_');
  return STATUS_BADGE[key] || 'badge-neutral';
}
