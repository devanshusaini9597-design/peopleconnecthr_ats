import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, Search, X, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import BASE_API_URL from '../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import Modal from './ui/Modal';
import ConfirmationModal from './ConfirmationModal';
import { formatByFieldName, formatNameForInput } from '../utils/textFormatter';

const PAGE_SIZE = 8;

/**
 * Compact in-context CRUD for organization picklists (Positions, Clients, CTC, etc.)
 * Opens over Add Candidate so recruiters never leave the form.
 */
export default function QuickListManager({
  open,
  onClose,
  title,
  singular = 'item',
  apiEndpoint,
  onChanged,
  seedable = false,
}) {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    if (!apiEndpoint) return;
    setLoading(true);
    setLoadError('');
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}${apiEndpoint}/all`);
      if (isUnauthorized(res)) { handleUnauthorized(); return; }
      if (!res.ok) {
        setRows([]);
        setLoadError(
          res.status === 404
            ? 'This list is not available on the server yet. Dropdowns still use starter values until it is deployed.'
            : `Could not load ${title}. Try again in a moment.`
        );
        return;
      }
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
      setLoadError(`Could not load ${title}. Check your connection and try again.`);
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint, title]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setPage(1);
    setDraft('');
    setEditing(null);
    setLoadError('');
    load();
  }, [open, load]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q
      ? rows
      : rows.filter((r) => `${r.name || ''} ${r.description || ''}`.toLowerCase().includes(q));
    return [...list].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }));
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE;
  const pageEnd = Math.min(safePage * PAGE_SIZE, filtered.length);
  const pageRows = filtered.slice(pageStart, pageEnd);

  const pageNumbers = useMemo(() => {
    const maxButtons = 5;
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safePage <= 3) return [1, 2, 3, 4, 5];
    if (safePage >= totalPages - 2) {
      return Array.from({ length: 5 }, (_, i) => totalPages - 4 + i);
    }
    return [safePage - 2, safePage - 1, safePage, safePage + 1, safePage + 2];
  }, [safePage, totalPages]);

  const resetEditor = () => {
    setEditing(null);
    setDraft('');
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (loadError) {
      toastRef.current.warning('List server is not ready yet — try again after deploy.');
      return;
    }
    const name = formatByFieldName('name', draft);
    if (!name.trim()) {
      toastRef.current.warning('Enter a name');
      return;
    }
    setSaving(true);
    try {
      const url = editing
        ? `${BASE_API_URL}${apiEndpoint}/${editing._id}`
        : `${BASE_API_URL}${apiEndpoint}`;
      const res = await authenticatedFetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: '' }),
      });
      if (isUnauthorized(res)) { handleUnauthorized(); return; }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toastRef.current.error(err.message || 'Could not save');
        return;
      }
      toastRef.current.success(editing ? 'Updated' : 'Added');
      resetEditor();
      await load();
      onChanged?.();
      if (!editing) setPage(1);
    } catch {
      toastRef.current.error('Could not save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}${apiEndpoint}/${deleteTarget._id}`, { method: 'DELETE' });
      if (isUnauthorized(res)) { handleUnauthorized(); return; }
      if (!res.ok) { toastRef.current.error('Could not remove'); return; }
      toastRef.current.success('Removed');
      if (editing?._id === deleteTarget._id) resetEditor();
      setDeleteTarget(null);
      await load();
      onChanged?.();
    } catch {
      toastRef.current.error('Could not remove');
    } finally {
      setDeleting(false);
    }
  };

  const handleSeed = async () => {
    if (!seedable || loadError) return;
    setSeeding(true);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}${apiEndpoint}/seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      if (isUnauthorized(res)) { handleUnauthorized(); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toastRef.current.error(data.message || 'Could not load starter set'); return; }
      toastRef.current.success('Starter set loaded');
      setPage(1);
      await load();
      onChanged?.();
    } catch {
      toastRef.current.error('Could not load starter set');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={title}
        description={`Add, edit, or remove ${singular}s. Changes appear in the dropdown immediately.`}
        size="md"
        zClass="z-[120]"
        footer={(
          <button type="button" onClick={onClose} className="btn-secondary">Done</button>
        )}
      >
        <div className="space-y-3">
          {loadError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <AlertCircle size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-amber-950">List unavailable</p>
                <p className="text-[11px] text-amber-900/80 mt-0.5 leading-relaxed">{loadError}</p>
                <button type="button" onClick={load} className="mt-1.5 text-[11px] font-bold text-brand-700 hover:underline">
                  Retry
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSave} className="flex gap-2">
            <input
              autoFocus={!loadError}
              value={draft}
              onChange={(e) => setDraft(formatNameForInput(e.target.value))}
              placeholder={editing ? `Rename ${singular}` : `New ${singular} name`}
              disabled={!!loadError}
              className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-stone-200 text-sm font-medium outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 disabled:opacity-50 disabled:bg-stone-50"
            />
            {editing && (
              <button type="button" onClick={resetEditor} className="btn-secondary !px-2.5" title="Cancel edit">
                <X size={14} />
              </button>
            )}
            <button type="submit" disabled={saving || !!loadError} className="btn-primary !px-3 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : editing ? 'Save' : <Plus size={14} />}
              <span className="ml-1">{editing ? 'Save' : 'Add'}</span>
            </button>
          </form>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Filter ${title.toLowerCase()}…`}
              disabled={!!loadError}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-200 bg-stone-50/60 text-sm outline-none focus:bg-white focus:border-brand-500 disabled:opacity-50"
            />
          </div>

          <div className="rounded-lg border border-stone-200 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-stone-500">
                <Loader2 size={16} className="animate-spin text-brand-600" /> Loading…
              </div>
            ) : loadError ? (
              <div className="py-8 px-4 text-center text-sm text-stone-500">
                Nothing to show until the list API is available.
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <p className="text-sm font-medium text-stone-700">{query ? 'No matches' : `No ${singular}s yet`}</p>
                <p className="text-xs text-stone-500 mt-1">
                  {query ? 'Try another filter.' : 'Type a name above and click Add.'}
                </p>
                {!query && seedable && (
                  <button type="button" onClick={handleSeed} disabled={seeding} className="btn-secondary mt-3 text-xs disabled:opacity-50">
                    {seeding ? 'Loading…' : 'Load starter set'}
                  </button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {pageRows.map((item) => (
                  <li key={item._id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-stone-50/80">
                    <span className="flex-1 min-w-0 text-sm font-medium text-stone-800 truncate">{item.name}</span>
                    <button
                      type="button"
                      onClick={() => { setEditing(item); setDraft(item.name || ''); }}
                      className="p-1.5 rounded-md text-stone-500 hover:text-brand-700 hover:bg-brand-50"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      className="p-1.5 rounded-md text-stone-500 hover:text-red-600 hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!loading && !loadError && filtered.length > 0 && (
              <div className="border-t border-stone-100 bg-stone-50/70 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-[11px] text-stone-500 font-medium tabular-nums">
                  Showing{' '}
                  <span className="text-stone-800 font-semibold">{pageStart + 1}–{pageEnd}</span>
                  {' '}of{' '}
                  <span className="text-stone-800 font-semibold">{filtered.length}</span>
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, Math.min(p, totalPages) - 1))}
                    disabled={safePage <= 1}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-brand-300 hover:text-brand-700 disabled:opacity-35 disabled:pointer-events-none transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {pageNumbers.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className={`h-8 min-w-[2rem] px-1.5 rounded-lg text-[11px] font-semibold tabular-nums transition-colors ${
                        n === safePage
                          ? 'bg-stone-900 text-white'
                          : 'border border-stone-200 bg-white text-stone-600 hover:border-brand-300 hover:text-brand-700'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, Math.min(p, totalPages) + 1))}
                    disabled={safePage >= totalPages}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-brand-300 hover:text-brand-700 disabled:opacity-35 disabled:pointer-events-none transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Remove ${singular}?`}
        message={`Remove "${deleteTarget?.name}" from ${title}? It will disappear from dropdowns.`}
        confirmText="Remove"
        type="delete"
        isLoading={deleting}
        zClass="z-[130]"
      />
    </>
  );
}
