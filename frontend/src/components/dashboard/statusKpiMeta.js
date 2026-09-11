import {
  Briefcase, Clock, Inbox, Calendar, UserCheck, BadgeCheck, UserX, UserMinus, Layers,
} from 'lucide-react';

export const STATUS_CARD_STYLE = {
  // Company dashboard stages (match live owner cards)
  Applied: { icon: Inbox, gradient: 'from-sky-500 to-brand-400' },
  'Screening / Pending': { icon: Layers, gradient: 'from-indigo-500 to-blue-400' },
  Screening: { icon: Layers, gradient: 'from-indigo-500 to-blue-400' },
  'Turn Up': { icon: Layers, gradient: 'from-orange-500 to-amber-400' },
  Interview: { icon: Calendar, gradient: 'from-brand-500 to-teal-500' },
  Shortlisted: { icon: Layers, gradient: 'from-violet-500 to-fuchsia-400' },
  Offer: { icon: Briefcase, gradient: 'from-violet-500 to-fuchsia-400' },
  Hired: { icon: UserCheck, gradient: 'from-emerald-500 to-lime-400' },
  Joined: { icon: BadgeCheck, gradient: 'from-teal-500 to-emerald-600' },
  Dropped: { icon: UserMinus, gradient: 'from-stone-400 to-stone-500' },
  'Screen Reject': { icon: Layers, gradient: 'from-sky-500 to-blue-500' },
  'Interview Reject': { icon: Layers, gradient: 'from-orange-500 to-amber-400' },
  Rejected: { icon: UserX, gradient: 'from-red-500 to-rose-400' },
  Interested: { icon: Layers, gradient: 'from-cyan-500 to-sky-400' },
  // Freelancer submission pipeline (My Pipeline board only)
  Submitted: { icon: Inbox, gradient: 'from-sky-500 to-brand-400' },
  Reviewing: { icon: Clock, gradient: 'from-amber-500 to-orange-400' },
  Shortlisting: { icon: UserCheck, gradient: 'from-emerald-500 to-lime-400' },
  Selection: { icon: Briefcase, gradient: 'from-violet-500 to-fuchsia-400' },
};

const FALLBACK_GRADIENTS = [
  'from-brand-500 to-teal-400',
  'from-sky-500 to-indigo-400',
  'from-amber-500 to-orange-400',
  'from-violet-500 to-fuchsia-400',
  'from-emerald-500 to-lime-400',
  'from-rose-500 to-orange-400',
];

function shortenPeriod(label = '') {
  const s = String(label).trim();
  if (!s) return 'period';
  if (s.length <= 18) return s;
  return s.replace('Last 7 Days', '7 days').replace('This Month', 'month').replace('This Quarter', 'quarter').replace('This Year', 'year');
}

/** Enterprise total KPI — scope caption + optional trend (stage cards stay clean). */
export function dashboardTotalKpiMeta(stats = {}, { scope = 'employee', periodLabel = 'All Time', isAllTime = true } = {}) {
  const caption = isAllTime
    ? (scope === 'organization' ? null : 'Assigned to you')
    : `${scope === 'organization' ? '' : 'Assigned to you · '}${periodLabel}`.replace(/^ · /, '') || periodLabel;

  let trend;
  if (!isAllTime && stats.candidateTrend != null && Number.isFinite(Number(stats.candidateTrend))) {
    trend = Number(stats.candidateTrend);
  }

  return { caption, trend, trendLabel: 'vs last period' };
}

/** Analytics / legacy — period delta copy */
export function periodHint(count, periodLabel) {
  const n = Number(count) || 0;
  const label = shortenPeriod(periodLabel);
  if (n > 0) return { hint: `+${n.toLocaleString()} added in ${label}`, hintTone: 'up' };
  return { hint: `0 added in ${label}`, hintTone: 'neutral' };
}

export function monthHint(count, periodLabel = 'this month') {
  return periodHint(count, periodLabel);
}

export function statusCardStyle(stage, index) {
  return STATUS_CARD_STYLE[stage] || {
    icon: Layers,
    gradient: FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length],
  };
}

export function statusCardList(stats) {
  if (Array.isArray(stats?.statusCards) && stats.statusCards.length) return stats.statusCards;
  if (Array.isArray(stats?.pipeline)) return stats.pipeline;
  return [];
}
