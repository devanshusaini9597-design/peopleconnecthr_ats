import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, FileSpreadsheet, Inbox, Info, RefreshCw, Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authenticatedFetch, handleUnauthorized, isUnauthorized } from '../utils/fetchUtils';
import { ctcRanges, expectedCtcOptions, noticePeriodOptions } from '../utils/ctcRanges';
import { formatNameForInput } from '../utils/textFormatter';
import usePageTour from '../hooks/usePageTour';
import useTableDragScroll from '../hooks/useTableDragScroll';
import ConfirmationModal from './ConfirmationModal';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import { PAGE_SIZE, TOUR_KEY, STATUS_OPTIONS, TOUR_STEPS } from './pendingReview/pendingReviewConstants';
import {
  buildEditPayload, isImportReady, validateEditFields,
} from './pendingReview/pendingReviewHelpers';
import PendingReviewTable from './pendingReview/PendingReviewTable';
import PendingReviewEditModal from './pendingReview/PendingReviewEditModal';
import PendingReviewKpis from './pendingReview/PendingReviewKpis';
import PendingReviewToolbar from './pendingReview/PendingReviewToolbar';

export default function PendingReviewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(TOUR_KEY);
  const {
    tableScrollRef,
    onTableDragScrollStart,
    onTableDragScrollMove,
    onTableDragScrollEnd,
  } = useTableDragScroll();

  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bucket, setBucket] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ review: 0, blocked: 0, total: 0 });
  const [selected, setSelected] = useState(() => new Set());
  const [showOriginals, setShowOriginals] = useState(false);

  const [editing, setEditing] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false });

  const [positions, setPositions] = useState([]);
  const [clients, setClients] = useState([]);
  const [sources, setSources] = useState([]);

  const load = useCallback(async (pageNum = 1, category = bucket, search = query) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: String(PAGE_SIZE),
        ...(category !== 'all' ? { category } : {}),
        ...(search ? { search } : {}),
      });
      const res = await authenticatedFetch(`/candidates/pending?${params}`);
      if (isUnauthorized(res)) { handleUnauthorized(); return; }
      const data = await res.json().catch(() => ({}));
      if (!data.success) throw new Error(data.message || 'Failed to load');
      setRows(data.candidates || []);
      setTotal(data.total || 0);
      setStats(data.stats || { review: 0, blocked: 0, total: 0 });
    } catch (err) {
      toast.error(err.message || 'Failed to load pending records');
    } finally {
      setIsLoading(false);
    }
  }, [bucket, query, toast]);

  useEffect(() => { load(1, 'all', ''); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const [p, c, s] = await Promise.all([
          authenticatedFetch('/api/positions'),
          authenticatedFetch('/api/clients'),
          authenticatedFetch('/api/sources'),
        ]);
        if (dead) return;
        if (p.ok) setPositions(await p.json().catch(() => []));
        if (c.ok) setClients(await c.json().catch(() => []));
        if (s.ok) setSources(await s.json().catch(() => []));
      } catch { /* ignore */ }
    })();
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') load(page, bucket, query);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load, page, bucket, query]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r._id));
  const selectedCount = selected.size;
  const readyOnPage = useMemo(() => rows.filter(isImportReady).length, [rows]);

  const positionOptions = useMemo(() => [
    { value: '', label: 'Select' },
    ...positions.filter((p) => p.isActive !== false).map((p) => ({ value: p.name, label: p.name })),
  ], [positions]);
  const clientOptions = useMemo(() => [
    { value: '', label: 'Select' },
    ...clients.filter((c) => c.isActive !== false).map((c) => ({ value: c.name, label: c.name })),
  ], [clients]);
  const sourceOptions = useMemo(() => [
    { value: '', label: 'Select' },
    ...sources.filter((s) => s.isActive !== false).map((s) => ({ value: s.name, label: s.name })),
  ], [sources]);
  const statusOptions = useMemo(() => [
    { value: '', label: 'Select' },
    ...STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
  ], []);
  const ctcOptions = useMemo(() => [{ value: '', label: 'Select' }, ...ctcRanges.map((r) => ({ value: r, label: r }))], []);
  const ectcOptions = useMemo(() => [{ value: '', label: 'Select' }, ...expectedCtcOptions.map((r) => ({ value: r, label: r }))], []);
  const npOptions = useMemo(() => [{ value: '', label: 'Select' }, ...noticePeriodOptions.map((o) => ({ value: o, label: o }))], []);
  const expOptions = useMemo(() => [
    { value: '', label: 'Select' },
    { value: 'Fresher', label: 'Fresher' },
    ...[...Array(31).keys()].slice(1).map((n) => ({ value: String(n), label: `${n} yrs` })),
  ], []);

  const changeBucket = (id) => {
    setBucket(id);
    setPage(1);
    setSelected(new Set());
    load(1, id, query);
  };

  const changeSearch = (val) => {
    setQuery(val);
    setPage(1);
    setSelected(new Set());
    load(1, bucket, val);
  };

  const changePage = (p) => {
    setPage(p);
    setSelected(new Set());
    load(p, bucket, query);
  };

  const toggleRow = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePage = () => {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(rows.map((r) => r._id)));
  };

  const selectImportReady = () => {
    setSelected(new Set(rows.filter(isImportReady).map((r) => r._id)));
  };

  const openEdit = (row) => {
    setEditing({ ...row });
    setEditErrors({});
  };

  const updateEdit = (field, value) => {
    const v = ['name', 'companyName', 'location', 'spoc', 'remark'].includes(field)
      ? formatNameForInput(value) : value;
    setEditing((prev) => ({ ...prev, [field]: v }));
    setEditErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validateEdit = () => {
    const err = validateEditFields(editing);
    setEditErrors(err);
    return Object.keys(err).length === 0;
  };

  const saveEdit = async () => {
    if (!editing?._id) return;
    if (!validateEdit()) {
      toast.warning('Fix required fields');
      return;
    }
    setIsSaving(true);
    try {
      const res = await authenticatedFetch(`/candidates/pending/${editing._id}`, {
        method: 'PUT',
        body: JSON.stringify(buildEditPayload(editing)),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Record updated');
      setEditing(null);
      load(page, bucket, query);
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const runDelete = (ids) => {
    const list = Array.isArray(ids) ? ids : [ids];
    setConfirmModal({
      isOpen: true,
      type: 'delete',
      title: `Delete ${list.length} record${list.length > 1 ? 's' : ''}?`,
      message: 'This removes them from Pending Review only. Candidates already in ATS are not affected.',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          const res = await authenticatedFetch('/candidates/pending/delete', {
            method: 'POST',
            body: JSON.stringify({ ids: list }),
          });
          const data = await res.json().catch(() => ({}));
          if (!data.success) throw new Error(data.message || 'Delete failed');
          toast.success(`Deleted ${data.deletedCount ?? list.length}`);
          setSelected(new Set());
          load(page, bucket, query);
        } catch (err) {
          toast.error(err.message || 'Delete failed');
        } finally {
          setConfirmModal({ isOpen: false });
        }
      },
    });
  };

  const runImport = (ids) => {
    const list = Array.isArray(ids) ? ids : [ids];
    if (!list.length) {
      toast.warning('Select rows to import');
      return;
    }
    setConfirmModal({
      isOpen: true,
      type: 'success',
      title: `Import ${list.length} to Candidates?`,
      message: 'Selected pending rows move into your Candidates list. Same email updates the existing record (no duplicates).',
      confirmText: `Import ${list.length}`,
      onConfirm: async () => {
        setConfirmModal({ isOpen: false });
        setIsImporting(true);
        try {
          const res = await authenticatedFetch('/candidates/pending/import', {
            method: 'POST',
            body: JSON.stringify({ ids: list }),
          });
          const data = await res.json().catch(() => ({}));
          if (!data.success) throw new Error(data.message || 'Import failed');
          toast.success(`Imported ${data.imported} candidate${data.imported === 1 ? '' : 's'}`);
          if (data.failed > 0) toast.warning(`${data.failed} failed`);
          setSelected(new Set());
          setEditing(null);
          load(page, bucket, query);
        } catch (err) {
          toast.error(err.message || 'Import failed');
        } finally {
          setIsImporting(false);
        }
      },
    });
  };

  const clearAll = () => {
    setConfirmModal({
      isOpen: true,
      type: 'delete',
      title: 'Clear entire pending queue?',
      message: `This permanently removes all ${stats.total.toLocaleString()} pending records for your account.`,
      confirmText: 'Clear all',
      onConfirm: async () => {
        try {
          const res = await authenticatedFetch('/candidates/pending/clear-all', { method: 'POST', body: '{}' });
          const data = await res.json().catch(() => ({}));
          if (!data.success) throw new Error(data.message || 'Clear failed');
          toast.success(`Cleared ${data.deletedCount ?? 0}`);
          setSelected(new Set());
          load(1, bucket, query);
          setPage(1);
        } catch (err) {
          toast.error(err.message || 'Clear failed');
        } finally {
          setConfirmModal({ isOpen: false });
        }
      },
    });
  };

  const importFromEdit = async () => {
    if (!editing?._id) return;
    if (!validateEdit()) {
      toast.warning('Fix required fields before import');
      return;
    }
    setIsSaving(true);
    try {
      const saveRes = await authenticatedFetch(`/candidates/pending/${editing._id}`, {
        method: 'PUT',
        body: JSON.stringify(buildEditPayload(editing)),
      });
      if (!saveRes.ok) throw new Error('Could not save before import');
      setIsSaving(false);
      runImport([editing._id]);
    } catch (err) {
      toast.error(err.message || 'Save failed');
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={Inbox}
          title="Pending Review"
          subtitle="Staging queue for import rows that need a human decision before they enter Candidates."
          gradientTitle
        >
          <button type="button" className="btn-secondary" onClick={() => navigate('/ats')}>
            <ArrowLeft size={16} /> Candidates
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/auto-import')}>
            <FileSpreadsheet size={16} /> Bulk Import
          </button>
          <button type="button" className="btn-secondary" onClick={() => load(page, bucket, query)} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Refresh
          </button>
          {stats.total > 0 && (
            <button type="button" className="btn-secondary !text-red-600 !border-red-200 hover:!bg-red-50" onClick={clearAll}>
              <Trash2 size={14} /> Clear all
            </button>
          )}
        </PageHeader>

        <PendingReviewKpis stats={stats} selectedCount={selectedCount} readyOnPage={readyOnPage} />

        <PendingReviewToolbar
          stats={stats}
          bucket={bucket}
          query={query}
          selectedCount={selectedCount}
          readyOnPage={readyOnPage}
          showOriginals={showOriginals}
          isImporting={isImporting}
          changeBucket={changeBucket}
          changeSearch={changeSearch}
          setShowOriginals={setShowOriginals}
          selectImportReady={selectImportReady}
          setSelected={setSelected}
          runDelete={runDelete}
          runImport={runImport}
          selected={selected}
        />

        <PendingReviewTable
          isLoading={isLoading}
          rows={rows}
          selected={selected}
          showOriginals={showOriginals}
          page={page}
          total={total}
          totalPages={totalPages}
          allSelected={allSelected}
          tableScrollRef={tableScrollRef}
          onTableDragScrollStart={onTableDragScrollStart}
          onTableDragScrollMove={onTableDragScrollMove}
          onTableDragScrollEnd={onTableDragScrollEnd}
          togglePage={togglePage}
          toggleRow={toggleRow}
          openEdit={openEdit}
          runDelete={runDelete}
          changePage={changePage}
          navigate={navigate}
        />

        <div className="rounded-xl border border-brand-100 bg-brand-50/40 px-4 py-3 text-[13px] text-stone-700 flex gap-3 items-start">
          <Info size={16} className="text-brand-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 leading-relaxed">
            <p className="font-semibold text-stone-900">How this queue works</p>
            <p>
              Rows land here when Bulk Import flags them for review. Edit and save required fields, select the ones you approve,
              then import into Candidates. Nothing moves until you confirm.
            </p>
          </div>
        </div>

        <TourHelpFab onClick={() => setTourOpen(true)} label="Tour" title="Tour Pending Review" />
        <ProductTour open={tourOpen} onClose={() => setTourOpen(false)} steps={TOUR_STEPS} storageKey={TOUR_KEY} />
      </div>

      <PendingReviewEditModal
        editing={editing}
        editErrors={editErrors}
        isSaving={isSaving}
        isImporting={isImporting}
        positionOptions={positionOptions}
        ctcOptions={ctcOptions}
        ectcOptions={ectcOptions}
        expOptions={expOptions}
        npOptions={npOptions}
        statusOptions={statusOptions}
        sourceOptions={sourceOptions}
        clientOptions={clientOptions}
        updateEdit={updateEdit}
        saveEdit={saveEdit}
        importFromEdit={importFromEdit}
        onClose={() => setEditing(null)}
      />

      <ConfirmationModal
        isOpen={!!confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false })}
        onConfirm={confirmModal.onConfirm || (() => {})}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
        isLoading={isImporting}
      />
    </>
  );
}
