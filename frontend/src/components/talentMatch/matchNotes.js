/** Compact, readable match notes for Suggested talent rows. */

export const MATCH_TONE_DOT = {
  fit: 'bg-emerald-500',
  partial: 'bg-amber-400',
  gap: 'bg-stone-300',
};

export function matchNotePresentation(row) {
  const ai = String(row?.aiReason || '').trim();
  const full = String(row?.why || row?.brief || ai || '').trim();
  const factors = Array.isArray(row?.factors) ? row.factors : [];

  if (ai) {
    return {
      kind: 'ai',
      lines: [{ label: 'Summary', text: ai.length > 140 ? `${ai.slice(0, 137)}…` : ai, tone: 'fit' }],
      full: ai,
    };
  }

  if (factors.length) {
    const lines = factors.slice(0, 3).map((factor) => {
      const ratio = factor.max ? factor.earned / factor.max : 0;
      const raw = String(factor.detail || '').replace(/\s+/g, ' ').trim();
      let text = raw.split(/(?<=\.)\s/)[0] || raw;
      if (/Matched /i.test(text) && /\.\s*Missing /i.test(raw)) {
        text = raw.replace(/\.\s*Missing .*/i, '');
      }
      if (text.length > 88) text = `${text.slice(0, 85)}…`;
      const tone = ratio >= 0.7 ? 'fit' : ratio >= 0.4 ? 'partial' : 'gap';
      return {
        label: factor.label,
        text: text || (tone === 'fit' ? 'Strong fit' : tone === 'partial' ? 'Partial fit' : 'Needs review'),
        tone,
      };
    });
    return { kind: 'factors', lines, full: full || lines.map((l) => `${l.label}: ${l.text}`).join(' · ') };
  }

  const brief = String(row?.brief || '').trim();
  if (brief) {
    const parts = brief.split(' · ').filter(Boolean).slice(0, 3);
    return {
      kind: 'brief',
      lines: parts.map((text) => ({ label: '', text, tone: 'partial' })),
      full: full || brief,
    };
  }

  const parts = full.split(' · ').filter(Boolean).slice(0, 3).map((part) => {
    const idx = part.indexOf(':');
    if (idx > 0) {
      return {
        label: part.slice(0, idx).trim(),
        text: part.slice(idx + 1).trim().slice(0, 64),
        tone: 'partial',
      };
    }
    return { label: '', text: part.slice(0, 72), tone: 'partial' };
  });

  if (!parts.length) {
    return {
      kind: 'empty',
      lines: [{ label: '', text: 'Ranked from role, experience, location, and skills.', tone: 'partial' }],
      full: 'Ranked from role, experience, location, and skills.',
    };
  }

  return { kind: 'why', lines: parts, full };
}
