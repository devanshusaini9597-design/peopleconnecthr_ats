/**
 * Resume → form merge helpers.
 *
 * Enterprise rules:
 * - Empty form / matching identity → fill empty fields only (never wipe typed values).
 * - Typed Person A + resume Person B → caller should ask: replace vs keep.
 */

function norm(v) {
  return String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function emailLocal(email) {
  const e = norm(email);
  const at = e.indexOf('@');
  return at > 0 ? e.slice(0, at) : e;
}

function namesOverlap(a, b) {
  const na = norm(a).replace(/[^a-z\s]/g, '');
  const nb = norm(b).replace(/[^a-z\s]/g, '');
  if (!na || !nb) return false;
  if (na === nb) return true;
  const aParts = na.split(/\s+/).filter((p) => p.length >= 3);
  const bParts = nb.split(/\s+/).filter((p) => p.length >= 3);
  return aParts.some((p) => bParts.some((q) => p.includes(q) || q.includes(p)));
}

/**
 * True when the form already has identity fields that disagree with the resume.
 */
export function resumeIdentityConflicts(form, parsed) {
  const formName = norm(form?.name);
  const formEmail = norm(form?.email);
  const parsedName = norm(parsed?.name);
  const parsedEmail = norm(parsed?.email);

  const hasTypedIdentity = Boolean(formName || formEmail);
  if (!hasTypedIdentity) return false;
  if (!parsedName && !parsedEmail) return false;

  let emailConflict = false;
  if (formEmail && parsedEmail && formEmail !== parsedEmail) {
    // Same person sometimes uses different addresses — only flag hard mismatch
    // when local-parts also don't overlap.
    const fl = emailLocal(formEmail);
    const pl = emailLocal(parsedEmail);
    emailConflict = !(fl.length >= 3 && pl.length >= 3 && (fl.includes(pl) || pl.includes(fl)));
  }

  let nameConflict = false;
  if (formName && parsedName && !namesOverlap(formName, parsedName)) {
    nameConflict = true;
  }

  // Different person if name OR email clearly disagree (and the other side isn't empty)
  return Boolean(emailConflict || nameConflict);
}

function fixEmail(email) {
  return String(email || '')
    .toLowerCase()
    .trim()
    .replace(/@gnail\.con$/, '@gmail.com')
    .replace(/@gmail\.con$/, '@gmail.com');
}

/**
 * @param {'empty-only'|'replace'} mode
 * @param {{ formatName?: (s: string) => string, stripContact?: (s: string) => string }} opts
 */
export function mergeResumeIntoForm(prev, parsed, mode = 'empty-only', opts = {}) {
  const next = { ...prev };
  const replace = mode === 'replace';
  const formatName = opts.formatName || ((s) => String(s).trim().replace(/\s{2,}/g, ' '));
  const stripContact = opts.stripContact || ((s) => String(s).trim());

  const setIf = (key, value, transform = (v) => v) => {
    if (!value) return;
    if (replace || !String(prev[key] || '').trim()) {
      next[key] = transform(value);
    }
  };

  setIf('name', parsed.name, formatName);
  setIf('email', parsed.email, fixEmail);
  setIf('contact', parsed.contact, stripContact);
  setIf('position', parsed.position, (v) => String(v).trim());
  // company maps to companyName in the candidate form
  if (parsed.company && (replace || !String(prev.companyName || '').trim())) {
    next.companyName = String(parsed.company).trim();
  }
  setIf('experience', parsed.experience, (v) => String(v).trim());
  setIf('location', parsed.location, (v) => String(v).trim());

  return next;
}

export function resumeConflictPromptMessage(parsed) {
  const who = parsed?.name || parsed?.email || 'another person';
  return `This resume looks like a different person (${who}).`;
}
