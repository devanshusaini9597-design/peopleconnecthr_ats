import React from 'react';
import {
  ThumbsUp, ThumbsDown, Loader2, Settings2, UserPlus, Trash2, RotateCcw, Filter,
  CheckSquare, Square, Eye, Download, ChevronLeft, ChevronRight,
} from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import {
  STATUS_FILTER_OPTIONS, PAGE_SIZE, statusOf, StatusBadge,
} from './resumeParsingConstants';

export function ParseResultsTable({
  toast,
  results, selectedIds, setSelectedIds, statusFilter, setStatusFilter,
  pendingCount, approvedCount, rejectedCount, failedCount,
  visibleResults, totalPages, safePage, pageStart, pagedResults,
  addingAll, setCurrentPage,
  tableScrollRef,
  setManyStatus, setRowStatus, removeRows,
  openConfirmAddAll, openReview, toggleSelect, allVisibleSelected, toggleSelectVisible,
  handleViewResume, handleDownloadResume,
  onTableDragScrollStart, onTableDragScrollMove, onTableDragScrollEnd,
}) {
  if (results.length === 0) return null;

  return (
    <div data-tour="parse-results" className="space-y-4 animate-slide-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">Review queue</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {pendingCount} pending · {approvedCount} approved · {rejectedCount} rejected · {failedCount} failed
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            disabled={!pendingCount}
            onClick={() => {
              setManyStatus(
                results.map((r, i) => (statusOf(r) === 'pending' ? i : -1)).filter((i) => i >= 0),
                'approved'
              );
              toast.success('All pending marked Approved');
            }}
          >
            Approve all pending
          </button>
          <button
            type="button"
            onClick={openConfirmAddAll}
            disabled={addingAll || approvedCount === 0}
            className="btn-primary"
          >
            {addingAll
              ? (<><Loader2 size={16} className="animate-spin" /> Adding…</>)
              : (<><UserPlus size={16} /> Add {approvedCount} approved</>)}
          </button>
        </div>
      </div>

      <div className="card-ats-bordered p-4 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="sm:w-56">
            <label htmlFor="parse-status-filter" className="label-ats">Status filter</label>
            <PremiumSelect
              id="parse-status-filter"
              variant="list"
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_FILTER_OPTIONS}
              icon={Filter}
            />
          </div>
          <div className="flex flex-wrap gap-2 flex-1">
            <button
              type="button"
              className="btn-secondary !h-[42px]"
              disabled={!selectedIds.size}
              onClick={() => {
                setManyStatus([...selectedIds], 'approved');
                toast.success(`${selectedIds.size} approved`);
                setSelectedIds(new Set());
              }}
            >
              <ThumbsUp size={14} /> Approve selected
            </button>
            <button
              type="button"
              className="btn-secondary !h-[42px]"
              disabled={!selectedIds.size}
              onClick={() => {
                setManyStatus([...selectedIds], 'rejected');
                toast.info(`${selectedIds.size} rejected — excluded from import`);
                setSelectedIds(new Set());
              }}
            >
              <ThumbsDown size={14} /> Reject selected
            </button>
            <button
              type="button"
              className="btn-secondary !h-[42px] !text-red-600 hover:!bg-red-50"
              disabled={!selectedIds.size}
              onClick={() => {
                removeRows([...selectedIds]);
                toast.success('Removed from queue');
              }}
            >
              <Trash2 size={14} /> Remove selected
            </button>
          </div>
        </div>
      </div>

      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- drag-to-scroll table viewport */}
      <div
        ref={tableScrollRef}
        className="cand-table-scroll overflow-x-auto select-none rounded-xl border border-stone-200 bg-white"
        onMouseDown={onTableDragScrollStart}
        onMouseMove={onTableDragScrollMove}
        onMouseUp={onTableDragScrollEnd}
        onMouseLeave={onTableDragScrollEnd}
      >
        <table className="cand-table-drag w-full text-left border-collapse min-w-[1180px] select-text border border-stone-200">
          <thead>
            <tr className="bg-stone-100">
              <th className="px-3.5 py-3.5 w-[52px] text-center border border-stone-200 bg-stone-100">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={toggleSelectVisible}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSelectVisible(); }}
                  className="cursor-pointer flex justify-center"
                  aria-label="Select all on this page"
                >
                  {allVisibleSelected
                    ? <CheckSquare size={18} className="text-brand-600" />
                    : <Square size={18} className="text-stone-400" />}
                </div>
              </th>
              {['Status', 'Resume', 'Name', 'Email', 'Phone', 'Position', 'Actions'].map((label) => (
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
            {pagedResults.length === 0 ? (
              <tr>
                <td colSpan={8} className="border border-stone-200 px-4 py-10 text-center text-sm text-stone-500">
                  No rows match this status filter.
                </td>
              </tr>
            ) : pagedResults.map(({ r: result, idx }, rowIndex) => {
              const st = statusOf(result);
              const selected = selectedIds.has(idx);
              return (
                <tr
                  key={result.id || `${result.fileName}-${idx}`}
                  className={`transition-colors ${
                    selected ? 'bg-brand-50/80' : rowIndex % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'
                  } hover:bg-brand-50/50 ${st === 'rejected' ? 'opacity-80' : ''}`}
                >
                  <td className="px-3.5 py-3 text-center w-[52px] border border-stone-200 align-top">
                    {result.success ? (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleSelect(idx)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSelect(idx); }}
                        className="cursor-pointer flex justify-center"
                      >
                        {selected
                          ? <CheckSquare className="text-brand-600" size={17} />
                          : <Square className="text-stone-300 hover:text-stone-400" size={17} />}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3.5 py-3 text-sm border border-stone-200 align-top whitespace-nowrap">
                    <StatusBadge status={st} />
                  </td>
                  <td className="px-3.5 py-3 text-sm border border-stone-200 align-middle">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:text-brand-600 hover:border-brand-300"
                        title={result.fileName ? `View · ${result.fileName}` : 'View resume'}
                        onClick={() => handleViewResume(result)}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:text-brand-600 hover:border-brand-300"
                        title={result.fileName ? `Download · ${result.fileName}` : 'Download resume'}
                        onClick={() => handleDownloadResume(result)}
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="px-3.5 py-3 text-sm text-stone-900 font-semibold border border-stone-200 align-top break-words min-w-[140px]">
                    {result.data?.name || '—'}
                  </td>
                  <td className="px-3.5 py-3 text-sm text-stone-700 font-medium border border-stone-200 align-top break-all min-w-[180px]">
                    {result.data?.email || '—'}
                  </td>
                  <td className="px-3.5 py-3 text-sm text-stone-700 font-medium border border-stone-200 align-top whitespace-nowrap">
                    {result.data?.contact || '—'}
                  </td>
                  <td className="px-3.5 py-3 text-sm text-stone-700 font-medium border border-stone-200 align-top break-words min-w-[160px]">
                    {result.data?.position || '—'}
                  </td>
                  <td className="px-3.5 py-3 text-sm border border-stone-200 align-top whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:text-brand-600 hover:border-brand-300"
                        title="Manage"
                        onClick={() => openReview(idx)}
                      >
                        <Settings2 size={14} />
                      </button>
                      {result.success && st !== 'approved' && (
                        <button
                          type="button"
                          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                          title="Approve"
                          onClick={() => { setRowStatus(idx, 'approved'); toast.success('Approved'); }}
                        >
                          <ThumbsUp size={14} />
                        </button>
                      )}
                      {result.success && st === 'approved' && (
                        <button
                          type="button"
                          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:bg-amber-50 hover:text-amber-700"
                          title="Unapprove → Pending"
                          onClick={() => { setRowStatus(idx, 'pending'); toast.info('Back to Pending'); }}
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                      {result.success && st !== 'rejected' && (
                        <button
                          type="button"
                          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:text-red-600 hover:border-red-200"
                          title="Reject — exclude from import"
                          onClick={() => { setRowStatus(idx, 'rejected'); toast.info('Rejected — will not import'); }}
                        >
                          <ThumbsDown size={14} />
                        </button>
                      )}
                      {result.success && st === 'rejected' && (
                        <button
                          type="button"
                          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:bg-amber-50"
                          title="Restore to Pending"
                          onClick={() => { setRowStatus(idx, 'pending'); toast.success('Restored to Pending'); }}
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-400 hover:text-red-600 hover:border-red-200"
                        title="Remove from queue"
                        onClick={() => removeRows([idx])}
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

      {visibleResults.length > 0 && (
        <div className="border border-stone-200 rounded-xl bg-stone-50/50 px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs sm:text-sm text-stone-500 font-medium">
            Showing{' '}
            <span className="text-stone-800 font-semibold">
              {pagedResults.length > 0 ? pageStart + 1 : 0}–{pageStart + pagedResults.length}
            </span>
            {' '}of{' '}
            <span className="text-stone-800 font-semibold">{visibleResults.length.toLocaleString()}</span>
            <span className="text-stone-400"> · {PAGE_SIZE} per page</span>
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
      )}
    </div>
  );
}
