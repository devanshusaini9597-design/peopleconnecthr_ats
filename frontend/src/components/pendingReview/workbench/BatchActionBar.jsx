import React from 'react';
import { CheckSquare, Trash2, Upload, X } from 'lucide-react';

export default function BatchActionBar({
  selectedCount,
  readySelectedCount,
  isImporting,
  onClear,
  onDelete,
  onImport,
  onSelectReady,
}) {
  if (selectedCount <= 0) return null;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[min(920px,calc(100%-1.5rem))]">
      <div className="rounded-2xl border border-stone-200 bg-white shadow-2xl px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-100 text-brand-700 flex items-center justify-center shrink-0">
            <CheckSquare className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-stone-900">
              {selectedCount} selected for batch action
            </p>
            <p className="text-[11px] text-stone-500">
              {readySelectedCount} ready to release
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <button type="button" className="btn-secondary !h-9 !text-xs" onClick={onSelectReady}>
            Select ready only
          </button>
          <button type="button" className="btn-secondary !h-9 !text-xs" onClick={onClear}>
            <X className="w-3.5 h-3.5" /> Clear
          </button>
          <button
            type="button"
            className="btn-secondary !h-9 !text-xs !text-red-600 !border-red-200"
            onClick={onDelete}
          >
            <Trash2 className="w-3.5 h-3.5" /> Discard
          </button>
          <button
            type="button"
            className="btn-primary !h-9 !text-xs"
            disabled={!selectedCount || isImporting}
            onClick={onImport}
          >
            <Upload className="w-3.5 h-3.5" /> Release selected
          </button>
        </div>
      </div>
    </div>
  );
}
