/**
 * MIS directory identity keys — email aliases, phone variants, and date alignment.
 * Used to keep one live record per person in an organisation.
 */

const { parsePhoneDigits } = require('./misRowFix');

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

function trimStr(v) {
  return String(v ?? '').trim();
}

function calendarDay(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function startOfUtcDay(d) {
  const key = calendarDay(d);
  if (!key) return null;
  return new Date(`${key}T00:00:00.000+05:30`);
}

function monthKey(d) {
  const day = calendarDay(d);
  return day ? day.slice(0, 7) : '';
}

/**
 * Collapse common mailbox aliases so  a.b+tag@gmail.com  matches  ab@gmail.com.
 */
function emailKey(email) {
  const raw = String(email || '').toLowerCase().trim();
  const at = raw.lastIndexOf('@');
  if (at < 1) return raw;
  let local = raw.slice(0, at);
  let domain = raw.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (GMAIL_DOMAINS.has(domain)) {
    const plus = local.indexOf('+');
    if (plus >= 0) local = local.slice(0, plus);
    local = local.replace(/\./g, '');
  }
  return local && domain ? `${local}@${domain}` : raw;
}

function phoneKey(raw) {
  return parsePhoneDigits(raw) || String(raw || '').replace(/\D/g, '');
}

function nameKey(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 80);
}

function companyKey(name) {
  return nameKey(name);
}

function levenshtein(a, b) {
  const s = String(a || '');
  const t = String(b || '');
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const rows = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i += 1) {
    let prev = i - 1;
    rows[0] = i;
    for (let j = 1; j <= t.length; j += 1) {
      const cur = rows[j];
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      rows[j] = Math.min(rows[j] + 1, rows[j - 1] + 1, prev + cost);
      prev = cur;
    }
  }
  return rows[t.length];
}

function namesLikelySame(a, b) {
  const x = nameKey(a);
  const y = nameKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length < 6 || y.length < 6) return false;
  const dist = levenshtein(x, y);
  const maxLen = Math.max(x.length, y.length);
  return dist <= 2 && dist / maxLen <= 0.25;
}

function identityKeys({ email, phone, contact, name, companyName } = {}) {
  const phoneRaw = phoneKey(phone || contact);
  return {
    emailKey: emailKey(email),
    phoneKey: phoneRaw || '',
    nameKey: nameKey(name),
    companyKey: companyKey(companyName),
  };
}

/**
 * Contact date may not sit after the import day, and may not move to another month
 * once it has been stored.
 */
function evaluateRecordDate({ recordDate, createdAt, previousRecordDate } = {}) {
  if (!recordDate) return { ok: true, recordDate: null };
  const next = recordDate instanceof Date ? recordDate : new Date(recordDate);
  if (Number.isNaN(next.getTime())) return { ok: false, code: 'DATE_INVALID', message: 'Contact date is not valid' };
  const imported = createdAt ? new Date(createdAt) : new Date();
  const nextDay = startOfUtcDay(next);
  const importDay = startOfUtcDay(imported);
  if (nextDay && importDay && nextDay.getTime() > importDay.getTime()) {
    return {
      ok: false,
      code: 'DATE_AFTER_IMPORT',
      message: 'Contact date cannot be after the import date',
    };
  }
  if (previousRecordDate) {
    const prevM = monthKey(previousRecordDate);
    const nextM = monthKey(next);
    if (prevM && nextM && prevM !== nextM) {
      return {
        ok: false,
        code: 'DATE_LOCKED',
        message: 'Contact date is locked after it is recorded',
      };
    }
  }
  return { ok: true, recordDate: next };
}

function applyIdentityFields(payload = {}) {
  const keys = identityKeys(payload);
  const phone = keys.phoneKey || trimStr(payload.phone || payload.contact);
  return {
    ...payload,
    email: String(payload.email || '').toLowerCase().trim(),
    phone,
    contact: phone,
    emailKey: keys.emailKey,
    phoneKey: keys.phoneKey,
    nameKey: keys.nameKey,
    companyKey: keys.companyKey,
  };
}

module.exports = {
  emailKey,
  phoneKey,
  nameKey,
  companyKey,
  identityKeys,
  namesLikelySame,
  levenshtein,
  evaluateRecordDate,
  applyIdentityFields,
  monthKey,
  startOfUtcDay,
};
