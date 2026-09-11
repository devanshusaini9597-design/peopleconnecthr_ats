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

/** Normalize common date strings to YYYY-MM-DD (local-safe). */
export function toDateKey(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const raw = String(value).trim();
  if (!raw) return '';
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    return `${dmy[3]}-${month}-${day}`;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
}

/** Milliseconds for sorting; prefers entry date, then createdAt, then ObjectId time. */
export function getCandidateSortTime(candidate) {
  if (!candidate) return 0;
  const dateKey = toDateKey(candidate.date);
  if (dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const dayMs = Date.UTC(y, m - 1, d);
    const createdMs = candidate.createdAt ? new Date(candidate.createdAt).getTime() : NaN;
    // Same calendar day → use createdAt so newest records win within the day
    if (Number.isFinite(createdMs)) {
      const createdKey = toDateKey(candidate.createdAt);
      if (createdKey === dateKey) return createdMs;
      return dayMs + (createdMs % 86400000);
    }
    return dayMs;
  }
  if (candidate.createdAt) {
    const t = new Date(candidate.createdAt).getTime();
    if (Number.isFinite(t)) return t;
  }
  const id = String(candidate._id || '');
  if (/^[a-fA-F0-9]{24}$/.test(id)) {
    return parseInt(id.slice(0, 8), 16) * 1000;
  }
  return 0;
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
  fixed = fixed.replace(/\s{2,}/g, ' ').toUpperCase();
  const isValid = fixed.length >= 2 && /^[A-Z\s]+$/.test(fixed);
  return { isValid, value: fixed };
}

export function is100PercentCorrect(candidate) {
  return (
    validateAndFixEmail(candidate.email).isValid &&
    validateAndFixMobile(candidate.contact).isValid &&
    validateAndFixName(candidate.name).isValid
  );
}
