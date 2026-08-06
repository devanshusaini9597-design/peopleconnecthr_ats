export const JOBS_TOUR_KEY = 'skillnix_tour_jobs_v1';
export const JOBS_TOUR_STEPS = [
  {
    title: 'Job openings',
    body: 'Create roles, filter by status, and reuse JD templates — without leaving this page.',
  },
  {
    target: '[data-tour="jobs-tip"]',
    title: 'Quick tip',
    body: 'Use JD Library for templates, then Post New Job. Press ? anytime to reopen this tour.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="jobs-actions"]',
    title: 'Create & templates',
    body: 'Open the JD Library or post a new requisition from here.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="jobs-filters"]',
    title: 'Search & filters',
    body: 'Search by role, location, or skills, and filter by Open, On Hold, or Closed.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="jobs-list"]',
    title: 'Job cards',
    body: 'Use the compact edit, share, and delete actions on each card. Status lives in the overflow menu.',
    placement: 'top',
  },
];

export const STATUS_OPTIONS = [
  { value: 'Open', label: 'Open' },
  { value: 'On Hold', label: 'On Hold' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Draft', label: 'Draft' },
];

export const FILTER_OPTIONS = [
  { value: 'All', label: 'All statuses' },
  { value: 'Open', label: 'Open' },
  { value: 'On Hold', label: 'On Hold' },
  { value: 'Closed', label: 'Closed' },
];

export const JOB_BOARD_OPTIONS = [
  { value: 'indeed_feed', label: 'Indeed feed', description: 'XML / feed sync' },
  { value: 'webhook', label: 'Webhook', description: 'POST to configured endpoint' },
];

export const STATUS_STYLES = {
  Open: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'On Hold': 'bg-amber-50 text-amber-700 border-amber-200',
  Closed: 'bg-stone-100 text-stone-600 border-stone-200',
  Draft: 'bg-sky-50 text-sky-700 border-sky-200',
  Cancelled: 'bg-red-50 text-red-700 border-red-200',
};
export const DOT_STYLES = {
  Open: 'bg-emerald-500',
  'On Hold': 'bg-amber-500',
  Closed: 'bg-stone-400',
  Draft: 'bg-sky-500',
  Cancelled: 'bg-red-500',
};

export const FALLBACK_MANAGERS = [
  { email: 'hr@company.com', name: 'HR' },
  { email: 'tech.lead@company.com', name: 'Tech Lead' },
  { email: 'cto@company.com', name: 'CTO' },
  { email: 'product.mgr@company.com', name: 'Product Manager' },
];

export const initialForm = {
  role: '',
  location: '',
  ctc: '',
  experience: '',
  skills: [],
  description: '',
  hiringManagers: [],
  status: 'Open',
};
