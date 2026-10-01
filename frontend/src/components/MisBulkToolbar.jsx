import React from 'react';
import { Mail, Pencil, ShieldCheck, Trash2, Users, X, ChevronDown } from 'lucide-react';
import { WhatsAppIcon } from './icons/BrandIcons';

/**
 * Bulk bar for MIS contacts — sits inside the table card (not sticky over the app header).
 * Keep z-index low so the app header / profile menu always stacks above this bar.
 */
export default function MisBulkToolbar({
  selectedIds = [],
  onClear,
  onEmail,
  onWhatsApp,
  onBulkEdit,
  onConsentMenuToggle,
  consentMenuOpen = false,
  onSetConsent,
  onMoveToCandidates,
  onDelete,
  filteredCount = 0,
  isAllFilteredSelected = false,
  onSelectAllFiltered,
  selectingAll = false,
}) {
  if (!selectedIds.length) return null;
  const countShown = isAllFilteredSelected && filteredCount > selectedIds.length ? filteredCount : selectedIds.length;
  const canExpand = !isAllFilteredSelected
    && filteredCount > selectedIds.length
    && typeof onSelectAllFiltered === 'function';

  return (
    <div data-tour="mis-bulk" className="relative z-10 animate-fade-in border-b border-brand-100/80 bg-gradient-to-r from-brand-50/95 via-white to-white">
      <div className="px-3 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center text-sm font-bold tabular-nums shadow-md shadow-brand-500/20 ring-1 ring-white/20 flex-shrink-0">
            {countShown.toLocaleString()}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">
              Bulk selection
            </p>
            <p className="text-sm font-semibold text-stone-900 mt-0.5 truncate">
              {countShown === 1 ? '1 contact selected' : `${countShown.toLocaleString()} contacts selected`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="h-9 w-9 rounded-xl border border-stone-200/80 bg-white text-stone-500 inline-flex items-center justify-center hover:bg-stone-50 hover:text-stone-800 hover:border-stone-300 transition-all shadow-sm flex-shrink-0"
            title="Clear selection"
            aria-label="Clear selection"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <div className="inline-flex items-center gap-2 p-1 rounded-xl bg-stone-50/80 border border-stone-100">
            <button
              type="button"
              onClick={onEmail}
              className="h-9 w-9 rounded-lg bg-white border border-stone-200/80 text-stone-600 inline-flex items-center justify-center shadow-sm hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-all"
              title="Email selected"
              aria-label="Campaign email selected"
            >
              <Mail size={16} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={onWhatsApp}
              className="h-9 w-9 rounded-lg bg-white border border-stone-200/80 text-stone-600 inline-flex items-center justify-center shadow-sm hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-all"
              title="WhatsApp selected"
              aria-label="WhatsApp selected"
            >
              <WhatsAppIcon size={16} />
            </button>
          </div>

          <div className="inline-flex items-center gap-2 p-1 rounded-xl bg-stone-50/80 border border-stone-100">
            <button
              type="button"
              onClick={onBulkEdit}
              className="h-9 px-3 rounded-lg bg-white border border-stone-200/80 text-stone-700 inline-flex items-center justify-center gap-1.5 shadow-sm hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-all text-xs font-bold"
              title="Bulk edit fields"
            >
              <Pencil size={14} strokeWidth={1.75} />
              Edit
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={onConsentMenuToggle}
                aria-expanded={consentMenuOpen}
                className={`h-9 px-3 rounded-lg border inline-flex items-center justify-center gap-1.5 shadow-sm transition-all text-xs font-bold ${
                  consentMenuOpen
                    ? 'border-brand-400 bg-brand-50 text-brand-700'
                    : 'bg-white border-stone-200/80 text-stone-700 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50'
                }`}
                title="Set marketing consent"
              >
                <ShieldCheck size={14} strokeWidth={1.75} />
                Consent
                <ChevronDown size={12} className="opacity-60" />
              </button>
              {consentMenuOpen ? (
                <>
                  <div className="fixed inset-0 z-[20]" onClick={onConsentMenuToggle} aria-hidden />
                  <div className="absolute right-0 top-full mt-2 z-[25] w-56 rounded-xl border border-stone-200 bg-white shadow-xl shadow-stone-900/15">
                    <div className="px-3.5 py-2.5 border-b border-stone-100 bg-stone-50/80 rounded-t-xl">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Marketing consent</p>
                      <p className="text-[11px] text-stone-400 mt-0.5">Applies to {selectedIds.length} selected</p>
                    </div>
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => onSetConsent(true)}
                        className="w-full text-left px-3.5 py-2.5 text-sm text-stone-700 hover:bg-brand-50 hover:text-brand-800 font-medium"
                      >
                        Enable consent
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetConsent(false)}
                        className="w-full text-left px-3.5 py-2.5 text-sm text-stone-700 hover:bg-brand-50 hover:text-brand-800 font-medium"
                      >
                        Remove consent
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
            {typeof onMoveToCandidates === 'function' ? (
              <button
                type="button"
                onClick={onMoveToCandidates}
                className="h-9 px-3 rounded-lg bg-white border border-stone-200/80 text-stone-700 inline-flex items-center justify-center gap-1.5 shadow-sm hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-all text-xs font-bold"
                title="Add selected contacts to Candidates"
              >
                <Users size={14} strokeWidth={1.75} />
                To Candidates
              </button>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onDelete}
            className="h-9 w-9 rounded-xl bg-white border border-red-200/90 text-red-600 inline-flex items-center justify-center shadow-sm hover:bg-red-50 hover:border-red-300 transition-all"
            title="Delete selected"
            aria-label="Delete selected"
          >
            <Trash2 size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {selectingAll ? (
        <div className="px-3 sm:px-5 py-2 border-t border-brand-100/80 bg-brand-50/50">
          <p className="text-xs sm:text-sm text-stone-600 font-medium">
            Confirming all matching results in the background…
          </p>
        </div>
      ) : null}
      {canExpand ? (
        <div className="px-3 sm:px-5 py-2 border-t border-brand-100/80 bg-brand-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-xs sm:text-sm text-stone-600">
            {selectedIds.length} selected on this page.
            {' '}
            <span className="text-stone-500">
              {filteredCount.toLocaleString()} match the current filters.
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
      ) : null}

      {isAllFilteredSelected && filteredCount > 0 ? (
        <div className="px-3 sm:px-5 py-2 border-t border-brand-100/80 bg-white/70">
          <p className="text-xs sm:text-sm text-stone-600 font-medium">
            All {filteredCount.toLocaleString()} matching contacts are selected.
          </p>
        </div>
      ) : null}
    </div>
  );
}
