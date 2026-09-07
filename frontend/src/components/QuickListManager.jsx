import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Pencil, Trash2, Loader2, Search, X, ChevronLeft, ChevronRight,
  AlertCircle, ListTree, Sparkles, Lock, Info,
} from 'lucide-react';
import BASE_API_URL from '../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { fetchPicklistPage, PICKLIST_MIN_SEARCH } from '../utils/orgListFetch';
import { useToast } from './Toast';
import Modal from './ui/Modal';
import ConfirmationModal from './ConfirmationModal';
import { formatByFieldName, formatNameForInput } from '../utils/textFormatter';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 20;
const EMPTY_NAMES = [];

/**
 * Compact in-context CRUD for organization picklists (Positions, Clients, CTC, etc.)
 * Opens over Add Candidate so recruiters never leave the form.
 * Freelancers may edit/delete only values they created; company library is read-only.
 */
export default function QuickListManager({
  open,
  onClose,
  title,
  singular = 'item',
  apiEndpoint,
  onChanged,
  seedable = false,
  icon: IconProp,
  supportsRequiresPan = false,
  extraNames = EMPTY_NAMES,
}) {
  const toast = useToast();
  const { user } = useAuth();
  const isFreelancer = user?.role === 'freelancer';
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const Icon = IconProp || ListTree;
  const loadRequestRef = useRef(0);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState('');
  const [draftRequiresPan, setDraftRequiresPan] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const extraNamesKey = (Array.isArray(extraNames) ? extraNames : EMPTY_NAMES).join('\0');
  const extraNamesRef = useRef(extraNames);
  extraNamesRef.current = extraNames;
  const queryRef = useRef(query);
  queryRef.current = query;
  const pageRef = useRef(page);
  pageRef.current = page;

  if (!open && (query !== '' || page !== 1)) {
    setQuery('');
    setPage(1);
  }

  const load = useCallback(async () => {
    if (!apiEndpoint) return;
    const requestId = ++loadRequestRef.current;
    const q = queryRef.current.trim();
    const pageNum = pageRef.current;
    const searchQ = q.length >= PICKLIST_MIN_SEARCH ? q : '';
    setLoading(true);
    setLoadError('');
    try {
      const data = await fetchPicklistPage(apiEndpoint, {
        q: searchQ,
        page: pageNum,
        limit: PAGE_SIZE,
      });
      if (requestId !== loadRequestRef.current) return;
      setRows(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total) || 0);
    } catch (err) {
      if (requestId !== loadRequestRef.current) return;
      setRows([]);
      setTotal(0);
      setLoadError(
        err.status === 404
          ? 'This list is not available on the server yet. Dropdowns still use starter values until it is deployed.'
          : `Could not load ${title}. Try again in a moment.`
      );
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [apiEndpoint, title]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!open) return undefined;
    setDraft('');
    setEditing(null);
    setDraftRequiresPan(false);
    setLoadError('');
    return () => {
      loadRequestRef.current += 1;
    };
  }, [open, apiEndpoint, extraNamesKey]);

  useEffect(() => {
    if (!open) return undefined;
    const q = query.trim();
    if (q.length === 1) return undefined;
    const delay = q.length >= PICKLIST_MIN_SEARCH ? 280 : 0;
    const t = setTimeout(() => loadRef.current(), delay);
    return () => clearTimeout(t);
  }, [open, query, page, apiEndpoint]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const have = new Set((rows || []).map((r) => String(r.name || '').trim().toUpperCase()));
    const extras = q.length >= PICKLIST_MIN_SEARCH
      ? (extraNames || [])
          .map((n) => String(n || '').trim().toUpperCase())
          .filter((n) => n && !have.has(n) && n.toLowerCase().includes(q))
          .slice(0, PAGE_SIZE)
          .map((name) => ({ _id: `catalog:${name}`, name, catalog: true }))
      : [];
    return [...rows, ...extras];
  }, [rows, query, extraNames]);

  const searchPending = query.trim().length === 1;
  const totalPages = Math.max(1, Math.ceil((total || 0) / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + filtered.length;
  const pageRows = filtered;

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
    setDraftRequiresPan(false);
  };

  const canManageItem = (item) => {
    if (!item || item.catalog) return false;
    if (!isFreelancer) return true;
    return item.isMine === true;
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (loadError) {
      toastRef.current.warning('This list is temporarily unavailable. Please try again shortly.');
      return;
    }
    if (editing && !canManageItem(editing)) {
      toastRef.current.warning('Organization library values are read-only. You may only edit entries you created.');
      return;
    }
    const name = formatByFieldName('name', draft);
    if (!name.trim()) {
      toastRef.current.warning(`Enter a ${singular} name`);
      return;
    }
    setSaving(true);
    try {
      const url = editing
        ? `${BASE_API_URL}${apiEndpoint}/${editing._id}`
        : `${BASE_API_URL}${apiEndpoint}`;
      const body = { name, description: '' };
      if (supportsRequiresPan) body.requiresPan = !!draftRequiresPan;
      const res = await authenticatedFetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (isUnauthorized(res)) { handleUnauthorized(); return; }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toastRef.current.error(err.message || `Could not save ${singular}`);
        return;
      }
      toastRef.current.success(editing ? `${title.slice(0, -1) || singular} updated` : `${singular.charAt(0).toUpperCase()}${singular.slice(1)} added`);
      resetEditor();
      if (!editing) {
        pageRef.current = 1;
        setPage(1);
      }
      await load();
      onChanged?.();
    } catch {
      toastRef.current.error(`Could not save ${singular}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (!canManageItem(deleteTarget)) {
      toastRef.current.warning('Organization library values are read-only. You may only remove entries you created.');
      setDeleteTarget(null);
      return;
    }
    setDeleting(true);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}${apiEndpoint}/${deleteTarget._id}`, { method: 'DELETE' });
      if (isUnauthorized(res)) { handleUnauthorized(); return; }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toastRef.current.error(err.message || `Could not remove ${singular}`);
        return;
      }
      toastRef.current.success(`${singular.charAt(0).toUpperCase()}${singular.slice(1)} removed`);
      if (editing?._id === deleteTarget._id) resetEditor();
      setDeleteTarget(null);
      await load();
      onChanged?.();
    } catch {
      toastRef.current.error(`Could not remove ${singular}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleSeed = async () => {
    if (!seedable || loadError || isFreelancer) return;
    setSeeding(true);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}${apiEndpoint}/seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      if (isUnauthorized(res)) { handleUnauthorized(); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toastRef.current.error(data.message || 'Could not load the company starter library'); return; }
      toastRef.current.success('Company starter library loaded');
      pageRef.current = 1;
      setPage(1);
      setQuery('');
      queryRef.current = '';
      await load();
      onChanged?.();
    } catch {
      toastRef.current.error('Could not load the company starter library');
    } finally {
      setSeeding(false);
    }
  };

  const inputClass = isFreelancer
    ? 'flex-1 min-w-0 w-full h-10 px-3 rounded-lg border border-stone-300 bg-white text-sm font-medium uppercase tracking-wide text-stone-900 outline-none placeholder:normal-case placeholder:tracking-normal placeholder:font-normal placeholder:text-stone-400 focus:border-stone-500 focus:ring-1 focus:ring-stone-400/40 disabled:opacity-50 disabled:bg-stone-50 transition-colors box-border'
    : 'flex-1 min-w-0 w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-sm font-semibold uppercase tracking-wide text-stone-800 outline-none placeholder:normal-case placeholder:tracking-normal placeholder:font-medium placeholder:text-stone-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 disabled:opacity-50 disabled:bg-stone-50 transition-all box-border';

  const searchClass = isFreelancer
    ? 'w-full h-10 pl-9 pr-3 rounded-lg border border-stone-300 bg-white text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-stone-500 focus:ring-1 focus:ring-stone-400/40 disabled:opacity-50 transition-colors'
    : 'w-full pl-10 pr-3 py-2.5 rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-700 outline-none placeholder:text-stone-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/12 disabled:opacity-50 transition-all';

  const primaryBtnClass = isFreelancer
    ? 'inline-flex h-10 flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-45 disabled:pointer-events-none transition-colors'
    : 'inline-flex h-[42px] flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-teal-600 shadow-md shadow-brand-500/20 hover:shadow-lg disabled:opacity-45 disabled:pointer-events-none transition-all';

  const footerDoneClass = isFreelancer
    ? 'inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg px-5 h-10 text-sm font-semibold text-white bg-stone-900 hover:bg-stone-800 transition-colors'
    : 'inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-brand-600 via-teal-600 to-brand-700 shadow-md shadow-brand-500/20 hover:shadow-lg hover:shadow-brand-500/25 transition-all';

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        closeOnBackdrop={false}
        title={title}
        description={
          isFreelancer
            ? 'Shared organization list. You may create values and edit only records you own.'
            : 'Organization library · updates apply to this form immediately'
        }
        size="manage"
        zClass="z-[400]"
        icon={Icon}
        bodyClassName={
          isFreelancer
            ? 'px-4 sm:px-5 py-4 overflow-y-auto overflow-x-hidden flex-1 min-h-0 min-w-0 overscroll-contain bg-white'
            : undefined
        }
        footer={(
          <div className="flex w-full min-w-0 items-stretch sm:items-center justify-between gap-2 sm:gap-3">
            <p className="text-[11px] text-stone-500 font-medium tabular-nums hidden sm:block min-w-0 truncate">
              {loading ? 'Loading…' : (
                <>
                  <span className="text-stone-800 font-semibold">{total.toLocaleString()}</span>
                  {' '}record{total === 1 ? '' : 's'}
                </>
              )}
            </p>
            <button
              type="button"
              onClick={onClose}
              className={footerDoneClass}
            >
              {isFreelancer ? 'Close' : 'Done'}
            </button>
          </div>
        )}
      >
        <div className={`min-w-0 w-full ${isFreelancer ? 'space-y-4' : 'space-y-3.5 sm:space-y-4'}`}>
          {isFreelancer ? (
            <div className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
              <Info size={14} className="text-stone-500 mt-0.5 flex-shrink-0" strokeWidth={2.25} />
              <p className="text-[12px] text-stone-600 leading-relaxed">
                Organization and starter values are available for selection.
                Edit and delete apply only to values you created.
              </p>
            </div>
          ) : null}

          {loadError && (
            <div className={`flex items-start gap-3 ${isFreelancer ? 'rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5' : 'rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white px-3.5 py-3'}`}>
              <span className={`mt-0.5 flex h-8 w-8 items-center justify-center flex-shrink-0 ${isFreelancer ? 'rounded-md bg-amber-100 text-amber-800' : 'rounded-lg bg-amber-100 text-amber-700'}`}>
                <AlertCircle size={15} />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-amber-950 tracking-tight">List unavailable</p>
                <p className="text-[11px] text-amber-900/80 mt-0.5 leading-relaxed">{loadError}</p>
                <button type="button" onClick={load} className="mt-2 text-[11px] font-semibold text-stone-800 hover:underline">
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Add / rename composer */}
          <section className={isFreelancer
            ? 'rounded-lg border border-stone-200 bg-white p-3.5'
            : 'rounded-xl border border-stone-200/80 bg-gradient-to-br from-stone-50/90 via-white to-teal-50/25 p-3.5 shadow-sm'
          }>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <p className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${isFreelancer ? 'text-stone-500' : 'text-stone-400 tracking-[0.12em] font-bold'}`}>
                {editing ? `Edit ${singular}` : `New ${singular}`}
              </p>
              <div className="flex items-center gap-2">
                {!editing && seedable && !loadError && !isFreelancer && (
                  <button
                    type="button"
                    onClick={handleSeed}
                    disabled={seeding}
                    className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50/80 px-2.5 py-1 text-[10px] font-bold text-brand-800 hover:bg-brand-50 disabled:opacity-50 transition-colors"
                  >
                    {seeding ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                    {seeding ? 'Loading…' : 'Load starter library'}
                  </button>
                )}
                {editing && (
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    isFreelancer
                      ? 'bg-stone-100 text-stone-700 border border-stone-200'
                      : 'bg-brand-50 text-brand-700 ring-1 ring-brand-100 font-bold'
                  }`}>
                    Editing
                  </span>
                )}
              </div>
            </div>
            <form onSubmit={handleSave} className="space-y-2.5 min-w-0">
              <div className="flex flex-col sm:flex-row gap-2 min-w-0">
                <input
                  autoFocus={!loadError}
                  value={draft}
                  onChange={(e) => setDraft(formatNameForInput(e.target.value))}
                  placeholder={editing ? `${singular} name` : `Enter ${singular} name`}
                  disabled={!!loadError}
                  className={inputClass}
                />
                <div className="flex gap-2 flex-shrink-0">
                  {editing && (
                    <button
                      type="button"
                      onClick={resetEditor}
                      className={`inline-flex items-center justify-center border bg-white text-stone-500 hover:text-stone-800 hover:border-stone-400 transition-colors ${
                        isFreelancer ? 'h-10 w-10 rounded-lg border-stone-300' : 'h-[42px] w-[42px] rounded-xl border-stone-200'
                      }`}
                      title="Cancel"
                    >
                      <X size={15} />
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={saving || !!loadError}
                    className={primaryBtnClass}
                  >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : editing ? null : <Plus size={15} strokeWidth={2.5} />}
                    <span>{editing ? 'Save' : 'Add'}</span>
                  </button>
                </div>
              </div>
              {supportsRequiresPan && (
                <label className="flex items-start gap-2.5 cursor-pointer select-none px-0.5">
                  <input
                    type="checkbox"
                    checked={draftRequiresPan}
                    onChange={(e) => setDraftRequiresPan(e.target.checked)}
                    disabled={!!loadError}
                    className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500/30"
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-stone-800">Require PAN for this client</span>
                    <span className="block text-[11px] text-stone-500 leading-snug mt-0.5">
                      Candidate records for this client must include a valid PAN.
                    </span>
                  </span>
                </label>
              )}
            </form>
          </section>

          {/* Filter */}
          <div>
            <label className={`block mb-1.5 ${isFreelancer ? 'text-[11px] font-semibold text-stone-600' : 'sr-only'}`}>
              {isFreelancer ? 'Search list' : 'Search'}
            </label>
            <div className="relative">
              <Search size={14} className={`absolute ${isFreelancer ? 'left-3' : 'left-3.5'} top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none`} />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={isFreelancer ? `Search ${singular}s (min. ${PICKLIST_MIN_SEARCH} characters)` : `Type at least ${PICKLIST_MIN_SEARCH} characters to search…`}
                disabled={!!loadError}
                className={searchClass}
              />
            </div>
            {searchPending && (
              <p className="mt-1.5 px-0.5 text-[11px] text-stone-500">
                Enter at least {PICKLIST_MIN_SEARCH} characters to search.
              </p>
            )}
          </div>

          {/* Directory list */}
          <section className={isFreelancer
            ? 'rounded-lg border border-stone-200 overflow-hidden bg-white'
            : 'rounded-xl border border-stone-200/80 overflow-hidden bg-white shadow-sm'
          }>
            <div className={`flex items-center justify-between gap-2 px-3.5 py-2 border-b border-stone-200 ${isFreelancer ? 'bg-stone-50' : 'bg-gradient-to-r from-stone-50/90 to-white'}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${isFreelancer ? 'text-stone-500' : 'text-stone-400 tracking-[0.12em] font-bold'}`}>
                {isFreelancer ? 'Records' : 'Directory'}
              </p>
              {!loading && !loadError && (
                <span className="text-[10px] font-medium tabular-nums text-stone-500">
                  {total === 0 ? '0' : `${pageStart + 1}–${Math.min(pageEnd, total || pageEnd)} of ${total.toLocaleString()}`}
                </span>
              )}
            </div>

            {loading ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className={`h-11 skeleton-ats ${isFreelancer ? 'rounded-md' : 'rounded-lg'}`} />
                ))}
              </div>
            ) : loadError ? (
              <div className="py-10 px-4 text-center text-sm text-stone-500">
                No records available until the list service responds.
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-10 px-5 text-center">
                <div className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center ${isFreelancer ? 'rounded-md border border-stone-200 bg-stone-50' : 'rounded-xl bg-gradient-to-br from-brand-50 to-teal-50 ring-1 ring-brand-100'}`}>
                  <Icon size={18} className={isFreelancer ? 'text-stone-500' : 'text-brand-700'} />
                </div>
                <p className="text-sm font-semibold text-stone-800 tracking-tight">
                  {query ? 'No matching records' : `No ${singular}s yet`}
                </p>
                <p className="text-xs text-stone-500 mt-1 max-w-[280px] mx-auto leading-relaxed">
                  {query.trim().length === 1
                    ? `Enter at least ${PICKLIST_MIN_SEARCH} characters to search.`
                    : query
                      ? 'Adjust your search and try again.'
                      : `Add a ${singular} above. It will appear in form lists immediately.`}
                </p>
                {!query && seedable && !isFreelancer && (
                  <button
                    type="button"
                    onClick={handleSeed}
                    disabled={seeding}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50/80 px-3.5 py-2 text-xs font-bold text-brand-800 hover:bg-brand-50 disabled:opacity-50 transition-colors"
                  >
                    {seeding ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    {seeding ? 'Loading…' : 'Load starter library'}
                  </button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {pageRows.map((item, idx) => {
                  const initials = String(item.name || '?')
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase() || '?';
                  const active = editing?._id === item._id;
                  const mine = canManageItem(item);
                  const locked = isFreelancer && !mine;
                  return (
                    <li
                      key={item._id || item.name}
                      className={`group flex items-center gap-2.5 px-3 sm:px-3.5 py-2 transition-colors min-w-0 ${
                        active
                          ? (isFreelancer ? 'bg-stone-100' : 'bg-brand-50/70')
                          : 'hover:bg-stone-50'
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center text-[10px] font-bold tracking-wide ${
                          isFreelancer
                            ? `rounded-md border ${active ? 'border-stone-400 bg-stone-200 text-stone-800' : 'border-stone-200 bg-stone-50 text-stone-600'}`
                            : active
                              ? 'rounded-lg bg-gradient-to-br from-brand-600 to-teal-600 text-white shadow-sm shadow-brand-500/25'
                              : 'rounded-lg bg-stone-100 text-stone-600 group-hover:bg-stone-200/80'
                        }`}
                        aria-hidden="true"
                      >
                        {initials.slice(0, 2)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <p className="text-sm font-semibold text-stone-900 truncate uppercase tracking-wide">
                            {item.name}
                          </p>
                          {supportsRequiresPan && item.requiresPan && (
                            <span className="flex-shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800 bg-amber-50 border border-amber-200">
                              PAN
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-stone-400 font-medium tabular-nums mt-0.5">
                          #{pageStart + idx + 1}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {item.catalog || locked ? (
                          <span
                            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[10px] font-medium text-stone-400"
                            title={item.catalog ? 'System value' : 'Organization value'}
                          >
                            <Lock size={12} strokeWidth={2.25} />
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(item);
                                setDraft(item.name || '');
                                setDraftRequiresPan(!!item.requiresPan);
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                              title="Edit"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-stone-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {!loading && !loadError && total > 0 && (
              <div className={`border-t border-stone-200 px-2.5 sm:px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0 ${isFreelancer ? 'bg-stone-50' : 'bg-gradient-to-r from-stone-50/80 to-white'}`}>
                <p className="text-[11px] text-stone-500 font-medium tabular-nums text-center sm:text-left">
                  Page <span className="text-stone-800 font-semibold">{safePage}</span>
                  {' '}of{' '}
                  <span className="text-stone-800 font-semibold">{totalPages}</span>
                </p>
                <div className="flex items-center justify-center gap-1 flex-wrap min-w-0">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, Math.min(p, totalPages) - 1))}
                    disabled={safePage <= 1}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-stone-300 bg-white text-stone-600 hover:border-stone-400 hover:text-stone-900 disabled:opacity-35 disabled:pointer-events-none transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {pageNumbers.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className={`h-8 min-w-[2rem] px-1.5 rounded-md text-[11px] font-semibold tabular-nums transition-colors ${
                        n === safePage
                          ? (isFreelancer ? 'bg-stone-900 text-white' : 'bg-gradient-to-br from-brand-600 to-teal-600 text-white shadow-sm shadow-brand-500/25')
                          : 'border border-stone-300 bg-white text-stone-600 hover:border-stone-400 hover:text-stone-900'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, Math.min(p, totalPages) + 1))}
                    disabled={safePage >= totalPages}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-stone-300 bg-white text-stone-600 hover:border-stone-400 hover:text-stone-900 disabled:opacity-35 disabled:pointer-events-none transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={isFreelancer ? `Delete ${singular}` : `Remove ${singular}?`}
        message={
          isFreelancer
            ? `Delete “${deleteTarget?.name}” from ${title}? This value will be removed from selection lists.`
            : `Remove “${deleteTarget?.name}” from ${title}? It will no longer appear in selection lists.`
        }
        confirmText={isFreelancer ? 'Delete' : 'Remove'}
        type="delete"
        isLoading={deleting}
        zClass="z-[420]"
      />
    </>
  );
}
