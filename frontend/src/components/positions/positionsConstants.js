export const POSITIONS_TOUR_KEY = 'skillnix_tour_positions_v1';

export const POSITIONS_TOUR_STEPS = [
  {
    title: 'Positions catalog',
    body: 'This is the shared job-role list for your company. Add a position here, on Add Candidate, or on a job — it stays in sync.',
  },
  {
    target: '[data-tour="positions-toolbar"]',
    title: 'Search the full list',
    body: 'Type to find a role. Large catalogs stay fast because only one page loads at a time.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="positions-compose"]',
    title: 'Add a position',
    body: 'New roles appear immediately in candidate and job dropdowns.',
    placement: 'right',
  },
  {
    target: '[data-tour="positions-catalog"]',
    title: 'Browse & edit',
    body: 'Rename or remove roles. Load starter set if the list is empty.',
    placement: 'left',
  },
];

export const PAGE_SIZE_OPTIONS = [
  { value: '25', label: '25', description: 'Compact list' },
  { value: '50', label: '50', description: 'Default page size' },
  { value: '100', label: '100', description: 'Larger page' },
];
