import React from 'react';
import { Search, Filter, FileSpreadsheet, Download, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { planHasFeature } from '../../config/planFeatures';

export default function CandidatesSearchToolbar(props) {
  const { t } = useTranslation();
  const {
    searchQuery, setSearchQuery, setCurrentPage, showAdvancedSearch, setShowAdvancedSearch,
    activeAdvFilterCount, orgPlan, toast, navigate, filteredCandidates, setShowDownloadModal,
    selectedIds,
  } = props;
  return (
        <div className="p-4 sm:p-5 border-b border-stone-100" data-tour="cand-search">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1 min-w-0 w-full">
              <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none z-[1]" />
              <input
                type="search"
                placeholder={t('candidates.searchPlaceholder')}
                className="w-full h-11 pl-11 sm:pl-12 pr-10 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 outline-none text-sm font-medium text-stone-900 placeholder:text-stone-400 transition-all"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              />
              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 z-[1]"
                  title={t('common.clear')}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 flex-shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                className={`inline-flex flex-1 sm:flex-none items-center justify-center gap-2 h-11 px-4 rounded-lg font-semibold border transition-colors text-sm ${
                  showAdvancedSearch || activeAdvFilterCount > 0
                    ? 'border-brand-500 bg-brand-50 text-brand-800'
                    : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 text-stone-700'
                }`}
              >
                <Filter size={15} strokeWidth={1.75} />
                {t('candidates.filters')}
                {activeAdvFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded bg-stone-900 text-white text-[10px] font-bold tabular-nums">
                    {activeAdvFilterCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!planHasFeature(orgPlan, 'jobs.bulkImport')) {
                    toast.info('Bulk Excel import requires Professional or higher.');
                    return;
                  }
                  navigate('/auto-import');
                }}
                className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 h-11 px-4 rounded-lg font-semibold border border-stone-200 bg-white hover:border-brand-300 hover:bg-brand-50/40 text-stone-700 hover:text-brand-800 text-sm transition-colors"
                title="Upload Excel/CSV with review before import"
              >
                <FileSpreadsheet size={15} strokeWidth={1.75} /> {t('candidates.import')}
              </button>
              <button
                type="button"
                onClick={() => { if (filteredCandidates.length === 0) toast.warning('No candidates to download.'); else setShowDownloadModal(true); }}
                className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 h-11 px-4 rounded-lg font-semibold border border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 text-stone-700 text-sm transition-colors"
              >
                <Download size={15} strokeWidth={1.75} /> {t('candidates.export')}{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
              </button>
            </div>
          </div>
        </div>
  );
}
