import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Megaphone, Search, Upload, RefreshCw, Trash2, Send, Loader2,
  CheckSquare, Square, MinusSquare, Mail, X, Info, Plus,
} from 'lucide-react';
import { authenticatedFetch, authenticatedUpload } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import Modal from './ui/Modal';
import ConfirmationModal from './ConfirmationModal';
import MisAddContactModal from './MisAddContactModal';
import { useAuth } from '../context/AuthContext';
import { useTableDragScroll } from './ats/hooks/useTableDragScroll';
import { Navigate } from 'react-router-dom';

const PAGE_SIZE = 50;

function dash(v) {
  return v ? <span className="text-sm text-stone-700 whitespace-nowrap">{v}</span> : <span className="text-stone-300">—</span>;
}

function formatDate(raw) {
  const d = raw ? new Date(raw) : null;
  const valid = d && !Number.isNaN(d.getTime());
  return valid
    ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
}

export default function MisPage() {
  const { user } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef(null);
  const {
    tableScrollRef,
    onTableDragScrollStart,
    onTableDragScrollMove,
    onTableDragScrollEnd,
  } = useTableDragScroll();

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, pages: 1 });
  const [scope, setScope] = useState('owner');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState('');
  const [consentFilter, setConsentFilter] = useState('all');
  const [unsubFilter, setUnsubFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('');
  const [locationQ, setLocationQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadUi, setUploadUi] = useState(null);
  // uploadUi: { phase, percent, fileName, result? }
  const [pendingUploadFile, setPendingUploadFile] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [mailOpen, setMailOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');

  const load = useCallback(async (pageOverride) => {
    const pageNum = pageOverride != null ? pageOverride : page;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: String(PAGE_SIZE),
      });
      if (q) params.set('q', q);
      if (consentFilter === 'yes' || consentFilter === 'no') params.set('consent', consentFilter);
      if (unsubFilter === '1' || unsubFilter === '0') params.set('unsubscribed', unsubFilter);
      if (locationQ.trim()) params.set('location', locationQ.trim());
      const res = await authenticatedFetch(`/api/mis?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to load MIS');
      setRows(data.rows || []);
      setPagination(data.pagination || { page: 1, limit: PAGE_SIZE, total: 0, pages: 1 });
      setScope(data.scope || 'owner');
      setSelected(new Set());
    } catch (err) {
      toast.error(err.message || 'Failed to load MIS');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, q, consentFilter, unsubFilter, locationQ, toast]);

  useEffect(() => { load(); }, [load]);

  const pageIds = rows.map((r) => String(r._id));
  const selectedOnPage = pageIds.filter((id) => selected.has(id));
  const isPageSelected = pageIds.length > 0 && selectedOnPage.length === pageIds.length;
  const isPagePartial = selectedOnPage.length > 0 && !isPageSelected;
  const selectedIds = useMemo(() => [...selected], [selected]);
  const totalLabel = (pagination.total || 0).toLocaleString();

  const togglePageSelection = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (isPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleConsent = useCallback(async (row) => {
    try {
      const next = !row.marketingConsent;
      const res = await authenticatedFetch(`/api/mis/${row._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketingConsent: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Update failed');
      setRows((prev) => prev.map((r) => (
        r._id === row._id
          ? { ...r, ...(data.data || {}), marketingConsent: next, unsubscribedAt: next ? null : r.unsubscribedAt }
          : r
      )));
      toast.success(next ? 'Consent enabled' : 'Consent removed');
    } catch (err) {
      toast.error(err.message || 'Could not update consent');
    }
  }, [toast]);

  const columns = useMemo(() => [
    {
      key: 'srNo',
      label: 'Sr No.',
      className: 'w-auto text-center',
      render: (_, index) => (
        <span className="text-sm font-mono text-stone-500 tabular-nums">
          {(page - 1) * PAGE_SIZE + index + 1}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Name',
      className: 'w-auto',
      render: (row) => (
        <div className="flex items-center gap-2.5 whitespace-nowrap">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 shadow-sm shadow-brand-500/20">
            {(row.name || '?').charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-stone-900 whitespace-nowrap">{row.name || '—'}</span>
        </div>
      ),
    },
    {
      key: 'contact',
      label: 'Phone',
      className: 'w-auto',
      render: (row) => (
        <span className="text-sm font-mono text-stone-600 whitespace-nowrap">
          {row.contact || row.phone || '—'}
        </span>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      className: 'w-auto',
      render: (row) => <span className="text-sm text-stone-600 whitespace-nowrap">{row.email || '—'}</span>,
    },
    { key: 'location', label: 'Location', className: 'w-auto', render: (row) => dash(row.location) },
    {
      key: 'position',
      label: 'Position',
      className: 'w-auto',
      render: (row) => (row.position
        ? <span className="text-sm font-semibold text-brand-700 whitespace-nowrap">{row.position}</span>
        : <span className="text-stone-300">—</span>),
    },
    {
      key: 'fls',
      label: 'FLS',
      className: 'w-auto',
      render: (row) => (row.fls ? (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap ${row.fls === 'FLS' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'bg-stone-100 text-stone-600 ring-1 ring-stone-200/80'}`}>
          {row.fls}
        </span>
      ) : <span className="text-stone-300">—</span>),
    },
    { key: 'companyName', label: 'Company', className: 'w-auto', render: (row) => dash(row.companyName) },
    {
      key: 'experience',
      label: 'Experience',
      className: 'w-auto',
      render: (row) => (row.experience ? <span className="text-sm whitespace-nowrap">{row.experience}</span> : <span className="text-stone-300">—</span>),
    },
    {
      key: 'ctc',
      label: 'CTC',
      className: 'w-auto',
      render: (row) => (row.ctc ? <span className="text-sm whitespace-nowrap">{row.ctc}</span> : <span className="text-stone-300">—</span>),
    },
    {
      key: 'expectedCtc',
      label: 'Expected CTC',
      className: 'w-auto',
      render: (row) => (row.expectedCtc ? <span className="text-sm whitespace-nowrap">{row.expectedCtc}</span> : <span className="text-stone-300">—</span>),
    },
    {
      key: 'noticePeriod',
      label: 'Notice Period',
      className: 'w-auto',
      render: (row) => (row.noticePeriod ? <span className="text-sm whitespace-nowrap">{row.noticePeriod}</span> : <span className="text-stone-300">—</span>),
    },
    {
      key: 'consent',
      label: 'Marketing consent',
      className: 'w-auto min-w-[130px]',
      render: (row) => {
        const ok = row.marketingConsent && !row.unsubscribedAt;
        return (
          <button
            type="button"
            onClick={() => toggleConsent(row)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border whitespace-nowrap ${
              ok
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-stone-50 text-stone-500 border-stone-200'
            }`}
            title="Toggle marketing consent"
          >
            {ok ? 'Consented' : row.unsubscribedAt ? 'Unsubscribed' : 'No consent'}
          </button>
        );
      },
    },
    { key: 'client', label: 'Client', className: 'w-auto', render: (row) => dash(row.client) },
    { key: 'product', label: 'Product / Skill', className: 'w-auto', render: (row) => dash(row.product) },
    {
      key: 'source',
      label: 'Source',
      className: 'w-auto',
      render: (row) => (row.source
        ? <span className="text-sm px-2.5 py-0.5 bg-stone-100 text-stone-600 rounded-full whitespace-nowrap">{row.source}</span>
        : <span className="text-stone-300">—</span>),
    },
    {
      key: 'uploadedBy',
      label: 'Uploaded by',
      className: 'w-auto',
      render: (row) => (
        <span className="text-sm text-stone-700 whitespace-nowrap">
          {row.createdBy?.name || row.createdBy?.email || '—'}
        </span>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      className: 'w-auto',
      render: (row) => (
        <span className="text-sm text-stone-600 whitespace-nowrap tabular-nums">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
  ], [page, toggleConsent]);

  const onUpload = async (file) => {
    if (!file) return;
    setPendingUploadFile(null);
    setUploading(true);
    setUploadUi({
      phase: 'upload',
      percent: 0,
      fileName: file.name,
      result: null,
    });
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { response, data } = await authenticatedUpload('/api/mis/bulk-upload', fd, {
        onProgress: ({ percent, phase }) => {
          setUploadUi((prev) => ({
            ...(prev || {}),
            percent,
            phase: phase === 'done' ? 'processing' : phase,
            fileName: file.name,
          }));
        },
      });
      if (!response.ok) throw new Error(data.message || 'Upload failed');
      setUploadUi({
        phase: 'done',
        percent: 100,
        fileName: file.name,
        result: data,
      });
      toast.success(data.message || 'Upload complete');
      setPage(1);
      await load(1);
    } catch (err) {
      setUploadUi((prev) => ({
        ...(prev || { fileName: file.name, percent: 0 }),
        phase: 'error',
        error: err.message || 'Upload failed',
      }));
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const requestUpload = (file) => {
    if (!file) return;
    setPendingUploadFile(file);
  };

  const deleteSelected = async () => {
    if (!selectedIds.length) return;
    setDeleting(true);
    try {
      const res = await authenticatedFetch('/api/mis/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Delete failed');
      toast.success(`Deleted ${data.deleted || 0}`);
      setDeleteConfirmOpen(false);
      await load();
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const sendMarketing = async () => {
    if (!selectedIds.length) {
      toast.warning('Select contacts first');
      return;
    }
    if (!subject.trim() || !htmlBody.trim()) {
      toast.warning('Subject and message are required');
      return;
    }
    setSending(true);
    try {
      const res = await authenticatedFetch('/api/mis/send-marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedIds,
          subject: subject.trim(),
          htmlBody: htmlBody.includes('<') ? htmlBody : `<p>${htmlBody.replace(/\n/g, '<br/>')}</p>`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Send failed');
      toast.success(data.message || `Campaign started for ${data.eligible || 0} contact(s)`);
      setMailOpen(false);
      setSubject('');
      setHtmlBody('');
    } catch (err) {
      toast.error(err.message || 'Marketing send failed');
    } finally {
      setSending(false);
    }
  };

  const runSearch = () => {
    setQ(draft.trim());
    setLocationQ(locationFilter.trim());
    setPage(1);
  };

  const clearFilters = () => {
    setDraft('');
    setQ('');
    setConsentFilter('all');
    setUnsubFilter('all');
    setLocationFilter('');
    setLocationQ('');
    setPage(1);
  };

  const showOverlay = loading && rows.length === 0;
  const hasActiveFilters = Boolean(
    q || consentFilter !== 'all' || unsubFilter !== 'all' || locationQ.trim()
  );

  if (user && user.role !== 'owner') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="page-shell-ats font-sans text-stone-900" role="main" aria-label="MIS">
      <PageHeader
        icon={Megaphone}
        title="MIS"
        subtitle={`${totalLabel} marketing contact${pagination.total === 1 ? '' : 's'} · Owner only`}
        gradientTitle
      >
        <div className="flex w-full sm:w-auto flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => load()}
            disabled={loading || uploading}
            className="btn-secondary flex-1 sm:flex-none justify-center"
            title="Refresh MIS"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-secondary flex-1 sm:flex-none justify-center"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Upload Excel
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={uploading}
            className="btn-primary flex-1 sm:flex-none justify-center"
          >
            <Plus size={16} />
            Add contact
          </button>
        </div>
      </PageHeader>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.csv"
        className="hidden"
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          requestUpload(f);
        }}
      />

      <div className="mb-4 flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-brand-900">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-brand-600" />
        <p className="leading-relaxed">
          <span className="font-semibold">Owner-only marketing desk.</span>
          {' '}Separate from Candidates. Re-uploading Excel merges new emails only — existing contacts are never overwritten.
          Use <span className="font-semibold">Add contact</span> for a single MIS entry.
        </p>
      </div>

      {selectedIds.length > 0 ? (
        <div className="sticky top-0 z-30 animate-fade-in mb-4">
          <div className="rounded-2xl border border-brand-200/70 bg-gradient-to-r from-brand-50/90 via-white to-white shadow-[var(--shadow-elevated)] overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center text-sm font-bold tabular-nums shadow-lg shadow-brand-500/25 ring-1 ring-white/20 flex-shrink-0">
                  {selectedIds.length}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">
                    Bulk actions
                  </p>
                  <p className="text-sm font-semibold text-stone-900 mt-0.5 truncate">
                    {selectedIds.length === 1 ? '1 contact selected' : `${selectedIds.length} contacts selected`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="h-10 w-10 rounded-xl border border-stone-200/80 bg-white text-stone-500 inline-flex items-center justify-center hover:bg-stone-50 hover:text-stone-800 hover:border-stone-300 transition-all shadow-sm flex-shrink-0"
                  title="Clear selection"
                  aria-label="Clear selection"
                >
                  <X size={16} strokeWidth={2} />
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setMailOpen(true)}
                  className="h-10 px-3.5 rounded-xl bg-white border border-stone-200/80 text-stone-700 inline-flex items-center justify-center gap-2 shadow-sm hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-all text-sm font-semibold"
                >
                  <Send size={16} strokeWidth={1.75} />
                  Send marketing
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="h-10 px-3.5 rounded-xl bg-white border border-rose-200 text-rose-700 inline-flex items-center justify-center gap-2 shadow-sm hover:bg-rose-50 transition-all text-sm font-semibold"
                >
                  <Trash2 size={16} strokeWidth={1.75} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card-ats-bordered relative overflow-hidden min-h-[320px]">
        <div className="p-4 sm:p-5 border-b border-stone-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none z-[1]" />
              <input
                type="search"
                placeholder="Search name, email, company, phone…"
                className="w-full h-11 pl-11 sm:pl-12 pr-10 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 outline-none text-sm font-medium text-stone-900 placeholder:text-stone-400 transition-all"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
              />
              {draft.trim() ? (
                <button
                  type="button"
                  onClick={() => { setDraft(''); setQ(''); setPage(1); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 z-[1]"
                  title="Clear"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
            <button type="button" className="btn-secondary h-11 justify-center" onClick={runSearch}>
              <Search size={16} />
              Search
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700"
              value={consentFilter}
              onChange={(e) => { setConsentFilter(e.target.value); setPage(1); }}
              aria-label="Consent filter"
            >
              <option value="all">All consent</option>
              <option value="yes">Consented</option>
              <option value="no">No consent</option>
            </select>
            <select
              className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700"
              value={unsubFilter}
              onChange={(e) => { setUnsubFilter(e.target.value); setPage(1); }}
              aria-label="Unsubscribe filter"
            >
              <option value="all">All status</option>
              <option value="0">Active</option>
              <option value="1">Unsubscribed</option>
            </select>
            <input
              type="text"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
              placeholder="Filter location"
              className="h-10 min-w-[140px] flex-1 sm:flex-none rounded-xl border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 placeholder:text-stone-400"
            />
            {hasActiveFilters ? (
              <button type="button" className="h-10 px-3 rounded-xl text-sm font-semibold text-stone-600 hover:bg-stone-100" onClick={clearFilters}>
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        <div className="relative min-h-[280px]">
          <div
            ref={tableScrollRef}
            className={`cand-table-scroll overflow-x-auto select-none transition-[filter,opacity] duration-300 ease-out ${
              showOverlay
                ? 'pointer-events-none select-none opacity-45 blur-[2.5px] saturate-75'
                : 'opacity-100 blur-0'
            }`}
            onMouseDown={showOverlay ? undefined : onTableDragScrollStart}
            onMouseMove={showOverlay ? undefined : onTableDragScrollMove}
            onMouseUp={showOverlay ? undefined : onTableDragScrollEnd}
            onMouseLeave={showOverlay ? undefined : onTableDragScrollEnd}
            aria-busy={showOverlay}
          >
            <table
              className="cand-table-drag w-max min-w-full text-left border-collapse select-text border border-stone-200"
              role="table"
              aria-label="MIS marketing contacts"
              style={{ tableLayout: 'auto' }}
            >
              <thead>
                <tr className="bg-stone-100">
                  <th scope="col" className="px-3.5 py-3.5 w-[52px] text-center border border-stone-200 bg-stone-100">
                    <button
                      type="button"
                      title={isPageSelected ? 'Deselect this page' : 'Select this page only'}
                      aria-label={isPageSelected ? 'Deselect this page' : 'Select this page only'}
                      onClick={togglePageSelection}
                      className="cursor-pointer flex justify-center mx-auto p-1 rounded hover:bg-stone-200/80"
                      disabled={showOverlay}
                    >
                      {isPageSelected ? (
                        <CheckSquare size={18} className="text-brand-600" aria-hidden="true" />
                      ) : isPagePartial ? (
                        <MinusSquare size={18} className="text-brand-500" aria-hidden="true" />
                      ) : (
                        <Square size={18} className="text-stone-400" aria-hidden="true" />
                      )}
                    </button>
                  </th>
                  {columns.map((column) => (
                    <th
                      scope="col"
                      key={column.key}
                      className={`px-3.5 py-3.5 text-[10px] font-bold text-stone-600 uppercase tracking-wider whitespace-nowrap border border-stone-200 bg-stone-100 ${column.className || ''}`}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 && Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    <td className="px-3.5 py-3 border border-stone-200">
                      <div className="h-4 w-4 skeleton-ats rounded mx-auto" />
                    </td>
                    {columns.map((column) => (
                      <td key={column.key} className="px-3.5 py-3 border border-stone-200">
                        <div className="h-4 skeleton-ats rounded w-24 max-w-full" />
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.map((row, index) => {
                  const id = String(row._id);
                  const isSelected = selected.has(id);
                  return (
                    <tr
                      key={id}
                      className={`transition-colors ${
                        isSelected ? 'bg-brand-50/80' : index % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'
                      } hover:bg-brand-50/50`}
                    >
                      <td className="px-3.5 py-3 text-center w-[52px] border border-stone-200">
                        <button
                          type="button"
                          aria-label={isSelected ? `Deselect ${row.name || 'contact'}` : `Select ${row.name || 'contact'}`}
                          onClick={() => toggleOne(id)}
                          className="cursor-pointer flex justify-center mx-auto p-1 rounded hover:bg-stone-100"
                          disabled={showOverlay}
                        >
                          {isSelected
                            ? <CheckSquare className="text-brand-600" size={17} aria-hidden="true" />
                            : <Square className="text-stone-300 hover:text-stone-400" size={17} aria-hidden="true" />}
                        </button>
                      </td>
                      {columns.map((column) => (
                        <td
                          key={`${id}-${column.key}`}
                          className={`px-3.5 py-3 text-sm text-stone-700 font-medium border border-stone-200 align-middle whitespace-nowrap overflow-visible ${column.className || ''}`}
                        >
                          {column.render(row, index)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={columns.length + 1} className="border border-stone-200">
                      {q ? (
                        <EmptyState icon={Search} tone="amber" message="No MIS contacts match your search" subMessage="Try a different name, email, or company." />
                      ) : (
                        <EmptyState
                          icon={Megaphone}
                          tone="teal"
                          message="No MIS contacts yet"
                          subMessage="Upload an Excel with the same columns as Candidates (Name + Email required)."
                        />
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-3.5 border-t border-stone-100 bg-stone-50/40">
          <p className="text-sm text-stone-500 font-medium">
            {totalLabel} contact{pagination.total === 1 ? '' : 's'}
            {q ? <span className="text-stone-400"> · filtered</span> : null}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary !py-1.5 !px-3 disabled:opacity-40"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <span className="text-xs font-semibold text-stone-500 tabular-nums px-1">
              Page {pagination.page} / {pagination.pages}
            </span>
            <button
              type="button"
              className="btn-secondary !py-1.5 !px-3 disabled:opacity-40"
              disabled={page >= pagination.pages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {mailOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-[1px]" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-stone-200 shadow-xl shadow-stone-900/15 p-5 sm:p-6 space-y-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-brand-50 border border-brand-100 text-brand-700 inline-flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-stone-900 tracking-tight">Send marketing</h3>
                  <p className="text-sm text-stone-500 mt-0.5">
                    {selectedIds.length} selected · Zoho Campaigns · consent required
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMailOpen(false)}
                className="h-9 w-9 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700 inline-flex items-center justify-center"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <input
              className="w-full h-11 rounded-xl border border-stone-200 px-3.5 text-sm font-medium outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <textarea
              className="w-full rounded-xl border border-stone-200 px-3.5 py-3 text-sm font-medium min-h-[150px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
              placeholder="Message body"
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setMailOpen(false)} disabled={sending}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary inline-flex items-center gap-2"
                onClick={sendMarketing}
                disabled={sending}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send campaign
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Modal
        open={Boolean(uploadUi)}
        onClose={() => {
          if (uploading) return;
          setUploadUi(null);
        }}
        title={uploadUi?.phase === 'done' ? 'Upload results' : uploadUi?.phase === 'error' ? 'Upload failed' : 'Uploading MIS file'}
        description={uploadUi?.fileName || 'Excel / CSV import'}
        size="md"
        icon={Upload}
        closeOnBackdrop={!uploading}
        zClass="z-[120]"
        footer={
          uploading ? null : (
            <button type="button" className="btn-primary" onClick={() => setUploadUi(null)}>
              Close
            </button>
          )
        }
      >
        {uploadUi ? (
          <div className="space-y-4">
            {(uploadUi.phase === 'upload' || uploadUi.phase === 'processing') ? (
              <>
                <div className="rounded-xl border border-stone-200 bg-gradient-to-br from-stone-50 to-white p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">
                        {uploadUi.phase === 'upload' ? 'Transfer' : 'Import'}
                      </p>
                      <p className="text-sm font-semibold text-stone-900 mt-0.5 truncate">
                        {uploadUi.phase === 'upload' ? 'Uploading spreadsheet…' : 'Writing records to MIS…'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-bold tabular-nums text-brand-700 leading-none">
                        {uploadUi.phase === 'processing' ? '99' : (uploadUi.percent || 0)}
                        <span className="text-sm font-semibold text-brand-500">%</span>
                      </p>
                      <p className="text-[10px] font-medium text-stone-400 mt-1 uppercase tracking-wider">
                        {uploadUi.phase === 'processing' ? 'Processing' : 'Complete'}
                      </p>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden border border-stone-200/80">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r from-brand-500 via-teal-600 to-brand-600 transition-[width] duration-300 ease-out ${
                        uploadUi.phase === 'processing' ? 'animate-pulse' : ''
                      }`}
                      style={{
                        width: `${uploadUi.phase === 'processing' ? 99 : Math.max(3, uploadUi.percent || 0)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-stone-500 leading-relaxed">
                    Large Excel files can take longer after the bar reaches 99% while rows are imported. Keep this window open until results appear.
                  </p>
                </div>
              </>
            ) : null}

            {uploadUi.phase === 'done' && uploadUi.result ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Merge complete</p>
                  <p className="text-sm font-semibold text-stone-900 mt-1">
                    Existing MIS contacts were left unchanged. Only new emails were added.
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'New', value: uploadUi.result.created ?? 0, tone: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
                    {
                      label: 'Duplicates kept',
                      value: uploadUi.result.duplicates ?? uploadUi.result.updated ?? 0,
                      tone: 'text-sky-700 bg-sky-50 border-sky-100',
                    },
                    {
                      label: 'In-file repeats',
                      value: uploadUi.result.duplicatesInFile ?? 0,
                      tone: 'text-violet-700 bg-violet-50 border-violet-100',
                    },
                    {
                      label: 'Invalid',
                      value: uploadUi.result.skipped ?? 0,
                      tone: 'text-amber-700 bg-amber-50 border-amber-100',
                    },
                  ].map((card) => (
                    <div key={card.label} className={`rounded-xl border px-3 py-2.5 ${card.tone}`}>
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{card.label}</p>
                      <p className="text-lg font-bold tabular-nums mt-0.5">{card.value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-stone-600 leading-relaxed">{uploadUi.result.message}</p>
                {Array.isArray(uploadUi.result.errors) && uploadUi.result.errors.length ? (
                  <div className="rounded-xl border border-stone-200 bg-stone-50/80 max-h-36 overflow-y-auto p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                      Sample notes ({uploadUi.result.errors.length})
                    </p>
                    <ul className="space-y-1 text-xs text-stone-600">
                      {uploadUi.result.errors.slice(0, 12).map((err, i) => (
                        <li key={`${err.row}-${i}`}>Row {err.row}: {err.message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {uploadUi.phase === 'error' ? (
              <p className="text-sm text-rose-700 font-medium">{uploadUi.error || 'Upload failed'}</p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <MisAddContactModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        toast={toast}
        onCreated={() => {
          setPage(1);
          load(1);
        }}
      />

      <ConfirmationModal
        isOpen={Boolean(pendingUploadFile)}
        onClose={() => setPendingUploadFile(null)}
        onConfirm={() => {
          const file = pendingUploadFile;
          if (file) onUpload(file);
        }}
        type="info"
        eyebrow="Excel merge"
        title="Upload to MIS?"
        message={`“${pendingUploadFile?.name || 'file'}” will be merged into MIS. Matching emails that already exist are kept as-is (nothing is overwritten). Only new emails are added.`}
        confirmText="Upload & merge"
        cancelText="Cancel"
        zClass="z-[140]"
      />

      <ConfirmationModal
        isOpen={deleteConfirmOpen}
        onClose={() => { if (!deleting) setDeleteConfirmOpen(false); }}
        onConfirm={deleteSelected}
        type="delete"
        eyebrow="Bulk delete"
        title={`Delete ${selectedIds.length} contact${selectedIds.length === 1 ? '' : 's'}?`}
        message="This removes them from MIS only. ATS Candidates are not affected."
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={deleting}
        zClass="z-[140]"
      />
    </div>
  );
}
