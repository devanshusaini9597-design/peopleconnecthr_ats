/**
 * Fallback CTC / notice options when org list is empty or API unavailable.
 * Orgs can manage their own via Manage on CTC / Notice fields in Add Candidate.
 */
export const DEFAULT_CTC_BANDS = [
  '0-50k', '50k-1L', '1L-2L', '2L-3L', '3L-4L', '4L-5L', '5L-6L', '6L-7L', '7L-8L', '8L-9L', '9L-10L',
  '10L-12L', '12L-15L', '15L-18L', '18L-20L', '20L-25L', '25L-30L', '30L-40L', '40L-50L',
  '50L-75L', '75L-1Cr', 'Above 1Cr',
  'Negotiable', 'Confidential', 'Not Disclosed',
];

export const DEFAULT_EXPECTED_CTC = ['As Per Company Norms', ...DEFAULT_CTC_BANDS];

export const DEFAULT_NOTICE_PERIODS = [
  'Immediate',
  '15 Days',
  '30 days',
  '45 days',
  '60 days',
  '90 days',
  'Serving Notice',
];

/** @deprecated use DEFAULT_CTC_BANDS — kept for filters/import helpers */
export const ctcRanges = DEFAULT_CTC_BANDS;
export const expectedCtcOptions = DEFAULT_EXPECTED_CTC;
export const noticePeriodOptions = DEFAULT_NOTICE_PERIODS;

export const ctcLpaBreakpoints = [
  0, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 20, 25, 30, 40, 50, 75, 100, 999,
];

export default ctcRanges;
