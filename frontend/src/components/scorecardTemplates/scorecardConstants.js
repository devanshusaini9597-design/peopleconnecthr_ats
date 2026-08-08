export const SC_TOUR_KEY = 'skillnix_tour_scorecard_templates_v1';

export const SC_TOUR_STEPS = [
  {
    title: 'Scorecard Templates',
    body: 'Build reusable weighted interview criteria so hiring managers score candidates consistently.',
  },
  {
    target: '[data-tour="sc-catalog"]',
    title: 'Template library',
    body: 'Browse your scorecards — each card shows criteria and weights. Edit or delete from here.',
    placement: 'top',
  },
  {
    target: '[data-tour="sc-create"]',
    title: 'Create a template',
    body: 'Add a name, optional description, and weighted criteria hiring managers will score in interviews.',
    placement: 'bottom',
  },
];

export const WEIGHT_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((w) => ({
  value: String(w),
  label: `×${w}`,
  description: w === 1 ? 'Standard weight' : w < 1 ? 'Lower weight' : 'Higher weight',
}));

export const emptyCriterion = () => ({
  name: '',
  weight: 1,
  description: '',
  suggestedQuestions: []
});

export const emptyForm = () => ({
  name: '',
  description: '',
  criteria: [{ name: 'Technical skills', weight: 2, description: '', suggestedQuestions: [] }]
});
