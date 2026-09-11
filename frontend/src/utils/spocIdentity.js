/** Roles that may manually edit candidate.spoc */
export const SPOC_EDIT_ROLES = ['owner', 'admin', 'hr_manager'];

export function canEditCandidateSpoc(role) {
  return SPOC_EDIT_ROLES.includes(String(role || ''));
}

function firstNameOf(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0] || '';
}

function toSpocCase(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/**
 * First name when unique among teammates; full name on first-name collision.
 */
export function resolveEmployeeSpocLabel(user, orgEmployeeNames = []) {
  const full = String(user?.name || '').trim();
  const first = firstNameOf(full);
  if (!first) {
    const local = String(user?.email || '').split('@')[0].trim();
    return local ? toSpocCase(local) : '';
  }

  const firstKey = first.toLowerCase();
  const fullKey = full.toLowerCase();
  const collision = (orgEmployeeNames || []).some((raw) => {
    const otherFull = String(raw || '').trim();
    if (!otherFull) return false;
    if (otherFull.toLowerCase() === fullKey) return false;
    return firstNameOf(otherFull).toLowerCase() === firstKey;
  });

  return toSpocCase(collision ? full : first);
}
