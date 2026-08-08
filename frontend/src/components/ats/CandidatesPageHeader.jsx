import React from 'react';
import { Plus, Upload, ChevronDown, FileSpreadsheet, Database, Share2, GitMerge, RefreshCw, Users, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../ui/PageHeader';
import FeatureGate from '../FeatureGate';
import { planHasFeature } from '../../config/planFeatures';
import { INITIAL_FORM_STATE } from './atsConstants';

export default function CandidatesPageHeader(props) {
  const { t } = useTranslation();
  const {
    filteredCandidates, showImportMenu, setShowImportMenu, orgPlan, navigate, toast,
    fileInputRef, candidatesViewMode, handleImportAllToMineClick, isImportingShared,
    isImportingAll, handleImportSharedToMineClick, selectedIds, handleFindDuplicates,
    dedupeLoading, setEditId, setFormData, setFormErrors, setCountryCode, setCountryIso,
    setShowModal, isLoadingInitial, candidates,
  } = props;
  return (
    <>
      <PageHeader
        icon={Users}
        title={t('candidates.title')}
        subtitle={t('candidates.subtitle', { count: filteredCandidates.length.toLocaleString() })}
        gradientTitle
      >
        <div className="relative w-full sm:w-auto" data-tour="cand-actions">
          <button
            type="button"
            onClick={() => setShowImportMenu((v) => !v)}
            aria-expanded={showImportMenu}
            className="btn-secondary w-full sm:w-auto justify-center"
          >
            <Upload size={16} /> {t('candidates.import')} <ChevronDown size={14} className={`opacity-60 transition-transform ${showImportMenu ? 'rotate-180' : ''}`} />
          </button>
          {showImportMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowImportMenu(false)} aria-hidden />
              <div className="absolute left-0 right-0 sm:left-auto sm:right-0 top-full mt-2 z-40 w-full sm:w-[340px] max-w-[calc(100vw-2rem)] rounded-xl border border-stone-200 bg-white shadow-xl shadow-stone-900/10 animate-fade-in overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-stone-100 bg-stone-50/80">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">{t('candidates.importMenuTitle')}</p>
                  <p className="text-[11px] text-stone-400 mt-0.5">{t('candidates.importMenuHint')}</p>
                </div>
                <div className="p-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportMenu(false);
                      if (!planHasFeature(orgPlan, 'jobs.bulkImport')) {
                        toast.info(t('candidates.bulkImportRequiresPro'));
                        return;
                      }
                      navigate('/auto-import');
                    }}
                    className="w-full flex items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-brand-50/60 transition-colors"
                  >
                    <span className="mt-0.5 h-8 w-8 rounded-lg border border-brand-200 bg-brand-50 inline-flex items-center justify-center text-brand-700 flex-shrink-0">
                      <FileSpreadsheet size={15} strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-stone-800">
                        {t('candidates.excelWithReview')}
                        <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-700 bg-brand-50 border border-brand-100 px-1.5 py-0.5 rounded">{t('candidates.recommended')}</span>
                      </span>
                      <span className="block text-[11px] text-stone-500 mt-0.5 leading-snug">
                        {t('candidates.excelWithReviewDesc')}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowImportMenu(false); fileInputRef.current?.click(); }}
                    className="w-full flex items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-stone-50 transition-colors"
                  >
                    <span className="mt-0.5 h-8 w-8 rounded-lg border border-stone-200 bg-white inline-flex items-center justify-center text-stone-600 flex-shrink-0">
                      <Upload size={15} strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-stone-800">{t('candidates.mapColumns')}</span>
                      <span className="block text-[11px] text-stone-500 mt-0.5 leading-snug">{t('candidates.mapColumnsDesc')}</span>
                    </span>
                  </button>
                  {candidatesViewMode === 'all' && (
                    <button
                      type="button"
                      onClick={() => { setShowImportMenu(false); handleImportAllToMineClick(); }}
                      disabled={isImportingShared || isImportingAll}
                      className="w-full flex items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-stone-50 transition-colors disabled:opacity-50"
                    >
                      <span className="mt-0.5 h-8 w-8 rounded-lg border border-stone-200 bg-white inline-flex items-center justify-center text-stone-600 flex-shrink-0">
                        <Database size={15} strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-stone-800">{t('candidates.fromDatabase')}</span>
                        <span className="block text-[11px] text-stone-500 mt-0.5 leading-snug">Copy org candidates into your list</span>
                      </span>
                    </button>
                  )}
                  {candidatesViewMode === 'all' && filteredCandidates.some(c => c._isShared) && (
                    <button
                      type="button"
                      onClick={() => { setShowImportMenu(false); handleImportSharedToMineClick(); }}
                      disabled={isImportingShared || isImportingAll}
                      className="w-full flex items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-stone-50 transition-colors disabled:opacity-50"
                    >
                      <span className="mt-0.5 h-8 w-8 rounded-lg border border-stone-200 bg-white inline-flex items-center justify-center text-stone-600 flex-shrink-0">
                        <Share2 size={15} strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-stone-800">
                          {selectedIds.length > 0 ? `Shared (${selectedIds.length})` : t('candidates.sharedWithMe')}
                        </span>
                        <span className="block text-[11px] text-stone-500 mt-0.5 leading-snug">Import candidates shared by teammates</span>
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        <FeatureGate feature="candidates.dedupe">
          <button
            type="button"
            onClick={handleFindDuplicates}
            disabled={dedupeLoading}
            className="btn-secondary flex-1 sm:flex-none"
            title="Find duplicate candidates by email, phone, or name"
          >
            {dedupeLoading ? <RefreshCw size={16} className="animate-spin" /> : <GitMerge size={16} />}
            {t('candidates.findDuplicates')}
          </button>
        </FeatureGate>
        <button
          type="button"
          onClick={() => {
            setEditId(null);
            setFormData(INITIAL_FORM_STATE);
            setFormErrors({});
            setCountryCode('+91');
            setCountryIso('IN');
            setShowModal(true);
          }}
          className="btn-primary flex-1 sm:flex-none"
        >
          <Plus size={16} /> {t('candidates.addNew')}
        </button>
      </PageHeader>

      <div data-tour="cand-tip" className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 text-brand-700 font-semibold">
          <Info size={14} /> Tip
        </span>
        <span>
          Select rows for bulk email, WhatsApp, status, share, or delete.
          Use <span className="font-semibold text-stone-800">Import → Excel with review</span> to upload a spreadsheet safely.
          Press <span className="font-semibold text-stone-800">?</span> for a tour.
        </span>
      </div>

      {isLoadingInitial && candidates.length === 0 && (
        <div className="h-1 w-full bg-stone-100 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-gradient-to-r from-brand-500 to-teal-400 rounded-full animate-shimmer" />
        </div>
      )}
    </>
  );
}
