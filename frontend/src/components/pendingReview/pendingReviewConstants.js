export const PAGE_SIZE = 40;
export const TOUR_KEY = 'skillnix_tour_pending_review_v1';

export const STATUS_OPTIONS = [
  'Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Joined',
  'Rejected', 'Dropped', 'Hold', 'Interested', 'Interested and scheduled',
];

export const TOUR_STEPS = [
  {
    title: 'Pending Review',
    body: 'Rows parked from Bulk Import that need a human fix before they enter Candidates.',
  },
  {
    target: '[data-tour="pr-kpis"]',
    title: 'Queue health',
    body: 'Needs review vs Blocked counts. Fix issues, select rows, then import only what you approve.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="pr-table"]',
    title: 'Work queue',
    body: 'Same table language as Candidates — select, edit, import, or delete. Nothing auto-writes to ATS.',
    placement: 'top',
  },
];
