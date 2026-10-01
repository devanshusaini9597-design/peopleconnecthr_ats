import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Upload, ChevronDown, FileSpreadsheet, Database, Share2,
  GitMerge, RefreshCw, Users, Info, Download, Layers,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../ui/PageHeader';
import FeatureGate from '../FeatureGate';
import { planHasFeature } from '../../config/planFeatures';
import { blankCandidateForm } from './atsConstants';

function formatAutoRefreshHint(seconds) {
  const s = Number(seconds) || 0;
  if (s >= 3600) {
    const h = Math.round(s / 3600);
    return `auto every ${h} hour${h === 1 ? '' : 's'}`;
  }
  if (s >= 60) {
    const m = Math.round(s / 60);
    return `auto every ${m} min`;
  }
  return s > 0 ? `auto every ${s}s` : 'manual';
}

function candidatesTipCaption({ isFreelancer, candidatesViewMode }) {
  if (isFreelancer) {
    return 'Select candidates to update or share. Prefer Actions → Excel with review for imports.';
  }
  if (candidatesViewMode === 'all') {
    return 'Organisation-wide desk. Select to email, message, update status, share, or delete.';
  }
  if (candidatesViewMode === 'shared') {
    return 'Shared with you. Select to email, message, update status, or import into your desk.';
  }
  return 'Your desk. Select to email, message, update status, share, or delete.';
}

function MenuItem({ icon: Icon, title, hint, onClick, disabled, recommended, tone = 'stone' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-stone-50 transition-colors disabled:opacity-50"
    >
      <span className={`h-8 w-8 rounded-lg border inline-flex items-center justify-center flex-shrink-0 ${
        tone === 'brand'
          ? 'border-brand-200 bg-brand-50 text-brand-700'
          : 'border-stone-200 bg-white text-stone-600'
      }`}>
        <Icon size={15} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-semibold text-stone-800 truncate">{title}</span>
          {recommended ? (
            <span className="text-[9px] font-bold uppercase tracking-wide text-brand-700 bg-brand-50 border border-brand-100 px-1 py-px rounded shrink-0">Rec</span>
          ) : null}
        </span>
        {hint ? <span className="block text-[11px] text-stone-500 truncate leading-snug">{hint}</span> : null}
      </span>
    </button>
  );
}

export default function CandidatesPageHeader(props) {
  const { t } = useTranslation();
  const {
    filteredCandidates, filteredCount, showImportMenu, setShowImportMenu, orgPlan, navigate, toast,
    fileInputRef, candidatesViewMode, handleImportAllToMineClick, isImportingShared,
    isImportingAll, handleImportSharedToMineClick, selectedIds, handleFindDuplicates,
    dedupeLoading, setEditId, setFormData, setFormErrors, setCountryCode, setCountryIso,
    setShowModal, isLoadingInitial, candidates, isFreelancer,
    initialFormState, openAddCandidate,
    onRefresh, refreshing, lastSyncedAt, autoRefreshSeconds,
    canExportCandidates, setShowDownloadModal,
  } = props;

  const tip = useMemo(
    () => candidatesTipCaption({ isFreelancer, candidatesViewMode }),
    [isFreelancer, candidatesViewMode],
  );

  const menuBtnRef = useRef(null);
  const [menuPos, setMenuPos] = useState(null);

  const closeMenu = () => setShowImportMenu(false);

  useEffect(() => {
    if (!showImportMenu) {
      setMenuPos(null);
      return undefined;
    }
    const place = () => {
      const el = menuBtnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = Math.min(340, window.innerWidth - 16);
      let left = Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8);
      const spaceBelow = window.innerHeight - r.bottom - 12;
      const maxH = Math.min(420, Math.max(220, spaceBelow > 240 ? spaceBelow : r.top - 12));
      const openUp = spaceBelow < 260 && r.top > spaceBelow;
      setMenuPos({
        left,
        width,
        maxH,
        top: openUp ? undefined : r.bottom + 8,
        bottom: openUp ? window.innerHeight - r.top + 8 : undefined,
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [showImportMenu]);

  const openAdd = () => {
    if (typeof openAddCandidate === 'function') {
      openAddCandidate();
      return;
    }
    setEditId(null);
    setFormData(typeof initialFormState === 'function' ? initialFormState() : blankCandidateForm(isFreelancer ? 'freelancer' : ''));
    setFormErrors({});
    setCountryCode('+91');
    setCountryIso('IN');
    setShowModal(true);
  };

  return (
    <>
      <PageHeader
        icon={Users}
        title={t('candidates.title')}
        subtitle={t('candidates.subtitle', { count: (typeof filteredCount === 'number' ? filteredCount : filteredCandidates.length).toLocaleString() })}
        gradientTitle
      >
        <div
          className="flex w-full items-center gap-1.5 sm:gap-2 justify-start md:justify-end flex-nowrap"
          data-tour="cand-actions"
        >
          {typeof onRefresh === 'function' ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing || isLoadingInitial}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 shadow-sm hover:bg-stone-50 hover:text-stone-800 disabled:opacity-50"
              aria-label="Refresh candidate list"
              title={
                lastSyncedAt
                  ? `Refresh · ${formatAutoRefreshHint(autoRefreshSeconds)} · last ${new Date(lastSyncedAt).toLocaleTimeString()}`
                  : `Refresh · ${formatAutoRefreshHint(autoRefreshSeconds)}`
              }
            >
              <RefreshCw size={16} strokeWidth={2.25} className={refreshing ? 'animate-spin' : ''} />
            </button>
          ) : null}

          <div className="relative shrink-0">
            <button
              ref={menuBtnRef}
              type="button"
              onClick={() => setShowImportMenu((v) => !v)}
              aria-expanded={showImportMenu}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-2.5 sm:px-3 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50"
            >
              <Layers size={15} className="shrink-0 text-stone-500" />
              <span>Actions</span>
              <ChevronDown size={14} className={`opacity-60 shrink-0 transition-transform ${showImportMenu ? 'rotate-180' : ''}`} />
            </button>

            {showImportMenu && menuPos ? (
              <>
                <div className="fixed inset-0 z-40" onClick={closeMenu} aria-hidden />
                <div
                  className="fixed z-50 rounded-xl border border-stone-200 bg-white shadow-xl shadow-stone-900/10 animate-fade-in flex flex-col overflow-hidden"
                  style={{
                    left: menuPos.left,
                    width: menuPos.width,
                    top: menuPos.top,
                    bottom: menuPos.bottom,
                    maxHeight: menuPos.maxH,
                  }}
                >
                  <div className="px-3 py-2 border-b border-stone-100 bg-stone-50/90 shrink-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Actions</p>
                    <p className="text-[11px] text-stone-400">Import, export, and tools</p>
                  </div>
                  <div
                    className="p-1.5 overflow-y-auto overscroll-contain min-h-0 flex-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    style={{ maxHeight: menuPos.maxH - 52 }}
                  >
                    <p className="px-2 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">Import</p>
                    <MenuItem
                      icon={FileSpreadsheet}
                      title={t('candidates.excelWithReview')}
                      hint="Upload → review → approve"
                      recommended
                      tone="brand"
                      onClick={() => {
                        closeMenu();
                        if (!isFreelancer && !planHasFeature(orgPlan, 'jobs.bulkImport')) {
                          toast.info(t('candidates.bulkImportRequiresPro'));
                          return;
                        }
                        navigate('/auto-import');
                      }}
                    />
                    <MenuItem
                      icon={Upload}
                      title={t('candidates.mapColumns')}
                      hint="Quick upload on this page"
                      onClick={() => { closeMenu(); fileInputRef.current?.click(); }}
                    />
                    {!isFreelancer && candidatesViewMode === 'all' ? (
                      <MenuItem
                        icon={Database}
                        title={t('candidates.fromDatabase')}
                        hint="Copy org candidates to your list"
                        disabled={isImportingShared || isImportingAll}
                        onClick={() => { closeMenu(); handleImportAllToMineClick(); }}
                      />
                    ) : null}
                    {!isFreelancer && candidatesViewMode === 'all' && filteredCandidates.some((c) => c._isShared) ? (
                      <MenuItem
                        icon={Share2}
                        title={selectedIds.length > 0 ? `Shared (${selectedIds.length})` : t('candidates.sharedWithMe')}
                        hint="Import shared candidates"
                        disabled={isImportingShared || isImportingAll}
                        onClick={() => { closeMenu(); handleImportSharedToMineClick(); }}
                      />
                    ) : null}

                    {canExportCandidates ? (
                      <>
                        <div className="my-1 mx-2 border-t border-stone-100" />
                        <p className="px-2 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">Export</p>
                        <MenuItem
                          icon={Download}
                          title={t('candidates.export')}
                          hint={selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Current list as Excel'}
                          onClick={() => {
                            closeMenu();
                            if ((typeof filteredCount === 'number' ? filteredCount : filteredCandidates.length) === 0) {
                              toast.warning('No candidates to export.');
                              return;
                            }
                            setShowDownloadModal(true);
                          }}
                        />
                      </>
                    ) : null}

                    {!isFreelancer ? (
                      <FeatureGate feature="candidates.dedupe">
                        <div className="my-1 mx-2 border-t border-stone-100" />
                        <p className="px-2 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">Tools</p>
                        <MenuItem
                          icon={GitMerge}
                          title={t('candidates.findDuplicates')}
                          hint="Match email or phone, merge one by one"
                          disabled={dedupeLoading}
                          onClick={() => { closeMenu(); handleFindDuplicates(); }}
                        />
                      </FeatureGate>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <button
            type="button"
            onClick={openAdd}
            className="inline-flex h-10 min-w-0 flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-brand-600 to-teal-600 px-3 sm:px-3.5 text-sm font-semibold text-white shadow-md shadow-brand-500/20 hover:opacity-95"
          >
            <Plus size={16} className="shrink-0" />
            <span className="truncate">{t('candidates.addNew')}</span>
          </button>
        </div>
      </PageHeader>

      {!isFreelancer ? (
        <div
          data-tour="cand-tip"
          className="rounded-xl border border-brand-100/80 bg-gradient-to-r from-brand-50/70 via-white to-white px-3.5 sm:px-4 py-2 text-[13px] text-stone-600 leading-snug flex flex-row items-center gap-2 shadow-sm shadow-brand-900/[0.03] min-w-0"
        >
          <span className="inline-flex items-center gap-1.5 text-brand-800 font-semibold shrink-0">
            <Info size={14} /> Guidance
          </span>
          <span className="min-w-0 flex-1 truncate" title={tip}>{tip}</span>
        </div>
      ) : null}

      {isLoadingInitial && candidates.length === 0 ? (
        <div className="h-1 w-full bg-stone-100 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-gradient-to-r from-brand-500 to-teal-400 rounded-full animate-shimmer" />
        </div>
      ) : null}
    </>
  );
}
