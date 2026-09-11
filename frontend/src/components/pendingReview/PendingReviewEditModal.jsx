import React from 'react';
import { Check, Loader2, Save, X, ClipboardPen } from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';

const FIELD_GRID = [
  { f: 'name', l: 'Name', t: 'text' },
  { f: 'email', l: 'Email', t: 'email' },
  { f: 'contact', l: 'Contact', t: 'text' },
  { f: 'companyName', l: 'Company', t: 'text' },
  { f: 'position', l: 'Position', t: 'select', o: 'positionOptions' },
  { f: 'ctc', l: 'CTC', t: 'select', o: 'ctcOptions' },
  { f: 'expectedCtc', l: 'Expected CTC', t: 'select', o: 'ectcOptions' },
  { f: 'experience', l: 'Experience', t: 'select', o: 'expOptions' },
  { f: 'noticePeriod', l: 'Notice', t: 'select', o: 'npOptions' },
  { f: 'location', l: 'Location', t: 'text' },
  { f: 'status', l: 'Status', t: 'select', o: 'statusOptions' },
  { f: 'source', l: 'Source', t: 'select', o: 'sourceOptions' },
  { f: 'client', l: 'Client', t: 'select', o: 'clientOptions' },
  { f: 'spoc', l: 'SPOC', t: 'text' },
  { f: 'remark', l: 'Remark', t: 'text' },
];

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

  const optionMap = {
    positionOptions,
    ctcOptions,
    ectcOptions,
    expOptions,
    npOptions,
    statusOptions,
    sourceOptions,
    clientOptions,
  };

  const issueCount = (editing.validationErrors || []).length;

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-stone-900/50 backdrop-blur-sm" aria-hidden="true" />
      <div
        className="relative bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 bg-white border-b border-stone-100 px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div className="flex items-start gap-3 min-w-0">
            <div className="icon-box-ats shrink-0 !w-10 !h-10">
              <ClipboardPen className="w-5 h-5" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-stone-900 truncate">
                Edit record{editing.name ? ` · ${editing.name}` : ''}
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Update required fields, then save to the queue or release into Candidates.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="h-9 w-9 rounded-xl border border-stone-200 inline-flex items-center justify-center text-stone-500 hover:bg-stone-50 shrink-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 grid sm:grid-cols-2 gap-3.5">
          {FIELD_GRID.map(({ f, l, t, o }) => {
            const val = editing[f] ?? '';
            const opts = o ? optionMap[o] : null;
            return (
              <div key={f} className="min-w-0">
                <label className="label-ats" htmlFor={`pr-edit-${f}`}>{l}</label>
                {t === 'select' ? (
                  <PremiumSelect
                    id={`pr-edit-${f}`}
                    variant="list"
                    value={String(val)}
                    onChange={(v) => updateEdit(f, v || '')}
                    options={opts}
                    allowClear
                    searchable
                  />
                ) : (
                  <input
                    id={`pr-edit-${f}`}
                    className={`input-ats ${editErrors[f] ? '!border-red-300 focus:!ring-red-200' : ''}`}
                    type={t}
                    value={val}
                    onChange={(e) => updateEdit(f, e.target.value)}
                  />
                )}
                {editErrors[f] && <p className="text-[11px] text-red-600 mt-1 font-medium">{editErrors[f]}</p>}
              </div>
            );
          })}
        </div>

        {issueCount > 0 && (
          <div className="mx-5 mb-4 rounded-xl border border-amber-100 bg-amber-50/50 px-3.5 py-2.5">
            <p className="text-xs font-semibold text-amber-900">
              {issueCount} validation flag{issueCount === 1 ? '' : 's'} on this row — resolve before release when possible.
            </p>
          </div>
        )}

        <div className="px-5 pb-5 flex flex-wrap gap-2 border-t border-stone-100 pt-4">
          <button type="button" className="btn-primary flex-1 sm:flex-none" disabled={isSaving} onClick={saveEdit}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
          <button
            type="button"
            className="btn-primary flex-1 sm:flex-none !bg-emerald-600 hover:!bg-emerald-700"
            disabled={isSaving || isImporting}
            onClick={importFromEdit}
          >
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save & release
          </button>
          <button type="button" className="btn-secondary flex-1 sm:flex-none" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
