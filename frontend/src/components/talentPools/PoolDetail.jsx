import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Trash2, Loader2, UserPlus, ArrowLeft,
  ChevronLeft, ChevronRight, Info, Settings2,
  Layers, CheckSquare, Square,
} from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../../utils/fetchUtils';
import EmptyState from '../ui/EmptyState';
import ConfirmationModal from '../ConfirmationModal';
import { useAuth } from '../../context/AuthContext';
import { planHasFeature } from '../../config/planFeatures';
import { MEMBER_PAGE_SIZE } from './talentPoolsConstants';
import { AddCandidatesModal } from './AddCandidatesModal';

export const PoolDetail = ({ pool, onBack, toast, onPoolUpdated, onManage }) => {
  const { organization } = useAuth();
  const canAutomate = planHasFeature(organization?.plan, 'candidates.talentPoolAutomation');
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [savingAuto, setSavingAuto] = useState(false);
  const [localPool, setLocalPool] = useState(pool);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [bulkRemoving, setBulkRemoving] = useState(false);

  useEffect(() => { setLocalPool(pool); }, [pool]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`/api/talent-pools/${pool._id}/candidates`);
      const data = await readApiJson(res);
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to load pool members');
        setCandidates([]);
        return;
      }
      setCandidates(data.data?.candidates || data.data || []);
    } catch {
      toast?.error?.('Failed to load pool members');
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [pool._id, toast]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(candidates.length / MEMBER_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * MEMBER_PAGE_SIZE;
  const paged = candidates.slice(pageStart, pageStart + MEMBER_PAGE_SIZE);

  const allPageSelected = paged.length > 0 && paged.every((c) => selectedIds.has(c._id));

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) paged.forEach((c) => next.delete(c._id));
      else paged.forEach((c) => next.add(c._id));
      return next;
    });
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const res = await authenticatedFetch(`/api/talent-pools/${pool._id}/candidates/${removeTarget._id}`, { method: 'DELETE' });
      const data = await readApiJson(res);
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to remove candidate');
        return;
      }
      toast?.success?.('Removed from pool');
      setRemoveTarget(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(removeTarget._id);
        return next;
      });
      await load();
      onPoolUpdated?.(localPool);
    } catch {
      toast?.error?.('Failed to remove candidate');
    } finally {
      setRemoving(false);
    }
  };

  const handleBulkRemove = async () => {
    if (!selectedIds.size) return;
    setBulkRemoving(true);
    try {
      let ok = 0;
      for (const id of selectedIds) {
        const res = await authenticatedFetch(`/api/talent-pools/${pool._id}/candidates/${id}`, { method: 'DELETE' });
        if (res.ok) ok += 1;
      }
      toast?.success?.(`Removed ${ok} candidate${ok === 1 ? '' : 's'} from pool`);
      setSelectedIds(new Set());
      await load();
      onPoolUpdated?.(localPool);
    } catch {
      toast?.error?.('Bulk remove failed');
    } finally {
      setBulkRemoving(false);
    }
  };

  const patchAutomation = async (body, successMsg) => {
    setSavingAuto(true);
    try {
      const res = await authenticatedFetch(`/api/talent-pools/${localPool._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      setLocalPool(data.data);
      onPoolUpdated?.(data.data);
      toast?.success?.(successMsg);
    } catch (err) {
      toast?.error?.(err.message || 'Update failed');
    } finally {
      setSavingAuto(false);
    }
  };

  return (
    <div className="space-y-5 animate-page-enter">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to pools
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3 sm:gap-4 min-w-0">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ring-1 ring-black/5"
            style={{ backgroundColor: `${localPool.color}22` }}
          >
            <Layers className="w-6 h-6" style={{ color: localPool.color }} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight" style={{ letterSpacing: '-0.025em' }}>
              {localPool.name}
            </h2>
            {localPool.description && <p className="text-sm text-stone-500 mt-1 leading-relaxed break-words">{localPool.description}</p>}
            <span className="badge-brand mt-2">{candidates.length} candidate{candidates.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button type="button" onClick={() => onManage?.(localPool)} className="btn-secondary flex-1 sm:flex-none">
            <Settings2 size={16} /> Manage
          </button>
          <button type="button" onClick={() => setShowAdd(true)} className="btn-primary flex-1 sm:flex-none">
            <UserPlus className="w-4 h-4" /> Add candidates
          </button>
        </div>
      </div>

      {canAutomate && (
        <div className="card-ats-bordered p-4 space-y-3 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <h3 className="text-sm font-semibold text-stone-900">Automation</h3>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
              checked={!!localPool.addOnReject}
              disabled={savingAuto}
              onChange={(e) => patchAutomation({ addOnReject: e.target.checked }, 'Automation updated')}
            />
            <span>
              <span className="block text-sm font-medium text-stone-800">Add on reject (silver medalist)</span>
              <span className="block text-xs text-stone-500">When an application is rejected, add the candidate to this pool.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
              checked={!!localPool.isDefaultRejectPool}
              disabled={savingAuto}
              onChange={(e) => patchAutomation({ isDefaultRejectPool: e.target.checked }, 'Default reject pool updated')}
            />
            <span>
              <span className="block text-sm font-medium text-stone-800">Default reject pool</span>
              <span className="block text-xs text-stone-500">Primary pool used for rejected candidates (one per org).</span>
            </span>
          </label>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5">
          <span className="text-sm font-semibold text-stone-700">{selectedIds.size} selected</span>
          <button
            type="button"
            className="btn-secondary !h-8 !text-red-600 hover:!bg-red-50"
            disabled={bulkRemoving}
            onClick={handleBulkRemove}
          >
            {bulkRemoving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Remove from pool
          </button>
          <button type="button" className="btn-ghost !h-8" onClick={() => setSelectedIds(new Set())}>Clear</button>
        </div>
      )}

      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center gap-2">
            <Loader2 className="w-7 h-7 text-brand-600 animate-spin" />
            <p className="text-sm text-stone-500 font-medium">Loading candidates…</p>
          </div>
        ) : candidates.length === 0 ? (
          <EmptyState
            icon={Users}
            tone="brand"
            message="No candidates in this pool yet"
            subMessage="Add candidates to keep them warm for future roles."
            action={(
              <button type="button" onClick={() => setShowAdd(true)} className="btn-primary">
                <UserPlus className="w-4 h-4" /> Add candidates
              </button>
            )}
          />
        ) : (
          <>
            <div className="cand-table-scroll overflow-x-auto">
              <table className="cand-table-drag w-full text-left border-collapse min-w-[900px] select-text border border-stone-200">
                <thead>
                  <tr className="bg-stone-100">
                    <th className="px-3.5 py-3.5 w-[52px] text-center border border-stone-200 bg-stone-100">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={toggleSelectPage}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSelectPage(); }}
                        className="cursor-pointer flex justify-center"
                        aria-label="Select page"
                      >
                        {allPageSelected
                          ? <CheckSquare size={18} className="text-brand-600" />
                          : <Square size={18} className="text-stone-400" />}
                      </div>
                    </th>
                    {['Name', 'Email', 'Phone', 'Position', 'Actions'].map((label) => (
                      <th
                        key={label}
                        className={`px-3.5 py-3.5 text-[10px] font-bold text-stone-600 uppercase tracking-wider whitespace-nowrap border border-stone-200 bg-stone-100 ${
                          label === 'Actions' ? 'text-right' : ''
                        }`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((c, rowIndex) => {
                    const selected = selectedIds.has(c._id);
                    return (
                      <tr
                        key={c._id}
                        className={`transition-colors ${
                          selected ? 'bg-brand-50/80' : rowIndex % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'
                        } hover:bg-brand-50/50`}
                      >
                        <td className="px-3.5 py-3 text-center border border-stone-200 align-middle">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleSelect(c._id)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSelect(c._id); }}
                            className="cursor-pointer flex justify-center"
                          >
                            {selected
                              ? <CheckSquare className="text-brand-600" size={17} />
                              : <Square className="text-stone-300 hover:text-stone-400" size={17} />}
                          </div>
                        </td>
                        <td className="px-3.5 py-3 text-sm text-stone-900 font-semibold border border-stone-200 align-middle break-words min-w-[140px]">
                          {c.name || '—'}
                        </td>
                        <td className="px-3.5 py-3 text-sm text-stone-700 font-medium border border-stone-200 align-middle break-all min-w-[180px]">
                          {c.email || '—'}
                        </td>
                        <td className="px-3.5 py-3 text-sm text-stone-700 font-medium border border-stone-200 align-middle whitespace-nowrap">
                          {c.contact || c.phone || '—'}
                        </td>
                        <td className="px-3.5 py-3 text-sm text-stone-700 font-medium border border-stone-200 align-middle break-words min-w-[140px]">
                          {c.position || '—'}
                        </td>
                        <td className="px-3.5 py-3 text-sm border border-stone-200 align-middle whitespace-nowrap">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => setRemoveTarget(c)}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-400 hover:text-red-600 hover:border-red-200"
                              title="Remove from pool"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-stone-100 bg-stone-50/50 px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs sm:text-sm text-stone-500 font-medium">
                Showing{' '}
                <span className="text-stone-800 font-semibold">
                  {paged.length > 0 ? pageStart + 1 : 0}–{pageStart + paged.length}
                </span>
                {' '}of{' '}
                <span className="text-stone-800 font-semibold">{candidates.length.toLocaleString()}</span>
                <span className="text-stone-400"> · {MEMBER_PAGE_SIZE} per page</span>
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                  disabled={safePage <= 1}
                  className="min-h-[40px] px-3.5 rounded-xl border-2 border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:border-brand-300 disabled:opacity-40 inline-flex items-center gap-1"
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page;
                    if (totalPages <= 5) page = i + 1;
                    else if (safePage <= 3) page = i + 1;
                    else if (safePage >= totalPages - 2) page = totalPages - 4 + i;
                    else page = safePage - 2 + i;
                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`min-h-[40px] min-w-[40px] rounded-xl text-sm font-semibold transition ${
                          page === safePage
                            ? 'bg-gradient-to-br from-brand-600 to-teal-600 text-white shadow-md shadow-brand-500/25'
                            : 'text-stone-600 hover:bg-white border border-transparent hover:border-stone-200'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                  disabled={safePage >= totalPages}
                  className="min-h-[40px] px-3.5 rounded-xl border-2 border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:border-brand-300 disabled:opacity-40 inline-flex items-center gap-1"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <AddCandidatesModal
        pool={pool}
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={async () => { await load(); onPoolUpdated?.(localPool); }}
      />
      <ConfirmationModal
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        title="Remove from pool?"
        message={`${removeTarget?.name || 'This candidate'} will stay in your database — only removed from this pool.`}
        confirmText="Remove"
        type="delete"
        isLoading={removing}
      />
    </div>
  );
};
