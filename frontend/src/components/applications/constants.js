import {
  FileText, Calendar, CheckCircle2, Award, Target, User, Briefcase,
} from 'lucide-react';

export const APPS_TOUR_KEY = 'skillnix_tour_applications_v1';
export const PIPELINE_TOUR_KEY = 'skillnix_tour_pipeline_board_v2';

export const APPS_TOUR_STEPS = [
  {
    title: 'Applications',
    body: 'Browse pipeline entries in list view — search, filter by stage, and open a candidate for details.',
  },
  {
    target: '[data-tour="apps-tip"]',
    title: 'Quick tip',
    body: 'Use compact row actions for email / call. Press ? anytime to reopen this tour.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="apps-filters"]',
    title: 'Filters',
    body: 'Select a job, search candidates, filter by stage, and switch to board view if you prefer.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="apps-workspace"]',
    title: 'Workspace',
    body: 'Open a candidate to change stage, schedule interviews, or add notes — all in the side panel.',
    placement: 'top',
  },
];

export const PIPELINE_TOUR_STEPS = [
  {
    title: 'Pipeline Board',
    body: 'Live kanban of every active application. Drag cards to move stage — it saves immediately.',
  },
  {
    target: '[data-tour="apps-tip"]',
    title: 'Quick tip',
    body: 'The board loads all open jobs by default. Filter to one role when you need a focused view.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="apps-stage-summary"]',
    title: 'Stage summary',
    body: 'Counts for every pipeline stage. Click a card to focus that column; click again to show all.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="apps-filters"]',
    title: 'Filters',
    body: 'Search, filter by stage, or switch to list view. Columns follow your organization pipeline.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="apps-workspace"]',
    title: 'Board',
    body: 'Drop zones highlight when you drag. Click a card for schedule, notes, reject, and more.',
    placement: 'top',
  },
];

export const STAGES = [
  { id: 'Applied', label: 'Applied', color: 'bg-sky-50', borderColor: 'border-sky-200', textColor: 'text-sky-700', bar: 'bg-sky-500', icon: FileText },
  { id: 'Screening', label: 'Screening', color: 'bg-amber-50', borderColor: 'border-amber-200', textColor: 'text-amber-700', bar: 'bg-amber-500', icon: Target },
  { id: 'Interview', label: 'Interview', color: 'bg-violet-50', borderColor: 'border-violet-200', textColor: 'text-violet-700', bar: 'bg-violet-500', icon: Calendar },
  { id: 'Offer', label: 'Offer', color: 'bg-emerald-50', borderColor: 'border-emerald-200', textColor: 'text-emerald-700', bar: 'bg-emerald-500', icon: Award },
  { id: 'Hired', label: 'Hired', color: 'bg-teal-50', borderColor: 'border-teal-200', textColor: 'text-teal-700', bar: 'bg-teal-500', icon: CheckCircle2 },
];

export const STAGE_PALETTE = [
  { color: 'bg-sky-50', borderColor: 'border-sky-200', textColor: 'text-sky-700', bar: 'bg-sky-500', icon: FileText },
  { color: 'bg-amber-50', borderColor: 'border-amber-200', textColor: 'text-amber-700', bar: 'bg-amber-500', icon: Target },
  { color: 'bg-violet-50', borderColor: 'border-violet-200', textColor: 'text-violet-700', bar: 'bg-violet-500', icon: Calendar },
  { color: 'bg-emerald-50', borderColor: 'border-emerald-200', textColor: 'text-emerald-700', bar: 'bg-emerald-500', icon: Award },
  { color: 'bg-teal-50', borderColor: 'border-teal-200', textColor: 'text-teal-700', bar: 'bg-teal-500', icon: CheckCircle2 },
  { color: 'bg-orange-50', borderColor: 'border-orange-200', textColor: 'text-orange-700', bar: 'bg-orange-500', icon: Briefcase },
  { color: 'bg-rose-50', borderColor: 'border-rose-200', textColor: 'text-rose-700', bar: 'bg-rose-500', icon: User },
  { color: 'bg-indigo-50', borderColor: 'border-indigo-200', textColor: 'text-indigo-700', bar: 'bg-indigo-500', icon: Target },
];

export function stageVisual(name, index = 0) {
  const label = String(name || 'Applied').trim() || 'Applied';
  const known = STAGES.find((s) => s.id.toLowerCase() === label.toLowerCase());
  if (known) return { ...known, id: label, label };
  const pal = STAGE_PALETTE[index % STAGE_PALETTE.length];
  return { id: label, label, ...pal };
}

export function buildBoardStages(orgStages, jobStages, applicationStages = []) {
  const fromJob = (jobStages || []).map((s) => String(s).trim()).filter(Boolean);
  const fromOrg = (orgStages || []).map((s) => String(s).trim()).filter(Boolean);
  const base = fromJob.length ? fromJob : (fromOrg.length ? fromOrg : STAGES.map((s) => s.id));
  const seen = new Set(base.map((s) => s.toLowerCase()));
  // Keep Rejected on the board even if a job override omitted it
  if (!seen.has('rejected')) {
    base.push('Rejected');
    seen.add('rejected');
  }
  const extras = [...new Set(
    (applicationStages || [])
      .map((s) => String(s || '').trim())
      .filter((s) => s && !seen.has(s.toLowerCase()))
  )];
  return [...base, ...extras].map((name, i) => stageVisual(name, i));
}

export const STAGE_FILTER_OPTIONS = [
  { value: 'all', label: 'All stages' },
  ...STAGES.map((s) => ({ value: s.id, label: s.label, icon: s.icon })),
];

export function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor(Math.abs(now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
};

/** Normalize backend Application docs (candidateId/jobId populated) for UI */
export const normalizeApp = (raw) => {
  if (!raw) return null;
  const candidate = raw.candidate || raw.candidateId || {};
  const job = raw.job || raw.jobId || {};
  return {
    ...raw,
    candidate: typeof candidate === 'object' ? candidate : { _id: candidate },
    job: typeof job === 'object' ? job : { _id: job },
    stage: raw.stage || 'Applied',
    rating: raw.rating || 0,
    notes: raw.notes || '',
  };
};

export const jobTitle = (job) => job?.title || job?.role || 'Untitled role';

export const emptyAddForm = {
  jobId: '',
  candidateId: '',
  mode: 'existing',
  name: '',
  email: '',
  phone: '',
  source: 'Direct',
};

export const SOURCE_OPTIONS = [
  { value: 'Direct', label: 'Direct', icon: User },
  { value: 'Referral', label: 'Referral', icon: User },
  { value: 'LinkedIn', label: 'LinkedIn', icon: Briefcase },
  { value: 'Job Board', label: 'Job Board', icon: Briefcase },
  { value: 'Careers Page', label: 'Careers Page', icon: FileText },
  { value: 'Agency', label: 'Agency', icon: Briefcase },
];
