/**
 * Stage-wise note helpers — strip legacy "[Stage] …" concat and build history.
 */

/** Remove unprofessional "[StageName]" prefixes from note bodies. */
export function cleanStageNoteText(text) {
  return String(text || '')
    .replace(/(^|[\n\r]+)\s*\[[^\]]+\]\s*/g, (_, br) => (br ? '\n' : ''))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Split legacy concatenated feedback like:
 *   testing
 *   [Shortlisted] checking
 * into [{ stage, note }, …]
 */
export function parseTaggedStageNotes(feedback, { fallbackStage = 'General', updatedAt, updatedByName } = {}) {
  const raw = String(feedback || '').trim();
  if (!raw) return [];

  const tagRe = /\[([^\]]+)\]\s*/g;
  const matches = [...raw.matchAll(tagRe)];
  if (!matches.length) {
    return [{
      stage: fallbackStage,
      note: raw,
      updatedAt: updatedAt || undefined,
      updatedByName: updatedByName || undefined,
    }];
  }

  const entries = [];
  const firstIdx = matches[0].index ?? 0;
  if (firstIdx > 0) {
    const preamble = raw.slice(0, firstIdx).trim();
    if (preamble) {
      const firstTag = String(matches[0][1] || '').trim();
      entries.push({
        stage: fallbackStage && fallbackStage.toLowerCase() !== firstTag.toLowerCase()
          ? fallbackStage
          : 'Applied',
        note: preamble,
        updatedAt: updatedAt || undefined,
        updatedByName: updatedByName || undefined,
      });
    }
  }

  for (let i = 0; i < matches.length; i += 1) {
    const stage = String(matches[i][1] || '').trim() || fallbackStage;
    const start = (matches[i].index ?? 0) + matches[i][0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? raw.length) : raw.length;
    const note = raw.slice(start, end).trim();
    if (!note) continue;
    entries.push({
      stage,
      note,
      updatedAt: updatedAt || undefined,
      updatedByName: updatedByName || undefined,
    });
  }

  return entries;
}

function expandStoredNotes(list, currentStageLabel = '') {
  const expanded = [];
  for (const n of list) {
    const raw = String(n.note || '');
    if (!raw.trim()) continue;
    const meta = {
      fallbackStage: String(n.stage || currentStageLabel || 'Stage').trim() || 'Stage',
      updatedAt: n.updatedAt,
      updatedByName: n.updatedByName,
    };
    if (/\[[^\]]+\]/.test(raw)) {
      expanded.push(
        ...parseTaggedStageNotes(raw, meta).map((e) => ({
          ...e,
          note: cleanStageNoteText(e.note),
        }))
      );
    } else {
      const note = cleanStageNoteText(raw);
      if (note) {
        expanded.push({
          stage: meta.fallbackStage,
          note,
          updatedAt: n.updatedAt,
          updatedByName: n.updatedByName,
        });
      }
    }
  }
  return expanded;
}

/** Prefer latest note per stage label (case-insensitive). */
function dedupeByStage(entries) {
  const map = new Map();
  for (const e of entries) {
    const key = String(e.stage || '').toLowerCase();
    const prev = map.get(key);
    if (!prev) {
      map.set(key, e);
      continue;
    }
    const prevT = new Date(prev.updatedAt || 0).getTime();
    const nextT = new Date(e.updatedAt || 0).getTime();
    if (nextT >= prevT) map.set(key, e);
  }
  return [...map.values()];
}

/** Full stage history for the Notes modal (newest first). */
export function resolveStageNotesHistory(row, currentStageLabel = '') {
  const list = Array.isArray(row?.stageNotes) ? [...row.stageNotes] : [];
  let entries = list.length
    ? expandStoredNotes(list, currentStageLabel)
    : parseTaggedStageNotes(row?.feedback, {
      fallbackStage: currentStageLabel || 'General',
      updatedAt: row?.reviewedAt || row?.updatedAt,
    }).map((n) => ({ ...n, note: cleanStageNoteText(n.note) }));

  entries = dedupeByStage(entries.filter((n) => n.note));
  return entries.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
}

/** Clean note text for one stage (current-stage edit / freelancer view). */
export function pickCleanStageNote(row, stageLabel) {
  const want = String(stageLabel || '').trim().toLowerCase();
  const history = resolveStageNotesHistory(row, stageLabel);
  if (!history.length) return '';

  if (want) {
    const hit = history.find((s) => String(s.stage || '').toLowerCase() === want);
    if (hit) return cleanStageNoteText(hit.note);
    return '';
  }

  return cleanStageNoteText(history[0]?.note || '');
}

/** Soft badge tone by stage name. */
export function stageBadgeTone(stage) {
  const k = String(stage || '').toLowerCase();
  if (/reject|drop|declin/.test(k)) return 'border-red-200 bg-red-50 text-red-800';
  if (/hire|join|offer|select/.test(k)) return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (/short/.test(k)) return 'border-teal-200 bg-teal-50 text-teal-900';
  if (/screen|interview|review|pending/.test(k)) return 'border-sky-200 bg-sky-50 text-sky-900';
  if (/appl|sourc|submit|general|earlier/.test(k)) return 'border-stone-200 bg-stone-100 text-stone-700';
  return 'border-brand-200 bg-brand-50 text-brand-900';
}
