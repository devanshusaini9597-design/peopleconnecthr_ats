export const PAGE_SIZE = 40;
export const TOUR_KEY = 'skillnix_tour_pending_review_workbench_v3';

export const REQUIRED_RELEASE_FIELDS = [
  { key: 'name', label: 'Full name' },
  { key: 'email', label: 'Email' },
  { key: 'contact', label: 'Mobile' },
  { key: 'companyName', label: 'Company' },
  { key: 'ctc', label: 'Current CTC' },
];

export const WORKBENCH_TOUR_STEPS = [
  {
    title: 'Pending Review workbench',
    body: 'Operator staging for Bulk Import. Inspect each row, fix gaps, then release into Candidates.',
  },
  {
    target: '[data-tour="wb-filters"]',
    title: 'Search & stage filters',
    body: 'Same filter card pattern as Applications — search, stage, then batch release or discard.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="wb-queue"]',
    title: 'Staging queue',
    body: 'Select rows for batch actions, or open one to decide in the panel.',
    placement: 'right',
  },
  {
    target: '[data-tour="wb-inspector"]',
    title: 'Decision panel',
    body: 'Release checklist, issues, and field snapshot — then Fix, Release, or Discard.',
    placement: 'left',
  },
];
