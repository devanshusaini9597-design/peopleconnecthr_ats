export const DRAFT_KEY = 'skillnix_bulk_import_v3';
export const PAGE_SIZE = 40;
export const TOUR_KEY = 'skillnix_tour_bulk_import_v3';
export const MAX_BYTES = 50 * 1024 * 1024;

export const STEPS = [
  { id: 'prepare', label: 'Prepare' },
  { id: 'upload', label: 'Upload' },
  { id: 'map', label: 'Map columns' },
  { id: 'review', label: 'Review & select' },
  { id: 'done', label: 'Complete' },
];

export const TEMPLATE_HEADERS = [
  'name', 'email', 'contact', 'position', 'companyName', 'location',
  'ctc', 'expectedCtc', 'experience', 'noticePeriod', 'status',
  'source', 'client', 'spoc', 'remark', 'date',
];

export const TEMPLATE_SAMPLE = [
  ['Riya Sharma', 'riya.sharma@example.com', '9876543210', 'Software Engineer', 'Acme Corp', 'Bengaluru',
    '8-10', '12-15', '3', '30', 'Applied', 'LinkedIn', 'Acme', 'Priya', '', '2026-08-01'],
  ['Aman Verma', 'aman.verma@example.com', '9123456780', 'Product Manager', 'Nova Labs', 'Pune',
    '15-20', '20-25', '5', '60', 'Screening', 'Referral', 'Nova', 'Dev', 'Strong hire', '2026-08-02'],
];

export const STATUS_OPTIONS = [
  'Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Joined',
  'Rejected', 'Dropped', 'Hold', 'Interested', 'Interested and scheduled',
];

export const TOUR_STEPS = [
  { title: 'Enterprise Bulk Import', body: 'A controlled intake: prepare template → upload → map columns → select valid rows → import only what you approve.' },
  { target: '[data-tour="bi-steps"]', title: 'Wizard steps', body: 'Follow Prepare → Upload → Map columns → Review & select → Complete. Nothing is saved until the last confirm.', placement: 'bottom' },
  { target: '[data-tour="bi-main"]', title: 'Work area', body: 'Download a template, upload your file, map Excel headers to fields, then tick rows to import.', placement: 'top' },
];

export const rowKey = (row) => {
  const raw = row._category || row.validation?.category || 'ready';
  const cat = raw === 'blocked' ? 'blocked' : raw === 'review' ? 'review' : 'ready';
  return `${cat}-${row.rowIndex}`;
};
