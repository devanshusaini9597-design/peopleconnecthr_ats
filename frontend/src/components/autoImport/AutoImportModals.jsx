import React from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import ConfirmationModal from '../ConfirmationModal';
import PremiumSelect from '../ui/PremiumSelect';

export default function AutoImportModals({
  editingRow,
  setEditingRow,
  editErrors,
  updateEdit,
  saveEdited,
  positionOptions,
  clientOptions,
  sourceOptions,
  statusOptions,
  ctcOptions,
  ectcOptions,
  npOptions,
  expOptions,
  blocker,
  busy,
  confirmModal,
  setConfirmModal,
  isImporting,
}) {
  return (
    <>
      {editingRow && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-stone-100 px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-stone-900">Fix row {editingRow.rowIndex}</h3>
                <p className="text-xs text-stone-500">Saving moves this row to Ready and selects it for import.</p>
              </div>
              <button type="button" className="h-9 w-9 rounded-xl border border-stone-200 inline-flex items-center justify-center" onClick={() => setEditingRow(null)}>
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
                const val = editingRow.fixed?.[f] ?? '';
                return (
                  <div key={f} className="min-w-0">
                    <label className="label-ats">{l}</label>
                    {t === 'select' ? (
                      <PremiumSelect variant="list" value={String(val)} onChange={(v) => updateEdit(f, v || '')} options={o} allowClear searchable />
                    ) : (
                      <input className={`input-ats ${editErrors[f] ? '!border-red-300' : ''}`} type={t} value={val} onChange={(e) => updateEdit(f, e.target.value)} />
                    )}
                    {editErrors[f] && <p className="text-[11px] text-red-600 mt-1">{editErrors[f]}</p>}
                  </div>
                );
              })}
            </div>
            {(editingRow.autoFixChanges || []).length > 0 && (
              <div className="mx-5 mb-3 rounded-xl border border-teal-100 bg-teal-50/50 p-3">
                <p className="text-xs font-bold text-teal-800 mb-1 flex items-center gap-1"><Sparkles size={12} /> Auto-fixes applied</p>
                <ul className="text-[11px] text-teal-900 space-y-0.5">
                  {(editingRow.autoFixChanges || []).slice(0, 8).map((c, i) => (
                    <li key={i}>{typeof c === 'string' ? c : `${c.field || 'field'}: ${c.from || ''} → ${c.to || c.message || ''}`}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="px-5 pb-5 flex gap-2">
              <button type="button" className="btn-primary flex-1" onClick={saveEdited}><Check size={16} /> Save to Ready</button>
              <button type="button" className="btn-secondary flex-1" onClick={() => setEditingRow(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-stone-900/60 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-stone-200 shadow-xl">
            <h3 className="text-lg font-bold text-stone-900">{busy ? 'Work in progress' : 'Leave import?'}</h3>
            <p className="text-sm text-stone-600 mt-2 mb-4">
              {busy ? 'Wait for upload/import to finish.' : 'Leave this page?'}
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn-primary flex-1" onClick={() => blocker.reset?.()}>Stay</button>
              <button type="button" className="btn-secondary flex-1 disabled:opacity-40" disabled={busy} onClick={() => blocker.proceed?.()}>Leave</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false })}
        onConfirm={confirmModal.onConfirm || (() => {})}
        title={confirmModal.title}
        eyebrow={confirmModal.eyebrow}
        message={confirmModal.message}
        details={confirmModal.details}
        stats={confirmModal.stats}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
        isLoading={isImporting}
      />
    </>
  );
}
