import React from 'react';
import { createPortal } from 'react-dom';
import { X, History } from 'lucide-react';

function entryAt(h) {
  return h?.updatedAt || h?.changedAt || null;
}

function entryBy(h) {
  return h?.updatedBy || h?.changedBy || 'System';
}

function formatStatus(status) {
  return String(status || '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || 'Unknown';
}

function formatWhen(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const HistoryModal = ({ candidate, onClose }) => {
  const rows = Array.isArray(candidate?.statusHistory)
    ? [...candidate.statusHistory].sort((a, b) => {
        const ta = new Date(entryAt(a) || 0).getTime();
        const tb = new Date(entryAt(b) || 0).getTime();
        return ta - tb;
      })
    : [];

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4" onClick={onClose}>
      <div
        className="bg-white p-5 sm:p-6 rounded-2xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Status history"
      >
        <div className="flex items-start justify-between gap-3 mb-4 border-b border-stone-100 pb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-stone-900">
              <History size={18} className="text-brand-600 flex-shrink-0" />
              <h2 className="text-lg font-bold truncate">Status history</h2>
            </div>
            <p className="text-xs text-stone-500 mt-1 truncate">{candidate?.name || 'Candidate'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {rows.length === 0 ? (
            <p className="text-sm text-stone-500 py-6 text-center">
              No status changes recorded yet. Change this candidate&apos;s status and it will appear here with the date.
            </p>
          ) : (
            rows.map((h, i) => (
              <div key={`${entryAt(h)}-${i}`} className="flex justify-between items-start gap-3 text-sm border-l-4 border-brand-500 pl-3 py-0.5">
                <div className="min-w-0">
                  <p className="font-bold text-brand-800">{formatStatus(h.status)}</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">{formatWhen(entryAt(h))}</p>
                  {h.remark ? (
                    <p className="text-[11px] text-stone-400 mt-0.5 truncate">{h.remark}</p>
                  ) : null}
                </div>
                <span className="text-[11px] bg-stone-100 text-stone-600 px-2 py-1 rounded-md flex-shrink-0 max-w-[40%] truncate">
                  {entryBy(h)}
                </span>
              </div>
            ))
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-800"
        >
          Close
        </button>
      </div>
    </div>,
    document.body
  );
};

export default HistoryModal;
