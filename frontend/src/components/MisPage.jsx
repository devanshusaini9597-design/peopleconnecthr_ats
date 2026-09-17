import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Megaphone, Search, Upload, RefreshCw, Trash2, Send, Loader2,
  CheckCircle2, XCircle, Mail,
} from 'lucide-react';
import { authenticatedFetch } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import { useAuth } from '../context/AuthContext';

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'contact', label: 'Phone' },
  { key: 'position', label: 'Position' },
  { key: 'companyName', label: 'Company' },
  { key: 'location', label: 'Location' },
  { key: 'experience', label: 'Exp' },
  { key: 'ctc', label: 'CTC' },
  { key: 'client', label: 'Client' },
  { key: 'source', label: 'Source' },
];

export default function MisPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 });
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
        limit: '50',
      });
      if (q) params.set('q', q);
      const res = await authenticatedFetch(`/api/mis?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to load MIS');
      setRows(data.rows || []);
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, pages: 1 });
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

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(String(r._id)));
  const selectedIds = useMemo(() => [...selected], [selected]);

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => String(r._id))));
  };

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const toggleConsent = async (row) => {
    try {
      const res = await authenticatedFetch(`/api/mis/${row._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketingConsent: !row.marketingConsent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Update failed');
      setRows((prev) => prev.map((r) => (r._id === row._id ? { ...r, ...data.data, marketingConsent: !row.marketingConsent, unsubscribedAt: !row.marketingConsent ? null : r.unsubscribedAt } : r)));
      toast.success(!row.marketingConsent ? 'Consent enabled' : 'Consent removed');
    } catch (err) {
      toast.error(err.message || 'Could not update consent');
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

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        icon={Megaphone}
        title="MIS"
        subtitle="Marketing contacts only — separate from ATS Candidates. Leadership sees the whole org; others see contacts they uploaded."
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
        {' '}These rows are never merged into Candidates / Applications. Use for campaigns only.
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
        <button
          type="button"
          className="btn-secondary"
          onClick={() => { setQ(draft.trim()); setPage(1); }}
        >
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
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="px-3 py-2.5 text-left w-10">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
                </th>
                {COLUMNS.map((c) => (
                  <th key={c.key} className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-stone-500 whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-stone-500">Consent</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-stone-500">Uploaded by</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={COLUMNS.length + 3} className="px-4 py-12 text-center text-stone-400">
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 3} className="px-4 py-12 text-center text-stone-500">
                    No MIS contacts yet. Upload an Excel with Name and Email columns.
                  </td>
                </tr>
              ) : rows.map((row) => {
                const id = String(row._id);
                const unsub = Boolean(row.unsubscribedAt);
                return (
                  <tr key={id} className="border-b border-stone-100 hover:bg-stone-50/80">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(id)}
                        onChange={() => toggleOne(id)}
                        aria-label={`Select ${row.name}`}
                      />
                    </td>
                    {COLUMNS.map((c) => (
                      <td key={c.key} className="px-3 py-2 text-stone-700 whitespace-nowrap max-w-[10rem] truncate">
                        {c.key === 'contact' ? (row.contact || row.phone || '—') : (row[c.key] || '—')}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleConsent(row)}
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold border ${
                          row.marketingConsent && !unsub
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-stone-50 text-stone-500 border-stone-200'
                        }`}
                        title="Toggle marketing consent"
                      >
                        {row.marketingConsent && !unsub
                          ? <><CheckCircle2 className="w-3.5 h-3.5" /> Yes</>
                          : <><XCircle className="w-3.5 h-3.5" /> No</>}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-stone-500 whitespace-nowrap text-xs">
                      {row.createdBy?.name || row.createdBy?.email || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
