import { Mail, Phone, MessageCircle } from 'lucide-react';

export const SEQ_TOUR_KEY = 'skillnix_tour_sequences_v1';

export const SEQ_TOUR_STEPS = [
  {
    title: 'Outreach Sequences',
    body: 'Build multi-step email, SMS, and WhatsApp drips with day delays — then enroll candidates and run due steps.',
  },
  {
    target: '[data-tour="seq-catalog"]',
    title: 'Your sequences',
    body: 'Each sequence shows steps, enrollments, and status. Open Enroll to add candidates to a drip.',
    placement: 'top',
  },
  {
    target: '[data-tour="seq-create"]',
    title: 'Create a sequence',
    body: 'Define steps, then click personalization tags (Candidate name, Email, Position) — no coding needed.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="seq-run"]',
    title: 'Run due steps',
    body: 'Process any steps that are ready to send across active enrollments.',
    placement: 'bottom',
  },
];

export const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email', description: 'Email message', icon: Mail },
  { value: 'sms', label: 'SMS', description: 'Text message', icon: Phone },
  { value: 'whatsapp', label: 'WhatsApp', description: 'WhatsApp chat', icon: MessageCircle },
];

export const TRIGGER_OPTIONS = [
  { value: 'manual', label: 'Manual', description: 'Enroll candidates yourself' },
  { value: 'on_apply', label: 'On apply', description: 'When a candidate applies' },
  { value: 'on_status', label: 'On status change', description: 'When status changes' },
];

/** Click-to-insert merge tags — no coding required */
export const MERGE_TAGS = [
  { token: '{{candidateName}}', label: 'Candidate name', example: 'Priya Sharma' },
  { token: '{{email}}', label: 'Email', example: 'priya@email.com' },
  { token: '{{position}}', label: 'Position', example: 'Frontend Engineer' },
];

export const emptyStep = () => ({
  channel: 'email',
  delayDays: 0,
  subject: '',
  body: 'Hi {{candidateName}},\n\n'
});

export const EMPTY_FORM = {
  name: '',
  description: '',
  triggerType: 'manual',
  steps: [emptyStep()]
};

export function channelIcon(channel) {
  if (channel === 'sms') return Phone;
  if (channel === 'whatsapp') return MessageCircle;
  return Mail;
}

export function insertAtCursor(el, value, token) {
  if (!el) return `${value || ''}${token}`;
  const start = el.selectionStart ?? String(value || '').length;
  const end = el.selectionEnd ?? start;
  const next = `${String(value || '').slice(0, start)}${token}${String(value || '').slice(end)}`;
  requestAnimationFrame(() => {
    try {
      const pos = start + token.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    } catch {
      /* ignore */
    }
  });
  return next;
}
