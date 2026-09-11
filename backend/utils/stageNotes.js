/**
 * Parse legacy feedback blobs that used "[Stage] note" concatenation
 * into structured stageNotes entries (backend).
 */
function parseTaggedStageNotes(feedback, { fallbackStage = 'General', updatedAt, updatedBy, updatedByName } = {}) {
  const raw = String(feedback || '').trim();
  if (!raw) return [];

  const tagRe = /\[([^\]]+)\]\s*/g;
  const matches = [...raw.matchAll(tagRe)];
  if (!matches.length) {
    return [{
      stage: String(fallbackStage || 'General').slice(0, 80),
      note: raw.slice(0, 4000),
      updatedAt: updatedAt || undefined,
      updatedBy: updatedBy || undefined,
      updatedByName: updatedByName || '',
    }];
  }

  const entries = [];
  const firstIdx = matches[0].index ?? 0;
  if (firstIdx > 0) {
    const preamble = raw.slice(0, firstIdx).trim();
    if (preamble) {
      const firstTag = String(matches[0][1] || '').trim();
      const stage = fallbackStage && String(fallbackStage).toLowerCase() !== firstTag.toLowerCase()
        ? fallbackStage
        : 'Applied';
      entries.push({
        stage: String(stage).slice(0, 80),
        note: preamble.slice(0, 4000),
        updatedAt: updatedAt || undefined,
        updatedBy: updatedBy || undefined,
        updatedByName: updatedByName || '',
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
      stage: String(stage).slice(0, 80),
      note: note.slice(0, 4000),
      updatedAt: updatedAt || undefined,
      updatedBy: updatedBy || undefined,
      updatedByName: updatedByName || '',
    });
  }

  return entries;
}

/**
 * Build next stageNotes list: preserve prior stages, upsert current.
 * Seeds from legacy flat feedback when stageNotes is empty so history is not wiped.
 */
function upsertStageNote(existingDoc, { stageKey, noteText, user }) {
  let list = Array.isArray(existingDoc.stageNotes)
    ? existingDoc.stageNotes.map((n) => (n.toObject ? n.toObject() : { ...n }))
    : [];

  if (!list.length && existingDoc.feedback) {
    list = parseTaggedStageNotes(existingDoc.feedback, {
      fallbackStage: stageKey || 'General',
      updatedAt: existingDoc.reviewedAt || existingDoc.updatedAt || new Date(),
      updatedBy: existingDoc.reviewedBy,
      updatedByName: '',
    });
  }

  // Expand any stored note that still contains "[Stage]" tags
  const expanded = [];
  for (const n of list) {
    const raw = String(n.note || '');
    if (/\[[^\]]+\]/.test(raw)) {
      expanded.push(...parseTaggedStageNotes(raw, {
        fallbackStage: n.stage || stageKey || 'General',
        updatedAt: n.updatedAt,
        updatedBy: n.updatedBy,
        updatedByName: n.updatedByName,
      }));
    } else if (raw.trim()) {
      expanded.push(n);
    }
  }
  list = expanded;

  const entry = {
    stage: String(stageKey || '').slice(0, 80),
    note: String(noteText || '').trim().slice(0, 4000),
    updatedAt: new Date(),
    updatedBy: user.id,
    updatedByName: user.name || user.email || '',
  };

  const idx = list.findIndex(
    (n) => String(n.stage || '').toLowerCase() === String(stageKey || '').toLowerCase()
  );
  if (idx >= 0) list[idx] = { ...list[idx], ...entry };
  else if (stageKey) list.push(entry);

  // Dedupe by stage (keep latest updatedAt)
  const map = new Map();
  for (const n of list) {
    const key = String(n.stage || '').toLowerCase();
    const prev = map.get(key);
    if (!prev || new Date(n.updatedAt || 0) >= new Date(prev.updatedAt || 0)) {
      map.set(key, n);
    }
  }
  return [...map.values()].slice(-40);
}

module.exports = {
  parseTaggedStageNotes,
  upsertStageNote,
};
