import React from 'react';
import { Search, X, Users, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';

export default function SequenceEnrollModal({
  open,
  onClose,
  sequenceName,
  candidateQuery,
  candidates,
  selectedCandidates,
  setSelectedCandidates,
  onSearch,
  onEnroll,
  enrolling,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enroll candidates"
      description={
        sequenceName
          ? `Add people to “${sequenceName}”.`
          : 'Search and select candidates to enroll.'
      }
      size="md"
      closeOnBackdrop={!enrolling}
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={enrolling}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={enrolling || selectedCandidates.size === 0}
            onClick={onEnroll}
          >
            {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            Enroll {selectedCandidates.size || ''}
          </button>
        </>
      )}
    >
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            className="input-ats !pl-10 !pr-9"
            value={candidateQuery}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search candidates by name or email…"
            aria-label="Search candidates"
          />
          {candidateQuery && (
            <button
              type="button"
              onClick={() => onSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-stone-200/80 bg-stone-50/40 max-h-64 overflow-y-auto overscroll-contain">
          {!candidateQuery ? (
            <p className="text-sm text-stone-400 text-center py-10 px-4">
              Type a name or email to find candidates.
            </p>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-stone-500 text-center py-10 px-4">No candidates found</p>
          ) : (
            candidates.map((c) => {
              const id = c._id || c.id;
              const checked = selectedCandidates.has(id);
              return (
                <label
                  key={id}
                  className={`flex items-center gap-3 px-3 py-2.5 border-b border-stone-100/80 cursor-pointer transition-colors ${
                    checked ? 'bg-brand-50/70' : 'hover:bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelectedCandidates((prev) => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      });
                    }}
                    className="rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-stone-800 truncate">{c.name}</span>
                    <span className="block text-xs text-stone-500 truncate">{c.email}</span>
                  </span>
                </label>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
