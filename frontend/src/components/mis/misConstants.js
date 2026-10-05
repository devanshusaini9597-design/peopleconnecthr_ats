export const MIS_TOUR_KEY = 'skillnix_tour_mis_v2';

export const MIS_TOUR_STEPS = [
  {
    title: 'MIS directory',
    body: 'Marketing and outreach contacts, kept separate from Candidates. Only authorised company staff can open this workspace.',
  },
  {
    target: '[data-tour="mis-tip"]',
    title: 'Overview cards',
    body: 'Live counts for desks you can access. Select a card to switch the directory view below.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="mis-desk-tabs"]',
    title: 'Desk switcher',
    body: 'All (owner/admin), My records, or Organisation. Desks sit with the table so results update in place.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="mis-actions"]',
    title: 'Add, import, and export',
    body: 'Add a contact or import Excel and CSV. Each row needs Name and Email. Duplicate emails are skipped. Owners can export the directory.',
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
    body: 'When contacts are selected, email, message, update consent, delete, or move them into Candidates together.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="mis-table"]',
    title: 'Contact table',
    body: 'Select rows with the checkboxes. Drag left or right on the table to see additional columns.',
    placement: 'top',
  },
];
