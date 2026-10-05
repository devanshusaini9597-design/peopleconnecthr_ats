/**
 * Per-recipient merge for bulk email / messaging.
 * Keeps {{candidateName}} (and {{name}}) working when a shared draft is sent
 * to many people — including when a sample name was already baked into the draft.
 */

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} text
 * @param {string} recipientName
 * @param {string[]} [bakedNames] Names that may already appear in the draft (e.g. first selected person)
 */
function personalizeBulkText(text, recipientName, bakedNames = []) {
  let out = String(text ?? '');
  const name = String(recipientName || '').trim() || 'Candidate';

  out = out
    .replace(/\{\{\s*candidateName\s*\}\}/gi, name)
    .replace(/\{\{\s*name\s*\}\}/gi, name);

  const seen = new Set();
  for (const sample of bakedNames) {
    const s = String(sample || '').trim();
    if (s.length < 2) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (key === name.toLowerCase()) continue;
    out = out.replace(new RegExp(escapeRegExp(s), 'g'), name);
  }

  return out;
}

/**
 * Ensure a draft still has {{candidateName}} for backend merge.
 * Restores the token when a sample name was substituted in the UI.
 */
function ensureCandidateNameToken(text, bakedNames = []) {
  let out = String(text ?? '');
  if (/\{\{\s*candidateName\s*\}\}/i.test(out)) return out;

  for (const sample of bakedNames) {
    const s = String(sample || '').trim();
    if (s.length < 2) continue;
    out = out.replace(new RegExp(escapeRegExp(s), 'g'), '{{candidateName}}');
  }
  return out;
}

module.exports = {
  personalizeBulkText,
  ensureCandidateNameToken,
  escapeRegExp,
};
