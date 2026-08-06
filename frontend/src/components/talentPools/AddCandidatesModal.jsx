import React, { useState, useEffect } from 'react';
import { Search, Loader2, CheckSquare, Square, UserPlus } from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../../utils/fetchUtils';
import { useToast } from '../Toast';
import Modal from '../ui/Modal';

export const AddCandidatesModal = ({ pool, open, onClose, onAdded }) => {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setSelected(new Set());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handle = setTimeout(async () => {
      if (!query.trim()) { setResults([]); return; }
      setSearching(true);
      try {
        const res = await authenticatedFetch(`/candidates?search=${encodeURIComponent(query.trim())}&limit=15`);
        const data = await readApiJson(res);
        if (data.success) setResults(data.data || []);
      } catch {
        toast?.error?.('Could not search candidates');
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [query, open, toast]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setAdding(true);
    try {
      const res = await authenticatedFetch(`/api/talent-pools/${pool._id}/candidates`, {
        method: 'POST',
        body: JSON.stringify({ candidateIds: Array.from(selected) }),
      });
      const data = await readApiJson(res);
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to add candidates');
        return;
      }
      toast?.success?.(data.message || 'Candidates added');
      onAdded();
      onClose();
    } catch {
      toast?.error?.('Failed to add candidates');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Add candidates to “${pool.name}”`}
      description="Search and select candidates to keep warm in this pool."
      size="lg"
      footer={(
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="button" onClick={handleAdd} disabled={adding || selected.size === 0} className="btn-primary">
            {adding
              ? <><Loader2 size={16} className="animate-spin" /> Adding…</>
              : `Add ${selected.size || ''} candidate${selected.size === 1 ? '' : 's'}`}
          </button>
        </>
      )}
    >
      <div className="relative mb-4">
        <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, or skills…"
          className="input-ats input-ats-icon"
          autoFocus
        />
      </div>
      <div className="max-h-72 overflow-y-auto -mx-1 px-1">
        {searching ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-brand-600 animate-spin" /></div>
        ) : results.length === 0 ? (
          <EmptyState
            icon={query ? Search : Users}
            tone={query ? 'amber' : 'brand'}
            compact
            message={query ? 'No candidates found' : 'Search candidates'}
            subMessage={query ? 'Try a different name or email.' : 'Start typing to search your candidates.'}
          />
        ) : (
          <div className="space-y-0.5 stagger-children">
            {results.map((c) => {
              const isSelected = selected.has(c._id);
              return (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => toggle(c._id)}
                  className={`w-full list-row-ats text-left ${isSelected ? 'bg-brand-50/80' : ''}`}
                >
                  <span className="flex-shrink-0">
                    {isSelected
                      ? <CheckSquare size={17} className="text-brand-600" />
                      : <Square size={17} className="text-stone-300" />}
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {(c.name || 'N')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-stone-900 truncate flex items-center gap-2">
                      {c.name}
                      {c.talentPoolConsent?.optedIn === false && (
                        <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-50 text-red-600">Opted out</span>
                      )}
                      {c.talentPoolConsent?.optedIn === true && (
                        <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">Consent</span>
                      )}
                    </div>
                    <div className="text-xs text-stone-500 break-all">{c.email}{c.position ? ` · ${c.position}` : ''}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};
