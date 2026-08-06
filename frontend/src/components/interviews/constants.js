import {
  Video, Phone, User, MapPin, Briefcase, Users,
} from 'lucide-react';

export const INTERVIEWS_TOUR_KEY = 'skillnix_tour_interviews_v1';
export const INTERVIEWS_TOUR_STEPS = [
  {
    title: 'Interviews',
    body: 'Schedule interviews, join meetings, mark complete, and submit scorecards — all from one place.',
  },
  {
    target: '[data-tour="iv-tip"]',
    title: 'Quick tip',
    body: 'Use compact row actions for Join, Complete, Cancel, Scorecard, and AI transcript. Press ? to reopen this tour.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="iv-filters"]',
    title: 'Find interviews',
    body: 'Filter by Upcoming, Completed, Cancelled, All, or By date. Search by candidate or role.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="iv-results"]',
    title: 'Results',
    body: 'Cards for day-to-day work; All view uses a full data table. Schedule opens a Manage-style modal.',
    placement: 'top',
  },
];

export const TYPE_OPTIONS = [
  { value: 'video', label: 'Video', description: 'Online meeting', icon: Video },
  { value: 'phone_screen', label: 'Phone', description: 'Call screen', icon: Phone },
  { value: 'in_person', label: 'Onsite', description: 'In person', icon: MapPin },
  { value: 'technical', label: 'Technical', description: 'Skills deep-dive', icon: Briefcase },
  { value: 'hr', label: 'HR', description: 'Culture / HR round', icon: User },
];

export const DURATION_OPTIONS = [
  { value: '30', label: '30 minutes' },
  { value: '45', label: '45 minutes' },
  { value: '60', label: '60 minutes' },
  { value: '90', label: '90 minutes' },
  { value: '120', label: '2 hours' },
];

export const actionBtn = 'h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:text-brand-600 hover:border-brand-300 transition-colors';
export const actionDanger = 'h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-400 hover:text-red-600 hover:border-red-200 transition-colors';

export const RECS = [
  { value: 'strong_yes', label: 'Strong Yes' },
  { value: 'yes', label: 'Yes' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'no', label: 'No' },
  { value: 'strong_no', label: 'Strong No' },
];

/** Fallback when org has no scorecard templates yet */
export const DEFAULT_CRITERIA = [
  { key: 'Technical Skills', name: 'Technical Skills', weight: 1, description: '' },
  { key: 'Communication', name: 'Communication', weight: 1, description: '' },
  { key: 'Problem Solving', name: 'Problem Solving', weight: 1, description: '' },
  { key: 'Culture Fit', name: 'Culture Fit', weight: 1, description: '' },
];

export const DEFAULT_TEMPLATE_VALUE = '__default__';

export function criteriaFromTemplate(template) {
  const list = template?.criteria?.length ? template.criteria : DEFAULT_CRITERIA;
  return list.map((c, i) => ({
    key: `${c.name || 'Criterion'}_${i}`,
    name: c.name || `Criterion ${i + 1}`,
    weight: Number(c.weight) || 1,
    description: c.description || '',
  }));
}

export function weightedOverall(criteria, ratings) {
  let weighted = 0;
  let totalWeight = 0;
  criteria.forEach((c) => {
    const w = Number(c.weight) || 1;
    const r = Number(ratings[c.key]) || 3;
    weighted += r * w;
    totalWeight += w;
  });
  if (!totalWeight) return 3;
  return Math.max(1, Math.min(5, Math.round(weighted / totalWeight)));
}

export const TYPE_META = {
  video: { label: 'Video', icon: Video, badge: 'badge-brand' },
  phone_screen: { label: 'Phone', icon: Phone, badge: 'badge-info' },
  in_person: { label: 'Onsite', icon: MapPin, badge: 'badge-neutral' },
  panel: { label: 'Panel', icon: Users, badge: 'badge-brand' },
  technical: { label: 'Technical', icon: Briefcase, badge: 'badge-warning' },
  hr: { label: 'HR', icon: User, badge: 'badge-neutral' },
};

export const STATUS_BADGE = {
  scheduled: 'badge-warning',
  in_progress: 'badge-brand',
  completed: 'badge-success',
  cancelled: 'badge-danger',
  no_show: 'badge-danger',
  rescheduled: 'badge-info',
};

export const modeToType = (mode) => {
  const m = String(mode || '').toLowerCase();
  if (m.includes('phone')) return 'phone_screen';
  if (m.includes('onsite') || m.includes('person')) return 'in_person';
  return 'video';
};

export const typeToMode = (type) => {
  if (type === 'phone_screen') return 'Phone';
  if (type === 'in_person') return 'Onsite';
  return 'Video';
};

export const formatWhen = (date) => {
  if (!date) return { day: '—', time: '—' };
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return { day: '—', time: '—' };
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((startThat - startToday) / 86400000);
  let day;
  if (diff === 0) day = 'Today';
  else if (diff === 1) day = 'Tomorrow';
  else if (diff === -1) day = 'Yesterday';
  else day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return { day, time };
};

export const candidateName = (iv) =>
  iv.candidateName
  || iv.applicationId?.candidateId?.name
  || iv.applicationId?.candidate?.name
  || 'Candidate';

export const jobName = (iv) =>
  iv.jobTitle
  || iv.applicationId?.jobId?.title
  || iv.applicationId?.jobId?.role
  || iv.applicationId?.job?.title
  || 'Role';

export const normalizeInterview = (raw) => {
  if (!raw) return null;
  return {
    ...raw,
    _id: raw._id,
    source: raw.source || 'interview',
    status: raw.status || 'scheduled',
    type: raw.type || modeToType(raw.mode),
    scheduledAt: raw.scheduledAt,
    meetingLink: raw.meetingLink || '',
    location: raw.location || '',
    duration: raw.duration || 60,
    applicationId: raw.applicationId,
  };
};
