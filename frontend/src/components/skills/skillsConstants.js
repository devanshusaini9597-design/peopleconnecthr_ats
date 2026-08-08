export const SKILLS_TOUR_KEY = 'skillnix_tour_skills_v1';

export const SKILLS_TOUR_STEPS = [
  {
    title: 'Skills taxonomy',
    body: 'Maintain a structured skill catalog for candidate–job matching — system skills plus your custom org skills.',
  },
  {
    target: '[data-tour="skills-toolbar"]',
    title: 'Search & filters',
    body: 'Search by name, filter System vs Custom, pick a category, and change page size for large catalogs.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="skills-compose"]',
    title: 'Add custom skills',
    body: 'Create org-specific skills with a category. System skills stay locked; custom ones can be edited or removed.',
    placement: 'right',
  },
  {
    target: '[data-tour="skills-catalog"]',
    title: 'Skills catalog',
    body: 'Browse skills by category. Use Import catalog for the starter set, then paginate through large lists.',
    placement: 'left',
  },
];

export const SOURCE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'system', label: 'System' },
  { key: 'custom', label: 'Custom' }
];

export const PAGE_SIZE_OPTIONS = [
  { value: '25', label: '25', description: 'Compact list' },
  { value: '50', label: '50', description: 'Default page size' },
  { value: '100', label: '100', description: 'Larger page' }
];
