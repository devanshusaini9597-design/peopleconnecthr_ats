import { Mail, Phone, MessageCircle, MessageSquare, Inbox as InboxIcon } from 'lucide-react';

export const INBOX_TOUR_KEY = 'skillnix_tour_inbox_v1';
export const INBOX_TOUR_STEPS = [
  {
    title: 'Unified Inbox',
    body: 'One place for candidate conversations across email, SMS, and WhatsApp — search, reply, and keep threads organized.',
  },
  {
    target: '[data-tour="inbox-threads"]',
    title: 'Conversations',
    body: 'Inbox, Unread, Starred, Snoozed, and Archived. Use templates, attachments, assign, and snooze from the thread.',
    placement: 'right',
  },
  {
    target: '[data-tour="inbox-thread"]',
    title: 'Thread & reply',
    body: 'Read messages, pick a reply channel, and send. Archive when a conversation is done.',
    placement: 'left',
  },
  {
    target: '[data-tour="inbox-compose"]',
    title: 'New message',
    body: 'Start a new outbound conversation. Respect messaging consent for SMS and WhatsApp.',
    placement: 'bottom',
  },
];

export const CHANNEL_FILTERS = [
  { value: 'all', label: 'All channels', description: 'Email, SMS & WhatsApp', icon: InboxIcon },
  { value: 'email', label: 'Email', description: 'Email threads only', icon: Mail },
  { value: 'sms', label: 'SMS', description: 'Text messages', icon: Phone },
  { value: 'whatsapp', label: 'WhatsApp', description: 'WhatsApp threads', icon: MessageCircle },
  { value: 'mixed', label: 'Mixed', description: 'Multi-channel threads', icon: MessageSquare },
];

export const REPLY_CHANNELS = [
  { value: 'email', label: 'Email', description: 'Send by email', icon: Mail },
  { value: 'sms', label: 'SMS', description: 'Send a text', icon: Phone },
  { value: 'whatsapp', label: 'WhatsApp', description: 'Send on WhatsApp', icon: MessageCircle },
];

export const EMPTY_COMPOSE = {
  toAddress: '',
  subject: '',
  body: '',
  channel: 'email',
  phone: '',
  countryIso: 'IN',
  mode: '',
  templateId: '',
  templateVars: {},
  templateDirty: false,
  matchedCandidate: null,
  draftId: '',
};

export const SNOOZE_OPTIONS = [
  { id: '1h', label: '1 hour' },
  { id: 'tonight', label: 'This evening' },
  { id: 'tomorrow', label: 'Tomorrow morning' },
  { id: 'week', label: 'Next week' },
];

export function snoozeUntil(id) {
  const now = new Date();
  if (id === '1h') return new Date(now.getTime() + 60 * 60 * 1000);
  if (id === 'tonight') {
    const d = new Date(now);
    d.setHours(18, 0, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    return d;
  }
  if (id === 'tomorrow') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  }
  if (id === 'week') {
    const d = new Date(now);
    const add = ((8 - d.getDay()) % 7) || 7;
    d.setDate(d.getDate() + add);
    d.setHours(9, 0, 0, 0);
    return d;
  }
  return new Date(now.getTime() + 60 * 60 * 1000);
}

export function fillInboxTemplate(text, vars = {}) {
  return String(text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    if (v == null || v === '') return `{{${key}}}`;
    return String(v);
  });
}

export function usedTemplateKeys(text = '') {
  const keys = new Set();
  String(text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    keys.add(key);
    return '';
  });
  return [...keys];
}

export function composeIsDirty(compose, files = []) {
  if (files.length) return true;
  return Boolean(
    String(compose?.toAddress || '').trim()
    || String(compose?.subject || '').trim()
    || String(compose?.body || '').trim()
    || String(compose?.phone || '').trim()
    || compose?.templateId
  );
}

export const formatWhen = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
};

export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/** Map useCountries() rows into PremiumSelect options. */
export function countrySelectOptions(countryCodes = []) {
  return (countryCodes || []).map((c) => {
    const iso = (c.iso || '').toUpperCase();
    return {
      value: iso || c.code,
      label: c.code,
      description: c.name || '',
      flagIso: iso || undefined,
      searchText: `${c.name || ''} ${iso} ${c.code || ''}`,
    };
  });
}

export function dialCodeForIso(countryCodes = [], countryIso) {
  const match = (countryCodes || []).find((c) => c.iso === countryIso);
  return match?.code || '+91';
}
