/**
 * Analytics calendar helpers — Railway runs UTC; hiring teams are mostly IST.
 * Keep month / day buckets in one timezone so dashboard cards match reality.
 */
const DEFAULT_TZ = process.env.ANALYTICS_TIMEZONE || 'Asia/Kolkata';

function zonedYmd(date, timeZone = DEFAULT_TZ) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getTimeZoneOffsetMs(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = {};
  for (const { type, value } of dtf.formatToParts(date)) {
    if (type !== 'literal') parts[type] = value;
  }
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - date.getTime();
}

/** Local wall-clock time in `timeZone` → UTC Date. */
function zonedTimeToUtc(year, month, day, hour = 0, minute = 0, second = 0, timeZone = DEFAULT_TZ) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset);
}

function monthRanges(now = new Date(), timeZone = DEFAULT_TZ) {
  const ymd = zonedYmd(now, timeZone);
  const [y, m] = ymd.split('-').map(Number);
  const startOfMonth = zonedTimeToUtc(y, m, 1, 0, 0, 0, timeZone);
  const startOfNextMonth =
    m === 12
      ? zonedTimeToUtc(y + 1, 1, 1, 0, 0, 0, timeZone)
      : zonedTimeToUtc(y, m + 1, 1, 0, 0, 0, timeZone);
  const startOfLastMonth =
    m === 1
      ? zonedTimeToUtc(y - 1, 12, 1, 0, 0, 0, timeZone)
      : zonedTimeToUtc(y, m - 1, 1, 0, 0, 0, timeZone);
  return { startOfMonth, startOfNextMonth, startOfLastMonth, timeZone };
}

function lastNDaysRange(n = 7, now = new Date(), timeZone = DEFAULT_TZ) {
  const ymd = zonedYmd(now, timeZone);
  const [y, m, d] = ymd.split('-').map(Number);
  const endExclusive = zonedTimeToUtc(y, m, d, 0, 0, 0, timeZone);
  endExclusive.setTime(endExclusive.getTime() + 24 * 60 * 60 * 1000);
  const start = new Date(endExclusive);
  start.setTime(start.getTime() - n * 24 * 60 * 60 * 1000);

  const days = [];
  for (let i = 0; i < n; i++) {
    const cursor = new Date(start.getTime() + i * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000);
    const key = zonedYmd(cursor, timeZone);
    const [yy, mm, dd] = key.split('-').map(Number);
    const noon = zonedTimeToUtc(yy, mm, dd, 12, 0, 0, timeZone);
    days.push({
      key,
      day: noon.toLocaleDateString('en-US', { weekday: 'short', timeZone }),
    });
  }
  return { start, endExclusive, days, timeZone };
}

const DATE_RANGE_LABELS = {
  all: 'All Time',
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'Last 7 Days',
  month: 'This Month',
  quarter: 'This Quarter',
  year: 'This Year',
  custom: 'Custom Range',
};

/**
 * Build a MongoDB createdAt filter for analytics / export.
 * Returns null for "all time". Uses ANALYTICS_TIMEZONE for calendar boundaries.
 */
function buildDateFilter(dateRange = 'all', customFrom, customTo, now = new Date(), timeZone = DEFAULT_TZ) {
  if (!dateRange || dateRange === 'all') return null;

  if (dateRange === 'custom' && customFrom && customTo) {
    const fromKey = String(customFrom).slice(0, 10);
    const toKey = String(customTo).slice(0, 10);
    // Invalid / inverted ranges: normalize so start ≤ end
    const [startKey, endKey] = fromKey <= toKey ? [fromKey, toKey] : [toKey, fromKey];
    const [fy, fm, fd] = startKey.split('-').map(Number);
    const [ty, tm, td] = endKey.split('-').map(Number);
    if (!fy || !fm || !fd || !ty || !tm || !td) return null;
    const start = zonedTimeToUtc(fy, fm, fd, 0, 0, 0, timeZone);
    const endExclusive = zonedTimeToUtc(ty, tm, td, 0, 0, 0, timeZone);
    endExclusive.setTime(endExclusive.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { $gte: start, $lte: endExclusive };
  }

  const ymd = zonedYmd(now, timeZone);
  const [y, m, d] = ymd.split('-').map(Number);

  switch (dateRange) {
    case 'today': {
      const start = zonedTimeToUtc(y, m, d, 0, 0, 0, timeZone);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
      return { $gte: start, $lte: end };
    }
    case 'yesterday': {
      const todayStart = zonedTimeToUtc(y, m, d, 0, 0, 0, timeZone);
      const start = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      const end = new Date(todayStart.getTime() - 1);
      return { $gte: start, $lte: end };
    }
    case 'week': {
      const { start } = lastNDaysRange(7, now, timeZone);
      return { $gte: start };
    }
    case 'month': {
      const { startOfMonth, startOfNextMonth } = monthRanges(now, timeZone);
      return { $gte: startOfMonth, $lt: startOfNextMonth };
    }
    case 'quarter': {
      const qStartMonth = Math.floor((m - 1) / 3) * 3 + 1;
      return { $gte: zonedTimeToUtc(y, qStartMonth, 1, 0, 0, 0, timeZone) };
    }
    case 'year':
      return { $gte: zonedTimeToUtc(y, 1, 1, 0, 0, 0, timeZone) };
    default:
      return null;
  }
}

/** Previous period of equal length — for trend % on dashboard cards. */
function previousPeriodFilter(dateRange = 'all', customFrom, customTo, now = new Date(), timeZone = DEFAULT_TZ) {
  const current = buildDateFilter(dateRange, customFrom, customTo, now, timeZone);
  if (!current) {
    const { startOfMonth, startOfLastMonth } = monthRanges(now, timeZone);
    return { $gte: startOfLastMonth, $lt: startOfMonth };
  }

  if (dateRange === 'custom' && customFrom && customTo) {
    const startMs = current.$gte.getTime();
    const endMs = current.$lte.getTime();
    const span = endMs - startMs + 1;
    return { $gte: new Date(startMs - span), $lte: new Date(startMs - 1) };
  }

  const ymd = zonedYmd(now, timeZone);
  const [y, m, d] = ymd.split('-').map(Number);

  switch (dateRange) {
    case 'today': {
      const todayStart = zonedTimeToUtc(y, m, d, 0, 0, 0, timeZone);
      const prevStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      return { $gte: prevStart, $lte: new Date(todayStart.getTime() - 1) };
    }
    case 'yesterday': {
      const todayStart = zonedTimeToUtc(y, m, d, 0, 0, 0, timeZone);
      const yStart = new Date(todayStart.getTime() - 48 * 60 * 60 * 1000);
      const yEnd = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000 - 1);
      return { $gte: yStart, $lte: yEnd };
    }
    case 'week': {
      const { start } = lastNDaysRange(7, now, timeZone);
      const prevStart = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { $gte: prevStart, $lt: start };
    }
    case 'month': {
      const { startOfMonth, startOfLastMonth } = monthRanges(now, timeZone);
      return { $gte: startOfLastMonth, $lt: startOfMonth };
    }
    case 'quarter': {
      const qStartMonth = Math.floor((m - 1) / 3) * 3 + 1;
      const qStart = zonedTimeToUtc(y, qStartMonth, 1, 0, 0, 0, timeZone);
      const prevQStartMonth = qStartMonth <= 3 ? 10 : qStartMonth - 3;
      const prevY = qStartMonth <= 3 ? y - 1 : y;
      const prevStart = zonedTimeToUtc(prevY, prevQStartMonth, 1, 0, 0, 0, timeZone);
      return { $gte: prevStart, $lt: qStart };
    }
    case 'year': {
      const yearStart = zonedTimeToUtc(y, 1, 1, 0, 0, 0, timeZone);
      const prevStart = zonedTimeToUtc(y - 1, 1, 1, 0, 0, 0, timeZone);
      return { $gte: prevStart, $lt: yearStart };
    }
    default:
      return null;
  }
}

function getDateRangeLabel(dateRange = 'all', customFrom, customTo) {
  if (dateRange === 'custom' && customFrom && customTo) {
    const fmt = (s) =>
      new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${fmt(customFrom)} — ${fmt(customTo)}`;
  }
  return DATE_RANGE_LABELS[dateRange] || DATE_RANGE_LABELS.all;
}

/** Chart bucket config for dashboard submissions trend. */
function chartBucketConfig(dateRange = 'month', customFrom, customTo, now = new Date(), timeZone = DEFAULT_TZ) {
  let days = 7;
  if (dateRange === 'week' || dateRange === 'today' || dateRange === 'yesterday') days = 7;
  else if (dateRange === 'month') days = 30;
  else if (dateRange === 'quarter') days = 90;
  else if (dateRange === 'year') days = 365;
  else if (dateRange === 'custom' && customFrom && customTo) {
    const filter = buildDateFilter('custom', customFrom, customTo, now, timeZone);
    days = Math.min(365, Math.max(7, Math.ceil((filter.$lte - filter.$gte) / (24 * 60 * 60 * 1000)) + 1));
  } else if (dateRange === 'all') days = 30;

  days = Math.min(days, 365);
  const { start, days: dayKeys } = lastNDaysRange(days, now, timeZone);
  const dateFilter = buildDateFilter(dateRange, customFrom, customTo, now, timeZone);
  const chartStart = dateFilter?.$gte && dateFilter.$gte > start ? dateFilter.$gte : start;

  return {
    days: dayKeys.length,
    dayKeys,
    chartStart,
    chartLabel: getDateRangeLabel(dateRange, customFrom, customTo),
    granularity: days <= 31 ? 'daily' : days <= 120 ? 'weekly' : 'monthly',
  };
}

module.exports = {
  DEFAULT_TZ,
  DATE_RANGE_LABELS,
  zonedYmd,
  zonedTimeToUtc,
  monthRanges,
  lastNDaysRange,
  buildDateFilter,
  previousPeriodFilter,
  getDateRangeLabel,
  chartBucketConfig,
};
