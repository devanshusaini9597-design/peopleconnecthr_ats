import {
  Info, CheckCircle2, AlertTriangle, Siren, Users, Megaphone, Globe2, Shield, UserRound,
} from 'lucide-react';

export const ANN_TOUR_KEY = 'skillnix_tour_announcements_v1';

export const ANN_TOUR_STEPS = [
  {
    title: 'Announcements',
    body: 'Publish banners for your hiring team, freelancers, or the careers site. Save a draft, preview the banner, and schedule a start or end.',
  },
  {
    target: '[data-tour="ann-toolbar"]',
    title: 'Find & filter',
    body: 'Search the full history and filter by Active, Scheduled, Draft, or Inactive.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="ann-new"]',
    title: 'New notice',
    body: 'Compose with rich text, audience, optional department or team targeting, acknowledgment, and attachments.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="ann-feed"]',
    title: 'Notice feed',
    body: 'Edit, deactivate, or open delivery to see who read it and whether email went out.',
    placement: 'top',
  },
];

export const SEVERITIES = [
  { value: 'info', label: 'Info', icon: Info, badge: 'badge-info', bar: 'from-sky-500 to-cyan-400' },
  { value: 'success', label: 'Success', icon: CheckCircle2, badge: 'badge-success', bar: 'from-emerald-500 to-lime-400' },
  { value: 'warning', label: 'Warning', icon: AlertTriangle, badge: 'badge-warning', bar: 'from-amber-500 to-orange-400' },
  { value: 'critical', label: 'Critical', icon: Siren, badge: 'badge-danger', bar: 'from-rose-500 to-red-400' }
];

export const FILTERS = [
  { key: 'active', label: 'Active' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'draft', label: 'Drafts' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'all', label: 'All' },
];

export const TITLE_MAX = 140;
export const BODY_MAX = 5000;

export const AUDIENCES = [
  { value: 'all', label: 'Hiring team', hint: 'Owner, admin, HR manager, recruiter, and sales — in-app and optional email', icon: Users },
  { value: 'admins', label: 'Admins only', hint: 'Owner, admin, and HR manager', icon: Shield },
  { value: 'recruiters', label: 'Recruiters+', hint: 'Hiring team above, including admins. Not interviewers.', icon: Megaphone },
  { value: 'freelancers', label: 'Freelancers only', hint: 'In-app only — no email', icon: UserRound },
  { value: 'public', label: 'Careers site', hint: 'Public careers / job pages. No in-app alert.', icon: Globe2 }
];

export const EMPTY_FORM = {
  title: '',
  body: '',
  severity: 'info',
  audience: 'all',
  notifyEmail: true,
  notifyAgain: true,
  requiresAck: false,
  pinned: false,
  startsAt: '',
  endsAt: '',
  departments: [],
  locations: [],
  offices: [],
  teams: [],
};

export function toLocalInput(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function plainText(input = '') {
  return String(input)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

export function sanitizeNoticeHtml(input = '') {
  return String(input)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?(iframe|object|embed|link|meta|form|base)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

export function severityMeta(value) {
  return SEVERITIES.find((s) => s.value === value) || SEVERITIES[0];
}

export function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return '';
  }
}
