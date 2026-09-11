/**
 * Persist which candidate table columns are visible.
 * New columns (e.g. org custom fields) are auto-shown the first time they appear.
 */
export const CANDIDATE_COLUMNS_STORAGE_KEY = 'skillnix_candidate_columns_v1';

/** Always keep these columns visible when present. */
export const CANDIDATE_LOCKED_COLUMN_KEYS = ['actions', 'srNo', 'name'];

export function loadCandidateColumnPrefs() {
  try {
    const raw = localStorage.getItem(CANDIDATE_COLUMNS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Legacy: bare array of visible ids
      return { visible: parsed, known: parsed };
    }
    if (parsed && Array.isArray(parsed.visible)) {
      return {
        visible: parsed.visible,
        known: Array.isArray(parsed.known) ? parsed.known : parsed.visible,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveCandidateColumnPrefs(visibleIds, knownIds) {
  try {
    localStorage.setItem(
      CANDIDATE_COLUMNS_STORAGE_KEY,
      JSON.stringify({
        visible: visibleIds,
        known: knownIds || visibleIds,
      })
    );
  } catch {
    /* ignore */
  }
}

/**
 * Merge saved prefs with the live column catalog.
 * - Drops removed keys
 * - Appends brand-new catalog keys as visible (dynamic custom fields)
 * - Ensures locked keys stay on
 * - Does NOT re-enable columns the user unchecked
 */
export function resolveVisibleColumnIds(
  availableKeys,
  prefs = null,
  lockedKeys = CANDIDATE_LOCKED_COLUMN_KEYS
) {
  const available = Array.isArray(availableKeys) ? availableKeys.filter(Boolean) : [];
  if (!available.length) {
    return { visible: [], known: [] };
  }

  const locked = lockedKeys.filter((k) => available.includes(k));
  const allowed = new Set(available);

  if (!prefs || !Array.isArray(prefs.visible) || !prefs.visible.length) {
    return { visible: [...available], known: [...available] };
  }

  const known = new Set([...(prefs.known || []), ...prefs.visible]);
  let visible = prefs.visible.filter((id) => allowed.has(id));

  for (const key of available) {
    if (!known.has(key) && !visible.includes(key)) {
      visible.push(key);
    }
  }

  for (const key of locked) {
    if (!visible.includes(key)) visible.unshift(key);
  }

  return {
    visible: visible.length ? visible : [...available],
    known: [...available],
  };
}
