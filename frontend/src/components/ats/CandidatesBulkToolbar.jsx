import React from 'react';
import { Mail, RefreshCw, Share2, Trash2, X } from 'lucide-react';
import { WhatsAppIcon } from '../icons/BrandIcons';
import { BULK_STATUS_OPTIONS } from './atsConstants';

export default function CandidatesBulkToolbar(props) {
  const {
    selectedIds, setSelectedIds, bulkStatusOpen, setBulkStatusOpen,
    startBulkEmailFlow, handleBulkWhatsApp, handleBulkStatusUpdate,
    handleShareClick, handleBulkDelete,
  } = props;
  if (!selectedIds?.length) return null;
  return (
        <div
          data-tour="cand-bulk"
          className="sticky top-0 z-30 animate-fade-in"
        >
          <div className="rounded-2xl border border-brand-200/70 bg-gradient-to-r from-brand-50/90 via-white to-white shadow-[var(--shadow-elevated)] overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Identity — makes it obvious this is the bulk zone */}
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

              {/* Icon actions — roomy, tooltip labels */}
              <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                <div className="inline-flex items-center gap-2 p-1 rounded-xl bg-stone-50/80 border border-stone-100">
                  <button
                    type="button"
                    onClick={startBulkEmailFlow}
                    className="h-10 w-10 rounded-lg bg-white border border-stone-200/80 text-stone-600 inline-flex items-center justify-center shadow-sm hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-all"
                    title="Email selected"
                    aria-label="Email selected"
                  >
                    <Mail size={17} strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkWhatsApp}
                    className="h-10 w-10 rounded-lg bg-white border border-stone-200/80 text-stone-600 inline-flex items-center justify-center shadow-sm hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-all"
                    title="WhatsApp selected"
                    aria-label="WhatsApp selected"
                  >
                    <WhatsAppIcon size={17} />
                  </button>
                </div>

                <div className="inline-flex items-center gap-2 p-1 rounded-xl bg-stone-50/80 border border-stone-100">
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
          </div>
        </div>
  );
}
