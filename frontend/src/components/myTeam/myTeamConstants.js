export const TAG_COLORS = [
  { value: 'brand', label: 'Brand', chip: 'bg-brand-50 text-brand-800 border-brand-200' },
  { value: 'teal', label: 'Teal', chip: 'bg-teal-50 text-teal-800 border-teal-200' },
  { value: 'amber', label: 'Amber', chip: 'bg-amber-50 text-amber-800 border-amber-200' },
  { value: 'sky', label: 'Sky', chip: 'bg-sky-50 text-sky-800 border-sky-200' },
  { value: 'rose', label: 'Rose', chip: 'bg-rose-50 text-rose-800 border-rose-200' },
  { value: 'violet', label: 'Violet', chip: 'bg-violet-50 text-violet-800 border-violet-200' },
];

export function tagChipClass(color) {
  return TAG_COLORS.find((c) => c.value === color)?.chip || TAG_COLORS[0].chip;
}

export function handlePreview(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}
