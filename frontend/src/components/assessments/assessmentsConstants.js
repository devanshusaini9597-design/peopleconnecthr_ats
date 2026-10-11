import { Type, Code2, ListChecks, Shield } from 'lucide-react';

export const emptyQuestion = () => ({
  type: 'text',
  prompt: '',
  options: ['', ''],
  correctOptionIndex: 0,
  points: 10,
  language: '',
  required: true,
  skillTag: '',
  section: '',
  rubric: '',
  hiddenTests: [{ name: '', input: '', expected: '' }],
  visibleTests: [{ name: 'Sample', input: '', expected: '' }],
});

export const ASSESS_TOUR_KEY = 'skillnix_tour_assessments_v2';
export const ASSESS_TOUR_STEPS = [
  {
    title: 'Assessments',
    body: 'Create assessments, invite candidates, and evaluate submissions from this workspace.',
  },
  {
    target: '[data-tour="assess-tip"]',
    title: 'Invitations',
    body: 'Inviting a candidate does not lock the assessment. Candidates who have already started retain the version they received.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="assess-filters"]',
    title: 'Workspace views',
    body: 'Switch between assessments, the evaluation queue, the question library, and policies. Search and sort the list as needed.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="assess-grid"]',
    title: 'Manage assessments',
    body: 'Open an assessment to send invitations and review results. Duplicate, edit, or delete from the card or table.',
    placement: 'top',
  },
];

export const QUESTION_TYPE_OPTIONS = [
  { value: 'multiple_choice', label: 'Multiple choice', description: 'Auto-scored aptitude or technical MCQ', icon: ListChecks },
  { value: 'text', label: 'Written', description: 'Descriptive answer, manual review', icon: Type },
  { value: 'code', label: 'Coding', description: 'Code answer reviewed against a rubric', icon: Code2 },
  { value: 'communication', label: 'Communication', description: 'Role-specific written response', icon: Type },
];

export const STRICTNESS_OPTIONS = [
  { value: 'standard', label: 'Standard', description: 'Balanced sensitivity', icon: Shield },
  { value: 'strict', label: 'Strict', description: 'Flag more aggressively', icon: Shield },
  { value: 'off', label: 'Record only', description: 'No auto-flagging', icon: Shield },
];

export const SORT_OPTIONS = [
  { value: 'title', label: 'Title A–Z' },
  { value: 'questions', label: 'Most questions' },
  { value: 'duration', label: 'Longest duration' },
];

export const STATUS_BADGE = {
  pending: 'badge-neutral',
  in_progress: 'badge-brand',
  submitted: 'badge-warning',
  graded: 'badge-success',
  expired: 'badge-danger',
  revoked: 'badge-danger',
  draft: 'badge-neutral',
  published: 'badge-success',
  archived: 'badge-warning',
};

export const defaultRules = (initial) => ({
  passingScorePercent: initial?.rules?.passingScorePercent ?? 0,
  negativeMarkPercent: initial?.rules?.negativeMarkPercent ?? 0,
  maxAttempts: initial?.rules?.maxAttempts ?? 1,
  randomizeQuestions: !!initial?.rules?.randomizeQuestions,
  allowBack: initial?.rules?.allowBack !== false,
  requireAll: initial?.rules?.requireAll !== false,
  resultVisibility: initial?.rules?.resultVisibility || 'hidden',
  autoSubmit: initial?.rules?.autoSubmit !== false,
});

export const actionBtn = 'h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white transition-colors';
