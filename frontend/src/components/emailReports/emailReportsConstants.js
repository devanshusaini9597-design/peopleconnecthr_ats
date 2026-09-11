/** Email Reports product tour + channel tabs */
export const EMAIL_REPORTS_TOUR_KEY = 'skillnix_tour_email_reports_v1';

export const EMAIL_REPORTS_TOUR_STEPS = [
  {
    title: 'Email Reports',
    body: 'Track every outbound email from your ATS — marketing campaigns in Zoho Campaigns and transactional mail via ZeptoMail — with opens, clicks, bounces, and replies.',
  },
  {
    target: '[data-tour="email-reports-tabs"]',
    title: 'Campaign vs Transactional',
    body: 'Switch between Marketing Campaigns and Transactional mail. Each view has its own KPIs and send history so teams can review the right channel.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="email-reports-kpis"]',
    title: 'Engagement KPIs',
    body: 'Sends, delivered, opened, clicked, bounced, replied, and failed — the same card style as Analytics, scoped to the tab you selected.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="email-reports-refresh"]',
    title: 'Refresh from Zoho',
    body: 'Pull latest campaign reports from Zoho Campaigns and sync delivery/open/click status from ZeptoMail for recent sends.',
    placement: 'left',
  },
  {
    target: '[data-tour="email-reports-table"]',
    title: 'Send history',
    body: 'Open any row for per-recipient detail: who opened, clicked, bounced, or replied, plus provider IDs for audit.',
    placement: 'top',
  },
];

export const CHANNEL_TABS = [
  {
    id: 'marketing',
    label: 'Marketing campaigns',
    short: 'Campaigns',
    provider: 'Zoho Campaigns',
    blurb: 'Bulk / nurture sends — opens, clicks, bounces, unsubscribes from Zoho Campaigns.',
  },
  {
    id: 'transactional',
    label: 'Transactional',
    short: 'Transactional',
    provider: 'ZeptoMail',
    blurb: 'Candidate emails, OTP, invites, and alerts — delivery and engagement from ZeptoMail.',
  },
  {
    id: 'all',
    label: 'All mail',
    short: 'All',
    provider: 'All providers',
    blurb: 'Combined ledger across marketing, transactional, and system mail.',
  },
];
