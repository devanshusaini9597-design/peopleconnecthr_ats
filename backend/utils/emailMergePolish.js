/**
 * Clean merged email subject/body so empty fields never appear as blank labels,
 * leftover {{tokens}}, or awkward "for  at ." prose.
 */

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ORPHAN_HEADERS =
  'Drive details|Drive schedule|Details|Key details|Role details|Interview details|Proposed schedule|Updated schedule|Schedule|Final round details|Job details|Onboarding details';

/**
 * @param {string} subject
 * @param {{ preserveTokens?: string[] }} [opts]
 * @returns {string}
 */
function polishMergedSubject(subject, opts = {}) {
  const preserve = new Set(
    (opts.preserveTokens || []).map((t) => String(t || '').trim()).filter(Boolean)
  );
  let s = String(subject || '');
  s = s.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => (preserve.has(key) ? `{{${key}}}` : ''));
  s = s.replace(/\s*[–—]\s*/g, ' – ');
  s = s.replace(/:\s*–\s*/g, ': ');
  s = s.replace(/\s*–\s*(?=\||$)/g, '');
  s = s.replace(/:\s*(?=\||$)/g, '');
  s = s.replace(/\s*\|\s*$/g, '');
  s = s.replace(/^\s*\|\s*/g, '');
  s = s.replace(/\s*\|\s*/g, ' | ');
  s = s.replace(/\s{2,}/g, ' ').trim();
  s = s.replace(/^([A-Za-z][^|]{0,40}?)\s*\|\s*$/g, '$1');
  if (!s || /^[:–—\-|]+$/i.test(s) || /^(Hiring drive|Job alert|Update)\s*:?$/i.test(s)) {
    return preserve.size ? s || 'Career update' : 'Career update';
  }
  return s;
}

/**
 * @param {string} body
 * @param {{ preserveTokens?: string[] }} [opts]
 * @returns {string}
 */
function polishMergedBody(body, opts = {}) {
  const preserve = new Set(
    (opts.preserveTokens || []).map((t) => String(t || '').trim()).filter(Boolean)
  );
  let s = String(body || '');

  // Strip leftover placeholders except ones we still need (e.g. bulk {{candidateName}})
  s = s.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => (preserve.has(key) ? `{{${key}}}` : ''));

  // Drop labeled lines / bullets with no value (Date:, • Time:, Mode / Venue:, etc.)
  // Keep known section headers — those are handled as orphans only when no details follow.
  s = s.replace(/^[•●\-]\s*[A-Za-z][^:\n]{0,60}:\s*$/gim, '');
  s = s.replace(
    new RegExp(
      `^(?!(?:${ORPHAN_HEADERS}):\\s*$)[A-Za-z][A-Za-z0-9\\s\\/&|()\\-–—]{0,55}:\\s*$`,
      'gim'
    ),
    ''
  );
  s = s.replace(/^[•●\-]?\s*[A-Za-z][^:\n]{0,60}:\s*[|–—\-.]+\s*$/gim, '');

  // Pipe-separated segments: drop empty "Label:" parts on the same line
  s = s
    .split('\n')
    .map((line) => {
      if (!line.includes('|')) return line;
      const parts = line
        .split('|')
        .map((p) => p.trim())
        .filter((p) => {
          if (!p) return false;
          if (/^[A-Za-z][^:]{0,50}:\s*$/.test(p)) return false;
          if (/^[:–—\-|.\s]+$/.test(p)) return false;
          // "Drive schedule:" with nothing after colon before next pipe already handled
          if (/^[A-Za-z][^:]{0,50}:\s*[–—\-.]+\s*$/.test(p)) return false;
          return true;
        });
      return parts.join(' | ');
    })
    .join('\n');

  // Orphan section headers when no labeled detail rows follow
  {
    const lines = s.split('\n');
    const kept = [];
    const headerRe = new RegExp(`^(?:${ORPHAN_HEADERS}):\\s*$`, 'i');
    const detailRe = /^(?:[•●\-]\s*)?[A-Za-z][^\n]{0,60}:\s*\S/;
    for (let i = 0; i < lines.length; i += 1) {
      const trimmed = lines[i].trim();
      if (headerRe.test(trimmed)) {
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j += 1;
        const next = (lines[j] || '').trim();
        if (!detailRe.test(next)) continue;
      }
      kept.push(lines[i]);
    }
    s = kept.join('\n');
  }

  // Mid-sentence empty slots
  s = s.replace(/\bfor\s+with\b/gi, 'with');
  s = s.replace(/\bfor\s+at\b/gi, 'at');
  s = s.replace(/\bat\s+with\b/gi, 'with');
  s = s.replace(/\bfor the\s+role\b/gi, 'for this role');
  s = s.replace(/\bfor\s+role\b/gi, 'for this role');
  s = s.replace(/\bthe\s+position\b/gi, 'this position');
  s = s.replace(/\bat\s+([.!,])/g, '$1');
  s = s.replace(/\bwith\s+([.!,])/g, '$1');
  s = s.replace(/\bfor\s+([.!,])/g, '$1');
  s = s.replace(/\s+,\s*,/g, ',');
  s = s.replace(/\(\s*\)/g, '');
  s = s.replace(/\s+[–—]\s*(?=[,.;]|$)/g, '');
  s = s.replace(/[ \t]*\|[ \t]*$/gm, '');
  s = s.replace(/^[ \t]*\|[ \t]*/gm, '');
  s = s.replace(/\|\s*\|/g, '|');

  // Placeholder stand-ins that look unprofessional
  s = s.replace(/^[•●\-]?\s*[A-Za-z][^:\n]{0,60}:\s*(N\/A|NA|TBD|To be (confirmed|decided)|None|-)\s*$/gim, '');

  s = s.replace(/(https?:\/\/[^\s]+?)[?&]+(?=\s|$)/g, '$1');
  s = s.replace(/\b(apply here|apply using the link below):\s*$/gim, '');

  s = s.replace(/[ \t]{2,}/g, ' ');
  s = s.replace(/[ \t]+\n/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

/**
 * Apply {{vars}} then polish. Empty values are omitted (not shown as blanks).
 * @param {string} templateStr
 * @param {Record<string, unknown>} vars
 * @param {{ preserveTokens?: string[], kind?: 'subject'|'body' }} [opts]
 */
function mergeAndPolish(templateStr, vars, opts = {}) {
  let out = String(templateStr || '');
  const preserve = new Set(opts.preserveTokens || []);
  Object.entries(vars || {}).forEach(([key, val]) => {
    if (preserve.has(key)) return;
    const str = typeof val === 'string' ? val.trim() : val == null ? '' : String(val).trim();
    const re = new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, 'g');
    out = out.replace(re, str);
  });
  if (opts.kind === 'subject') return polishMergedSubject(out, { preserveTokens: opts.preserveTokens });
  return polishMergedBody(out, { preserveTokens: opts.preserveTokens });
}

module.exports = {
  polishMergedSubject,
  polishMergedBody,
  mergeAndPolish,
  escapeRegExp,
};
