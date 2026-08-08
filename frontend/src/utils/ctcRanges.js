/**
 * Fallback CTC / notice options when org list is empty or API unavailable.
 * Lean set — orgs can manage their own via Manage on CTC / Notice fields in Add Candidate.
 */
export const DEFAULT_CTC_BANDS = [
  '0-50k', '50k-1L', '1L-2L', '2L-3L', '3L-4L', '4L-5L', '5L-6L', '6L-8L',
  '8L-10L', '10L-12L', '12L-15L', '15L-20L', '20L-25L', '25L-30L', '30L-40L',
  '40L-50L', 'Above 50L',
];

export const DEFAULT_EXPECTED_CTC = ['As Per Company Norms', ...DEFAULT_CTC_BANDS];

export const DEFAULT_NOTICE_PERIODS = [
  'Immediate',
  '15 Days',
  '30 days',
  '60 days',
  '90 days',
];

/** @deprecated use DEFAULT_CTC_BANDS — kept for filters/import helpers */
export const ctcRanges = DEFAULT_CTC_BANDS;
export const expectedCtcOptions = DEFAULT_EXPECTED_CTC;
export const noticePeriodOptions = DEFAULT_NOTICE_PERIODS;

export const ctcLpaBreakpoints = [
  0, 0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 999,
];

export default ctcRanges;
