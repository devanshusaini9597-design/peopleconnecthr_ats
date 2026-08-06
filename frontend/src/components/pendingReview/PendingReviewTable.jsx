import React from 'react';
import {
  AlertCircle, CheckSquare, ChevronLeft, ChevronRight, Edit2, FileSpreadsheet,
  Inbox, Loader2, Sparkles, Square, Trash2,
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import CategoryBadge from './CategoryBadge';
import { PAGE_SIZE } from './pendingReviewConstants';
import { getOriginal, isImportReady } from './pendingReviewHelpers';

export default function PendingReviewTable({
  isLoading,
  rows,
  selected,
  showOriginals,
  page,
  total,
  totalPages,
  allSelected,
  tableScrollRef,
  onTableDragScrollStart,
  onTableDragScrollMove,
  onTableDragScrollEnd,
  togglePage,
  toggleRow,
  openEdit,
  runDelete,
  changePage,
  navigate,
}) {
  return (
    <div data-tour="pr-table" className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {isLoading ? (
        <div className="min-h-[280px] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-9 h-9 text-brand-600 animate-spin" />
          <p className="text-sm text-stone-500 font-medium">Loading pending queue…</p>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          tone="emerald"
          message="No pending records"
          subMessage="Flagged rows from Bulk Import land here. When the queue is empty, you’re clear."
          action={(
            <button type="button" className="btn-primary" onClick={() => navigate('/auto-import')}>
              <FileSpreadsheet size={16} /> Open Bulk Import
            </button>
          )}
        />
      ) : (
        <>
          <div
            className="cand-table-scroll overflow-x-auto select-none"
            ref={tableScrollRef}
            onMouseDown={onTableDragScrollStart}
            onMouseMove={onTableDragScrollMove}
            onMouseUp={onTableDragScrollEnd}
            onMouseLeave={onTableDragScrollEnd}
          >
            <table className="cand-table-drag w-full text-left border-collapse min-w-[1280px] select-text border border-stone-200">
              <thead>
                <tr className="bg-stone-100">
                  <th className="px-3.5 py-3.5 w-[52px] text-center border border-stone-200 bg-stone-100">
                    <button type="button" onClick={togglePage} className="inline-flex justify-center w-full" aria-label="Select page">
                      {allSelected ? <CheckSquare size={18} className="text-brand-600" /> : <Square size={18} className="text-stone-400" />}
                    </button>
                  </th>
                  {['Status', 'Name', 'Email', 'Contact', 'Company', 'Position', 'Score', 'Issues', 'Fixes', 'Edit'].map((h) => (
                    <th
                      key={h}
                      className="px-3.5 py-3.5 text-[10px] font-bold text-stone-600 uppercase tracking-wider whitespace-nowrap border border-stone-200 bg-stone-100"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const on = selected.has(row._id);
                  const ready = isImportReady(row);
                  const fixes = (row.autoFixChanges || []).length;
                  const issues = (row.validationErrors || []).length;
                  const score = row.confidence != null && row.confidence !== ''
                    ? `${String(row.confidence).replace(/%/g, '')}%`
                    : '—';
                  return (
                    <React.Fragment key={row._id}>
                      <tr
                        className={`transition-colors ${
                          on ? 'bg-brand-50/80' : index % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'
                        } hover:bg-brand-50/50`}
                      >
                        <td className="px-3.5 py-3 text-center w-[52px] border border-stone-200">
                          <button type="button" onClick={() => toggleRow(row._id)} className="inline-flex justify-center w-full" aria-label="Select row">
                            {on ? <CheckSquare className="text-brand-600" size={17} /> : <Square className="text-stone-300" size={17} />}
                          </button>
                        </td>
                        <td className="px-3.5 py-3 border border-stone-200 align-middle whitespace-nowrap">
                          <div className="flex flex-col gap-1 items-start">
                            <CategoryBadge cat={row.category} />
                            {ready && (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-100">
                                Ready
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3.5 py-3 text-sm font-semibold text-stone-900 border border-stone-200 align-middle whitespace-nowrap">
                          {row.name || '—'}
                        </td>
                        <td className="px-3.5 py-3 text-sm text-stone-600 border border-stone-200 align-middle whitespace-nowrap">
                          {row.email || '—'}
                        </td>
                        <td className="px-3.5 py-3 text-sm font-mono text-stone-600 border border-stone-200 align-middle whitespace-nowrap">
                          {row.contact || '—'}
                        </td>
                        <td className="px-3.5 py-3 text-sm text-stone-700 border border-stone-200 align-middle whitespace-nowrap">
                          {row.companyName || '—'}
                        </td>
                        <td className="px-3.5 py-3 text-sm text-stone-700 border border-stone-200 align-middle whitespace-nowrap">
                          {row.position || '—'}
                        </td>
                        <td className="px-3.5 py-3 text-sm font-bold text-stone-800 tabular-nums border border-stone-200 align-middle whitespace-nowrap">
                          {score}
                        </td>
                        <td className="px-3.5 py-3 border border-stone-200 align-middle whitespace-nowrap">
                          {issues > 0 ? (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-md"
                              title={(row.validationErrors || []).map((e) => (typeof e === 'object' ? (e.message || e.field || '') : String(e))).join(', ')}
                            >
                              <AlertCircle size={10} /> {issues}
                            </span>
                          ) : (
                            <span className="text-stone-300">—</span>
                          )}
                        </td>
                        <td className="px-3.5 py-3 border border-stone-200 align-middle whitespace-nowrap">
                          {fixes > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-md">
                              <Sparkles size={10} /> {fixes}
                            </span>
                          ) : (
                            <span className="text-stone-300">—</span>
                          )}
                        </td>
                        <td className="px-3.5 py-3 border border-stone-200 align-middle whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              className="h-8 w-8 rounded-full border border-stone-200 bg-stone-50 inline-flex items-center justify-center text-stone-600 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50"
                              onClick={() => openEdit(row)}
                              title="Edit"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              className="h-8 w-8 rounded-full border border-stone-200 bg-stone-50 inline-flex items-center justify-center text-red-500 hover:border-red-200 hover:bg-red-50"
                              onClick={() => runDelete(row._id)}
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {showOriginals && row.originalData && Object.keys(row.originalData).length > 0 && (
                        <tr className="bg-stone-50/80">
                          <td className="px-3 py-1.5 border border-stone-200 text-[10px] text-stone-400 font-bold whitespace-nowrap" colSpan={2}>
                            Original
                          </td>
                          {['name', 'email', 'contact', 'companyName', 'position'].map((f) => {
                            const orig = getOriginal(row, f);
                            const curr = row[f] || '';
                            const diff = orig != null && curr && String(orig).toLowerCase().trim() !== String(curr).toLowerCase().trim();
                            return (
                              <td
                                key={f}
                                className={`px-3.5 py-1.5 text-[10px] border border-stone-200 whitespace-nowrap ${diff ? 'text-amber-700 font-semibold' : 'text-stone-400'}`}
                              >
                                {orig != null ? String(orig) : '—'}
                              </td>
                            );
                          })}
                          <td className="border border-stone-200" colSpan={4} />
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-stone-100 bg-stone-50/50 px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs sm:text-sm text-stone-500 font-medium">
              Showing{' '}
              <span className="text-stone-800 font-semibold">
                {total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, total)}
              </span>{' '}
              of <span className="text-stone-800 font-semibold">{total.toLocaleString()}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="min-h-[40px] px-4 rounded-xl border-2 border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:border-brand-300 disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => changePage(page - 1)}
              >
                <ChevronLeft size={16} className="inline" /> Previous
              </button>
              <span className="text-sm font-semibold text-stone-700 tabular-nums px-2">{page} / {totalPages}</span>
              <button
                type="button"
                className="min-h-[40px] px-4 rounded-xl border-2 border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:border-brand-300 disabled:opacity-40"
                disabled={page >= totalPages}
                onClick={() => changePage(page + 1)}
              >
                Next <ChevronRight size={16} className="inline" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
