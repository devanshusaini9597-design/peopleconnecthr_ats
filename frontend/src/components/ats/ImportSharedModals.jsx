import React from 'react';
import { RefreshCw } from 'lucide-react';

export default function ImportSharedModals(props) {
  const {
    showImportSharedConfirm, setShowImportSharedConfirm, getIdsToImportShared,
    handleImportSharedToMine, isImportingShared, showImportAllConfirm,
    setShowImportAllConfirm, handleImportAllToMine, isImportingAll,
    importAllSuccess, setImportAllSuccess, fetchData, importSharedSuccess,
    setImportSharedSuccess,
  } = props;
  return (
    <>
      {/* Import shared candidates: confirm */}
      {showImportSharedConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-900/55 backdrop-blur-sm" onClick={() => setShowImportSharedConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-stone-900 mb-2">Import shared candidates</h3>
            <p className="text-stone-600 mb-6">
              Import {getIdsToImportShared().length} shared candidate(s) to your database? They will be copied to All Candidates.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowImportSharedConfirm(false)} className="px-4 py-2 text-stone-700 font-medium rounded-lg hover:bg-stone-100 transition-colors">Cancel</button>
              <button onClick={handleImportSharedToMine} disabled={isImportingShared} className="px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50">Import</button>
            </div>
          </div>
        </div>
      )}

      {/* Import all from database: confirm */}
      {showImportAllConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-900/55 backdrop-blur-sm" onClick={() => setShowImportAllConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-stone-900 mb-2">Import all candidates from database</h3>
            <p className="text-stone-600 mb-6">
              Copy every candidate in the database into your list? Candidates you already own will be skipped. This adds all others as &ldquo;My candidates&rdquo;.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowImportAllConfirm(false)} className="px-4 py-2 text-stone-700 font-medium rounded-lg hover:bg-stone-100 transition-colors">Cancel</button>
              <button onClick={handleImportAllToMine} disabled={isImportingAll} className="px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50">
                {isImportingAll ? 'Importing...' : 'Import all'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import all from database: success */}
      {importAllSuccess !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-900/55 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-stone-900 mb-2">Candidates imported</h3>
            <p className="text-stone-600 mb-6">{Number(importAllSuccess.imported) || 0} candidate(s) have been added to your database. You can find them under &ldquo;Show only mine&rdquo; or &ldquo;View all&rdquo;.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setImportAllSuccess(null)} className="px-4 py-2 text-stone-700 font-medium rounded-lg hover:bg-stone-100 transition-colors">Stay here</button>
              <button onClick={() => { setImportAllSuccess(null); fetchData(1, { search: '', position: '' }); }} className="px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors">Go to All Candidates</button>
            </div>
          </div>
        </div>
      )}

      {/* Import shared candidates: success */}
      {importSharedSuccess !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-900/55 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-stone-900 mb-2">Candidates imported</h3>
            <p className="text-stone-600 mb-6">{Number(importSharedSuccess.imported) || 0} shared candidate(s) have been added to your database.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setImportSharedSuccess(null); }} className="px-4 py-2 text-stone-700 font-medium rounded-lg hover:bg-stone-100 transition-colors">Stay here</button>
              <button onClick={() => { setImportSharedSuccess(null); fetchData(1, { search: '', position: '' }); }} className="px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors">Go to All Candidates</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
