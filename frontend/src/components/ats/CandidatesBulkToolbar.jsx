import React from 'react';
import { Mail, Pencil, RefreshCw, Share2, Trash2, X } from 'lucide-react';
import { WhatsAppIcon } from '../icons/BrandIcons';
import { BULK_STATUS_OPTIONS } from './atsConstants';

export default function CandidatesBulkToolbar(props) {
  const {
    selectedIds, setSelectedIds, bulkStatusOpen, setBulkStatusOpen,
    startBulkEmailFlow, handleBulkWhatsApp, handleBulkStatusUpdate,
    openBulkEdit, handleShareClick, handleBulkDelete, isFreelancer,
    filteredCount = 0, isAllFilteredSelected = false, onSelectAllFiltered,
    selectionScopeLabel = '',
  } = props;
  if (!selectedIds?.length) return null;
  const canExpand = !isAllFilteredSelected && filteredCount > selectedIds.length && typeof onSelectAllFiltered === 'function';
  return (
        <div
          data-tour="cand-bulk"
          className="sticky top-0 z-30 animate-fade-in"
        >
          <div className="rounded-2xl border border-brand-200/70 bg-gradient-to-r from-brand-50/90 via-white to-white shadow-[var(--shadow-elevated)] overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center text-sm font-bold tabular-nums shadow-lg shadow-brand-500/25 ring-1 ring-white/20 flex-shrink-0">
                  {selectedIds.length}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">
                    Bulk actions
                  </p>
                  <p className="text-sm font-semibold text-stone-900 mt-0.5 truncate">
                    {selectedIds.length === 1 ? '1 candidate selected' : `${selectedIds.length} candidates selected`}
                    {selectionScopeLabel ? (
                      <span className="text-stone-500 font-medium"> · {selectionScopeLabel}</span>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedIds([]); setBulkStatusOpen(false); }}
                  className="h-10 w-10 rounded-xl border border-stone-200/80 bg-white text-stone-500 inline-flex items-center justify-center hover:bg-stone-50 hover:text-stone-800 hover:border-stone-300 transition-all shadow-sm flex-shrink-0"
                  title="Clear selection"
                  aria-label="Clear selection"
                >
                  <X size={16} strokeWidth={2} />
                </button>
              </div>

              <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                <div className="inline-flex items-center gap-2 p-1 rounded-xl bg-stone-50/80 border border-stone-100">
                  {!isFreelancer && (
                  <button
                    type="button"
                    onClick={startBulkEmailFlow}
                    className="h-10 w-10 rounded-lg bg-white border border-stone-200/80 text-stone-600 inline-flex items-center justify-center shadow-sm hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-all"
                    title="Email selected"
                    aria-label="Email selected"
                  >
                    <Mail size={17} strokeWidth={1.75} />
                  </button>
                  )}
                  {!isFreelancer ? (
                  <button
                    type="button"
                    onClick={handleBulkWhatsApp}
                    className="h-10 w-10 rounded-lg bg-white border border-stone-200/80 text-stone-600 inline-flex items-center justify-center shadow-sm hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-all"
                    title="WhatsApp selected"
                    aria-label="WhatsApp selected"
                  >
                    <WhatsAppIcon size={17} />
                  </button>
                  ) : (
                  <span
                    className="h-10 px-2.5 rounded-lg bg-stone-100 border border-stone-200 text-stone-400 inline-flex items-center justify-center gap-1.5 cursor-not-allowed opacity-70"
                    title="Paid company feature — messaging tools are for company recruiters only"
                  >
                    <WhatsAppIcon size={15} />
                    <span className="text-[9px] font-bold uppercase tracking-wide text-amber-700">Paid</span>
                  </span>
                  )}
                </div>

                {!isFreelancer && (
                <div className="inline-flex items-center gap-2 p-1 rounded-xl bg-stone-50/80 border border-stone-100">
                  <button
                    type="button"
                    onClick={openBulkEdit}
                    className="h-10 px-3 rounded-lg bg-white border border-stone-200/80 text-stone-700 inline-flex items-center justify-center gap-1.5 shadow-sm hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-all text-xs font-bold"
                    title="Bulk edit fields"
                    aria-label="Bulk edit fields"
                  >
                    <Pencil size={15} strokeWidth={1.75} />
                    Edit
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setBulkStatusOpen((v) => !v)}
                      aria-expanded={bulkStatusOpen}
                      className={`h-10 w-10 rounded-lg border inline-flex items-center justify-center shadow-sm transition-all ${
                        bulkStatusOpen
                          ? 'border-brand-400 bg-brand-50 text-brand-700'
                          : 'bg-white border-stone-200/80 text-stone-600 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50'
                      }`}
                      title="Change status"
                      aria-label="Change status"
                    >
                      <RefreshCw size={17} strokeWidth={1.75} />
                    </button>
                    {bulkStatusOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setBulkStatusOpen(false)} aria-hidden />
                        <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border border-stone-200 bg-white shadow-xl overflow-hidden">
                          <div className="px-3.5 py-2.5 border-b border-stone-100 bg-stone-50/80">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Set status</p>
                            <p className="text-[11px] text-stone-400 mt-0.5">Applies to {selectedIds.length} selected</p>
                          </div>
                          <div className="py-1 max-h-64 overflow-y-auto">
                            {BULK_STATUS_OPTIONS.map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => { setBulkStatusOpen(false); handleBulkStatusUpdate(s); }}
                                className="w-full text-left px-3.5 py-2.5 text-sm text-stone-700 hover:bg-brand-50 hover:text-brand-800 font-medium"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleShareClick(null)}
                    className="h-10 w-10 rounded-lg bg-white border border-stone-200/80 text-stone-600 inline-flex items-center justify-center shadow-sm hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-all"
                    title="Share with team"
                    aria-label="Share with team"
                  >
                    <Share2 size={17} strokeWidth={1.75} />
                  </button>
                </div>
                )}

                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="h-10 w-10 rounded-xl bg-white border border-red-200/90 text-red-600 inline-flex items-center justify-center shadow-sm hover:bg-red-50 hover:border-red-300 transition-all"
                  title="Delete selected"
                  aria-label="Delete selected"
                >
                  <Trash2 size={17} strokeWidth={1.75} />
                </button>
              </div>
            </div>
            {canExpand && (
              <div className="px-4 sm:px-5 py-2.5 border-t border-brand-100/80 bg-brand-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-xs sm:text-sm text-stone-600">
                  {selectedIds.length} selected on this view.
                  {' '}
                  <span className="text-stone-500">
                    {filteredCount.toLocaleString()} match your current search/filters.
                  </span>
                </p>
                <button
                  type="button"
                  onClick={onSelectAllFiltered}
                  className="text-sm font-bold text-brand-700 hover:text-brand-800 underline underline-offset-2 decoration-brand-300 hover:decoration-brand-500 transition-colors text-left sm:text-right"
                >
                  Select all {filteredCount.toLocaleString()} matching results
                </button>
              </div>
            )}
            {isAllFilteredSelected && filteredCount > 0 && (
              <div className="px-4 sm:px-5 py-2 border-t border-brand-100/80 bg-white/70">
                <p className="text-xs sm:text-sm text-stone-600 font-medium">
                  All {filteredCount.toLocaleString()} matching candidates are selected.
                </p>
              </div>
            )}
          </div>
        </div>
  );
}
