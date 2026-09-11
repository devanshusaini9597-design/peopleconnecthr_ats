export const FREELANCER_DASH_TOUR_KEY = 'skillnix_tour_freelancer_dashboard_v1';

export const FREELANCER_DASH_TOUR_STEPS = [
  {
    title: 'Your freelance workspace',
    body: 'This dashboard shows only your candidates, submissions, and performance. Private profiles stay hidden until you submit.',
  },
  {
    target: '[data-tour="freelancer-dash-tip"]',
    title: 'How your desk works',
    body: 'Add candidates in ATS, submit against open mandates, then track status and reviewer notes on My Pipeline.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="dash-kpis"]',
    title: 'Key metrics',
    body: 'Same card layout as the company dashboard: all desk candidates, new this month, then live submission stages (Submitted → Joined), plus shortlist rate and awaiting review.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="dash-chart"]',
    title: 'Activity',
    body: 'Last 7 days of candidates added and submissions sent. Open Analytics for the full report.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="dash-actions"]',
    title: 'Quick actions',
    body: 'Add candidates, open mandates, check the pipeline board, or jump to analytics.',
    placement: 'left',
  },
  {
    target: '[data-tour="dash-pipeline"]',
    title: 'Submission pipeline',
    body: 'Submission status with the hiring manager: submitted, in review, shortlisted, or returned.',
    placement: 'top',
  },
];

export const DASH_TOUR_KEY = 'skillnix_tour_dashboard_v1';

export const DASH_TOUR_STEPS = [
  {
    title: 'Your hiring overview',
    body: 'This dashboard summarizes pipeline health — KPIs, recent candidates, and shortcuts to everyday recruiting work.',
  },
  {
    target: '[data-tour="dash-kpis"]',
    title: 'Key metrics',
    body: 'All candidates is your full inventory. New this month is everyone added in the period (any stage). Stage cards show only who is currently in that stage.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="dash-recent"]',
    title: 'Recent candidates',
    body: 'Latest people added to your ATS. Open one to search or continue screening.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="dash-actions"]',
    title: 'Quick actions',
    body: 'Jump straight to add candidate, pipeline board, resume parsing, templates, or analytics.',
    placement: 'left',
  },
  {
    target: '[data-tour="dash-pipeline"]',
    title: 'Hiring pipeline',
    body: 'See how many candidates sit in each stage. Click a stage to open the matching board or list.',
    placement: 'top',
  },
];

export const statusColor = (status) => {
  const key = String(status || '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  const title = key
    ? key.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
    : '';
  const map = {
    Applied: 'badge-info',
    Screening: 'badge-warning',
    Interview: 'badge-brand',
    Offer: 'badge-ats bg-violet-100 text-violet-700',
    Hired: 'badge-success',
    Joined: 'badge-success',
    Rejected: 'badge-danger',
    Dropped: 'badge-neutral',
    Interested: 'badge-info',
  };
  return map[title] || 'badge-neutral';
};

export const displayStatus = (status) => {
  const raw = String(status || '').trim();
  if (!raw) return '—';
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export const pipelineColors = {
  Applied: 'bg-sky-500',
  Screening: 'bg-amber-500',
  Interview: 'bg-brand-500',
  Offer: 'bg-violet-500',
  Hired: 'bg-emerald-500',
  Joined: 'bg-teal-600',
  Rejected: 'bg-red-400',
  Dropped: 'bg-stone-400',
  Interested: 'bg-sky-400',
};

export const stageRoutes = {
  Applied: '/applications',
  Screening: '/applications',
  Interview: '/applications',
  Offer: '/applications',
  Hired: '/applications',
  Joined: '/applications',
  Rejected: '/ats',
  Dropped: '/ats',
};

export const formatTimeAgo = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};
