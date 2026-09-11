const { normalizeText } = require('./textNormalize');

const SPOC_EDIT_ROLES = ['owner', 'admin', 'hr_manager'];

function canEditCandidateSpoc(user) {
  return Boolean(user && SPOC_EDIT_ROLES.includes(user.role));
}

function firstNameOf(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0] || '';
}

/**
 * Default SPOC stamp for an employee desk.
 * First name when unique in the org; full name when another teammate shares that first name.
 */
function resolveEmployeeSpocLabel(user, orgEmployeeNames = []) {
  const full = String(user?.name || '').trim();
  const first = firstNameOf(full);
  if (!first) {
    const local = String(user?.email || '').split('@')[0].trim();
    return local ? normalizeText(local) : '';
  }

  const firstKey = first.toLowerCase();
  const fullKey = full.toLowerCase();
  const collision = (orgEmployeeNames || []).some((raw) => {
    const otherFull = String(raw || '').trim();
    if (!otherFull) return false;
    if (otherFull.toLowerCase() === fullKey) return false;
    return firstNameOf(otherFull).toLowerCase() === firstKey;
  });

  return normalizeText(collision ? full : first);
}

async function loadOrgEmployeeNames(organizationId) {
  if (!organizationId) return [];
  const User = require('../models/User');
  const rows = await User.find({
    organizationId,
    isActive: { $ne: false },
  })
    .select('name')
    .lean();
  return rows.map((r) => r.name).filter(Boolean);
}

/** Force locked SPOC for recruiters/sales on create/import. Managers may keep body.spoc. */
async function enforceSpocOnWrite(req, { isCreate = false } = {}) {
  if (canEditCandidateSpoc(req.user)) {
    if (isCreate && !(req.body.spoc && String(req.body.spoc).trim())) {
      const names = await loadOrgEmployeeNames(req.user.organizationId);
      req.body.spoc = resolveEmployeeSpocLabel(req.user, names);
    }
    return;
  }
  const names = await loadOrgEmployeeNames(req.user.organizationId);
  req.body.spoc = resolveEmployeeSpocLabel(req.user, names);
}

/** On update: non-managers cannot change SPOC. */
function stripSpocUnlessEditor(req) {
  if (!canEditCandidateSpoc(req.user) && 'spoc' in req.body) {
    delete req.body.spoc;
  }
}

module.exports = {
  SPOC_EDIT_ROLES,
  canEditCandidateSpoc,
  firstNameOf,
  resolveEmployeeSpocLabel,
  loadOrgEmployeeNames,
  enforceSpocOnWrite,
  stripSpocUnlessEditor,
};
