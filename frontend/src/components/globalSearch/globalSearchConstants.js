export const SEARCH_TOUR_KEY = 'skillnix_tour_global_search_v6';

export const SEARCH_TOUR_STEPS = [
  {
    title: 'Global Search',
    body: 'Search candidates and MIS contacts together. Results stay on this page until you run a new search or leave.',
  },
  {
    target: '[data-tour="search-kpis"]',
    title: 'Workspace totals',
    body: 'These figures are organisation counts and refresh automatically. They are independent of the current search. Select a card to open that list.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="search-workbench"]',
    title: 'Search and filters',
    body: 'Choose a field from the scope menu, or search across all fields. Open Filters for role, location, product, and compensation criteria.',
    placement: 'bottom',
  },
];

export const ENTITY_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'candidates', label: 'Candidates' },
  { key: 'mis', label: 'MIS' },
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
  pending: 'badge-warning',
  scheduled: 'badge-info',
};

export const EXAMPLE_QUERIES = [
  { q: 'SKILLNIX-', hint: 'Job ID — also returns people who match that role' },
  { q: 'HR Recruiter', hint: 'Position or job title' },
  { q: 'Pune', hint: 'Location across candidates and MIS contacts' },
  { q: 'Banking', hint: 'Skill or industry' },
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

export function emptySearchData() {
  return {
    candidates: [],
    jobs: [],
    applications: [],
    mis: [],
    people: [],
    interviews: [],
    jobFit: [],
    related: [],
    talentPools: [],
    relatedJob: null,
    aiEnabled: false,
    totals: null,
    floors: null,
    countsExact: false,
  };
}
