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
  if (!dateRange || dateRange === 'all') return null;
  const current = buildDateFilter(dateRange, customFrom, customTo, now, timeZone);
  if (!current) return null;

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

function nextYmd(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${month}-${day}`;
}

/** Inclusive calendar days from start up to, but not including, endExclusive. */
function dayKeysBetween(start, endExclusive, timeZone = DEFAULT_TZ) {
  if (!(start instanceof Date) || !(endExclusive instanceof Date) || endExclusive <= start) return [];
  const last = zonedYmd(new Date(endExclusive.getTime() - 1), timeZone);
  const keys = [];
  let key = zonedYmd(start, timeZone);
  let guard = 0;
  while (key <= last && guard < 800) {
    const [yy, mm, dd] = key.split('-').map(Number);
    const noon = zonedTimeToUtc(yy, mm, dd, 12, 0, 0, timeZone);
    keys.push({
      key,
      day: noon.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone }),
    });
    const next = nextYmd(key);
    if (next <= key) break;
    key = next;
    guard += 1;
  }
  return keys;
}

function withDayLabels(dayKeys, timeZone) {
  if (dayKeys.length > 7) return dayKeys;
  return dayKeys.map((row) => {
    const [yy, mm, dd] = row.key.split('-').map(Number);
    const noon = zonedTimeToUtc(yy, mm, dd, 12, 0, 0, timeZone);
    return {
      ...row,
      day: noon.toLocaleDateString('en-US', { weekday: 'short', timeZone }),
    };
  });
}

function weekBuckets(dayKeys) {
  const weeks = [];
  for (let i = 0; i < dayKeys.length; i += 7) {
    const slice = dayKeys.slice(i, i + 7);
    weeks.push({
      key: slice[0].key,
      day: slice[0].day,
      startKey: slice[0].key,
      endKey: slice[slice.length - 1].key,
    });
  }
  return weeks;
}

/** Chart buckets for the submissions trend. Days stay inside the selected period. */
function chartBucketConfig(dateRange = 'month', customFrom, customTo, now = new Date(), timeZone = DEFAULT_TZ) {
  const dateFilter = buildDateFilter(dateRange, customFrom, customTo, now, timeZone);
  const ymd = zonedYmd(now, timeZone);
  const [y, m, d] = ymd.split('-').map(Number);
  const tomorrow = new Date(zonedTimeToUtc(y, m, d, 0, 0, 0, timeZone).getTime() + 24 * 60 * 60 * 1000);

  let start;
  let endExclusive;
  let chartLabel;

  if (!dateFilter) {
    const range = lastNDaysRange(30, now, timeZone);
    start = range.start;
    endExclusive = range.endExclusive;
    chartLabel = 'Last 30 days';
  } else {
    start = dateFilter.$gte
      ? new Date(dateFilter.$gte)
      : new Date(new Date(dateFilter.$gt).getTime() + 1);
    if (dateFilter.$lt) endExclusive = new Date(dateFilter.$lt);
    else if (dateFilter.$lte) endExclusive = new Date(new Date(dateFilter.$lte).getTime() + 1);
    else endExclusive = tomorrow;
    if (endExclusive > tomorrow) endExclusive = tomorrow;
    chartLabel = getDateRangeLabel(dateRange, customFrom, customTo);
  }

  const allDays = dayKeysBetween(start, endExclusive, timeZone);
  const rollup = allDays.length > 120 ? 'week' : 'day';
  let dayKeys = rollup === 'week' ? weekBuckets(allDays) : withDayLabels(allDays, timeZone);
  if (!dayKeys.length) {
    const range = lastNDaysRange(7, now, timeZone);
    start = range.start;
    dayKeys = withDayLabels(range.days, timeZone);
    chartLabel = chartLabel || 'Last 7 days';
  }

  return {
    days: allDays.length || dayKeys.length,
    dayKeys,
    rollup,
    chartStart: start,
    chartLabel,
    granularity: rollup === 'week' ? 'weekly' : 'daily',
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
