/** List prices are rupees per workspace, per month. GST is extra. */
export const GST_RATE = 0.18;
export const GST_LABEL = '+ 18% GST';

export function formatPlanPrice(amount) {
  if (amount == null) return 'Custom';
  if (Number(amount) === 0) return 'Free';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function formatGstNote() {
  return GST_LABEL;
}
