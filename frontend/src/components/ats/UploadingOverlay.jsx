import React from 'react';

export default function UploadingOverlay({
  isUploading
}) {
  return (
    <>
      {isUploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/55">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            <h3 className="text-lg font-bold text-stone-800">Uploading candidates…</h3>
            <p className="mt-2 text-sm text-stone-500">Please wait. This can take a few minutes for large files.</p>
          </div>
        </div>
      )}
    </>
  );
}
