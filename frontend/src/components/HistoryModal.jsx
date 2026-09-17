import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, History, Loader2 } from 'lucide-react';
import BASE_API_URL from '../config';
import { authenticatedFetch } from '../utils/fetchUtils';
import useModalLayer from '../hooks/useModalLayer';

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
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function sortHistory(list) {
  return [...list].sort((a, b) => {
    const ta = new Date(entryAt(a) || 0).getTime();
    const tb = new Date(entryAt(b) || 0).getTime();
    return ta - tb;
  });
}

/**
 * Status history overlay — must sit above the edit-candidate modal (z-100).
 */
const HistoryModal = ({ candidate, candidateId, onClose }) => {
  useModalLayer(true);
  const [rows, setRows] = useState(() => (
    Array.isArray(candidate?.statusHistory) ? sortHistory(candidate.statusHistory) : []
  ));
  const [loading, setLoading] = useState(Boolean(candidateId));
  const [error, setError] = useState('');
  const displayName = candidate?.name || 'Candidate';

  useEffect(() => {
    let cancelled = false;
    const id = candidateId || candidate?._id;
    if (!id) {
      setLoading(false);
      return undefined;
    }

    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await authenticatedFetch(`${BASE_API_URL}/candidates/${id}`);
        if (!res.ok) throw new Error('Could not load status history');
        const data = await res.json();
        const hist = Array.isArray(data?.statusHistory) ? data.statusHistory : [];
        if (!cancelled) setRows(sortHistory(hist));
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load status history');
          if (Array.isArray(candidate?.statusHistory)) {
            setRows(sortHistory(candidate.statusHistory));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [candidateId, candidate?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-stone-900/55 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white p-5 sm:p-6 rounded-2xl w-full max-w-md shadow-2xl border border-stone-200/70"
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
            <p className="text-xs text-stone-500 mt-1 truncate">{displayName}</p>
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

        <div className="space-y-3 max-h-72 overflow-y-auto pr-1 min-h-[6rem]">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-stone-500">
              <Loader2 size={22} className="animate-spin text-brand-600" />
              <p className="text-sm font-medium">Loading history…</p>
            </div>
          ) : error && rows.length === 0 ? (
            <p className="text-sm text-rose-600 py-6 text-center">{error}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-stone-500 py-6 text-center">
              No status changes recorded yet. When this candidate’s stage changes, each change will appear here with date and user.
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
