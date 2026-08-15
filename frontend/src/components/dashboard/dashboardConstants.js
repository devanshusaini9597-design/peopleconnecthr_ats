export const FREELANCER_DASH_TOUR_KEY = 'skillnix_tour_freelancer_dashboard_v1';

export const FREELANCER_DASH_TOUR_STEPS = [
  {
    title: 'Your freelance desk',
    body: 'This home is yours only — your candidates, open mandates, and a private pipeline the company cannot see. SPOC updates statuses; you view them.',
  },
  {
    target: '[data-tour="dash-kpis"]',
    title: 'Your numbers',
    body: 'Candidates on your desk, people added this month, open mandates you can submit against, and handoffs waiting on the SPOC.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="dash-mandates"]',
    title: 'Open mandates',
    body: 'Company requisitions refresh automatically. Submit from your desk; SPOC is locked to who posted the job.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="dash-actions"]',
    title: 'Quick actions',
    body: 'Add to your desk, open candidates, submit to a mandate, or open your private pipeline board.',
    placement: 'left',
  },
  {
    target: '[data-tour="dash-submissions"]',
    title: 'Submissions',
    body: 'Track what you sent the company — awaiting review, shortlisted, or sent back. Full board is under My Pipeline.',
    placement: 'top',
  },
];

export const DASH_TOUR_KEY = 'skillnix_tour_dashboard_v1';

export const DASH_TOUR_STEPS = [
  {
    title: 'Your hiring command center',
    body: 'This dashboard summarizes pipeline health — KPIs, recent candidates, and shortcuts to everyday recruiting work.',
  },
  {
    target: '[data-tour="dash-kpis"]',
    title: 'Key metrics',
    body: 'Track candidates, monthly adds, pending reviews (Applied + Screening → Applications), and hires. Click any card to jump into that list.',
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
  const map = {
    Applied: 'badge-info',
    Screening: 'badge-warning',
    Interview: 'badge-brand',
    Offer: 'badge-ats bg-violet-100 text-violet-700',
    Hired: 'badge-success',
    Joined: 'badge-success',
    Rejected: 'badge-danger',
    Dropped: 'badge-neutral',
  };
  return map[status] || 'badge-neutral';
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
