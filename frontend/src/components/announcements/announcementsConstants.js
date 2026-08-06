import {
  Info, CheckCircle2, AlertTriangle, Siren, Users, Megaphone, Globe2, Shield,
} from 'lucide-react';

export const ANN_TOUR_KEY = 'skillnix_tour_announcements_v1';

export const ANN_TOUR_STEPS = [
  {
    title: 'Announcements',
    body: 'Publish banners for your hiring team (in-app) or careers site visitors — one clear notice at a time.',
  },
  {
    target: '[data-tour="ann-toolbar"]',
    title: 'Find & filter',
    body: 'Search notices and filter by Active / Inactive so the feed stays easy to manage.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="ann-compose"]',
    title: 'Compose a notice',
    body: 'Set title, message, audience (hiring team vs careers site), and severity, then Publish.',
    placement: 'right',
  },
  {
    target: '[data-tour="ann-feed"]',
    title: 'Notice feed',
    body: 'Review live notices here. Edit opens a modal; deactivate removes the banner for everyone.',
    placement: 'left',
  },
];

export const SEVERITIES = [
  { value: 'info', label: 'Info', icon: Info, badge: 'badge-info', bar: 'from-sky-500 to-cyan-400' },
  { value: 'success', label: 'Success', icon: CheckCircle2, badge: 'badge-success', bar: 'from-emerald-500 to-lime-400' },
  { value: 'warning', label: 'Warning', icon: AlertTriangle, badge: 'badge-warning', bar: 'from-amber-500 to-orange-400' },
  { value: 'critical', label: 'Critical', icon: Siren, badge: 'badge-danger', bar: 'from-rose-500 to-red-400' }
];

export const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' }
];

export const AUDIENCES = [
  { value: 'all', label: 'Hiring team', hint: 'In-app banner for everyone', icon: Users },
  { value: 'admins', label: 'Admins only', hint: 'Owners & admins in-app', icon: Shield },
  { value: 'recruiters', label: 'Recruiters+', hint: 'Recruiters & admins in-app', icon: Megaphone },
  { value: 'public', label: 'Careers site', hint: 'Public careers / job pages', icon: Globe2 }
];

export const EMPTY_FORM = { title: '', body: '', severity: 'info', audience: 'all' };

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
