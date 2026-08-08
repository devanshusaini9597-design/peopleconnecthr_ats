export const REPORTS_TOUR_KEY = 'skillnix_tour_reports_v1';

export const REPORTS_TOUR_STEPS = [
  {
    title: 'Reports Studio',
    body: 'Pipeline, source quality, time-to-hire, and job performance — with CSV export when you need to share.',
  },
  {
    target: '[data-tour="reports-toolbar"]',
    title: 'Report views',
    body: 'Focus on All reports, Pipeline, Sources, or Job performance.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="reports-kpis"]',
    title: 'Headline metrics',
    body: 'Time-to-hire, pipeline volume, source volume, and jobs reported at a glance.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="reports-charts"]',
    title: 'Breakdowns',
    body: 'Hiring pipeline and source quality charts — export each section as CSV.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="reports-jobs"]',
    title: 'Job performance',
    body: 'Search roles and compare applications, hires, and conversion rates.',
    placement: 'top',
  },
];

export const SECTIONS = [
  { key: 'all', label: 'All reports' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'sources', label: 'Sources' },
  { key: 'jobs', label: 'Job performance' }
];

export const PIPELINE_BAR = [
  'bg-sky-500',
  'bg-amber-500',
  'bg-brand-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-teal-600',
  'bg-rose-400',
  'bg-stone-400'
];

export const SOURCE_BAR = [
  'bg-brand-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-fuchsia-500'
];
