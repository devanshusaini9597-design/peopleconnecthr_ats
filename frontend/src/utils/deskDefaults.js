/** Apply desk defaults onto a blank Add Candidate form (empty fields only). */
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

const DESK_KEYS = ['fls', 'client', 'source', 'product', 'location'];

function pickDeskValue(...sources) {
  for (const src of sources) {
    if (src == null) continue;
    const val = String(src).trim();
    if (val) return val;
  }
  return '';
}

/**
 * Resolve defaults for Add Candidate.
 * Priority: personal deskDefaults → effectiveDeskDefaults → role defaults → last-used (if unlocked).
 * Always prefer personal saved values so a Profile save works even if effective* is stale in auth state.
 */
export function resolveFormDeskDefaults(user) {
  if (!user || typeof user !== 'object') return null;
  const personal = user.deskDefaults && typeof user.deskDefaults === 'object' ? user.deskDefaults : {};
  const effective = user.effectiveDeskDefaults && typeof user.effectiveDeskDefaults === 'object'
    ? user.effectiveDeskDefaults
    : {};
  const role = user.roleDeskDefaults && typeof user.roleDeskDefaults === 'object'
    ? user.roleDeskDefaults
    : {};
  const last = user.deskLastUsed && typeof user.deskLastUsed === 'object' ? user.deskLastUsed : {};

  const locked = {
    ...EMPTY_DESK_DEFAULTS.locked,
    ...(effective.locked || {}),
    ...(personal.locked || {}),
  };

  const out = {
    ...EMPTY_DESK_DEFAULTS,
    locked,
    setupCompletedAt: personal.setupCompletedAt || effective.setupCompletedAt || null,
  };

  for (const key of DESK_KEYS) {
    const personalVal = pickDeskValue(personal[key]);
    if (personalVal) {
      out[key] = personalVal;
      continue;
    }
    const effectiveVal = pickDeskValue(effective[key]);
    if (effectiveVal) {
      out[key] = effectiveVal;
      continue;
    }
    const roleVal = pickDeskValue(role[key]);
    if (roleVal) {
      out[key] = roleVal;
      continue;
    }
    if (!locked[key]) {
      out[key] = pickDeskValue(last[key]);
    } else {
      out[key] = '';
    }
  }

  return out;
}

/** Client-side merge after saving personal desk defaults (keeps auth state in sync). */
export function mergeEffectiveAfterPersonalSave(personal, user) {
  return resolveFormDeskDefaults({
    ...user,
    deskDefaults: personal,
    effectiveDeskDefaults: user?.effectiveDeskDefaults,
    roleDeskDefaults: user?.roleDeskDefaults,
    deskLastUsed: user?.deskLastUsed,
  });
}
