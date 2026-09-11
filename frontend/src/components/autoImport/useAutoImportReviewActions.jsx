import React from 'react';
import { importReviewedInChunks, savePendingInChunks } from '../../utils/bulkImportApi';
import { formatNameForInput } from '../../utils/textFormatter';
import { DRAFT_KEY, rowKey } from './constants';

/**
 * Selection, import, pending-save, and row-edit actions for auto-import review.
 * State stays in useAutoImport; this only returns callbacks.
 */
export function useAutoImportReviewActions({
  toast,
  reviewData,
  fileName,
  pageRows,
  selected,
  selectedList,
  selectedNew,
  selectedUpdates,
  reviewCount,
  blockedCount,
  editingRow,
  setSelected,
  setConfirmModal,
  setIsImporting,
  setReviewData,
  setImportResult,
  setStep,
  setIsSavingPending,
  setEditingRow,
  setEditErrors,
  setBucket,
}) {
  const toggleRow = (row) => {
    if (row._category !== 'ready') {
      toast.info('Fix this row with Edit first — it must be Ready before import.');
      return;
    }
    const k = rowKey(row);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const selectPageReady = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      pageRows.forEach((r) => {
        if (r._category === 'ready') next.add(rowKey(r));
      });
      return next;
    });
  };

  const deselectPageReady = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      pageRows.forEach((r) => {
        if (r._category === 'ready') next.delete(rowKey(r));
      });
      return next;
    });
  };

  /** Header checkbox: select all Ready on this page, or clear page if already all selected. */
  const togglePageReady = () => {
    const readyOnPage = pageRows.filter((r) => r._category === 'ready');
    if (readyOnPage.length === 0) return;
    const allOn = readyOnPage.every((r) => selected.has(rowKey(r)));
    if (allOn) deselectPageReady();
    else selectPageReady();
  };

  const selectAllReady = () => {
    setSelected(new Set((reviewData?.ready || []).map((r) => `ready-${r.rowIndex}`)));
  };

  const skipExistingInAts = () => {
    setSelected(new Set(
      (reviewData?.ready || [])
        .filter((r) => !r.isDbDuplicate)
        .map((r) => `ready-${r.rowIndex}`)
    ));
    toast.info('Deselected rows already in Candidates — only new emails selected');
  };

  const clearSelection = () => setSelected(new Set());

  const runImport = async () => {
    const toImport = selectedList.filter((r) => r._category === 'ready');
    if (toImport.length === 0) {
      toast.warning('Select at least one Ready row to import');
      return;
    }
    setConfirmModal({ isOpen: false });
    setIsImporting(true);
    try {
      // Chunked POSTs — a single 10k-row JSON body exceeds the server 10mb limit
      const data = await importReviewedInChunks({
        readyRecords: toImport,
        reviewRecords: [],
        onProgress: ({ chunk, totalChunks }) => {
          if (totalChunks > 1) {
            toast.info(`Importing batch ${chunk}/${totalChunks}…`, 2000);
          }
        },
      });

      const selectedIndexes = new Set(toImport.map((r) => `ready-${r.rowIndex}`));
      const remainingReview = reviewCount;
      const remainingBlocked = blockedCount;

      setReviewData((prev) => {
        if (!prev) return prev;
        return {
          ready: (prev.ready || []).filter((r) => !selectedIndexes.has(`ready-${r.rowIndex}`)),
          review: prev.review || [],
          blocked: prev.blocked || [],
        };
      });
      setSelected(new Set());
      setImportResult({
        imported: data.imported ?? 0,
        upserted: data.upserted ?? 0,
        modified: data.modified ?? 0,
        fileName,
        remainingReview,
        remainingBlocked,
      });
      setStep('done');
      localStorage.removeItem(DRAFT_KEY);
      const up = data.upserted ?? 0;
      const mod = data.modified ?? 0;
      const total = data.imported ?? 0;
      if (data.failedChunks > 0) {
        toast.warning(`Partially imported ${total}. ${data.failedChunks} batch(es) failed — open Candidates, then retry import for the rest.`);
      } else if (total > 0 || up > 0 || mod > 0) {
        toast.success(
          mod > 0 || up > 0
            ? `Done — ${up} new, ${mod} updated. Open Candidates to view them.`
            : `Imported ${total} candidates. Open Candidates to view them.`
        );
      } else {
        toast.warning('Import finished but no rows were written. Try again or contact support.');
      }
    } catch (err) {
      toast.error(err.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const confirmImport = () => {
    if (!selectedList.length) {
      toast.warning('Select rows to import first');
      return;
    }
    const nonReady = selectedList.filter((r) => r._category !== 'ready');
    if (nonReady.length) {
      toast.warning('Only Ready rows can be imported. Fix others with Edit first.');
      return;
    }
    setConfirmModal({
      isOpen: true,
      type: 'success',
      eyebrow: 'Bulk import',
      title: 'Confirm import',
      message: 'These selected Ready rows will be written to Candidates.',
      stats: [
        { label: 'Selected', value: selectedList.length, hint: 'Ready to write', tone: 'brand' },
        { label: 'New', value: selectedNew, hint: 'Profiles created', tone: 'emerald' },
        { label: 'Updates', value: selectedUpdates, hint: 'Existing emails', tone: 'violet' },
      ],
      details: selectedUpdates > 0
        ? (
          <ul className="space-y-1.5 text-sm text-stone-600">
            <li className="flex gap-2"><span className="text-brand-600 font-bold">·</span><span>Matching emails <strong className="text-stone-800">update</strong> the existing candidate — no duplicates.</span></li>
            <li className="flex gap-2"><span className="text-brand-600 font-bold">·</span><span>Unchecked rows stay out of Candidates.</span></li>
          </ul>
        )
        : (
          <p>Unchecked rows stay out of Candidates until you import them later.</p>
        ),
      confirmText: `Import ${selectedList.length}`,
      onConfirm: runImport,
    });
  };

  const sendRestToPending = async () => {
    const pending = [
      ...(reviewData?.review || []).map((r) => ({ ...r, category: 'review' })),
      ...(reviewData?.blocked || []).map((r) => ({ ...r, category: 'blocked' })),
    ];
    if (!pending.length) {
      toast.info('No review/blocked rows left');
      return;
    }
    setIsSavingPending(true);
    try {
      const data = await savePendingInChunks({ records: pending, fileName });
      setReviewData((prev) => (prev ? { ...prev, review: [], blocked: [] } : prev));
      toast.success(`${data.count ?? pending.length} sent to Pending Review`);
    } catch (err) {
      toast.error(err.message || 'Failed');
    } finally {
      setIsSavingPending(false);
    }
  };

  const updateEdit = (field, value) => {
    const v = ['name', 'companyName', 'location', 'spoc', 'remark'].includes(field)
      ? formatNameForInput(value) : value;
    setEditingRow((prev) => ({ ...prev, fixed: { ...prev.fixed, [field]: v } }));
    setEditErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const saveEdited = async () => {
    if (!editingRow) return;
    const rec = { ...(editingRow.original || {}), ...(editingRow.fixed || {}) };
    const err = {};
    if (!(rec.name || '').trim()) err.name = 'Required';
    if (!(rec.email || '').trim()) err.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(rec.email).trim())) err.email = 'Invalid email';
    const phone = String(rec.contact || '').replace(/\D/g, '');
    if (phone.length < 10) err.contact = '10-digit mobile required';
    if (!(rec.companyName || '').trim()) err.companyName = 'Required';
    if (!(rec.ctc || '').trim()) err.ctc = 'Required';
    setEditErrors(err);
    if (Object.keys(err).length) {
      toast.warning('Fix required fields');
      return;
    }

    const fixed = {
      name: String(rec.name || '').trim(),
      email: String(rec.email || '').trim().toLowerCase(),
      contact: String(rec.contact || '').trim(),
      position: rec.position || '',
      companyName: String(rec.companyName || '').trim(),
      location: String(rec.location || '').trim(),
      ctc: rec.ctc || '',
      expectedCtc: rec.expectedCtc || '',
      experience: rec.experience != null ? String(rec.experience) : '',
      noticePeriod: rec.noticePeriod || '',
      status: rec.status || 'Applied',
      source: rec.source || '',
      client: rec.client || '',
      spoc: String(rec.spoc || '').trim(),
      remark: String(rec.remark || '').trim(),
      date: rec.date || '',
    };

    setReviewData((prev) => {
      if (!prev) return prev;
      const idx = editingRow.rowIndex;
      const strip = (arr) => (arr || []).filter((r) => r.rowIndex !== idx);
      const upgraded = {
        rowIndex: idx,
        fixed,
        original: editingRow.original || {},
        validation: {
          ...(editingRow.validation || {}),
          confidence: Math.max(90, editingRow.validation?.confidence || 0),
          category: 'ready',
          errors: [],
          warnings: [],
        },
        autoFixChanges: editingRow.autoFixChanges || [],
      };
      return {
        ready: [...strip(prev.ready), upgraded],
        review: strip(prev.review),
        blocked: strip(prev.blocked),
      };
    });
    setSelected((prev) => {
      const next = new Set(prev);
      ['ready', 'review', 'blocked'].forEach((c) => next.delete(`${c}-${editingRow.rowIndex}`));
      next.add(`ready-${editingRow.rowIndex}`);
      return next;
    });
    setEditingRow(null);
    setBucket('ready');
    toast.success('Row fixed and moved to Ready — included in selection');
  };

  return {
    toggleRow,
    selectPageReady,
    deselectPageReady,
    togglePageReady,
    selectAllReady,
    skipExistingInAts,
    clearSelection,
    confirmImport,
    sendRestToPending,
    updateEdit,
    saveEdited,
  };
}
