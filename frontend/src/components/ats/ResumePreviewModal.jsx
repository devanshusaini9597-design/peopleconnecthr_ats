import React, { useEffect, useRef, useState } from 'react';
import { Download, X, RefreshCw, AlertCircle } from 'lucide-react';
import { canInlinePreview } from '../../utils/resumeFileKind';

export default function ResumePreviewModal({
  previewResumeUrl,
  previewBlobUrl,
  previewBlob,
  previewFileKind,
  previewResumeCandidate,
  previewResumeError,
  isPreviewLoading,
  closeResumePreview,
  handleResumeDownload,
}) {
  const docxContainerRef = useRef(null);
  const [docxError, setDocxError] = useState(null);
  const [docxRendering, setDocxRendering] = useState(false);

  useEffect(() => {
    if (previewFileKind !== 'docx' || !previewBlob || !docxContainerRef.current) {
      setDocxError(null);
      setDocxRendering(false);
      return undefined;
    }

    let cancelled = false;
    const container = docxContainerRef.current;
    container.innerHTML = '';
    setDocxError(null);
    setDocxRendering(true);

    (async () => {
      try {
        const { renderAsync } = await import('docx-preview');
        if (cancelled) return;
        await renderAsync(previewBlob, container, undefined, {
          className: 'docx-preview-surface',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
        });
      } catch (err) {
        console.error('[Resume] DOCX preview failed:', err);
        if (!cancelled) setDocxError('Could not render this Word document. Try downloading it instead.');
      } finally {
        if (!cancelled) setDocxRendering(false);
      }
    })();

    return () => {
      cancelled = true;
      if (container) container.innerHTML = '';
    };
  }, [previewFileKind, previewBlob]);

  if (!previewResumeUrl) return null;

  const blobReady = !isPreviewLoading && previewBlobUrl && previewBlobUrl.startsWith('blob:');
  const showPdf = blobReady && previewFileKind === 'pdf';
  const showImage = blobReady && previewFileKind === 'image';
  const showDocx = !isPreviewLoading && previewFileKind === 'docx' && previewBlob;
  const showLegacyDoc = !isPreviewLoading && previewFileKind === 'doc';
  const showUnsupported = !isPreviewLoading
    && previewBlob
    && previewFileKind
    && previewFileKind !== 'html_error'
    && !canInlinePreview(previewFileKind)
    && previewFileKind !== 'doc';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/55 backdrop-blur-sm" onClick={closeResumePreview}>
      <div className="bg-white rounded-2xl shadow-2xl w-[90vw] h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50">
          <div>
            <h3 className="text-lg font-bold text-stone-900">Resume Preview</h3>
            {previewResumeCandidate?.name && (
              <p className="text-sm text-stone-500 mt-0.5">{previewResumeCandidate.name}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => previewResumeCandidate && handleResumeDownload(previewResumeCandidate)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Download size={16} /> Download
            </button>
            <button onClick={closeResumePreview} className="p-2 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer">
              <X size={20} className="text-stone-600" />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-stone-100 flex items-center justify-center overflow-hidden">
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
              <button
                type="button"
                onClick={() => previewResumeCandidate && handleResumeDownload(previewResumeCandidate)}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                Try Download
              </button>
            </div>
          ) : previewResumeError === 'load_failed' ? (
            <div className="flex flex-col items-center gap-4 p-6 text-center max-w-md">
              <AlertCircle size={40} className="text-amber-500" />
              <p className="text-stone-700 font-medium">Could not load this resume</p>
              <p className="text-sm text-stone-500">
                Download the file, or re-upload it as PDF or DOCX for in-app preview.
              </p>
              <button
                type="button"
                onClick={() => previewResumeCandidate && handleResumeDownload(previewResumeCandidate)}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                Download File
              </button>
            </div>
          ) : showPdf ? (
            <iframe
              src={`${previewBlobUrl}#toolbar=1`}
              className="w-full h-full border-0 bg-white"
              title="Resume Preview"
            />
          ) : showImage ? (
            <img
              src={previewBlobUrl}
              alt={previewResumeCandidate?.name ? `Resume for ${previewResumeCandidate.name}` : 'Resume'}
              className="max-w-full max-h-full object-contain"
            />
          ) : showDocx ? (
            <div className="w-full h-full overflow-auto bg-white">
              {(docxRendering || docxError) && (
                <div className="sticky top-0 z-10 px-4 py-2 bg-stone-50 border-b border-stone-200 text-sm text-stone-600">
                  {docxRendering && !docxError ? 'Rendering document…' : docxError}
                </div>
              )}
              <div
                ref={docxContainerRef}
                className="docx-preview-host min-h-full px-4 py-6 [&_.docx-wrapper]:mx-auto [&_.docx-wrapper]:shadow-sm [&_.docx-wrapper]:bg-white"
              />
            </div>
          ) : showLegacyDoc ? (
            <div className="flex flex-col items-center gap-4 p-6 text-center max-w-md">
              <AlertCircle size={40} className="text-amber-500" />
              <p className="text-stone-700 font-medium">Legacy .doc files cannot be opened in the browser</p>
              <p className="text-sm text-stone-500">
                Old Word (.doc) files can contain macros, so Skillnix does not render them in-app. Download to open in Word, or re-upload as PDF or DOCX for a safe preview.
              </p>
              <button
                type="button"
                onClick={() => previewResumeCandidate && handleResumeDownload(previewResumeCandidate)}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                Download File
              </button>
            </div>
          ) : showUnsupported ? (
            <div className="flex flex-col items-center gap-3 p-6 text-center max-w-md">
              <AlertCircle size={32} className="text-red-400" />
              <p className="text-stone-500 font-medium">This file type cannot be previewed in the browser</p>
              <button
                type="button"
                onClick={() => previewResumeCandidate && handleResumeDownload(previewResumeCandidate)}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                Download Instead
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <AlertCircle size={32} className="text-red-400" />
              <p className="text-stone-500 font-medium">Unable to preview this file</p>
              <button
                type="button"
                onClick={() => previewResumeCandidate && handleResumeDownload(previewResumeCandidate)}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                Download Instead
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
