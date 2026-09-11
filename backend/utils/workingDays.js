/**
 * Working-day helpers for ATS callback email timing.
 * Sundays and Indian national holidays are non-working.
 */

/** Fixed Indian national / gazetted holidays (MM-DD). Year-agnostic. */
const INDIAN_HOLIDAY_MMDD = new Set([
  '01-26', // Republic Day
  '08-15', // Independence Day
  '10-02', // Gandhi Jayanti
  '01-01', // New Year (often observed)
  '05-01', // Labour Day (many orgs)
]);

/** Extra full YYYY-MM-DD holidays (variable dates / year-specific). Extend as needed. */
const EXTRA_HOLIDAYS = new Set([
  // 2025
  '2025-03-14', // Holi
  '2025-03-31', // Id-ul-Fitr (approx)
  '2025-04-10', // Mahavir Jayanti
  '2025-04-18', // Good Friday
  '2025-06-07', // Id-ul-Zuha (approx)
  '2025-08-16', // Janmashtami (approx)
  '2025-10-02', // Gandhi Jayanti (also in MMDD)
  '2025-10-20', // Diwali (approx)
  '2025-10-21', // Diwali / Govardhan (approx)
  '2025-10-22', // Bhai Dooj (approx)
  '2025-12-25', // Christmas
  // 2026
  '2026-03-03', // Holi (approx)
  '2026-03-21', // Id-ul-Fitr (approx)
  '2026-03-31', // Mahavir Jayanti
  '2026-04-03', // Good Friday
  '2026-05-28', // Id-ul-Zuha (approx)
  '2026-09-04', // Janmashtami (approx)
  '2026-11-08', // Diwali (approx)
  '2026-11-09', // Diwali / Govardhan (approx)
  '2026-12-25', // Christmas
]);

function toYmd(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toMmDd(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}-${day}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a, b) {
  return toYmd(a) === toYmd(b);
}

/** Sunday or known holiday */
function isNonWorkingDay(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  if (d.getDay() === 0) return true; // Sunday
  const ymd = toYmd(d);
  if (EXTRA_HOLIDAYS.has(ymd)) return true;
  if (INDIAN_HOLIDAY_MMDD.has(toMmDd(d))) return true;
  return false;
}

/**
 * Email notify date = 1 calendar day before callback,
 * shifted earlier while that day is Sunday / holiday.
 */
function getCallbackEmailNotifyDate(callbackDate) {
  const cb = startOfDay(callbackDate);
  const notify = new Date(cb);
  notify.setDate(notify.getDate() - 1);
  let guard = 0;
  while (isNonWorkingDay(notify) && guard < 14) {
    notify.setDate(notify.getDate() - 1);
    guard += 1;
  }
  return notify;
}

/** True when today is the adjusted “one day before” notify day. */
function isCallbackEmailNotifyDay(callbackDate, today = new Date()) {
  const notify = getCallbackEmailNotifyDate(callbackDate);
  return isSameDay(notify, startOfDay(today));
}

module.exports = {
  INDIAN_HOLIDAY_MMDD,
  EXTRA_HOLIDAYS,
  toYmd,
  isSameDay,
  isNonWorkingDay,
  getCallbackEmailNotifyDate,
  isCallbackEmailNotifyDay,
  startOfDay,
};
