/**
 * Shared CTC/Expected CTC ranges and notice period options for Add/Edit Candidate.
 * Ranges from 0-50k up to Above 50L (1L increments from 10L to 50L).
 */

const baseRanges = [
  '0-50k', '50k-1L', '1L-1.5L', '1.5L-2L', '2L-2.5L', '2.5L-3L', '3L-3.5L', '3.5L-4L',
  '4L-4.5L', '4.5L-5L', '5L-5.5L', '5.5L-6L', '6L-8L', '8L-9L', '9L-10L'
];

const extendedRanges = [];
for (let i = 10; i <= 49; i++) {
  extendedRanges.push(`${i}L-${i + 1}L`);
}

export const ctcRanges = [...baseRanges, ...extendedRanges, 'Above 50L'];

/** Expected CTC options: "As Per Company Norms" first, then ctcRanges (for Expected CTC dropdown only). */
export const expectedCtcOptions = ['As Per Company Norms', ...ctcRanges];

/** LPA breakpoints for mapping a numeric value to range index (for sort/display). */
export const ctcLpaBreakpoints = [
  0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 8, 9, 10,
  ...Array.from({ length: 40 }, (_, i) => 11 + i), // 11..50
  999
];

export const noticePeriodOptions = [
  'Immediate',
  '15 Days',
  '30 days',
  '60 days',
  '90 days'
];

export default ctcRanges;
