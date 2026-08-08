import React from 'react';
import { Download, X, RefreshCw, AlertCircle } from 'lucide-react';

export default function ResumePreviewModal({
  previewResumeUrl, previewBlobUrl, previewResumeCandidate, previewResumeError,
  isPreviewLoading, closeResumePreview, handleResumeDownload,
}) {
  if (!previewResumeUrl) return null;
  return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/55 backdrop-blur-sm" onClick={closeResumePreview}>
          <div className="bg-white rounded-2xl shadow-2xl w-[90vw] h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50">
              <h3 className="text-lg font-bold text-stone-900">Resume Preview</h3>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => previewResumeCandidate && handleResumeDownload(previewResumeCandidate)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-2">
                  <Download size={16} /> Download
                </button>
                <button onClick={closeResumePreview} className="p-2 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer">
                  <X size={20} className="text-stone-600" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-stone-100 flex items-center justify-center">
              {isPreviewLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw size={32} className="text-brand-500 animate-spin" />
                  <p className="text-stone-500 font-medium">Loading preview...</p>
                </div>
              ) : previewResumeError === 'file_not_found' ? (
                <div className="flex flex-col items-center gap-4 p-6 text-center max-w-md">
                  <AlertCircle size={40} className="text-amber-500" />
                  <p className="text-stone-700 font-medium">Resume file not found on this server</p>
                  <p className="text-sm text-stone-500">
                    The file may have been uploaded on the live site. View it there, or re-upload the resume for this candidate here.
                  </p>
                  <button type="button" onClick={() => previewResumeCandidate && handleResumeDownload(previewResumeCandidate)} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors">
                    Try Download
                  </button>
                </div>
              ) : previewBlobUrl && (previewBlobUrl.startsWith('http') || previewBlobUrl.startsWith('blob:')) ? (
                <iframe
                  src={previewBlobUrl}
                  className="w-full h-full border-0"
                  title="Resume Preview"
                />
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <AlertCircle size={32} className="text-red-400" />
                  <p className="text-stone-500 font-medium">Unable to preview this file</p>
                  <button type="button" onClick={() => previewResumeCandidate && handleResumeDownload(previewResumeCandidate)} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors">
                    Download Instead
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
  );
}
