import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ClipboardList, Download, FileSpreadsheet, Info, Keyboard, RefreshCw, Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../Toast';
import PageHeader from '../../ui/PageHeader';
import ProductTour from '../../ui/ProductTour';
import TourHelpFab from '../../ui/TourHelpFab';
import ConfirmationModal from '../../ConfirmationModal';
import { PendingReviewProvider, usePendingReview } from '../context/PendingReviewContext';
import { STATUS_OPTIONS } from '../pendingReviewConstants';
import { PAGE_SIZE, TOUR_KEY, WORKBENCH_TOUR_STEPS } from './workbenchConstants';
import { ctcRanges, expectedCtcOptions, noticePeriodOptions } from '../../../utils/ctcRanges';
import { isImportReady, validateEditFields } from '../pendingReviewHelpers';
import PendingReviewEditModal from '../PendingReviewEditModal';
import WorkbenchFilters from './WorkbenchFilters';
import StagingQueue from './StagingQueue';
import DecisionInspector from './DecisionInspector';
import BatchActionBar from './BatchActionBar';
import usePageTour from '../../../hooks/usePageTour';

const SHORTCUTS = {
  'Ctrl/Cmd + K': 'Focus search',
  'Ctrl/Cmd + A': 'Select all on page',
  Escape: 'Clear selection / close',
  'Ctrl/Cmd + E': 'Fix focused record',
  'Ctrl/Cmd + I': 'Release selected',
  '?': 'Toggle shortcuts',
};

function WorkbenchContent() {
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useTranslation();
  const [tourOpen, setTourOpen] = usePageTour(TOUR_KEY);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [activeId, setActiveId] = useState(null);

  const {
    rows,
    total,
    stats,
    isLoading,
    isError,
    error,
    positions,
    clients,
    sources,
    selectedIds,
    bucket,
    query,
    page,
    editing,
    editErrors,
    confirmModal,
    isSaving,
    isDeleting,
    isImporting,
    isClearing,
    setBucket,
    setQuery,
    setPage,
    setSelectedIds,
    toggleRow,
    togglePage,
    selectImportReady,
    openEdit,
    updateEdit,
    saveEdit,
    runDelete,
    runImport,
    clearAll,
    importFromEdit,
    setEditing,
    setEditErrors,
    setConfirmModal,
    refetch,
  } = usePendingReview();

  const activeRow = useMemo(
    () => rows.find((r) => r._id === activeId) || null,
    [rows, activeId],
  );

  useEffect(() => {
    if (!rows.length) {
      setActiveId(null);
      return;
    }
    if (!activeId || !rows.some((r) => r._id === activeId)) {
      setActiveId(rows[0]._id);
    }
  }, [rows, activeId]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refetch]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('wb-search')?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !e.target.matches('input, textarea, select')) {
        e.preventDefault();
        togglePage(rows);
      }
      if (e.key === 'Escape') {
        if (editing) setEditing(null);
        else if (showShortcuts) setShowShortcuts(false);
        else if (selectedIds.size > 0) setSelectedIds(new Set());
        else if (confirmModal.isOpen) setConfirmModal({ isOpen: false });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        if (activeRow) openEdit(activeRow);
        else if (selectedIds.size === 1) {
          const row = rows.find((r) => selectedIds.has(r._id));
          if (row) openEdit(row);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'i' && selectedIds.size > 0) {
        e.preventDefault();
        runImport([...selectedIds]);
      }
      if (e.key === '?' && !e.target.matches('input, textarea, select')) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [
    rows, selectedIds, editing, confirmModal, showShortcuts, activeRow,
    togglePage, openEdit, runImport, setSelectedIds, setEditing, setConfirmModal,
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r._id));
  const selectedCount = selectedIds.size;
  const readyOnPage = useMemo(() => rows.filter(isImportReady).length, [rows]);
  const readySelectedCount = useMemo(
    () => rows.filter((r) => selectedIds.has(r._id) && isImportReady(r)).length,
    [rows, selectedIds],
  );

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

  const handleExport = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        format: 'xlsx',
        ...(bucket !== 'all' ? { category: bucket } : {}),
        ...(query ? { search: query } : {}),
      });
      const res = await fetch(`/api/candidates/pending/export?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pending-review-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Queue exported');
    } catch (err) {
      toast.error(err.message || 'Export failed');
    }
  }, [bucket, query, toast]);

  const validateEdit = useCallback(() => {
    const err = validateEditFields(editing);
    setEditErrors(err);
    return Object.keys(err).length === 0;
  }, [editing, setEditErrors]);

  const handleSaveEdit = useCallback(async () => {
    if (!editing?._id) return;
    if (!validateEdit()) {
      toast.warning('Fix required fields');
      return;
    }
    await saveEdit();
    toast.success('Record updated');
  }, [editing, saveEdit, validateEdit, toast]);

  const handleImportFromEdit = useCallback(async () => {
    if (!editing?._id) return;
    if (!validateEdit()) {
      toast.warning('Fix required fields before release');
      return;
    }
    await importFromEdit();
  }, [editing, importFromEdit, validateEdit, toast]);

  if (isError) {
    return (
      <div className="page-shell-ats flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md px-4">
          <h2 className="text-xl font-bold text-stone-900 mb-2">Couldn’t load pending queue</h2>
          <p className="text-stone-600 mb-4">{error?.message || 'Unexpected error'}</p>
          <button type="button" className="btn-primary" onClick={refetch}>
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`page-shell-ats animate-page-enter ${selectedCount > 0 ? 'pb-24' : ''}`}>
        <PageHeader
          icon={ClipboardList}
          title={t('pages.pendingReview.title', { defaultValue: 'Pending Review' })}
          subtitle="Operator workbench for Bulk Import — inspect each row, fix gaps, then release into Candidates."
          gradientTitle
        >
          <button type="button" className="btn-secondary flex-1 sm:flex-none" onClick={() => navigate('/auto-import')}>
            <FileSpreadsheet className="w-4 h-4" /> Bulk Import
          </button>
          <button
            type="button"
            className="btn-primary flex-1 sm:flex-none"
            disabled={!selectedCount || isImporting}
            onClick={() => runImport([...selectedIds])}
          >
            Release selected{selectedCount ? ` (${selectedCount})` : ''}
          </button>
        </PageHeader>

        <div
          data-tour="wb-tip"
          className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1.5"
        >
          <span className="inline-flex items-center gap-1.5 text-brand-700 font-semibold">
            <Info className="w-3.5 h-3.5" /> Tip
          </span>
          <span>
            Work one record in the decision panel, or multi-select for batch release. Press{' '}
            <span className="font-semibold text-stone-800">?</span> for shortcuts.
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-tour="wb-kpis">
          {[
            { label: 'In queue', value: stats.total, hint: 'Total staged' },
            { label: 'Needs review', value: stats.review, hint: 'Fixable gaps' },
            { label: 'Blocked', value: stats.blocked, hint: 'Critical gaps' },
            { label: 'Selected', value: selectedCount, hint: `${readyOnPage} ready on page` },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-2xl font-bold tabular-nums text-stone-900 leading-none">{k.value}</p>
              <p className="text-sm font-semibold text-stone-800 mt-1.5">{k.label}</p>
              <p className="text-[11px] text-stone-400">{k.hint}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary !h-9 !text-xs" onClick={refetch} disabled={isLoading}>
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button type="button" className="btn-secondary !h-9 !text-xs" onClick={() => setShowShortcuts(true)}>
            <Keyboard className="w-3.5 h-3.5" /> Shortcuts
          </button>
          <button type="button" className="btn-secondary !h-9 !text-xs" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          {stats.total > 0 && (
            <button
              type="button"
              className="btn-secondary !h-9 !text-xs !text-red-600 !border-red-200 hover:!bg-red-50"
              disabled={isClearing}
              onClick={() => clearAll(stats.total)}
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear queue
            </button>
          )}
        </div>

        <WorkbenchFilters
          query={query}
          setQuery={setQuery}
          bucket={bucket}
          setBucket={setBucket}
          readyOnPage={readyOnPage}
          selectedCount={selectedCount}
          isImporting={isImporting}
          onSelectReady={() => selectImportReady(rows, isImportReady)}
          onClearSelection={() => setSelectedIds(new Set())}
          onDeleteSelected={() => runDelete([...selectedIds])}
          onImportSelected={() => runImport([...selectedIds])}
          statsTotal={total}
        />

        <section className="rounded-xl border border-stone-200/90 bg-white shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)] min-h-[520px]">
            <StagingQueue
              isLoading={isLoading}
              rows={rows}
              selectedIds={selectedIds}
              activeId={activeId}
              page={page}
              total={total}
              totalPages={totalPages}
              allSelected={allSelected}
              onTogglePage={() => togglePage(rows)}
              onToggleRow={toggleRow}
              onActivate={(row) => setActiveId(row._id)}
              onChangePage={setPage}
              onOpenImport={() => navigate('/auto-import')}
            />
            <DecisionInspector
              row={activeRow}
              isImporting={isImporting}
              onFix={openEdit}
              onRelease={(id) => runImport([id])}
              onDiscard={(id) => runDelete(id)}
            />
          </div>
        </section>

        <TourHelpFab onClick={() => setTourOpen(true)} label="Tour" title="Tour Pending Review" />
        <ProductTour open={tourOpen} onClose={() => setTourOpen(false)} steps={WORKBENCH_TOUR_STEPS} storageKey={TOUR_KEY} />
      </div>

      <BatchActionBar
        selectedCount={selectedCount}
        readySelectedCount={readySelectedCount}
        isImporting={isImporting}
        onClear={() => setSelectedIds(new Set())}
        onDelete={() => runDelete([...selectedIds])}
        onImport={() => runImport([...selectedIds])}
        onSelectReady={() => selectImportReady(rows, isImportReady)}
      />

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
        saveEdit={handleSaveEdit}
        importFromEdit={handleImportFromEdit}
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
        isLoading={isImporting || isDeleting || isClearing}
      />

      {showShortcuts && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/55 backdrop-blur-sm" onClick={() => setShowShortcuts(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-stone-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
              <h3 className="text-lg font-bold text-stone-900">Keyboard shortcuts</h3>
              <button type="button" className="p-2 rounded-lg hover:bg-stone-100 text-stone-400" onClick={() => setShowShortcuts(false)} aria-label="Close">
                <Info className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {Object.entries(SHORTCUTS).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 py-2 border-b border-stone-100 last:border-0">
                  <kbd className="px-3 py-1.5 rounded-lg bg-stone-100 text-stone-700 font-mono text-sm font-semibold shrink-0">{k}</kbd>
                  <span className="text-sm text-stone-600 text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function PendingReviewWorkbench() {
  return (
    <PendingReviewProvider>
      <WorkbenchContent />
    </PendingReviewProvider>
  );
}
