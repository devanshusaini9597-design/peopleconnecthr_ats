/**
 * Clean merged email subject/body so empty fields never appear as blank labels,
 * leftover {{tokens}}, or awkward "for  at ." prose.
 * Keep in sync with backend/utils/emailMergePolish.js
 */

import { titleCasePhrase } from './emailBodyHtml';

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ORPHAN_HEADERS =
  'Drive details|Drive schedule|Details|Key details|Role details|Interview details|Proposed schedule|Updated schedule|Schedule|Final round details|Job details|Onboarding details';

const EMPTY_SUBJECT_PREFIX =
  'Hiring drive|Job alert|Update|Open role|Open opportunity|New opening|Application update|Opportunity|Career opportunity|A role that may fit your profile|Status update|Interview invitation|Message from recruiting team';

function polishSubjectSegment(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/https?:\/\//i.test(raw)) return raw;
  if (/^[A-Z0-9]+-\d{4}-\d+/i.test(raw)) return raw.toUpperCase();
  if (/[a-z]/.test(raw)) return raw;
  if (/^[\d\s./\-–—:]+$/.test(raw)) return raw;
  return titleCasePhrase(raw);
}

export function polishMergedSubject(subject, opts = {}) {
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

  if (
    !s ||
    /^[:–—\-|]+$/i.test(s) ||
    new RegExp(`^(?:${EMPTY_SUBJECT_PREFIX})\\s*:?$`, 'i').test(s)
  ) {
    return preserve.size ? s || 'Career opportunity' : 'Career opportunity';
  }

  s = s
    .split(' | ')
    .map((part) => {
      const m = part.match(/^([^:–—-]+?)(\s*[:–—-]\s*)(.+)$/);
      if (m) {
        return `${m[1]}${m[2]}${polishSubjectSegment(m[3])}`;
      }
      return polishSubjectSegment(part) || part;
    })
    .join(' | ');

  s = s.replace(/\s{2,}/g, ' ').trim();
  if (!s || new RegExp(`^(?:${EMPTY_SUBJECT_PREFIX})\\s*:?$`, 'i').test(s)) {
    return 'Career opportunity';
  }
  return s;
}

export function polishMergedBody(body, opts = {}) {
  const preserve = new Set(
    (opts.preserveTokens || []).map((t) => String(t || '').trim()).filter(Boolean)
  );
  let s = String(body || '');

  s = s.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => (preserve.has(key) ? `{{${key}}}` : ''));

  s = s.replace(/^[•●\-]\s*[A-Za-z][^:\n]{0,60}:\s*$/gim, '');
  s = s.replace(
    new RegExp(
      `^(?!(?:${ORPHAN_HEADERS}):\\s*$)[A-Za-z][A-Za-z0-9\\s\\/&|()\\-–—]{0,55}:\\s*$`,
      'gim'
    ),
    ''
  );
  s = s.replace(/^[•●\-]?\s*[A-Za-z][^:\n]{0,60}:\s*[|–—\-.]+\s*$/gim, '');

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

  s = s.replace(/^[•●\-]?\s*[A-Za-z][^:\n]{0,60}:\s*(N\/A|NA|TBD|To be (confirmed|decided)|None|-)\s*$/gim, '');

  s = s.replace(/(https?:\/\/[^\s]+?)[?&]+(?=\s|$)/g, '$1');
  s = s.replace(/\b(apply here|apply using the link below):\s*$/gim, '');
  s = s.replace(/\breply to this email or(?:\s+apply using the link below:?)?\s*$/gim, 'reply to this email.');
  s = s.replace(/\bor apply using the link below:?\s*$/gim, '.');
  s = s.replace(/\bor use the (?:button|link) below(?: to apply)?\.?\s*$/gim, '.');
  s = s.replace(/\s+or\s*$/gm, '.');
  s = s.replace(/\.\s*\./g, '.');
  s = s.replace(/^Dear\s*(there)?\s*,?\s*$/gim, 'Dear Candidate,');
  s = s.replace(/^Dear\s+there\s*,?/gim, 'Dear Candidate,');

  s = s.replace(/[ \t]{2,}/g, ' ');
  s = s.replace(/[ \t]+\n/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

export function mergeAndPolish(templateStr, vars, opts = {}) {
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
