import React from 'react';
import { ChevronLeft, Loader2 } from 'lucide-react';
import ImportColumnMapper from '../ImportColumnMapper';

export default function MapStep({
  isUploading,
  setExcelHeaders,
  pendingFileRef,
  setStep,
  fileName,
  uploadProgress,
  uploadPercent,
  excelHeaders,
  candidateFields,
  lastImportMapping,
  onMapContinue,
  onMapSkipAuto,
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto">
        <button
          type="button"
          className="btn-secondary !h-9"
          disabled={isUploading}
          onClick={() => {
            setExcelHeaders([]);
            pendingFileRef.current = null;
            setStep('upload');
          }}
        >
          <ChevronLeft size={16} /> Back to upload
        </button>
        <p className="text-xs text-stone-500 truncate">{fileName}</p>
      </div>
      {isUploading ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center max-w-4xl mx-auto">
          <Loader2 className="w-10 h-10 text-brand-600 animate-spin mx-auto mb-3" />
          <p className="font-bold text-stone-900">{uploadProgress || 'Validating…'}</p>
          <div className="h-2 rounded-full bg-stone-200 overflow-hidden max-w-sm mx-auto mt-4">
            <div className="h-full bg-gradient-to-r from-brand-500 to-teal-500 transition-all" style={{ width: `${uploadPercent}%` }} />
          </div>
        </div>
      ) : (
        <ImportColumnMapper
          headers={excelHeaders}
          fields={candidateFields}
          lastMapping={lastImportMapping}
          onContinue={onMapContinue}
          onSkipAuto={onMapSkipAuto}
          busy={isUploading}
        />
      )}
    </div>
  );
}
