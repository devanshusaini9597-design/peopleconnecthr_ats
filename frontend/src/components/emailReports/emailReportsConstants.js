import {
  Calendar,
  FileText,
  Server,
  Activity,
  Users,
  Eye,
  MousePointerClick,
  AlertTriangle,
  MessageSquareReply,
  Send,
  Mail,
  CheckCircle2,
  XCircle,
  Megaphone,
  Zap,
} from 'lucide-react';

/** Email Reports product tour + channel tabs */
export const EMAIL_REPORTS_TOUR_KEY = 'skillnix_tour_email_reports_v3';

export const EMAIL_REPORTS_TOUR_STEPS = [
  {
    title: 'Email Reports',
    body: 'Track outbound mail from your ATS — marketing via Zoho Campaigns and transactional via ZeptoMail.',
  },
  {
    target: '[data-tour="email-reports-tabs"]',
    title: 'Campaign vs Transactional',
    body: 'Each channel has its own related KPIs and table so metrics stay separate.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="email-reports-kpis"]',
    title: 'Engagement funnel',
    body: 'Cards follow sends → recipients → delivered → opened → clicked → bounced. Click a card to filter the table to matching sends.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="email-reports-columns"]',
    title: 'Choose columns',
    body: 'Show or hide table fields. Use Select all, Clear, or Reset to defaults.',
    placement: 'left',
  },
  {
    target: '[data-tour="email-reports-table"]',
    title: 'Send history',
    body: 'Drag horizontally to scroll. Open Details for per-recipient opens, clicks, bounces, and replies.',
    placement: 'top',
  },
];

export const CHANNEL_TABS = [
  {
    id: 'marketing',
    label: 'Marketing campaigns',
    short: 'Campaigns',
    provider: 'Zoho Campaigns',
    blurb: 'Bulk / nurture — funnel from campaign send through opens, clicks, and bounces.',
  },
  {
    id: 'transactional',
    label: 'Transactional',
    short: 'Transactional',
    provider: 'ZeptoMail',
    blurb: 'Candidate mail, OTP, invites — delivery and engagement from ZeptoMail.',
  },
  {
    id: 'all',
    label: 'All mail',
    short: 'All',
    provider: 'All providers',
    blurb: 'Combined ledger across marketing and transactional channels.',
  },
];

/** Funnel KPIs — order matters. metric filters the history table when clicked. */
export function buildKpiFunnel(summary, channel) {
  const s = summary || {};
  const recipients = s.recipients || 0;
  const delivered = s.delivered || 0;
  const opened = s.opened || 0;
  const clicked = s.clicked || 0;
  const bounced = s.bounced || 0;
  const failed = s.failed || 0;
  const replied = s.replied || 0;
  const sends = s.sends || 0;

  if (channel === 'marketing') {
    return [
      {
        key: 'campaigns',
        metric: 'all',
        icon: Megaphone,
        label: 'Campaigns',
        value: sends,
        caption: 'Campaigns started',
        gradient: 'from-brand-500 to-teal-400',
      },
      {
        key: 'recipients',
        metric: 'all',
        icon: Users,
        label: 'Recipients',
        value: recipients,
        caption: 'People reached',
        gradient: 'from-sky-500 to-brand-400',
      },
      {
        key: 'delivered',
        metric: 'delivered',
        icon: CheckCircle2,
        label: 'Delivered',
        value: delivered,
        caption: 'Inbox accepted',
        gradient: 'from-emerald-500 to-teal-400',
      },
      {
        key: 'opened',
        metric: 'opened',
        icon: Eye,
        label: 'Opened',
        value: opened,
        caption: 'Opened at least once',
        gradient: 'from-teal-500 to-cyan-400',
      },
      {
        key: 'clicked',
        metric: 'clicked',
        icon: MousePointerClick,
        label: 'Clicked',
        value: clicked,
        caption: 'Link clicked',
        gradient: 'from-indigo-500 to-violet-400',
      },
      {
        key: 'bounced',
        metric: 'bounced',
        icon: AlertTriangle,
        label: 'Bounced',
        value: bounced,
        caption: 'Hard or soft bounce',
        gradient: 'from-amber-500 to-orange-400',
      },
    ];
  }

  if (channel === 'transactional') {
    return [
      {
        key: 'sends',
        metric: 'all',
        icon: Send,
        label: 'Sends',
        value: sends,
        caption: 'Jobs sent',
        gradient: 'from-brand-500 to-teal-400',
      },
      {
        key: 'recipients',
        metric: 'all',
        icon: Mail,
        label: 'Recipients',
        value: recipients,
        caption: 'Addresses contacted',
        gradient: 'from-sky-500 to-brand-400',
      },
      {
        key: 'delivered',
        metric: 'delivered',
        icon: CheckCircle2,
        label: 'Delivered',
        value: delivered,
        caption: 'Inbox accepted',
        gradient: 'from-emerald-500 to-teal-400',
      },
      {
        key: 'opened',
        metric: 'opened',
        icon: Eye,
        label: 'Opened',
        value: opened,
        caption: 'Opened at least once',
        gradient: 'from-teal-500 to-cyan-400',
      },
      {
        key: 'failed',
        metric: 'failed',
        icon: XCircle,
        label: 'Failed',
        value: failed,
        caption: 'Send failures',
        gradient: 'from-rose-500 to-red-400',
      },
      {
        key: 'bounced',
        metric: 'bounced',
        icon: AlertTriangle,
        label: 'Bounced',
        value: bounced,
        caption: 'Hard or soft bounce',
        gradient: 'from-amber-500 to-orange-400',
      },
    ];
  }

  return [
    {
      key: 'sends',
      metric: 'all',
      icon: Send,
      label: 'Sends',
      value: sends,
      caption: 'All channels',
      gradient: 'from-brand-500 to-teal-400',
    },
    {
      key: 'recipients',
      metric: 'all',
      icon: Users,
      label: 'Recipients',
      value: recipients,
      caption: 'Across all sends',
      gradient: 'from-sky-500 to-brand-400',
    },
    {
      key: 'delivered',
      metric: 'delivered',
      icon: CheckCircle2,
      label: 'Delivered',
      value: delivered,
      caption: 'Inbox accepted',
      gradient: 'from-emerald-500 to-teal-400',
    },
    {
      key: 'opened',
      metric: 'opened',
      icon: Eye,
      label: 'Opened',
      value: opened,
      caption: 'Opened at least once',
      gradient: 'from-teal-500 to-cyan-400',
    },
    {
      key: 'clicked',
      metric: 'clicked',
      icon: MousePointerClick,
      label: 'Clicked',
      value: clicked,
      caption: 'Link clicked',
      gradient: 'from-indigo-500 to-violet-400',
    },
    {
      key: 'replied',
      metric: 'replied',
      icon: MessageSquareReply,
      label: 'Replied',
      value: replied,
      caption: 'Inbound replies',
      gradient: 'from-violet-500 to-fuchsia-400',
    },
  ];
}

export const TABLE_COLUMNS = [
  { id: 'sentAt', label: 'When', icon: Calendar, defaultVisible: true, locked: false },
  { id: 'subject', label: 'Subject / Campaign', icon: FileText, defaultVisible: true, locked: true },
  { id: 'channel', label: 'Channel', icon: Megaphone, defaultVisible: false },
  { id: 'provider', label: 'Provider', icon: Server, defaultVisible: true },
  { id: 'status', label: 'Status', icon: Activity, defaultVisible: true },
  { id: 'from', label: 'From', icon: Mail, defaultVisible: false },
  { id: 'sentBy', label: 'Sent by', icon: Users, defaultVisible: false },
  { id: 'sent', label: 'Sent', icon: Send, defaultVisible: true },
  { id: 'delivered', label: 'Delivered', icon: CheckCircle2, defaultVisible: false },
  { id: 'opened', label: 'Opened', icon: Eye, defaultVisible: true },
  { id: 'clicked', label: 'Clicked', icon: MousePointerClick, defaultVisible: true },
  { id: 'bounced', label: 'Bounced', icon: AlertTriangle, defaultVisible: true },
  { id: 'replied', label: 'Replied', icon: MessageSquareReply, defaultVisible: true },
  { id: 'failed', label: 'Failed', icon: XCircle, defaultVisible: false },
];

export const COLUMNS_STORAGE_KEY = 'skillnix_email_reports_columns_v2';

export function defaultVisibleColumnIds() {
  return TABLE_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id);
}

export function loadVisibleColumns() {
  const defaults = defaultVisibleColumnIds();
  try {
    const raw = localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return defaults;
    const allowed = new Set(TABLE_COLUMNS.map((c) => c.id));
    const next = parsed.filter((id) => allowed.has(id));
    TABLE_COLUMNS.filter((c) => c.locked).forEach((c) => {
      if (!next.includes(c.id)) next.unshift(c.id);
    });
    return next.length ? next : defaults;
  } catch {
    return defaults;
  }
}

export function saveVisibleColumns(ids) {
  try {
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export const METRIC_LABELS = {
  all: 'All sends',
  delivered: 'Delivered',
  opened: 'Opened',
  clicked: 'Clicked',
  bounced: 'Bounced',
  failed: 'Failed',
  replied: 'Replied',
};

export { Zap };
