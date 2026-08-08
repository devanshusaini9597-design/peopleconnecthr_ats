import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, FileSpreadsheet, Inbox, Info, RefreshCw, Trash2,
  Keyboard, Download, Settings, Filter,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import ConfirmationModal from './ConfirmationModal';
import { PendingReviewProvider, usePendingReview } from './pendingReview/context/PendingReviewContext';
import { PAGE_SIZE, TOUR_KEY, TOUR_STEPS, STATUS_OPTIONS } from './pendingReview/pendingReviewConstants';
import { ctcRanges, expectedCtcOptions, noticePeriodOptions } from '../utils/ctcRanges';
import { formatNameForInput } from '../utils/textFormatter';
import { isImportReady, validateEditFields, buildEditPayload } from './pendingReview/pendingReviewHelpers';
import PendingReviewKpis from './pendingReview/PendingReviewKpis';
import PendingReviewToolbar from './pendingReview/PendingReviewToolbar';
import PendingReviewTable from './pendingReview/PendingReviewTable';
import PendingReviewEditModal from './pendingReview/PendingReviewEditModal';
import usePageTour from '../hooks/usePageTour';
import useTableDragScroll from '../hooks/useTableDragScroll';

// Enterprise-grade keyboard shortcuts
const KEYBOARD_SHORTCUTS = {
  'Ctrl/Cmd + K': 'Focus search',
  'Ctrl/Cmd + A': 'Select all on page',
  'Escape': 'Clear selection / Close modal',
  'Ctrl/Cmd + E': 'Edit selected',
  'Ctrl/Cmd + I': 'Import selected',
  'Ctrl/Cmd + Delete': 'Delete selected',
  'Arrow Up/Down': 'Navigate rows',
  'Enter': 'Edit focused row',
};

function PendingReviewPageContent() {
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useTranslation();
  const [tourOpen, setTourOpen] = usePageTour(TOUR_KEY);
  const {
    tableScrollRef,
    onTableDragScrollStart,
    onTableDragScrollMove,
    onTableDragScrollEnd,
  } = useTableDragScroll();

  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [savedFilters, setSavedFilters] = useState([]);

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
    showOriginals,
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
    setShowOriginals,
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

  // Auto-refresh on visibility change
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refetch]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl/Cmd + K: Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector('input[placeholder*="Search"]')?.focus();
      }
      // Ctrl/Cmd + A: Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        togglePage(rows);
      }
      // Escape: Clear selection
      if (e.key === 'Escape') {
        if (editing) {
          setEditing(null);
        } else if (selectedIds.size > 0) {
          setSelectedIds(new Set());
        } else if (confirmModal.isOpen) {
          setConfirmModal({ isOpen: false });
        }
      }
      // Ctrl/Cmd + E: Edit selected
      if ((e.ctrlKey || e.metaKey) && e.key === 'e' && selectedIds.size === 1) {
        e.preventDefault();
        const selectedRow = rows.find((r) => selectedIds.has(r._id));
        if (selectedRow) openEdit(selectedRow);
      }
      // Ctrl/Cmd + I: Import selected
      if ((e.ctrlKey || e.metaKey) && e.key === 'i' && selectedIds.size > 0) {
        e.preventDefault();
        runImport([...selectedIds]);
      }
      // Ctrl/Cmd + Delete: Delete selected
      if ((e.ctrlKey || e.metaKey) && e.key === 'Delete' && selectedIds.size > 0) {
        e.preventDefault();
        runDelete([...selectedIds]);
      }
      // ?: Show keyboard shortcuts
      if (e.key === '?' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        setShowKeyboardShortcuts((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, rows, editing, confirmModal, togglePage, openEdit, runImport, runDelete, setSelectedIds, setEditing, setConfirmModal]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r._id));
  const selectedCount = selectedIds.size;
  const readyOnPage = useMemo(() => rows.filter(isImportReady).length, [rows]);

  // Memoized options
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

  // Export functionality
  const handleExport = useCallback(async (format = 'xlsx') => {
    try {
      const params = new URLSearchParams({
        format,
        ...(bucket !== 'all' ? { category: bucket } : {}),
        ...(query ? { search } : {}),
      });
      const res = await fetch(`/api/candidates/pending/export?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pending-review-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(err.message || 'Export failed');
    }
  }, [bucket, query, toast]);

  // Validate edit
  const validateEdit = useCallback(() => {
    const err = validateEditFields(editing);
    setEditErrors(err);
    return Object.keys(err).length === 0;
  }, [editing, setEditErrors]);

  // Handle save with validation
  const handleSaveEdit = useCallback(async () => {
    if (!editing?._id) return;
    if (!validateEdit()) {
      toast.warning('Fix required fields');
      return;
    }
    await saveEdit();
    toast.success('Record updated');
  }, [editing, saveEdit, validateEdit, toast]);

  // Handle import from edit
  const handleImportFromEdit = useCallback(async () => {
    if (!editing?._id) return;
    if (!validateEdit()) {
      toast.warning('Fix required fields before import');
      return;
    }
    await importFromEdit();
  }, [editing, importFromEdit, validateEdit, toast]);

  if (isError) {
    return (
      <div className="page-shell-ats flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Info size={32} className="text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-stone-900 mb-2">Failed to load data</h2>
          <p className="text-stone-600 mb-4">{error?.message || 'An unexpected error occurred'}</p>
          <button type="button" className="btn-primary" onClick={refetch}>
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={Inbox}
          title={t('pages.pendingReview.title')}
          subtitle="Staging queue for import rows that need a human decision before they enter Candidates."
          gradientTitle
        >
          <span className="px-2 py-1 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold uppercase tracking-wider">Enterprise</span>
          <button type="button" className="btn-secondary" onClick={() => navigate('/ats')}>
            <ArrowLeft size={16} /> Candidates
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/auto-import')}>
            <FileSpreadsheet size={16} /> Bulk Import
          </button>
          <button type="button" className="btn-secondary" onClick={refetch} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button type="button" className="btn-secondary" onClick={() => setShowKeyboardShortcuts(true)}>
            <Keyboard size={16} /> Shortcuts
          </button>
          <button type="button" className="btn-secondary" onClick={() => handleExport('xlsx')}>
            <Download size={16} /> Export
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
          changeBucket={setBucket}
          changeSearch={setQuery}
          setShowOriginals={setShowOriginals}
          selectImportReady={() => selectImportReady(rows, isImportReady)}
          setSelected={setSelectedIds}
          runDelete={runDelete}
          runImport={runImport}
          selected={selectedIds}
        />

        <PendingReviewTable
          isLoading={isLoading}
          rows={rows}
          selected={selectedIds}
          showOriginals={showOriginals}
          page={page}
          total={total}
          totalPages={totalPages}
          allSelected={allSelected}
          tableScrollRef={tableScrollRef}
          onTableDragScrollStart={onTableDragScrollStart}
          onTableDragScrollMove={onTableDragScrollMove}
          onTableDragScrollEnd={onTableDragScrollEnd}
          togglePage={() => togglePage(rows)}
          toggleRow={toggleRow}
          openEdit={openEdit}
          runDelete={runDelete}
          changePage={setPage}
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
            <p className="text-xs text-stone-500 mt-1">
              <strong>Tip:</strong> Press <kbd className="px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 font-mono text-[11px]">?</kbd> for keyboard shortcuts
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

      {/* Keyboard Shortcuts Modal */}
      {showKeyboardShortcuts && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/55 backdrop-blur-sm" onClick={() => setShowKeyboardShortcuts(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-stone-200 bg-white shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
              <h3 className="text-lg font-bold text-stone-900">Keyboard Shortcuts</h3>
              <button
                type="button"
                onClick={() => setShowKeyboardShortcuts(false)}
                className="p-2 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600"
              >
                <Info size={18} />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {Object.entries(KEYBOARD_SHORTCUTS).map(([shortcut, description]) => (
                <div key={shortcut} className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0">
                  <kbd className="px-3 py-1.5 rounded-lg bg-stone-100 text-stone-700 font-mono text-sm font-semibold">
                    {shortcut}
                  </kbd>
                  <span className="text-sm text-stone-600">{description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Wrapper with provider
export default function PendingReviewPageEnterprise() {
  return (
    <PendingReviewProvider>
      <PendingReviewPageContent />
    </PendingReviewProvider>
  );
}
