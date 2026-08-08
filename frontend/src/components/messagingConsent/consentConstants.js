export const CONSENT_TOUR_KEY = 'skillnix_tour_messaging_consent_v1';

export const CONSENT_TOUR_STEPS = [
  {
    title: 'Messaging Consent',
    body: 'Manage TCPA / GDPR channel opt-in and talent-pool retention — so outreach only goes to people who said yes.',
  },
  {
    target: '[data-tour="consent-candidates"]',
    title: 'Find a candidate',
    body: 'Search by name or email, then select someone to review their consent settings.',
    placement: 'right',
  },
  {
    target: '[data-tour="consent-panel"]',
    title: 'Channel permissions',
    body: 'Toggle email, SMS, WhatsApp, talent-pool retention, and phone verification — then save.',
    placement: 'left',
  },
  {
    target: '[data-tour="consent-save"]',
    title: 'Save consent',
    body: 'Saving updates what sequences and inbox can send. Turning channels off may ask for confirmation.',
    placement: 'top',
  },
];

export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
