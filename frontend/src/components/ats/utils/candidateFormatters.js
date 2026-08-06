import { ctcRanges, ctcLpaBreakpoints } from '../../../utils/ctcRanges';

export function formatCandidateName(candidate) {
  if (!candidate) return '';
  return (candidate.name || '').trim() || 'Unnamed';
}

export function formatExperience(exp) {
  if (exp === undefined || exp === null || exp === '') return '—';
  const n = Number(exp);
  if (Number.isNaN(n)) return String(exp);
  return n === 1 ? '1 yr' : `${n} yrs`;
}

export function formatCtc(value) {
  if (value === undefined || value === null || value === '') return '—';
  return String(value);
}

export function getCTCRank(val) {
  if (!val) return -1;
  const idx = ctcRanges.indexOf(val);
  if (idx !== -1) return idx;
  const str = String(val).toUpperCase().trim();
  const num = parseFloat(str.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return -1;
  let lpa = num;
  if (str.includes('K')) lpa = num / 100;
  for (let i = 0; i < ctcLpaBreakpoints.length - 1; i++) {
    if (lpa <= ctcLpaBreakpoints[i + 1]) return i;
  }
  return ctcRanges.length - 1;
}

export function validateAndFixEmail(email) {
  if (!email) return { isValid: false, value: '' };
  const fixed = String(email).trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return { isValid: emailRegex.test(fixed), value: fixed };
}

export function validateAndFixMobile(mobile) {
  if (!mobile) return { isValid: false, value: '' };
  let digitsOnly = String(mobile).replace(/\D/g, '');
  if (digitsOnly.startsWith('91') && digitsOnly.length > 10) digitsOnly = digitsOnly.slice(-10);
  if (digitsOnly.length > 10) digitsOnly = digitsOnly.slice(-10);
  const isValid = digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly);
  return { isValid, value: digitsOnly };
}

export function validateAndFixName(name) {
  if (!name) return { isValid: false, value: '' };
  let fixed = String(name).replace(/[0-9!@#$%^&*()_+=\[\]{};:'",.<>?/\\|`~-]/g, '').trim();
  fixed = fixed.split(/\s+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  const isValid = fixed.length >= 2 && /^[a-zA-Z\s]+$/.test(fixed);
  return { isValid, value: fixed };
}

export function is100PercentCorrect(candidate) {
  return (
    validateAndFixEmail(candidate.email).isValid &&
    validateAndFixMobile(candidate.contact).isValid &&
    validateAndFixName(candidate.name).isValid
  );
}
