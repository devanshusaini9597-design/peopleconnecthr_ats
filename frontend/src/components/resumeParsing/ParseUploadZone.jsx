import React from 'react';
import { Upload, FileText, AlertCircle, Loader2, Cpu } from 'lucide-react';

export function ParseUploadZone({
  dragOver, setDragOver, parsing, error,
  uploadedFiles, results,
  fileInputRef, handleFileSelect, handleDrop,
}) {
  return (
    <>
      <div data-tour="parse-tip" className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-stone-500">
          <Cpu size={13} className="text-brand-600" /> Queue
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800">Pending</span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">Approved</span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-xs font-semibold text-red-700">Rejected</span>
        <span className="text-stone-500">
          Only Approved import to Candidates. Rejected stay out of import. Unapprove = back to Pending. Press <span className="font-semibold text-stone-800">?</span> for a tour.
        </span>
      </div>

      <div
        data-tour="parse-upload"
        className={`card-ats-bordered relative overflow-hidden transition-colors ${
          dragOver ? 'border-brand-400 ring-2 ring-brand-200/50' : ''
        }`}
        onDragOver={(e) => { e.preventDefault(); if (!parsing) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <label className={`relative block px-5 py-8 sm:py-10 text-center cursor-pointer ${parsing ? 'opacity-70 pointer-events-none' : ''}`}>
          <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-3 border border-brand-100">
            {parsing ? <Loader2 size={22} className="animate-spin" /> : <Upload size={22} strokeWidth={1.75} />}
          </div>
          <p className="text-base font-semibold text-stone-900 tracking-tight">
            {parsing ? 'Extracting fields…' : 'Drop resumes here'}
          </p>
          <p className="text-stone-500 text-sm mt-1 max-w-lg mx-auto">
            {parsing
              ? 'Processing with rules engine / OCR'
              : 'PDF, DOC, DOCX · max 10 MB · multiple files supported'}
          </p>
          {!parsing && (
            <span className="inline-flex mt-4 text-sm font-semibold text-brand-700">
              or browse files
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx"
            onChange={handleFileSelect}
            disabled={parsing}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
        {error && (
          <div className="mx-5 mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {results.length === 0 && !parsing && (
        <div className="card-ats-bordered p-4 sm:p-5 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-1">Workflow</p>
              <p className="text-stone-700 font-medium">Upload → Extract → Pending → Approve / Reject → Add</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-1">Extracted fields</p>
              <p className="text-stone-600 leading-relaxed">Name, email, phone, position, company, experience, location, education, skills</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-1">Best input</p>
              <p className="text-stone-600 leading-relaxed">Text PDFs preferred. Scanned images are less reliable — always review before saving.</p>
            </div>
          </div>
        </div>
      )}

      {parsing && results.length === 0 && (
        <div className="card-ats-bordered p-10 text-center">
          <Loader2 size={32} className="animate-spin text-brand-600 mx-auto mb-3" />
          <p className="text-stone-800 font-semibold">Parsing queue…</p>
          <p className="text-xs text-stone-500 mt-1">
            {uploadedFiles.length} file{uploadedFiles.length === 1 ? '' : 's'} in progress
          </p>
        </div>
      )}

      {uploadedFiles.length > 0 && parsing && (
        <div className="card-ats-bordered p-4 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <p className="text-sm font-bold text-stone-900 mb-2">Queue</p>
          <ul className="divide-y divide-stone-100">
            {uploadedFiles.map((file, idx) => (
              <li key={idx} className="flex items-center justify-between py-2.5 gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText size={16} className="text-stone-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-stone-800 truncate">{file.name}</span>
                  <span className="text-xs text-stone-400 flex-shrink-0">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <Loader2 size={14} className="animate-spin text-brand-600 flex-shrink-0" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
