import { Type, Code2, ListChecks, Shield } from 'lucide-react';

export const emptyQuestion = () => ({ type: 'text', prompt: '', options: ['', ''], correctOptionIndex: 0, points: 10, language: '' });

export const ASSESS_TOUR_KEY = 'skillnix_tour_assessments_v1';
export const ASSESS_TOUR_STEPS = [
  {
    title: 'Assessments',
    body: 'Build skills tests, invite candidates, and grade submissions — all from one place.',
  },
  {
    target: '[data-tour="assess-tip"]',
    title: 'How it works',
    body: 'Create an assessment, open it to invite candidates, then review and grade submissions when they come in.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="assess-filters"]',
    title: 'Find assessments',
    body: 'Search by title or description and sort by name, question count, or duration.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="assess-grid"]',
    title: 'Open & manage',
    body: 'Click a card to manage invites. Use the delete control on each card to remove an assessment.',
    placement: 'top',
  },
];

export const QUESTION_TYPE_OPTIONS = [
  { value: 'text', label: 'Free text', description: 'Open written answer', icon: Type },
  { value: 'code', label: 'Code', description: 'Code snippet answer', icon: Code2 },
  { value: 'multiple_choice', label: 'Multiple choice', description: 'Pick one correct option', icon: ListChecks },
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
  expired: 'badge-danger'
};

export const actionBtn = 'h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white transition-colors';
