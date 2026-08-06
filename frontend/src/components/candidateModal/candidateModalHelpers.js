/** Candidate modal field validators — shared helpers. */

export function validateAndFixEmail(email) {
  if (!email) return { isValid: false, value: '' };
  const fixed = String(email).trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return { isValid: emailRegex.test(fixed), value: fixed };
}

export function validateAndFixMobile(mobile, country) {
  if (!mobile) return { isValid: false, value: '' };
  let digitsOnly = String(mobile).replace(/\D/g, '');

  if (digitsOnly.startsWith('91') && digitsOnly.length > 10) {
    digitsOnly = digitsOnly.slice(-10);
  }
  if (digitsOnly.startsWith('1') && digitsOnly.length > 10) {
    digitsOnly = digitsOnly.slice(-10);
  }
  if (digitsOnly.length > 11) {
    digitsOnly = digitsOnly.slice(-10);
  }

  const len = digitsOnly.length;
  let isValid = false;

  if (country === '+91' || country === '+1' || country === '+7') {
    isValid = len === 10;
  } else if (country === '+44') {
    isValid = len >= 10 && len <= 11;
  } else if (country === '+61') {
    isValid = len >= 9 && len <= 10;
  } else {
    isValid = len >= 9;
  }

  return { isValid, value: digitsOnly };
}

export function validateAndFixName(name) {
  if (!name) return { isValid: false, value: '' };
  let fixed = String(name)
    .replace(/[0-9!@#$%^&*()_+=[\]{};:'",.<>?/\\|`~-]/g, '')
    .trim();
  fixed = fixed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  const isValid = fixed.length >= 2 && /^[a-zA-Z\s]+$/.test(fixed);
  return { isValid, value: fixed };
}

export const CANDIDATE_STATUS_OPTIONS = [
  'Applied',
  'Screening',
  'Interview',
  'Offer',
  'Hired',
  'Joined',
  'Dropped',
  'Rejected',
  'Interested',
  'Interested and scheduled',
];

export const INITIAL_CANDIDATE_FORM = () => ({
  srNo: '',
  date: new Date().toISOString().split('T')[0],
  location: '',
  position: '',
  fls: '',
  name: '',
  contact: '',
  email: '',
  companyName: '',
  experience: '',
  ctc: '',
  expectedCtc: '',
  noticePeriod: '',
  status: 'Applied',
  client: '',
  spoc: '',
  source: '',
  resume: null,
  callBackDate: '',
  countryCode: '+91',
});
