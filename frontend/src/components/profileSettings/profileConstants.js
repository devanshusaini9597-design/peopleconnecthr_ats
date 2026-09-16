import API_URL from '../../config';

export const BASE = API_URL;
export const PROFILE_TOUR_KEY = 'skillnix_tour_profile_v2';
export const PROFILE_TOUR_STEPS = [
  {
    title: 'Your profile',
    body: 'Review your account details, security settings, and personal hiring preferences from this page.',
  },
  {
    target: '[data-tour="profile-tabs"]',
    title: 'Sections',
    body: 'Profile covers identity. Security updates your password and lets you sign out other devices.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="desk-defaults"]',
    title: 'Desk defaults',
    body: 'Set your usual client, source, product, and FLS so Add Candidate opens ready to work. Lock defaults if you want these values to stay fixed.',
    placement: 'top',
  },
];

export const PASSWORD_RULES = [
  { id: 'len', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { id: 'num', label: 'One number', test: (p) => /\d/.test(p) },
  { id: 'special', label: 'One special character', test: (p) => /[!@#$%^&*]/.test(p) },
];

export function formatProfileDate(value, { withDay = false } = {}) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', withDay
    ? { day: 'numeric', month: 'short', year: 'numeric' }
    : { month: 'short', year: 'numeric' });
}

export function formatProfileDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
