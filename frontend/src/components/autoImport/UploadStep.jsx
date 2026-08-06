import React from 'react';
import { Upload, Loader2, ChevronLeft } from 'lucide-react';

export default function UploadStep({
  fileRef,
  isUploading,
  setIsDragging,
  isDragging,
  onPickFile,
  uploadProgress,
  fileName,
  uploadPercent,
  setStep,
  downloadTemplate,
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden max-w-3xl mx-auto">
      <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="p-6 sm:p-10">
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' && !isUploading) fileRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); onPickFile(e.dataTransfer.files?.[0]); }}
          onClick={() => !isUploading && fileRef.current?.click()}
          className={`rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all ${
            isDragging ? 'border-brand-500 bg-brand-50' : isUploading ? 'border-stone-200 bg-stone-50 cursor-wait' : 'border-stone-300 hover:border-brand-400 hover:bg-brand-50/40'
          }`}
        >
          {isUploading ? (
            <div className="max-w-sm mx-auto space-y-3">
              <Loader2 className="w-10 h-10 text-brand-600 animate-spin mx-auto" />
              <p className="font-bold text-stone-900">{uploadProgress}</p>
              <p className="text-sm text-stone-500 truncate">{fileName}</p>
              <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-brand-500 to-teal-500 transition-all" style={{ width: `${uploadPercent}%` }} />
              </div>
            </div>
          ) : (
            <>
              <Upload className="w-10 h-10 text-brand-600 mx-auto mb-3" />
              <p className="text-lg font-bold text-stone-900">Drop your file here</p>
              <p className="text-sm text-stone-500 mt-1 mb-5">CSV / XLSX / XLS · max 50 MB</p>
              <span className="btn-primary inline-flex pointer-events-none"><Upload size={16} /> Choose file</span>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { onPickFile(e.target.files?.[0]); e.target.value = ''; }} />
        <div className="mt-5 flex justify-between">
          <button type="button" className="btn-secondary" disabled={isUploading} onClick={() => setStep('prepare')}>
            <ChevronLeft size={16} /> Back
          </button>
          <button type="button" className="text-sm font-semibold text-brand-600" onClick={downloadTemplate}>
            Download template
          </button>
        </div>
      </div>
    </div>
  );
}
