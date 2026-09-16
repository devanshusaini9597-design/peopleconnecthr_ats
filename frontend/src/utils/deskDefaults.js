/** Apply user deskDefaults onto a blank Add Candidate form (empty fields only). */
export function applyDeskDefaultsToForm(form, deskDefaults) {
  if (!form || !deskDefaults || typeof deskDefaults !== 'object') return form;
  const next = { ...form };
  const keys = ['fls', 'client', 'source', 'product', 'location'];
  for (const key of keys) {
    const val = deskDefaults[key];
    if (val == null || String(val).trim() === '') continue;
    if (next[key] == null || String(next[key]).trim() === '') {
      next[key] = String(val).trim();
    }
  }
  return next;
}

export function deskFieldLocked(deskDefaults, key) {
  return Boolean(deskDefaults?.locked?.[key]);
}

export const EMPTY_DESK_DEFAULTS = {
  fls: '',
  client: '',
  source: '',
  product: '',
  location: '',
  locked: { fls: false, client: false, source: false, product: false, location: false },
  setupCompletedAt: null,
};

export const FLS_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'FLS', label: 'FLS' },
  { value: 'NON-FLS', label: 'NON-FLS' },
];
