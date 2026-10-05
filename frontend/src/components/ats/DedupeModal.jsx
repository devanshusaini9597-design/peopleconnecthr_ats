import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GitMerge, Loader2, X } from 'lucide-react';

function formatCandidateDate(m) {
  const raw = m?.appliedAt || m?.date || m?.createdAt;
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function groupStableKey(group, gi) {
  return String(group?.key || group?.members?.[0]?._id || gi);
}

export default function DedupeModal({
  open,
  dedupeResults,
  onClose,
  onMerge,
  merging = false,
  mergingDropId = null,
}) {
  const groups = dedupeResults?.groups || [];
  const [keepByGroup, setKeepByGroup] = useState({});
  const wasOpenRef = useRef(false);

  // Seed Keep radios only when the modal opens — never after a one-by-one merge.
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      setKeepByGroup({});
      return;
    }
    if (!wasOpenRef.current) {
      const initial = {};
      (dedupeResults?.groups || []).forEach((g, gi) => {
        const gk = groupStableKey(g, gi);
        const firstId = g.members?.[0]?._id;
        if (firstId) initial[gk] = String(firstId);
      });
      setKeepByGroup(initial);
    }
    wasOpenRef.current = true;
  }, [open, dedupeResults]);

  // After a merge removes members, fix Keep only for groups whose selection disappeared.
  useEffect(() => {
    if (!open || !groups.length) return;
    setKeepByGroup((prev) => {
      let changed = false;
      const next = { ...prev };
      const alive = new Set(groups.map((g, gi) => groupStableKey(g, gi)));

      groups.forEach((g, gi) => {
        const gk = groupStableKey(g, gi);
        const memberIds = new Set((g.members || []).map((m) => String(m._id)));
        if (next[gk] && !memberIds.has(String(next[gk]))) {
          next[gk] = String(g.members[0]._id);
          changed = true;
        } else if (!next[gk] && g.members?.[0]?._id) {
          next[gk] = String(g.members[0]._id);
          changed = true;
        }
      });

      Object.keys(next).forEach((k) => {
        if (!alive.has(k)) {
          delete next[k];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [open, groups]);

  const totalMembers = useMemo(
    () => groups.reduce((n, g) => n + (g.members?.length || 0), 0),
    [groups]
  );

  if (!open) return null;

  const handleMergeOne = (gi, dropId) => {
    const group = groups[gi];
    if (!group?.members?.length || !onMerge || !dropId) return;
    const gk = groupStableKey(group, gi);
    const keepId = keepByGroup[gk] || String(group.members[0]._id);
    if (String(dropId) === String(keepId)) return;
    onMerge({ keepId, dropIds: [String(dropId)], groupIndex: gi });
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-900/55 backdrop-blur-sm p-4"
      onClick={() => !merging && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-stone-100">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-stone-900">Likely duplicates</h3>
            <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
              Scanned your full candidate database by matching email or phone.
              Choose who to keep, then merge <span className="font-semibold text-stone-700">one record at a time</span>.
            </p>
          </div>
          <button
            type="button"
            disabled={merging}
            onClick={() => onClose()}
            className="p-2 rounded-lg hover:bg-stone-100 disabled:opacity-50 shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {groups.length ? (
            groups.map((group, gi) => {
              const gk = groupStableKey(group, gi);
              const keepId = String(keepByGroup[gk] || group.members?.[0]?._id || '');
              return (
                <div key={gk} className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                  <p className="text-xs font-semibold text-amber-800 mb-3">
                    Group {gi + 1} · {group.members.length} candidates
                    <span className="font-medium text-amber-700/80"> · merge one into Keep</span>
                  </p>
                  <ul className="space-y-2">
                    {group.members.map((m) => {
                      const id = String(m._id);
                      const selected = keepId === id;
                      const thisMerging = merging && String(mergingDropId || '') === id;
                      const dateLabel = formatCandidateDate(m);
                      return (
                        <li
                          key={id}
                          className={`rounded-lg border px-3 py-2.5 flex flex-wrap items-center gap-3 transition-opacity ${
                            thisMerging ? 'opacity-70' : ''
                          } ${
                            selected ? 'border-brand-300 bg-white shadow-sm' : 'border-stone-200/80 bg-white/70'
                          }`}
                        >
                          <label className="flex items-start gap-2.5 cursor-pointer min-w-0 flex-1">
                            <input
                              type="radio"
                              name={`dedupe-keep-${gk}`}
                              className="mt-1"
                              checked={selected}
                              disabled={merging}
                              onChange={() => setKeepByGroup((prev) => ({ ...prev, [gk]: id }))}
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-stone-900">{m.name || '—'}</span>
                              <span className="block text-xs text-stone-500 break-all">{m.email || '—'}</span>
                              <span className="block text-xs text-stone-500">
                                {(m.contact || m.phone || '—')
                                  + (m.position ? ` · ${m.position}` : '')}
                              </span>
                              <span className="block text-xs text-stone-500 tabular-nums mt-0.5" title="Date added / first applied in ATS">
                                Date · {dateLabel}
                              </span>
                            </span>
                          </label>
                          {selected ? (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-full">
                              Keep
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={merging || !keepId}
                              onClick={() => handleMergeOne(gi, id)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 text-brand-800 text-xs font-semibold px-2.5 py-1.5 hover:bg-brand-100 disabled:opacity-50 shrink-0"
                              title="Merge this record into the Keep candidate"
                            >
                              {thisMerging ? <Loader2 size={13} className="animate-spin" /> : <GitMerge size={13} />}
                              Merge into keep
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-stone-500 text-center py-8">No duplicate groups found.</p>
          )}
        </div>

        <div className="px-5 py-3 border-t border-stone-100 flex items-center justify-between gap-3">
          <p className="text-xs text-stone-500">
            {groups.length
              ? `${groups.length} group${groups.length === 1 ? '' : 's'} · ${totalMembers} records`
              : 'Nothing to merge'}
          </p>
          <button type="button" disabled={merging} onClick={() => onClose()} className="btn-secondary">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
