export const CAND_TOUR_KEY = 'skillnix_tour_candidates_v2';
export const CAND_TOUR_STEPS = [
  {
    title: 'Candidates workspace',
    body: 'Your hiring database — import, search, edit, and message candidates without leaving this page.',
  },
  {
    target: '[data-tour="cand-actions"]',
    title: 'Import & add',
    body: 'Import Excel with review (Professional+), find duplicates, or add one candidate. Spreadsheet rows are validated before they enter your database.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="cand-tip"]',
    title: 'Quick tip',
    body: 'Press ? anytime to reopen this tour. Select rows to open the bulk action bar.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="cand-search"]',
    title: 'Search, filters & import',
    body: 'Search the list, open Filters, Export selected, or Import Excel for a review-before-add workflow.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="cand-bulk"]',
    title: 'Bulk actions',
    body: 'Email, WhatsApp, change status, share with teammates, or delete — all on the selected set.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="cand-table"]',
    title: 'Candidate table',
    body: 'Check rows to select. Drag left/right on cells (not the scrollbar) to see more columns.',
    placement: 'top',
  },
];

export const BULK_STATUS_OPTIONS = [
  'Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Joined', 'Rejected', 'Dropped',
];

export const EMAIL_TYPE_OPTIONS = [
  { value: 'interview', label: 'Interview Invitation' },
  { value: 'rejection', label: 'Rejection Letter' },
  { value: 'document', label: 'Document Request' },
  { value: 'onboarding', label: 'Onboarding Welcome' },
  { value: 'custom', label: 'Custom Message' },
];

export const REVIEW_STATUS_OPTIONS = [
  'Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected', 'Interested', 'Interested and scheduled',
].map((s) => ({ value: s, label: s }));

export const TIME_SELECT_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return { value: `${String(h).padStart(2, '0')}:${m}`, label: `${h12}:${m} ${ampm}` };
});

export const PAGE_SIZE = 50;

export const EMPTY_ADVANCED_FILTERS = {
  position: '', companyName: '', location: '',
  expMin: '', expMax: '', ctcMin: '', ctcMax: '',
  expectedCtcMin: '', expectedCtcMax: '', date: '',
};

export const INITIAL_FORM_STATE = {
  srNo: '', date: new Date().toISOString().split('T')[0], location: '', position: '',
  fls: '', name: '', contact: '', email: '', companyName: '', experience: '',
  ctc: '', expectedCtc: '', noticePeriod: '', status: 'Applied', client: '',
  spoc: '', source: '', resume: null, callBackDate: '', remark: '', customFields: {},
  legalhold: false
};
