/** Product tours for freelance company desk + freelancer workspace pages */

export const FREELANCE_REVIEW_TOUR_KEY = 'skillnix_tour_freelance_review_v1';

export const FREELANCE_REVIEW_TOUR_STEPS = [
  {
    title: 'Freelance Desk Review',
    body: 'Review candidates submitted by external recruiters. Update stages, leave notes, transfer ownership, and archive submissions from one workspace.',
  },
  {
    target: '[data-tour="freelance-live-desks"]',
    title: 'Recruiter presence',
    body: 'See which freelance recruiters are live, away, or offline. Select a recruiter to scope the queue to their desk.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="freelance-review-stage-summary"]',
    title: 'Pipeline overview',
    body: 'Stage volumes across the hiring pipeline. Selecting a stage scopes the boards below.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="freelance-review-filters"]',
    title: 'Queue filters',
    body: 'Refine the queue by search, stage, recruiter, or mandate.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="freelance-review-boards"]',
    title: 'Submission boards',
    body: 'Open notes, scorecards, and audit history from each board. Stage scorecards capture structured ratings per stage.',
    placement: 'top',
  },
];

export const FREELANCER_PIPELINE_TOUR_KEY = 'skillnix_tour_freelancer_pipeline_v1';

export const FREELANCER_PIPELINE_TOUR_STEPS = [
  {
    title: 'My Pipeline',
    body: 'Follow candidates you submitted against open mandates. Progress mirrors the company’s hiring pipeline.',
  },
  {
    target: '[data-tour="freelancer-pipeline-tip"]',
    title: 'Company-managed stages',
    body: 'Stage changes are made by the hiring team. Open the info icon on a board to read company notes.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="freelancer-stage-summary"]',
    title: 'Pipeline overview',
    body: 'Stage volumes for your submissions. Selecting a stage focuses the boards below.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="freelancer-pipeline-filters"]',
    title: 'Find candidates',
    body: 'Search by name or narrow by mandate, hiring manager, and recency.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="freelancer-pipeline-boards"]',
    title: 'Candidate boards',
    body: 'Each submission has its own board with company stages, mandate context, and reviewer notes.',
    placement: 'top',
  },
];

export const MANDATES_TOUR_KEY = 'skillnix_tour_mandates_v1';

export const MANDATES_TOUR_STEPS = [
  {
    title: 'Open Mandates',
    body: 'Review active requisitions assigned to you. Submit candidates to the hiring manager specified on each mandate.',
  },
  {
    target: '[data-tour="mandates-tip"]',
    title: 'How submissions work',
    body: 'Create a candidate under Candidates, open a mandate, then submit. Company reviewers process the submission in Freelance Desk Review.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="mandates-workbench"]',
    title: 'Requisition workbench',
    body: 'Search and filter mandates, then open a role to view details and submit candidates.',
    placement: 'bottom',
  },
];
