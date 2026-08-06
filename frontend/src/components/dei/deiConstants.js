export const DEI_TOUR_KEY = 'skillnix_tour_dei_v1';

export const DEI_TOUR_STEPS = [
  {
    title: 'DEI & fair hiring',
    body: 'Configure blind screening and review aggregate self-ID analytics — never shown on individual candidate cards.',
  },
  {
    target: '[data-tour="dei-toolbar"]',
    title: 'Views',
    body: 'Switch between All, Controls, and Funnel analytics to focus the page.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="dei-kpis"]',
    title: 'Pipeline snapshot',
    body: 'See disclosure rates and how many fair-hiring controls are enabled.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="dei-controls"]',
    title: 'Controls',
    body: 'Toggle blind screening and related settings for your org.',
    placement: 'right',
  },
  {
    target: '[data-tour="dei-funnel"]',
    title: 'Funnel analytics',
    body: 'Stage-level gender/ethnicity aggregates from voluntary self-ID — export CSV when you need a report.',
    placement: 'left',
  },
];

export const SECTIONS = [
  { key: 'all', label: 'All' },
  { key: 'controls', label: 'Controls' },
  { key: 'funnel', label: 'Funnel analytics' }
];

export const BAR_COLORS = [
  'from-brand-500 to-teal-600',
  'from-sky-500 to-cyan-500',
  'from-violet-500 to-fuchsia-500',
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-lime-500',
  'from-rose-400 to-pink-500'
];
