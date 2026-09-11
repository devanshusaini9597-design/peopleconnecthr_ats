export const PAGE_SIZE = 40;
export const TOUR_KEY = 'skillnix_tour_pending_review_v1';

export const STATUS_OPTIONS = [
  'Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Joined',
  'Rejected', 'Dropped', 'Hold', 'Interested', 'Interested and scheduled',
];

export const TOUR_STEPS = [
  {
    title: 'Pending Review',
    body: 'Enterprise staging queue: flagged Bulk Import rows stay here until a human approves them into Candidates.',
  },
  {
    target: '[data-tour="pr-workflow"]',
    title: 'Controlled release',
    body: 'Review → Fix → Approve. Nothing enters the ATS until you import selected, ready rows.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="pr-kpis"]',
    title: 'Queue health',
    body: 'Needs review vs Blocked counts. Fix issues, select rows, then import only what you approve.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="pr-toolbar"]',
    title: 'Filter & act',
    body: 'Bucket by status, search the queue, select ready rows, then import or delete in batch.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="pr-table"]',
    title: 'Work queue',
    body: 'Same table language as Candidates — select, edit, import, or delete. Nothing auto-writes to ATS.',
    placement: 'top',
  },
];
