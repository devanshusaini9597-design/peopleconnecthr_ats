import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Megaphone, Search, Upload, RefreshCw, Trash2, Loader2,
  CheckSquare, Square, MinusSquare, Info, Plus, Users, X,
} from 'lucide-react';
import { authenticatedFetch, authenticatedUpload, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import Modal from './ui/Modal';
import ConfirmationModal from './ConfirmationModal';
import MisAddContactModal from './MisAddContactModal';
import MisBulkToolbar from './MisBulkToolbar';
import MisBulkEditModal from './MisBulkEditModal';
import CandidateEmailModal from './ats/CandidateEmailModal';
import EmailCampaignResultModal from './ats/EmailCampaignResultModal';
import { useCandidateEmail } from './ats/hooks/useCandidateEmail';
import { useAuth } from '../context/AuthContext';
import { useTableDragScroll } from './ats/hooks/useTableDragScroll';
import { Navigate, useNavigate } from 'react-router-dom';
import BASE_API_URL from '../config';

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
  const navigate = useNavigate();
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
  const [moveConfirmOpen, setMoveConfirmOpen] = useState(false);
  const [moveIds, setMoveIds] = useState([]);
  const [moving, setMoving] = useState(false);
  const [moveResult, setMoveResult] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [consentMenuOpen, setConsentMenuOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditing, setBulkEditing] = useState(false);
  const [whatsAppConfirmOpen, setWhatsAppConfirmOpen] = useState(false);
  const [whatsAppTargets, setWhatsAppTargets] = useState([]);
  const [consentBulk, setConsentBulk] = useState(null); // true | false | null
  const [consentBulkConfirmOpen, setConsentBulkConfirmOpen] = useState(false);
  const [consentBulkSaving, setConsentBulkSaving] = useState(false);
  const [campaignStarting, setCampaignStarting] = useState(false);

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
    } catch (err) {
      toast.error(err.message || 'Failed to load MIS');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, q, consentFilter, unsubFilter, locationQ, toast]);

  // Clear selection when filters/search change (not on page flip — keeps "select all matching")
  useEffect(() => {
    setSelected(new Set());
    setConsentMenuOpen(false);
  }, [q, consentFilter, unsubFilter, locationQ]);

  useEffect(() => { load(); }, [load]);

  const pageIds = rows.map((r) => String(r._id));
  const selectedOnPage = pageIds.filter((id) => selected.has(id));
  const isPageSelected = pageIds.length > 0 && selectedOnPage.length === pageIds.length;
  const isPagePartial = selectedOnPage.length > 0 && !isPageSelected;
  const selectedIds = useMemo(() => [...selected], [selected]);
  const setSelectedIds = useCallback((next) => {
    if (typeof next === 'function') {
      setSelected((prev) => {
        const asArr = [...prev];
        const result = next(asArr);
        return new Set((result || []).map(String));
      });
      return;
    }
    setSelected(new Set((next || []).map(String)));
  }, []);

  const email = useCandidateEmail({
    toast,
    candidates: rows,
    selectedIds,
    setSelectedIds,
  });

  const totalLabel = (pagination.total || 0).toLocaleString();
  const filteredCount = pagination.total || 0;
  const isAllFilteredSelected =
    filteredCount > 0
    && selectedIds.length > 0
    && selectedIds.length >= filteredCount;

  const buildListParams = useCallback((extra = {}) => {
    const params = new URLSearchParams({
      page: String(extra.page ?? page),
      limit: String(extra.limit ?? PAGE_SIZE),
    });
    if (q) params.set('q', q);
    if (consentFilter === 'yes' || consentFilter === 'no') params.set('consent', consentFilter);
    if (unsubFilter === '1' || unsubFilter === '0') params.set('unsubscribed', unsubFilter);
    if (locationQ.trim()) params.set('location', locationQ.trim());
    if (extra.idsOnly) params.set('idsOnly', '1');
    return params;
  }, [page, q, consentFilter, unsubFilter, locationQ]);

  const handleSelectAllFiltered = useCallback(async () => {
    try {
      const params = buildListParams({ page: 1, limit: 1, idsOnly: true });
      const res = await authenticatedFetch(`/api/mis?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not select matching contacts');
      const ids = (data.ids || []).map(String);
      if (!ids.length) {
        toast.warning('No matching contacts to select.');
        return;
      }
      setSelected(new Set(ids));
      const matchTotal = data.total || filteredCount;
      if (data.capped) {
        toast.warning(
          `Selected ${ids.length.toLocaleString()} of ${matchTotal.toLocaleString()} matches (maximum). Refine filters to target the rest.`,
        );
      } else {
        toast.success(`Selected all ${ids.length.toLocaleString()} matching contacts.`);
      }
    } catch (err) {
      toast.error(err?.message || 'Could not select all matching contacts.');
    }
  }, [buildListParams, filteredCount, toast]);

  const handleBulkWhatsApp = useCallback(async () => {
    if (!selectedIds.length) {
      toast.warning('Please select at least one contact.');
      return;
    }
    let pool = rows.filter((r) => selected.has(String(r._id)));
    if (selectedIds.length > pool.length) {
      try {
        const params = buildListParams({ page: 1, limit: 1, idsOnly: true });
        const res = await authenticatedFetch(`/api/mis?${params}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Could not load phone numbers');
        const idSet = new Set(selectedIds);
        pool = (data.contacts || []).filter((c) => idSet.has(String(c._id)));
      } catch (err) {
        toast.error(err.message || 'Could not load phone numbers');
        return;
      }
    }
    const withPhone = pool.filter((c) => {
      const phone = String(c.phone || c.contact || '').replace(/\D/g, '');
      return phone.length >= 7;
    });
    if (withPhone.length === 0) {
      toast.warning('No valid phone numbers found in selected contacts.');
      return;
    }
    setWhatsAppTargets(withPhone);
    setWhatsAppConfirmOpen(true);
  }, [selectedIds, rows, selected, toast, buildListParams]);

  const openWhatsAppTabs = useCallback(() => {
    setWhatsAppConfirmOpen(false);
    whatsAppTargets.forEach((c, i) => {
      const phone = String(c.phone || c.contact || '').replace(/\D/g, '');
      setTimeout(() => {
        window.open(`https://wa.me/${phone}`, '_blank');
      }, i * 500);
    });
    setWhatsAppTargets([]);
  }, [whatsAppTargets]);

  const requestBulkConsent = useCallback((value) => {
    setConsentMenuOpen(false);
    if (!selectedIds.length) {
      toast.warning('Select contacts first');
      return;
    }
    setConsentBulk(Boolean(value));
    setConsentBulkConfirmOpen(true);
  }, [selectedIds, toast]);

  const confirmBulkConsent = async () => {
    if (!selectedIds.length || consentBulk == null) return;
    setConsentBulkSaving(true);
    try {
      const res = await authenticatedFetch('/api/mis/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedIds,
          updates: { marketingConsent: consentBulk },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Consent update failed');
      toast.success(
        consentBulk
          ? `Consent enabled for ${data.modified ?? selectedIds.length} contact(s)`
          : `Consent removed for ${data.modified ?? selectedIds.length} contact(s)`,
      );
      setConsentBulkConfirmOpen(false);
      setConsentBulk(null);
      await load();
    } catch (err) {
      toast.error(err.message || 'Consent update failed');
    } finally {
      setConsentBulkSaving(false);
    }
  };

  const submitBulkEdit = async (updates) => {
    if (!selectedIds.length || !updates || !Object.keys(updates).length) return;
    setBulkEditing(true);
    try {
      const res = await authenticatedFetch('/api/mis/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, updates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Bulk edit failed');
      toast.success(`Updated ${data.modified ?? selectedIds.length} contact(s)`);
      setBulkEditOpen(false);
      await load();
    } catch (err) {
      toast.error(err.message || 'Bulk edit failed');
    } finally {
      setBulkEditing(false);
    }
  };

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

  const requestMove = useCallback((ids) => {
    const list = (ids || []).map(String).filter(Boolean);
    if (!list.length) {
      toast.warning('Select contacts first');
      return;
    }
    setMoveIds(list);
    setMoveResult(null);
    setMoveConfirmOpen(true);
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
    {
      key: 'actions',
      label: 'Actions',
      className: 'w-auto',
      render: (row) => (
        <button
          type="button"
          onClick={() => requestMove([row._id])}
          className="h-8 px-2.5 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-stone-700 inline-flex items-center gap-1.5 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-all whitespace-nowrap"
          title="Move to Candidates"
        >
          <Users size={13} />
          To Candidates
        </button>
      ),
    },
  ], [page, toggleConsent, requestMove]);

  const onUpload = async (file) => {
    if (!file) return;
    setPendingUploadFile(null);
    setUploading(true);
    setUploadUi({
      phase: 'upload',
      percent: 0,
      fileName: file.name,
      result: null,
      processed: 0,
      totalRows: 0,
      created: 0,
      duplicates: 0,
      duplicatesInFile: 0,
      skipped: 0,
    });
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { response, data } = await authenticatedUpload('/api/mis/bulk-upload', fd, {
        onProgress: ({ percent, phase }) => {
          setUploadUi((prev) => ({
            ...(prev || {}),
            percent: phase === 'upload' ? percent : (prev?.percent || 99),
            phase: phase === 'done' || phase === 'processing' ? 'processing' : phase,
            fileName: file.name,
          }));
        },
      });

      // Partial / hard failures: still show counts when the server returned them
      if (!response.ok && !data?.jobId && data?.created == null && data?.duplicates == null) {
        const msg = data.message
          || (response.status === 502 || response.status === 504
            ? 'Server timed out while reading the file. Please retry — large files now import in the background.'
            : `Upload failed (${response.status})`);
        throw new Error(msg);
      }

      let finalResult = data;
      if (data?.jobId || data?.async) {
        const jobId = data.jobId;
        setUploadUi((prev) => ({
          ...(prev || {}),
          phase: 'processing',
          percent: data.percent || 0,
          fileName: file.name,
          jobId,
          totalRows: data.totalRows || 0,
          processed: data.processed || 0,
          created: data.created || 0,
          duplicates: data.duplicates || 0,
          duplicatesInFile: data.duplicatesInFile || 0,
          skipped: data.skipped || 0,
          blank: data.blank || 0,
        }));

        const started = Date.now();
        const maxMs = 30 * 60 * 1000;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (Date.now() - started > maxMs) {
            throw new Error('Import is taking too long. Refresh MIS to see what was saved.');
          }
          await new Promise((r) => setTimeout(r, 450));
          const res = await authenticatedFetch(`/api/mis/bulk-upload/jobs/${encodeURIComponent(jobId)}`);
          const job = await res.json().catch(() => ({}));
          if (!res.ok && !job.processed && job.created == null) {
            throw new Error(job.message || 'Could not read import progress');
          }
          setUploadUi((prev) => ({
            ...(prev || {}),
            phase: job.status === 'done' ? 'done' : job.status === 'error' ? 'error' : 'processing',
            percent: job.percent ?? prev?.percent ?? 0,
            fileName: file.name,
            jobId,
            totalRows: job.totalRows || 0,
            processed: job.processed || 0,
            created: job.created || 0,
            duplicates: job.duplicates || 0,
            duplicatesInFile: job.duplicatesInFile || 0,
            skipped: job.skipped || 0,
            blank: job.blank || 0,
            message: job.message || prev?.message,
            result: job.status === 'done' || job.status === 'error' ? job : prev?.result,
            error: job.status === 'error' ? (job.error || job.message) : null,
          }));
          if (job.status === 'done' || job.status === 'error') {
            finalResult = job;
            break;
          }
        }
      }

      const created = finalResult.created ?? 0;
      const duplicates = finalResult.duplicates ?? 0;
      const duplicatesInFile = finalResult.duplicatesInFile ?? 0;
      const skipped = finalResult.skipped ?? 0;
      const summary = `${created} added · ${duplicates} duplicates · ${duplicatesInFile} in-file repeats · ${skipped} failed/invalid`;

      if (finalResult.status === 'error' && created === 0 && duplicates === 0) {
        setUploadUi({
          phase: 'error',
          percent: 0,
          fileName: file.name,
          error: finalResult.error || finalResult.message || 'Import failed',
          result: finalResult,
        });
        toast.error(finalResult.error || finalResult.message || 'Import failed');
      } else {
        setUploadUi({
          phase: 'done',
          percent: 100,
          fileName: file.name,
          result: finalResult,
          created,
          duplicates,
          duplicatesInFile,
          skipped,
          processed: finalResult.processed,
          totalRows: finalResult.totalRows,
        });
        if (created > 0) {
          toast.success(`Import complete — ${summary}`);
        } else if (duplicates > 0 || duplicatesInFile > 0) {
          toast.info(`No new rows — ${summary}`);
        } else if (skipped > 0) {
          toast.warning(`Nothing added — ${summary}`);
        } else {
          toast.success(finalResult.message || summary);
        }
        setPage(1);
        await load(1);
      }
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

  const confirmMoveToCandidates = async () => {
    if (!moveIds.length) return;
    setMoving(true);
    try {
      const res = await authenticatedFetch('/api/mis/move-to-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: moveIds, removeFromMis: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Move failed');
      setMoveResult(data);
      toast.success(data.message || `Moved ${data.moved || 0}`);
      setSelected(new Set());
      await load();
    } catch (err) {
      toast.error(err.message || 'Move failed');
      setMoveConfirmOpen(false);
    } finally {
      setMoving(false);
    }
  };

  const startMisCampaign = useCallback(async () => {
    if (!selectedIds.length) {
      toast.warning('Please select at least one contact.');
      return;
    }
    setCampaignStarting(true);
    try {
      let pool = rows.filter((r) => selected.has(String(r._id)));
      if (selectedIds.length > pool.length) {
        const params = buildListParams({ page: 1, limit: 1, idsOnly: true });
        const res = await authenticatedFetch(`/api/mis?${params}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Could not load contacts for campaign');
        const idSet = new Set(selectedIds);
        pool = (data.contacts || []).filter((c) => idSet.has(String(c._id)));
      }

      const eligible = pool.filter((c) => {
        const em = String(c.email || '').trim().toLowerCase();
        if (!em || !em.includes('@')) return false;
        if (c.marketingConsent === false) return false;
        if (c.unsubscribedAt) return false;
        return true;
      }).map((c) => ({
        _id: String(c._id),
        email: String(c.email).trim(),
        name: c.name || '',
        position: c.position || '',
        location: c.location || '',
        client: c.client || '',
        companyName: c.companyName || '',
      }));

      if (!eligible.length) {
        toast.warning('No eligible contacts — need a valid email, marketing consent, and not unsubscribed.');
        return;
      }

      if (eligible.length < selectedIds.length) {
        toast.info(
          `${eligible.length.toLocaleString()} of ${selectedIds.length.toLocaleString()} selected are eligible for campaign (consent + email).`,
        );
      }

      try {
        const statusRes = await authenticatedFetch(`${BASE_API_URL}/api/email/sender-status`);
        const statusData = await statusRes.json();
        if (statusData.success) {
          email.setEmailSenderInfo({
            fromEmail: statusData.fromEmail || statusData.agentFrom || '',
            replyTo: statusData.replyTo || '',
            displayName: statusData.displayName || '',
            verifiedDomain: statusData.verifiedDomain || '',
            sendAsUser: Boolean(statusData.sendAsUser),
            agentFrom: statusData.agentFrom || '',
            hint: statusData.hint || '',
          });
        }
      } catch (_) { /* keep previous */ }

      try {
        const chRes = await authenticatedFetch(`${BASE_API_URL}/api/email/channels`);
        const chData = await chRes.json();
        if (chData.success && chData.channels) {
          email.setChannelsAvailable({
            transactional: false,
            marketing: chData.channels.marketing?.available ?? false,
          });
        }
      } catch (_) {
        email.setChannelsAvailable({ transactional: false, marketing: false });
      }

      try {
        const res = await authenticatedFetch(`${BASE_API_URL}/api/email-templates`);
        if (isUnauthorized(res)) {
          handleUnauthorized();
          return;
        }
        const data = await res.json();
        if (data.success && data.templates?.length) {
          email.setEmailTemplates(data.templates);
        }
      } catch (_) { /* ignore */ }

      email.setBulkEmailRecipients(eligible);
      email.setEmailRecipient(eligible[0]);
      email.setEmailChannel('marketing');
      email.setEmailMode('template');
      email.setSelectedTemplate(null);
      email.setShowEmailModal(true);
    } catch (err) {
      toast.error(err.message || 'Could not start campaign');
    } finally {
      setCampaignStarting(false);
    }
  }, [
    selectedIds, rows, selected, toast, buildListParams,
    email.setEmailSenderInfo, email.setChannelsAvailable, email.setEmailTemplates,
    email.setBulkEmailRecipients, email.setEmailRecipient, email.setEmailChannel,
    email.setEmailMode, email.setSelectedTemplate, email.setShowEmailModal,
  ]);

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
          Use <span className="font-semibold">Add contact</span> for a full Candidates-style form (saved to MIS only).
          Select rows to <span className="font-semibold">Move to Candidates</span> — moved rows leave MIS.
        </p>
      </div>

      {selectedIds.length > 0 ? (
        <MisBulkToolbar
          selectedIds={selectedIds}
          onClear={() => { setSelected(new Set()); setConsentMenuOpen(false); }}
          onEmail={startMisCampaign}
          onWhatsApp={handleBulkWhatsApp}
          onBulkEdit={() => { setConsentMenuOpen(false); setBulkEditOpen(true); }}
          onConsentMenuToggle={() => setConsentMenuOpen((v) => !v)}
          consentMenuOpen={consentMenuOpen}
          onSetConsent={requestBulkConsent}
          onMoveToCandidates={() => requestMove(selectedIds)}
          onDelete={() => setDeleteConfirmOpen(true)}
          filteredCount={filteredCount}
          isAllFilteredSelected={isAllFilteredSelected}
          onSelectAllFiltered={handleSelectAllFiltered}
        />
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

      <CandidateEmailModal
        campaignOnly
        recipientNoun="contacts"
        showEmailModal={email.showEmailModal}
        emailRecipient={email.emailRecipient}
        setShowEmailModal={email.setShowEmailModal}
        bulkEmailRecipients={email.bulkEmailRecipients}
        setBulkEmailRecipients={email.setBulkEmailRecipients}
        setSelectedIds={setSelectedIds}
        emailChannel={email.emailChannel}
        setEmailChannel={email.setEmailChannel}
        channelsAvailable={email.channelsAvailable}
        emailSenderInfo={email.emailSenderInfo}
        emailMode={email.emailMode}
        setEmailMode={email.setEmailMode}
        emailCC={email.emailCC}
        setEmailCC={email.setEmailCC}
        emailBCC={email.emailBCC}
        setEmailBCC={email.setEmailBCC}
        teamMembers={[]}
        ccInput={email.ccInput}
        setCcInput={email.setCcInput}
        bccInput={email.bccInput}
        setBccInput={email.setBccInput}
        showCCPicker={email.showCCPicker}
        setShowCCPicker={email.setShowCCPicker}
        showBCCPicker={email.showBCCPicker}
        setShowBCCPicker={email.setShowBCCPicker}
        emailTemplates={email.emailTemplates}
        selectedTemplate={email.selectedTemplate}
        selectEmailTemplate={email.selectEmailTemplate}
        setSelectedTemplate={email.setSelectedTemplate}
        templateVars={email.templateVars}
        setTemplateVars={email.setTemplateVars}
        templateDraftSubject={email.templateDraftSubject}
        setTemplateDraftSubject={email.setTemplateDraftSubject}
        templateDraftBody={email.templateDraftBody}
        setTemplateDraftBody={email.setTemplateDraftBody}
        templateDraftDirty={email.templateDraftDirty}
        setTemplateDraftDirty={email.setTemplateDraftDirty}
        emailType={email.emailType}
        setEmailType={email.setEmailType}
        quickName={email.quickName}
        setQuickName={email.setQuickName}
        quickPosition={email.quickPosition}
        setQuickPosition={email.setQuickPosition}
        quickDepartment={email.quickDepartment}
        setQuickDepartment={email.setQuickDepartment}
        quickJoiningDate={email.quickJoiningDate}
        setQuickJoiningDate={email.setQuickJoiningDate}
        customMessage={email.customMessage}
        setCustomMessage={email.setCustomMessage}
        quickSubject={email.quickSubject}
        setQuickSubject={email.setQuickSubject}
        showQuickPreview={email.showQuickPreview}
        setShowQuickPreview={email.setShowQuickPreview}
        quickPreviewHtml={email.quickPreviewHtml}
        setQuickPreviewHtml={email.setQuickPreviewHtml}
        quickPreviewSubject={email.quickPreviewSubject}
        setQuickPreviewSubject={email.setQuickPreviewSubject}
        loadingPreview={email.loadingPreview}
        setLoadingPreview={email.setLoadingPreview}
        isSendingEmail={email.isSendingEmail || campaignStarting}
        sendTemplateEmail={email.sendTemplateEmail}
        sendSingleEmail={email.sendSingleEmail}
        toast={toast}
      />

      <EmailCampaignResultModal
        open={Boolean(email.showEmailCampaignResult)}
        result={email.emailCampaignResult}
        onClose={() => {
          email.setShowEmailCampaignResult?.(false);
          email.setEmailCampaignResult?.(null);
        }}
        onViewReports={() => {
          email.setShowEmailCampaignResult?.(false);
          email.setEmailCampaignResult?.(null);
          navigate('/email-reports');
        }}
      />

      <Modal
        open={Boolean(uploadUi)}
        onClose={() => {
          if (uploading) return;
          setUploadUi(null);
        }}
        title={
          uploadUi?.phase === 'done'
            ? 'Upload results'
            : uploadUi?.phase === 'error'
              ? 'Upload issue'
              : uploadUi?.phase === 'processing'
                ? 'Importing rows'
                : 'Uploading MIS file'
        }
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
                        {uploadUi.phase === 'upload' ? 'File transfer' : 'Row import'}
                      </p>
                      <p className="text-sm font-semibold text-stone-900 mt-0.5 truncate">
                        {uploadUi.phase === 'upload'
                          ? 'Uploading spreadsheet…'
                          : (uploadUi.totalRows
                            ? `Processed ${(uploadUi.processed || 0).toLocaleString()} of ${(uploadUi.totalRows || 0).toLocaleString()} rows`
                            : (uploadUi.message || 'Reading spreadsheet…'))}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-bold tabular-nums text-brand-700 leading-none">
                        {uploadUi.phase === 'processing'
                          ? (uploadUi.totalRows
                            ? Math.min(100, Math.round(((uploadUi.processed || 0) / uploadUi.totalRows) * 100))
                            : (uploadUi.percent || 0))
                          : (uploadUi.percent || 0)}
                        <span className="text-sm font-semibold text-brand-500">%</span>
                      </p>
                      <p className="text-[10px] font-medium text-stone-400 mt-1 uppercase tracking-wider">
                        {uploadUi.phase === 'processing' ? 'Live' : 'Transfer'}
                      </p>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden border border-stone-200/80">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 via-teal-600 to-brand-600 transition-[width] duration-300 ease-out"
                      style={{
                        width: `${Math.max(
                          3,
                          uploadUi.phase === 'processing' && uploadUi.totalRows
                            ? Math.min(100, Math.round(((uploadUi.processed || 0) / uploadUi.totalRows) * 100))
                            : (uploadUi.percent || 0)
                        )}%`,
                      }}
                    />
                  </div>
                  {uploadUi.phase === 'processing' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      {[
                        { label: 'Added', value: uploadUi.created ?? 0, tone: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
                        { label: 'Duplicates', value: uploadUi.duplicates ?? 0, tone: 'text-sky-700 bg-sky-50 border-sky-100' },
                        { label: 'In-file', value: uploadUi.duplicatesInFile ?? 0, tone: 'text-violet-700 bg-violet-50 border-violet-100' },
                        { label: 'Failed', value: uploadUi.skipped ?? 0, tone: 'text-amber-700 bg-amber-50 border-amber-100' },
                      ].map((card) => (
                        <div key={card.label} className={`rounded-xl border px-2.5 py-2 ${card.tone}`}>
                          <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">{card.label}</p>
                          <p className="text-base font-bold tabular-nums mt-0.5">{card.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-500 leading-relaxed">
                      After the file finishes uploading, row import progress appears live (added / duplicates / failed).
                    </p>
                  )}
                </div>
              </>
            ) : null}

            {uploadUi.phase === 'done' && uploadUi.result ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Import complete</p>
                  <p className="text-sm font-semibold text-stone-900 mt-1">
                    {(uploadUi.result.processed ?? 0).toLocaleString()} of {(uploadUi.result.totalRows ?? 0).toLocaleString()} rows handled.
                    Existing contacts were not overwritten.
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Added', value: uploadUi.result.created ?? 0, tone: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
                    {
                      label: 'Duplicates kept',
                      value: uploadUi.result.duplicates ?? 0,
                      tone: 'text-sky-700 bg-sky-50 border-sky-100',
                    },
                    {
                      label: 'In-file repeats',
                      value: uploadUi.result.duplicatesInFile ?? 0,
                      tone: 'text-violet-700 bg-violet-50 border-violet-100',
                    },
                    {
                      label: 'Failed / invalid',
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
              <div className="space-y-3">
                <p className="text-sm text-rose-700 font-medium">{uploadUi.error || 'Upload failed'}</p>
                {uploadUi.result && (uploadUi.result.created > 0 || uploadUi.result.duplicates > 0) ? (
                  <p className="text-sm text-stone-600">
                    Partial progress before the issue: {uploadUi.result.created || 0} added, {uploadUi.result.duplicates || 0} duplicates, {uploadUi.result.skipped || 0} failed.
                  </p>
                ) : null}
              </div>
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

      <ConfirmationModal
        isOpen={moveConfirmOpen}
        onClose={() => {
          if (moving) return;
          setMoveConfirmOpen(false);
          setMoveResult(null);
          setMoveIds([]);
        }}
        onConfirm={() => {
          if (moveResult) {
            setMoveConfirmOpen(false);
            setMoveResult(null);
            setMoveIds([]);
            return;
          }
          confirmMoveToCandidates();
        }}
        type={moveResult ? 'success' : 'info'}
        eyebrow="MIS → Candidates"
        title={moveResult ? 'Move complete' : `Move ${moveIds.length} contact${moveIds.length === 1 ? '' : 's'} to Candidates?`}
        message={
          moveResult
            ? (moveResult.message || 'Done')
            : 'Creates Candidates from these MIS rows, then removes them from MIS. Existing candidate emails/phones are skipped (not overwritten).'
        }
        confirmText={moveResult ? 'Close' : 'Move to Candidates'}
        cancelText={moveResult ? undefined : 'Cancel'}
        showCancel={!moveResult}
        isLoading={moving}
        zClass="z-[140]"
        stats={moveResult ? [
          { label: 'Moved', value: moveResult.moved ?? 0, tone: 'emerald' },
          { label: 'Already there', value: moveResult.skippedDuplicate ?? 0, tone: 'amber' },
          { label: 'Skipped', value: moveResult.skippedInvalid ?? 0, tone: 'red' },
        ] : [
          { label: 'Selected', value: moveIds.length, tone: 'brand' },
        ]}
      />

      <ConfirmationModal
        isOpen={whatsAppConfirmOpen}
        onClose={() => { setWhatsAppConfirmOpen(false); setWhatsAppTargets([]); }}
        onConfirm={openWhatsAppTabs}
        type="info"
        eyebrow="WhatsApp"
        title="Open WhatsApp"
        message={`Open WhatsApp for ${whatsAppTargets.length} contact(s)? Each will open in a new tab.`}
        confirmText="Open WhatsApp"
        cancelText="Cancel"
        zClass="z-[140]"
      />

      <ConfirmationModal
        isOpen={consentBulkConfirmOpen}
        onClose={() => {
          if (consentBulkSaving) return;
          setConsentBulkConfirmOpen(false);
          setConsentBulk(null);
        }}
        onConfirm={confirmBulkConsent}
        type="info"
        eyebrow="Marketing consent"
        title={consentBulk ? 'Enable consent?' : 'Remove consent?'}
        message={
          consentBulk
            ? `Enable marketing consent for ${selectedIds.length} selected contact(s). Unsubscribed flags will be cleared where consent is enabled.`
            : `Remove marketing consent for ${selectedIds.length} selected contact(s). They will be excluded from Send marketing.`
        }
        confirmText={consentBulk ? 'Enable consent' : 'Remove consent'}
        cancelText="Cancel"
        isLoading={consentBulkSaving}
        zClass="z-[140]"
      />

      <MisBulkEditModal
        open={bulkEditOpen}
        onClose={() => { if (!bulkEditing) setBulkEditOpen(false); }}
        selectedCount={selectedIds.length}
        onSubmit={submitBulkEdit}
        isLoading={bulkEditing}
      />
    </div>
  );
}
