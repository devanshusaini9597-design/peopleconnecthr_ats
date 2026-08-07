import React, { useState, useEffect } from 'react';
import { Send, Loader2, Search } from 'lucide-react';
import { authenticatedFetch } from '../../utils/fetchUtils';
import { useToast } from '../Toast';
import Modal from '../ui/Modal';

export const InviteModal = ({ assessment, open, onClose, onSent }) => {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handle = setTimeout(async () => {
      if (!query.trim()) { setResults([]); return; }
      try {
        const res = await authenticatedFetch(`/candidates?search=${encodeURIComponent(query.trim())}&limit=10`);
        const data = await res.json();
        if (data.success) setResults(data.data || []);
      } catch { /* best-effort */ }
    }, 350);
    return () => clearTimeout(handle);
  }, [query, open]);

  const handleInvite = async (candidate) => {
    setSending(true);
    try {
      const res = await authenticatedFetch(`/api/assessments/${assessment._id}/invite`, {
        method: 'POST',
        body: JSON.stringify({ candidateId: candidate._id })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to send invite');
        return;
      }
      toast?.success?.(`Invite sent to ${candidate.name}`);
      onSent();
      onClose();
    } catch {
      toast?.error?.('Failed to send invite');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite a candidate"
      description={`Send “${assessment.title}” to a candidate in your database.`}
      size="md"
    >
      <div className="relative">
        <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search candidates…"
          className="input-ats input-ats-icon"
          autoFocus
        />
      </div>
      <div className="mt-3 max-h-64 overflow-y-auto space-y-0.5">
        {results.length === 0 ? (
          <EmptyState
            icon={Search}
            tone={query ? 'amber' : 'sky'}
            compact
            message={query ? 'No candidates found' : 'Search candidates'}
            subMessage={query ? 'Try a different name or email.' : 'Start typing a name or email.'}
          />
        ) : results.map((c) => (
          <button
            key={c._id}
            type="button"
            onClick={() => handleInvite(c)}
            disabled={sending}
            className="list-row-ats w-full text-left justify-between disabled:opacity-50"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {(c.name || 'N')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-stone-900 truncate">{c.name}</div>
                <div className="text-xs text-stone-500 truncate">{c.email}</div>
              </div>
            </div>
            {sending ? <Loader2 className="w-4 h-4 text-brand-600 animate-spin" /> : <Send className="w-4 h-4 text-brand-600" />}
          </button>
        ))}
      </div>
    </Modal>
  );
};
