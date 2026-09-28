export const MIS_TOUR_KEY = 'skillnix_tour_mis_v1';

export const MIS_TOUR_STEPS = [
  {
    title: 'MIS directory',
    body: 'Company marketing contacts, kept separate from Candidates. Only authorised company staff can open this page.',
  },
  {
    target: '[data-tour="mis-actions"]',
    title: 'Add, import, and export',
    body: 'Add a single contact or import Excel and CSV files. Each row needs Name and Email. Duplicate emails are skipped. Company owners can export the directory.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="mis-tip"]',
    title: 'Workspace guide',
    body: 'Select rows for email, WhatsApp, consent, or bulk edit. Press ? or the help control to reopen this tour.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="mis-search"]',
    title: 'Search and filters',
    body: 'Search by name, email, company, or phone. Open Filters to refine by position, location, product, and marketing consent.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="mis-bulk"]',
    title: 'Bulk actions',
    body: 'When contacts are selected, email, message, update consent, or delete them together. Company owners can move selected contacts into Candidates.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="mis-table"]',
    title: 'Contact table',
    body: 'Select rows with the checkboxes. Drag left or right on the table to see additional columns.',
    placement: 'top',
  },
];
