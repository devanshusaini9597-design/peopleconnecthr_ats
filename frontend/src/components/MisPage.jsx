import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Megaphone, Search, Upload, RefreshCw, Trash2, Send, Loader2,
  CheckSquare, Square, MinusSquare, Mail,
} from 'lucide-react';
import { authenticatedFetch } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useTableDragScroll } from './ats/hooks/useTableDragScroll';

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
  const {
    tableScrollRef,
    onTableDragScrollStart,
    onTableDragScrollMove,
    onTableDragScrollEnd,
  } = useTableDragScroll();

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, pages: 1 });
  const [scope, setScope] = useState('mine');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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
      const res = await authenticatedFetch(`/api/mis?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to load MIS');
      setRows(data.rows || []);
      setPagination(data.pagination || { page: 1, limit: PAGE_SIZE, total: 0, pages: 1 });
      setScope(data.scope || 'mine');
      setSelected(new Set());
    } catch (err) {
      toast.error(err.message || 'Failed to load MIS');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, q, toast]);

  useEffect(() => { load(); }, [load]);

  const pageIds = rows.map((r) => String(r._id));
  const selectedOnPage = pageIds.filter((id) => selected.has(id));
  const isPageSelected = pageIds.length > 0 && selectedOnPage.length === pageIds.length;
  const isPagePartial = selectedOnPage.length > 0 && !isPageSelected;
  const selectedIds = useMemo(() => [...selected], [selected]);

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
    {
      key: 'location',
      label: 'Location',
      className: 'w-auto',
      render: (row) => dash(row.location),
    },
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
    {
      key: 'companyName',
      label: 'Company',
      className: 'w-auto',
      render: (row) => dash(row.companyName),
    },
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
    {
      key: 'client',
      label: 'Client',
      className: 'w-auto',
      render: (row) => dash(row.client),
    },
    {
      key: 'product',
      label: 'Product / Skill',
      className: 'w-auto',
      render: (row) => dash(row.product),
    },
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
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await authenticatedFetch('/api/mis/bulk-upload', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      toast.success(data.message || 'Upload complete');
      setPage(1);
      await load(1);
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const deleteSelected = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Delete ${selectedIds.length} MIS contact(s)? This does not affect ATS Candidates.`)) return;
    try {
      const res = await authenticatedFetch('/api/mis/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Delete failed');
      toast.success(`Deleted ${data.deleted || 0}`);
      await load();
    } catch (err) {
      toast.error(err.message || 'Delete failed');
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

  const showOverlay = loading && rows.length === 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        icon={Megaphone}
        title="MIS"
        subtitle="Marketing contacts only — same tracker format as Candidates, separate from ATS. Leadership sees the whole org; others see their uploads."
      >
        <label className="btn-secondary cursor-pointer inline-flex items-center gap-2">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Upload Excel
          <input
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              onUpload(f);
            }}
          />
        </label>
        <button type="button" className="btn-secondary" onClick={() => load()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </PageHeader>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong className="font-semibold">Marketing data desk.</strong>
        {' '}Never merged into Candidates / Applications.
        {' '}View: <span className="font-semibold">{scope === 'organization' ? 'Entire organization' : 'My uploads only'}</span>
        {user?.role ? ` · ${user.role}` : ''}.
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            className="w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 py-2.5 text-sm"
            placeholder="Search name, email, company…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setQ(draft.trim());
                setPage(1);
              }
            }}
          />
        </div>
        <button type="button" className="btn-secondary" onClick={() => { setQ(draft.trim()); setPage(1); }}>
          Search
        </button>
        <button
          type="button"
          className="btn-secondary disabled:opacity-50"
          disabled={!selectedIds.length}
          onClick={() => setMailOpen(true)}
        >
          <Send className="w-4 h-4" />
          Send marketing ({selectedIds.length})
        </button>
        <button
          type="button"
          className="btn-secondary text-rose-700 disabled:opacity-50"
          disabled={!selectedIds.length}
          onClick={deleteSelected}
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
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

        <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100 text-sm text-stone-500">
          <span>{pagination.total} contact{pagination.total === 1 ? '' : 's'}</span>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary !py-1.5 !px-3 disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <span className="self-center text-xs">Page {pagination.page} / {pagination.pages}</span>
            <button
              type="button"
              className="btn-secondary !py-1.5 !px-3 disabled:opacity-40"
              disabled={page >= pagination.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {mailOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-stone-200 shadow-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-brand-600" />
              <h3 className="text-lg font-bold text-stone-900">Send marketing</h3>
            </div>
            <p className="text-sm text-stone-500">
              Sends via Zoho Campaigns to {selectedIds.length} selected contact(s) with consent.
              Unsubscribed contacts are skipped.
            </p>
            <input
              className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <textarea
              className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm min-h-[140px]"
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
    </div>
  );
}
