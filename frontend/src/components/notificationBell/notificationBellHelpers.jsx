import React from 'react';
import {
  AlertTriangle, Calendar, Clock, UserPlus, Check, UserX, Share2, Send, AtSign, Users, Megaphone, Briefcase, BarChart3,
} from 'lucide-react';

export const isCallbackNotif = (notif) =>
  ['callback_reminder', 'callback_today', 'callback_overdue'].includes(notif?.type);

export const parseCallbackDateClient = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const ddmmyyyy = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const yyyymmdd = dateStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(dateStr.length <= 10 ? `${dateStr}T00:00:00` : dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Live days remaining from callBackDate (ignores stale stored daysRemaining). */
export const liveDaysRemaining = (notif) => {
  const parsed = parseCallbackDateClient(notif?.callBackDate);
  if (parsed) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cb = new Date(parsed);
    cb.setHours(0, 0, 0, 0);
    return Math.ceil((cb - today) / (1000 * 60 * 60 * 24));
  }
  if (notif?.daysRemaining === undefined || notif.daysRemaining === null) return null;
  return Number(notif.daysRemaining);
};

export const notifIconTone = (type, priority, daysRemaining = null) => {
  if (isCallbackNotif({ type }) && daysRemaining !== null && daysRemaining < 0) {
    return 'bg-rose-50 text-rose-700 border-rose-100';
  }
  if (type === 'callback_reminder' || type === 'callback_today' || type === 'interview_reminder') {
    return 'bg-amber-50 text-amber-700 border-amber-100';
  }
  if (type === 'callback_overdue' || priority === 'urgent') {
    return 'bg-rose-50 text-rose-700 border-rose-100';
  }
  if (type === 'mention') return 'bg-brand-50 text-brand-700 border-brand-100';
  if (type === 'team_activity') return 'bg-teal-50 text-teal-700 border-teal-100';
  if (type === 'announcement') return 'bg-violet-50 text-violet-700 border-violet-100';
  if (type === 'job_opening') return 'bg-brand-50 text-brand-700 border-brand-100';
  if (type === 'candidate_hired') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (type === 'share_request' || type === 'freelancer_submission') {
    return 'bg-sky-50 text-sky-700 border-sky-100';
  }
  if (type === 'report_shared') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  return 'bg-stone-50 text-stone-600 border-stone-200/80';
};

export const NotifTypeIcon = ({ type, priority, daysRemaining = null, className = '' }) => {
  const cls = `flex-shrink-0 ${className}`;
  if (type === 'invitation') return <UserPlus size={16} className={`text-brand-600 ${cls}`} />;
  if (type === 'invitation_accepted') return <Check size={16} className={`text-teal-600 ${cls}`} />;
  if (type === 'invitation_declined') return <UserX size={16} className={`text-rose-600 ${cls}`} />;
  if (type === 'share_request') return <Share2 size={16} className={`text-teal-600 ${cls}`} />;
  if (type === 'report_shared') return <BarChart3 size={16} className={`text-emerald-700 ${cls}`} />;
  if (type === 'freelancer_submission') return <Send size={16} className={`text-brand-700 ${cls}`} />;
  if (type === 'mention') return <AtSign size={16} className={`text-brand-700 ${cls}`} />;
  if (type === 'team_activity') return <Users size={16} className={`text-teal-700 ${cls}`} />;
  if (type === 'announcement') return <Megaphone size={16} className={`text-brand-700 ${cls}`} />;
  if (type === 'job_opening') return <Briefcase size={16} className={`text-brand-700 ${cls}`} />;
  if (type === 'candidate_hired') return <Briefcase size={16} className={`text-emerald-700 ${cls}`} />;
  if (type === 'interview_reminder') return <Calendar size={16} className={`text-brand-600 ${cls}`} />;
  if (isCallbackNotif({ type })) {
    const overdue = daysRemaining !== null ? daysRemaining < 0 : type === 'callback_overdue';
    return <Clock size={16} className={`${overdue ? 'text-rose-600' : 'text-amber-600'} ${cls}`} />;
  }
  if (priority === 'urgent') return <AlertTriangle size={16} className={`text-rose-600 ${cls}`} />;
  if (priority === 'high') return <Clock size={16} className={`text-amber-600 ${cls}`} />;
  return <Calendar size={16} className={`text-brand-600 ${cls}`} />;
};

export const isFreelanceReview = (notif) => {
  if (notif?.type !== 'freelancer_submission') return false;
  const title = String(notif.title || '');
  return /marked |review update/i.test(title);
};

export const notifKindLabel = (notif) => {
  if (!notif) return 'Update';
  if (notif.type === 'invitation') {
    if (notif.status === 'accepted') return 'Invitation accepted';
    if (notif.status === 'declined') return 'Invitation declined';
    return 'Team invitation';
  }
  if (notif.type === 'share_request') return 'Shared candidates';
  if (notif.type === 'report_shared') return 'Shared report';
  if (notif.type === 'invitation_accepted') return 'Invitation accepted';
  if (notif.type === 'invitation_declined') return 'Invitation declined';
  if (notif.type === 'freelancer_submission') {
    return isFreelanceReview(notif) ? 'Review update' : 'Freelance submission';
  }
  if (notif.type === 'mention') return 'Mention';
  if (notif.type === 'team_activity') return 'My team';
  if (notif.type === 'announcement') return 'Company';
  if (notif.type === 'job_opening') return 'New job';
  if (notif.type === 'candidate_hired') return 'Hired';
  if (notif.type === 'candidate_update') return 'Pipeline';
  if (notif.type === 'interview_reminder') return 'Interview';
  if (isCallbackNotif(notif)) return 'Callback';
  return 'Update';
};

export const reviewStageFromNotif = (notif) => {
  const title = String(notif?.title || '');
  const message = String(notif?.message || '');
  const hit = `${title} ${message}`.match(/\b(submitted|reviewing|shortlisted|rejected)\b/i);
  if (!hit) return '';
  const value = hit[1].toLowerCase();
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export const reviewBodyFromNotif = (notif) => {
  const message = String(notif?.message || '').trim();
  if (!isFreelanceReview(notif)) return message;
  const split = message.split(': ');
  if (split.length >= 2) return split.slice(1).join(': ').trim();
  return message;
};

export const notifHeadline = (notif) => {
  if (isCallbackNotif(notif)) {
    return notif.candidateName || 'Candidate';
  }
  if (notif?.type === 'job_opening') {
    const raw = String(notif.title || '');
    const m = raw.match(/^New opening:\s*(.+)$/i);
    return m ? m[1].trim() : (raw || 'New job opening');
  }
  if (notif?.title) return notif.title;
  if (notif?.candidateName) return notif.candidateName;
  return 'Notification';
};

export const formatNotifDate = (value) => {
  if (!value) return '';
  const raw = String(value);
  const d = raw.length <= 10 ? new Date(`${raw}T00:00:00`) : new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export const notifSnippet = (notif) => {
  if (isCallbackNotif(notif)) {
    const bits = [];
    if (notif.candidatePosition) bits.push(notif.candidatePosition);
    if (notif.callBackDate) bits.push(formatNotifDate(notif.callBackDate));
    if (notif.candidateContact) bits.push(notif.candidateContact);
    return bits.join(' · ');
  }
  if (notif?.type === 'job_opening') {
    return String(notif.message || '').replace(/\s+/g, ' ').trim();
  }
  const raw = isFreelanceReview(notif) ? reviewBodyFromNotif(notif) : notif?.message;
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > 110 ? `${text.slice(0, 107)}…` : text;
};

export const groupNotifications = (list, sortOrder = 'latest') => {
  const start = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };
  const today = start(new Date());
  const yesterday = today - 86_400_000;
  const groups = [
    { key: 'today', label: 'Today', items: [] },
    { key: 'yesterday', label: 'Yesterday', items: [] },
    { key: 'earlier', label: 'Earlier', items: [] },
  ];
  for (const n of list) {
    const t = start(n.createdAt || 0);
    if (t === today) groups[0].items.push(n);
    else if (t === yesterday) groups[1].items.push(n);
    else groups[2].items.push(n);
  }
  const ordered = groups.filter((g) => g.items.length > 0);
  return sortOrder === 'oldest' ? ordered.reverse() : ordered;
};

export const dueLabel = (notif) => {
  const days = liveDaysRemaining(notif);
  if (days === null || days === undefined || Number.isNaN(days)) return null;
  if (days < 0) return `Missed · ${Math.abs(days)}d`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Tomorrow';
  return `${days}d left`;
};

export const dueTone = (notif) => {
  const days = liveDaysRemaining(notif);
  if (days === null || days === undefined || Number.isNaN(days)) return '';
  if (days <= 0) return 'text-rose-700 bg-rose-50 ring-rose-100';
  if (days <= 2) return 'text-amber-800 bg-amber-50 ring-amber-100';
  return 'text-stone-600 bg-stone-100 ring-stone-200/80';
};

export const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return formatNotifDate(dateStr);
};
