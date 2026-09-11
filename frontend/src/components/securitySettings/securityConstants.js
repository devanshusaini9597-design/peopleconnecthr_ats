export const SEC_TOUR_KEY = 'skillnix_tour_security_v1';
export const SEC_TOUR_STEPS = [
  {
    title: 'Security',
    body: 'Protect accounts with MFA, then set org-wide session and network policies.',
  },
  {
    target: '[data-tour="sec-mfa"]',
    title: 'Your authenticator',
    body: 'Enroll a TOTP authenticator app for your own login — scan/setup, verify, save backup codes.',
    placement: 'right',
  },
  {
    target: '[data-tour="sec-policies"]',
    title: 'Organization policies',
    body: 'Enforce MFA for everyone, idle timeouts, concurrent sessions, and (on Enterprise) IP allowlists.',
    placement: 'left',
  },
  {
    target: '[data-tour="sec-devices"]',
    title: 'Signed-in devices',
    body: 'See every laptop or browser using this account and sign one out remotely.',
    placement: 'top',
  },
  {
    target: '[data-tour="sec-save"]',
    title: 'Save policies',
    body: 'Apply organization security settings after you change them.',
    placement: 'bottom',
  },
];

export const IDLE_OPTIONS = [
  { value: '30', label: '30 minutes', description: 'Short sessions' },
  { value: '60', label: '1 hour', description: 'Tight idle timeout' },
  { value: '120', label: '2 hours', description: 'Balanced' },
  { value: '240', label: '4 hours', description: 'Half day' },
  { value: '485', label: '8 hours', description: 'Workday lock' },
  { value: '1440', label: '24 hours', description: 'Full day' },
  { value: '10080', label: '7 days', description: 'Stay signed in until re-login' },
];

export const SESSION_COUNT_OPTIONS = [1, 3, 5, 10, 15, 20, 50].map((n) => ({
  value: String(n),
  label: String(n),
  description: n === 1 ? 'Single device' : `${n} concurrent logins`,
}));
