export const CAND_TOUR_KEY = 'skillnix_tour_candidates_v2';
export const CANDIDATE_EXPORT_ROLES = ['owner', 'admin', 'hr_manager'];
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
    body: 'Email, WhatsApp, bulk edit fields, change status, share with teammates, or delete — all on the selected set.',
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
  'APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'JOINED',
  'REJECTED', 'DROPPED', 'INTERESTED', 'INTERESTED AND SCHEDULED',
];

export const EMAIL_TYPE_OPTIONS = [
  { value: 'interview', label: 'Interview Invitation' },
  { value: 'rejection', label: 'Rejection Letter' },
  { value: 'document', label: 'Document Request' },
  { value: 'onboarding', label: 'Onboarding Welcome' },
  { value: 'custom', label: 'Custom Message' },
];

export const REVIEW_STATUS_OPTIONS = [
  'APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'INTERESTED', 'INTERESTED AND SCHEDULED',
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
  skills: '', product: '', spoc: '', client: '',
  expMin: '', expMax: '', ctcMin: '', ctcMax: '',
  expectedCtcMin: '', expectedCtcMax: '', date: '',
};

/** Quick search scopes for the candidates toolbar */
export const CANDIDATE_SEARCH_SCOPES = [
  { value: 'all', label: 'All fields' },
  { value: 'name', label: 'Name' },
  { value: 'email', label: 'Email' },
  { value: 'position', label: 'Position' },
  { value: 'skills', label: 'Skill' },
  { value: 'product', label: 'Product / Skill' },
  { value: 'spoc', label: 'SPOC' },
  { value: 'location', label: 'Location' },
  { value: 'company', label: 'Company' },
  { value: 'client', label: 'Client' },
];

/** Local calendar date YYYY-MM-DD (not UTC — avoids off-by-one in IST). */
export function todayLocalISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Fresh blank candidate form — call this each time Add Candidate opens. */
export function getInitialFormState() {
  return {
    srNo: '',
    date: todayLocalISO(),
    location: '',
    position: '',
    fls: '',
    name: '',
    contact: '',
    email: '',
    companyName: '',
    experience: '',
    ctc: '',
    expectedCtc: '',
    noticePeriod: '',
    status: 'APPLIED',
    client: '',
    spoc: '',
    source: '',
    resume: null,
    callBackDate: '',
    remark: '',
    customFields: {},
    product: '',
    pan: '',
    legalhold: false,
  };
}

export function blankCandidateForm(role) {
  const next = getInitialFormState();
  if (role === 'freelancer') next.source = 'Freelance';
  return next;
}

/** @deprecated Prefer getInitialFormState() so date is always “today”. */
export const INITIAL_FORM_STATE = getInitialFormState();
