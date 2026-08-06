export const POOL_COLORS = ['#0d9488', '#14b8a6', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#a855f7'];
export const POOLS_TOUR_KEY = 'skillnix_tour_talent_pools_v1';
export const MEMBER_PAGE_SIZE = 25;

export const SORT_OPTIONS = [
  { value: 'name', label: 'Name A–Z' },
  { value: 'members', label: 'Most members' },
  { value: 'recent', label: 'Recently updated' },
];

export const POOLS_TOUR_STEPS = [
  {
    title: 'Talent Pools',
    body: 'Group strong candidates for future roles — independent of any single job. Create pools, add people, and keep them warm.',
  },
  {
    target: '[data-tour="pools-tip"]',
    title: 'How it works',
    body: 'Pools are a silver-medalist / passive bench. Opening a pool lets you manage members and optional reject automation.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="pools-filters"]',
    title: 'Find pools',
    body: 'Search by name or description and sort by name, size, or recent activity.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="pools-grid"]',
    title: 'Your pools',
    body: 'Open a pool to review members. Use Manage to rename or recolor. Delete removes the pool only — candidates stay in the ATS.',
    placement: 'top',
  },
];
