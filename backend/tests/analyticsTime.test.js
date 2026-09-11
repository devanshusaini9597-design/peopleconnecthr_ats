const { monthRanges, lastNDaysRange, zonedYmd, zonedTimeToUtc, buildDateFilter, getDateRangeLabel, previousPeriodFilter } = require('../utils/analyticsTime');

describe('analyticsTime', () => {
  it('builds IST month windows that do not use UTC midnight', () => {
    // 2026-08-01 00:30 IST = 2026-07-31 19:00 UTC
    const now = new Date('2026-07-31T19:30:00.000Z');
    const { startOfMonth, startOfNextMonth, timeZone } = monthRanges(now, 'Asia/Kolkata');
    expect(timeZone).toBe('Asia/Kolkata');
    expect(zonedYmd(startOfMonth, 'Asia/Kolkata')).toBe('2026-08-01');
    expect(zonedYmd(new Date(startOfNextMonth.getTime() - 1), 'Asia/Kolkata')).toBe('2026-08-31');
  });

  it('fills seven consecutive local calendar days', () => {
    const now = zonedTimeToUtc(2026, 8, 20, 15, 0, 0, 'Asia/Kolkata');
    const { days } = lastNDaysRange(7, now, 'Asia/Kolkata');
    expect(days).toHaveLength(7);
    expect(days[0].key).toBe('2026-08-14');
    expect(days[6].key).toBe('2026-08-20');
  });

  it('buildDateFilter uses IST calendar month boundaries', () => {
    const now = new Date('2026-07-31T19:30:00.000Z'); // Aug 1 00:30 IST
    const filter = buildDateFilter('month', null, null, now, 'Asia/Kolkata');
    expect(filter).not.toBeNull();
    expect(zonedYmd(filter.$gte, 'Asia/Kolkata')).toBe('2026-08-01');
    expect(zonedYmd(new Date(filter.$lt.getTime() - 1), 'Asia/Kolkata')).toBe('2026-08-31');
  });

  it('buildDateFilter supports custom multi-year ranges', () => {
    const filter = buildDateFilter('custom', '2023-01-01', '2025-12-31', new Date(), 'Asia/Kolkata');
    expect(filter.$gte).toBeDefined();
    expect(filter.$lte).toBeDefined();
    expect(zonedYmd(filter.$gte, 'Asia/Kolkata')).toBe('2023-01-01');
    expect(zonedYmd(filter.$lte, 'Asia/Kolkata')).toBe('2025-12-31');
  });

  it('buildDateFilter normalizes inverted custom ranges', () => {
    const filter = buildDateFilter('custom', '2026-06-01', '2025-01-01', new Date(), 'Asia/Kolkata');
    expect(zonedYmd(filter.$gte, 'Asia/Kolkata')).toBe('2025-01-01');
    expect(zonedYmd(filter.$lte, 'Asia/Kolkata')).toBe('2026-06-01');
  });

  it('getDateRangeLabel returns human labels', () => {
    expect(getDateRangeLabel('quarter')).toBe('This Quarter');
    expect(getDateRangeLabel('custom', '2024-01-01', '2024-06-30')).toMatch(/2024/);
  });

  it('previousPeriodFilter returns prior month for month range', () => {
    const now = new Date('2026-08-15T12:00:00.000Z');
    const prev = previousPeriodFilter('month', null, null, now, 'Asia/Kolkata');
    expect(prev.$gte).toBeDefined();
    expect(prev.$lt).toBeDefined();
  });
});
