import React from 'react';
import {
  ArrowLeft, Check, FileSpreadsheet, Inbox, Loader2, Lock, Upload,
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import { STEPS, TOUR_KEY, TOUR_STEPS } from './autoImport/constants';
import PrepareStep from './autoImport/PrepareStep';
import UploadStep from './autoImport/UploadStep';
import MapStep from './autoImport/MapStep';
import ReviewStep from './autoImport/ReviewStep';
import DoneStep from './autoImport/DoneStep';
import AutoImportModals from './autoImport/AutoImportModals';
import useAutoImport from './autoImport/useAutoImport';

export default function AutoImportPage() {
  const a = useAutoImport();

  if (a.authLoading) {
    return (
      <div className="page-shell-ats">
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-9 h-9 text-brand-600 animate-spin" />
          <p className="text-sm text-stone-500 font-medium">Loading import…</p>
        </div>
      </div>
    );
  }

  if (!a.canBulkImport) {
    return (
      <div className="page-shell-ats animate-page-enter">
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center card-ats-bordered border-amber-200/80 bg-amber-50/40 p-8">
            <Lock className="w-10 h-10 text-amber-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-stone-900">Bulk Import is Professional+</h2>
            <p className="text-sm text-stone-500 mt-2">Controlled spreadsheet intake with review-before-add.</p>
            <div className="flex gap-2 justify-center mt-6">
              <button type="button" className="btn-secondary" onClick={() => a.navigate('/ats')}>Back</button>
              <a href="/billing" className="btn-primary">View plans</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={FileSpreadsheet}
          title="Bulk Import"
          subtitle="Enterprise spreadsheet intake — download template, validate, select, then import."
          gradientTitle
        >
          <button type="button" className="btn-secondary" onClick={() => a.navigate('/ats')}>
            <ArrowLeft size={16} /> Candidates
          </button>
          <button type="button" className="btn-secondary" onClick={() => a.navigate('/pending-review')}>
            <Inbox size={16} /> Pending Review
          </button>
          {(a.step === 'review' || a.step === 'done') && (
            <button type="button" className="btn-secondary" onClick={a.resetAll}>
              <Upload size={14} /> Start over
            </button>
          )}
        </PageHeader>

        <div data-tour="bi-steps" className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-sm">
          <ol className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STEPS.map((s, i) => {
              const done = i < a.stepIndex;
              const active = s.id === a.step;
              return (
                <li key={s.id} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${
                  active ? 'border-brand-300 bg-brand-50/50' : done ? 'border-emerald-200 bg-emerald-50/40' : 'border-stone-200 bg-stone-50/50'
                }`}>
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    done ? 'bg-emerald-600 text-white' : active ? 'bg-brand-600 text-white' : 'bg-stone-200 text-stone-600'
                  }`}>
                    {done ? <Check size={14} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className={`text-sm font-semibold ${active ? 'text-brand-900' : 'text-stone-700'}`}>{s.label}</span>
                </li>
              );
            })}
          </ol>
        </div>

        <div data-tour="bi-main" className="space-y-4">
          {a.step === 'prepare' && (
            <PrepareStep downloadTemplate={a.downloadTemplate} setStep={a.setStep} />
          )}

          {a.step === 'upload' && (
            <UploadStep
              fileRef={a.fileRef}
              isUploading={a.isUploading}
              setIsDragging={a.setIsDragging}
              isDragging={a.isDragging}
              onPickFile={a.onPickFile}
              uploadProgress={a.uploadProgress}
              fileName={a.fileName}
              uploadPercent={a.uploadPercent}
              setStep={a.setStep}
              downloadTemplate={a.downloadTemplate}
            />
          )}

          {a.step === 'map' && (
            <MapStep
              isUploading={a.isUploading}
              setExcelHeaders={a.setExcelHeaders}
              pendingFileRef={a.pendingFileRef}
              setStep={a.setStep}
              fileName={a.fileName}
              uploadProgress={a.uploadProgress}
              uploadPercent={a.uploadPercent}
              excelHeaders={a.excelHeaders}
              candidateFields={a.candidateFields}
              lastImportMapping={a.lastImportMapping}
              onMapContinue={a.onMapContinue}
              onMapSkipAuto={a.onMapSkipAuto}
            />
          )}

          {a.step === 'review' && a.reviewData && (
            <ReviewStep
              readyCount={a.readyCount}
              reviewCount={a.reviewCount}
              blockedCount={a.blockedCount}
              stats={a.stats}
              dbDupCount={a.dbDupCount}
              selected={a.selected}
              selectedNew={a.selectedNew}
              selectedUpdates={a.selectedUpdates}
              bucket={a.bucket}
              setBucket={a.setBucket}
              query={a.query}
              setQuery={a.setQuery}
              setPage={a.setPage}
              selectAllReady={a.selectAllReady}
              selectPageReady={a.selectPageReady}
              skipExistingInAts={a.skipExistingInAts}
              clearSelection={a.clearSelection}
              isSavingPending={a.isSavingPending}
              sendRestToPending={a.sendRestToPending}
              isImporting={a.isImporting}
              confirmImport={a.confirmImport}
              tableScrollRef={a.tableScrollRef}
              onTableDragScrollStart={a.onTableDragScrollStart}
              onTableDragScrollMove={a.onTableDragScrollMove}
              onTableDragScrollEnd={a.onTableDragScrollEnd}
              pageRows={a.pageRows}
              toggleRow={a.toggleRow}
              setEditingRow={a.setEditingRow}
              setEditErrors={a.setEditErrors}
              filtered={a.filtered}
              page={a.page}
              totalPages={a.totalPages}
            />
          )}

          {a.step === 'done' && a.importResult && (
            <DoneStep importResult={a.importResult} navigate={a.navigate} resetAll={a.resetAll} />
          )}
        </div>

        <TourHelpFab onClick={() => a.setTourOpen(true)} label="Tour" title="Tour Bulk Import" />
        <ProductTour open={a.tourOpen} onClose={() => a.setTourOpen(false)} steps={TOUR_STEPS} storageKey={TOUR_KEY} />
      </div>

      <AutoImportModals
        editingRow={a.editingRow}
        setEditingRow={a.setEditingRow}
        editErrors={a.editErrors}
        updateEdit={a.updateEdit}
        saveEdited={a.saveEdited}
        positionOptions={a.positionOptions}
        clientOptions={a.clientOptions}
        sourceOptions={a.sourceOptions}
        statusOptions={a.statusOptions}
        ctcOptions={a.ctcOptions}
        ectcOptions={a.ectcOptions}
        npOptions={a.npOptions}
        expOptions={a.expOptions}
        blocker={a.blocker}
        busy={a.busy}
        confirmModal={a.confirmModal}
        setConfirmModal={a.setConfirmModal}
        isImporting={a.isImporting}
      />
    </>
  );
}
