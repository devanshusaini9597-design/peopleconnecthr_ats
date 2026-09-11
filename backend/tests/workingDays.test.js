/**
 * Working-day helpers used for callback email timing.
 */
describe('workingDays', () => {
  const {
    isNonWorkingDay,
    getCallbackEmailNotifyDate,
    isCallbackEmailNotifyDay,
    toYmd,
  } = require('../utils/workingDays');

  it('treats Sunday as non-working', () => {
    // 2026-08-09 is a Sunday
    expect(isNonWorkingDay(new Date(2026, 7, 9))).toBe(true);
  });

  it('treats Independence Day as holiday', () => {
    expect(isNonWorkingDay(new Date(2026, 7, 15))).toBe(true);
  });

  it('shifts notify day earlier when day-before is Sunday', () => {
    // Callback Monday 2026-08-10 → day before Sunday → notify Saturday 2026-08-08
    const cb = new Date(2026, 7, 10);
    const notify = getCallbackEmailNotifyDate(cb);
    expect(toYmd(notify)).toBe('2026-08-08');
    expect(isCallbackEmailNotifyDay(cb, new Date(2026, 7, 8))).toBe(true);
    expect(isCallbackEmailNotifyDay(cb, new Date(2026, 7, 9))).toBe(false);
  });

  it('uses plain day-before when it is a weekday', () => {
    // Callback Wednesday 2026-08-12 → notify Tuesday 2026-08-11
    const cb = new Date(2026, 7, 12);
    const notify = getCallbackEmailNotifyDate(cb);
    expect(toYmd(notify)).toBe('2026-08-11');
  });
});
