import React from 'react';
import { Check, Loader2, Save, Sparkles, X } from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import { getOriginal } from './pendingReviewHelpers';

export default function PendingReviewEditModal({
  editing,
  editErrors,
  isSaving,
  isImporting,
  positionOptions,
  ctcOptions,
  ectcOptions,
  expOptions,
  npOptions,
  statusOptions,
  sourceOptions,
  clientOptions,
  updateEdit,
  saveEdit,
  importFromEdit,
  onClose,
}) {
  if (!editing) return null;

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-stone-100 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="font-bold text-stone-900">
              Fix row {editing.rowIndex != null ? editing.rowIndex : ''}
              {editing.name ? ` · ${editing.name}` : ''}
            </h3>
            <p className="text-xs text-stone-500">Save to update the queue, or Save & import to push into Candidates.</p>
          </div>
          <button
            type="button"
            className="h-9 w-9 rounded-xl border border-stone-200 inline-flex items-center justify-center"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 grid sm:grid-cols-2 gap-3">
          {[
            { f: 'name', l: 'Name', t: 'text' },
            { f: 'email', l: 'Email', t: 'email' },
            { f: 'contact', l: 'Contact', t: 'text' },
            { f: 'companyName', l: 'Company', t: 'text' },
            { f: 'position', l: 'Position', t: 'select', o: positionOptions },
            { f: 'ctc', l: 'CTC', t: 'select', o: ctcOptions },
            { f: 'expectedCtc', l: 'Expected CTC', t: 'select', o: ectcOptions },
            { f: 'experience', l: 'Experience', t: 'select', o: expOptions },
            { f: 'noticePeriod', l: 'Notice', t: 'select', o: npOptions },
            { f: 'location', l: 'Location', t: 'text' },
            { f: 'status', l: 'Status', t: 'select', o: statusOptions },
            { f: 'source', l: 'Source', t: 'select', o: sourceOptions },
            { f: 'client', l: 'Client', t: 'select', o: clientOptions },
            { f: 'spoc', l: 'SPOC', t: 'text' },
            { f: 'remark', l: 'Remark', t: 'text' },
          ].map(({ f, l, t, o }) => {
            const val = editing[f] ?? '';
            const orig = getOriginal(editing, f);
            const origStr = orig != null ? String(orig).trim() : '';
            const diff = origStr && String(val).trim() && origStr.toLowerCase() !== String(val).trim().toLowerCase();
            return (
              <div key={f} className="min-w-0">
                <label className="label-ats">
                  {l}
                  {diff && <span className="text-amber-600 font-medium normal-case ml-1">(was: {origStr.slice(0, 24)})</span>}
                </label>
                {t === 'select' ? (
                  <PremiumSelect variant="list" value={String(val)} onChange={(v) => updateEdit(f, v || '')} options={o} allowClear searchable />
                ) : (
                  <input
                    className={`input-ats ${editErrors[f] ? '!border-red-300' : diff ? '!border-amber-300' : ''}`}
                    type={t}
                    value={val}
                    onChange={(e) => updateEdit(f, e.target.value)}
                  />
                )}
                {editErrors[f] && <p className="text-[11px] text-red-600 mt-1">{editErrors[f]}</p>}
              </div>
            );
          })}
        </div>

        {(editing.validationErrors || []).length > 0 && (
          <div className="mx-5 mb-3 rounded-xl border border-red-100 bg-red-50/60 p-3">
            <p className="text-xs font-bold text-red-800 mb-1">Validation issues</p>
            <ul className="text-[11px] text-red-700 space-y-0.5">
              {(editing.validationErrors || []).slice(0, 8).map((e, i) => (
                <li key={i}>
                  {typeof e === 'object' && e?.field ? `${e.field}: ${e.message || ''}` : (e?.message || String(e))}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(editing.autoFixChanges || []).length > 0 && (
          <div className="mx-5 mb-3 rounded-xl border border-teal-100 bg-teal-50/50 p-3">
            <p className="text-xs font-bold text-teal-800 mb-1 flex items-center gap-1">
              <Sparkles size={12} /> Auto-fixes applied
            </p>
            <ul className="text-[11px] text-teal-900 space-y-0.5">
              {(editing.autoFixChanges || []).slice(0, 8).map((c, i) => (
                <li key={i}>{typeof c === 'string' ? c : `${c.field || 'field'}: ${c.from || ''} → ${c.to || c.message || ''}`}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="px-5 pb-5 flex flex-wrap gap-2">
          <button type="button" className="btn-primary flex-1" disabled={isSaving} onClick={saveEdit}>
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
          </button>
          <button type="button" className="btn-primary flex-1 !bg-emerald-600 hover:!bg-emerald-700" disabled={isSaving || isImporting} onClick={importFromEdit}>
            {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save & import
          </button>
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
