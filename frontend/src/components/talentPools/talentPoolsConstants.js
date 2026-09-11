export const POOL_COLORS = ['#0d9488', '#14b8a6', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#a855f7'];
export const POOLS_TOUR_KEY = 'skillnix_tour_talent_pools_v1';
export const MEMBER_PAGE_SIZE = 25;
export const AUTO_OPTIONS = [
  {
    key: 'addOnReject',
    label: 'Add on reject',
    hint: 'When an application is rejected, or Candidates status is set to Rejected.',
  },
  {
    key: 'isDefaultRejectPool',
    label: 'Default reject pool',
    hint: 'Catch-all for every reject in the company. Use only on Warm bench (one per org).',
  },
  {
    key: 'addOnDropped',
    label: 'Add on dropped',
    hint: 'When they drop off or status is Dropped.',
  },
  {
    key: 'addOnInterview',
    label: 'Add on interview',
    hint: 'When they reach Interview on a job — keep strong people even before a reject.',
  },
  {
    key: 'addOnHired',
    label: 'Add on hired',
    hint: 'When they are hired or joined — alumni / future similar roles.',
  },
  {
    key: 'addOnCreate',
    label: 'Add on new candidate',
    hint: 'Every new candidate, even if industry/skill does not match. Leave off on named pools.',
  },
];

export const SORT_OPTIONS = [
  { value: 'name', label: 'Name A–Z' },
  { value: 'members', label: 'Most members' },
  { value: 'recent', label: 'Recently updated' },
];

export const POOLS_TOUR_STEPS = [
  {
    title: 'Talent Pools',
    body: 'Same person, many jobs. Rejected for Banking can still be selected for Finance — pools keep them warm without searching everyone.',
  },
  {
    target: '[data-tour="pools-tip"]',
    title: 'How it works',
    body: 'Tag a pool with industry or skill/product. Those lists load from your catalogs. On reject, matching pools (and Warm bench) fill automatically.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="pools-filters"]',
    title: 'Find pools',
    body: 'Search by name, industry, or description. Sort by name, size, or recent activity.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="pools-grid"]',
    title: 'Your pools',
    body: 'Open a pool to review members. Add people from suggestions — you do not have to hunt names. Delete removes the pool only.',
    placement: 'top',
  },
];
