/**
 * Fix obvious MIS tracker cell mix-ups (phone in Email, email in Phone, etc.).
 * Mirrors Candidates Excel post-detection swaps, scoped to MIS fields.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const TEXT_KEYS = [
  'name', 'position', 'companyName', 'experience', 'ctc', 'expectedCtc',
  'noticePeriod', 'location', 'skills', 'product', 'client', 'fls', 'remark', 'source',
];

function looksLikeEmail(value) {
  const s = String(value || '').trim();
  return EMAIL_RE.test(s);
}

function parsePhoneDigits(value) {
  if (value == null || value === '') return '';
  const s = String(value).trim();
  if (/lpa|salary|ctc|@/i.test(s)) return '';
  let digits = s.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  if (/^[6-9]\d{9}$/.test(digits)) return digits;
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    if (/^[6-9]\d{9}$/.test(last10)) return last10;
  }
  // Accept other international lengths (7–15) when clearly phone-like
  if (digits.length >= 7 && digits.length <= 15 && !/@/.test(s)) return digits;
  return '';
}

function isPhoneOnlyCell(value) {
  const s = String(value || '').trim();
  if (!s || looksLikeEmail(s)) return false;
  return Boolean(parsePhoneDigits(s));
}

/**
 * @param {Record<string, string>} row
 * @returns {{ row: Record<string, string>, fixes: string[] }}
 */
function autoFixMisRow(row = {}) {
  const next = { ...row };
  const fixes = [];

  const takeEmailFrom = (key) => {
    const val = String(next[key] || '').trim();
    if (!looksLikeEmail(val)) return false;
    next.email = val.toLowerCase();
    next[key] = '';
    fixes.push(`${key} → email`);
    return true;
  };

  const takePhoneFrom = (key) => {
    const phone = parsePhoneDigits(next[key]);
    if (!phone) return false;
    next.phone = phone;
    next.contact = phone;
    if (key !== 'phone' && key !== 'contact') next[key] = '';
    fixes.push(`${key} → phone`);
    return true;
  };

  // Normalize known fields first
  if (next.email) next.email = String(next.email).toLowerCase().trim();
  const contactPhone = parsePhoneDigits(next.contact || next.phone);
  if (contactPhone) {
    next.phone = contactPhone;
    next.contact = contactPhone;
  }

  const emailOk = looksLikeEmail(next.email);
  const emailIsPhone = !emailOk && isPhoneOnlyCell(next.email);
  const contactIsEmail = looksLikeEmail(next.contact) || looksLikeEmail(next.phone);

  // Case: Email column has phone, Contact has email → swap
  if (emailIsPhone && contactIsEmail) {
    const phone = parsePhoneDigits(next.email);
    const email = String(next.contact || next.phone).toLowerCase().trim();
    next.email = email;
    next.phone = phone;
    next.contact = phone;
    fixes.push('swapped email ↔ phone');
  }

  // Case: Email column has phone, Contact empty → move phone, hunt email elsewhere
  if (!looksLikeEmail(next.email) && emailIsPhone && !looksLikeEmail(next.contact)) {
    takePhoneFrom('email');
  }

  // Case: Contact/phone cell is actually an email
  if (!looksLikeEmail(next.email) && contactIsEmail) {
    const email = String(next.contact || next.phone).toLowerCase().trim();
    next.email = email;
    next.contact = '';
    next.phone = '';
    fixes.push('contact → email');
  }

  // Pull email from other text columns if still missing
  if (!looksLikeEmail(next.email)) {
    for (const key of TEXT_KEYS) {
      if (takeEmailFrom(key)) break;
    }
  }

  // Pull phone from other text columns / email leftovers if still missing
  if (!parsePhoneDigits(next.phone || next.contact)) {
    if (isPhoneOnlyCell(next.email) && !looksLikeEmail(next.email)) {
      takePhoneFrom('email');
    } else {
      for (const key of TEXT_KEYS) {
        if (isPhoneOnlyCell(next[key]) && takePhoneFrom(key)) break;
      }
    }
  }

  // Final normalize
  if (next.email) next.email = String(next.email).toLowerCase().trim();
  const phone = parsePhoneDigits(next.phone || next.contact);
  next.phone = phone;
  next.contact = phone;

  return { row: next, fixes };
}

module.exports = {
  EMAIL_RE,
  looksLikeEmail,
  parsePhoneDigits,
  isPhoneOnlyCell,
  autoFixMisRow,
};
