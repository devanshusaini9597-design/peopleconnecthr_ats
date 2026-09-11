import React, { useEffect, useMemo, useState } from 'react';
import { GitMerge, Loader2, X } from 'lucide-react';

export default function DedupeModal({
  open,
  dedupeResults,
  onClose,
  onMerge,
  merging = false,
}) {
  const groups = dedupeResults?.groups || [];
  const [keepByGroup, setKeepByGroup] = useState({});

  useEffect(() => {
    if (!open) return;
    const initial = {};
    groups.forEach((g, gi) => {
      const firstId = g.members?.[0]?._id;
      if (firstId) initial[gi] = String(firstId);
    });
    setKeepByGroup(initial);
  }, [open, dedupeResults]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalMembers = useMemo(
    () => groups.reduce((n, g) => n + (g.members?.length || 0), 0),
    [groups]
  );

  if (!open) return null;

  const handleMergeGroup = (gi) => {
    const group = groups[gi];
    if (!group?.members?.length || !onMerge) return;
    const keepId = keepByGroup[gi] || String(group.members[0]._id);
    const dropIds = group.members
      .map((m) => String(m._id))
      .filter((id) => id !== String(keepId));
    if (!dropIds.length) return;
    onMerge({ keepId, dropIds, groupIndex: gi });
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
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <div>
            <h3 className="text-lg font-bold text-stone-900">Likely duplicates</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Matched by email, phone, or similar name. Pick who to keep, then merge.
            </p>
          </div>
          <button
            type="button"
            disabled={merging}
            onClick={() => onClose()}
            className="p-2 rounded-lg hover:bg-stone-100 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {groups.length ? (
            groups.map((group, gi) => (
              <div key={gi} className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-xs font-semibold text-amber-800">
                    Group {gi + 1} · {group.members.length} candidates
                  </p>
                  <button
                    type="button"
                    disabled={merging || group.members.length < 2}
                    onClick={() => handleMergeGroup(gi)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-xs font-semibold px-3 py-1.5 hover:bg-brand-700 disabled:opacity-50"
                  >
                    {merging ? <Loader2 size={14} className="animate-spin" /> : <GitMerge size={14} />}
                    Merge into keep
                  </button>
                </div>
                <ul className="space-y-2">
                  {group.members.map((m) => {
                    const id = String(m._id);
                    const selected = String(keepByGroup[gi] || '') === id;
                    return (
                      <li
                        key={id}
                        className={`rounded-lg border px-3 py-2.5 flex flex-wrap items-start gap-3 ${
                          selected ? 'border-brand-300 bg-white' : 'border-stone-200/80 bg-white/60'
                        }`}
                      >
                        <label className="flex items-start gap-2.5 cursor-pointer min-w-0 flex-1">
                          <input
                            type="radio"
                            name={`dedupe-keep-${gi}`}
                            className="mt-1"
                            checked={selected}
                            disabled={merging}
                            onChange={() => setKeepByGroup((prev) => ({ ...prev, [gi]: id }))}
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-stone-900">{m.name || '—'}</span>
                            <span className="block text-xs text-stone-500 break-all">{m.email || '—'}</span>
                            <span className="block text-xs text-stone-500">
                              {(m.contact || m.phone || '—')
                                + (m.position ? ` · ${m.position}` : '')}
                            </span>
                          </span>
                        </label>
                        {selected && (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
                            Keep
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
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
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
