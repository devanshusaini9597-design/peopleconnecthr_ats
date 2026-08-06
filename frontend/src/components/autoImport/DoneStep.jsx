import React from 'react';
import { CheckCircle, FileSpreadsheet, Inbox } from 'lucide-react';

export default function DoneStep({ importResult, navigate, resetAll }) {
  return (
    <div className="max-w-2xl mx-auto rounded-2xl border border-brand-200/60 bg-gradient-to-br from-brand-50/40 via-white to-white shadow-[var(--shadow-elevated)] overflow-hidden">
      <div className="px-6 sm:px-8 pt-7 pb-6 border-b border-stone-100/80">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-teal-700 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-500/30 ring-1 ring-white/20">
            <CheckCircle size={28} strokeWidth={2} />
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">Bulk import</p>
            <h2 className="text-2xl font-bold text-stone-900 tracking-tight mt-1">Import complete</h2>
            <p className="text-sm text-stone-500 mt-2 flex flex-wrap items-center gap-2">
              <span>Source</span>
              <span className="inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-800 text-xs font-semibold shadow-sm truncate">
                <FileSpreadsheet size={13} className="text-brand-600 flex-shrink-0" />
                <span className="truncate">{importResult.fileName}</span>
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 sm:px-8 py-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'New records', value: importResult.upserted ?? 0, hint: 'Created in Candidates', tone: 'emerald', bar: 'from-emerald-400 to-emerald-600', chip: 'bg-emerald-50/80 border-emerald-100' },
          { label: 'Updated', value: importResult.modified ?? 0, hint: 'Existing emails merged', tone: 'violet', bar: 'from-violet-400 to-violet-600', chip: 'bg-violet-50/80 border-violet-100' },
          { label: 'Total writes', value: importResult.imported ?? 0, hint: 'Database operations', tone: 'brand', bar: 'from-brand-400 to-teal-600', chip: 'bg-brand-50/80 border-brand-100' },
        ].map((k) => (
          <div key={k.label} className={`relative overflow-hidden rounded-xl border ${k.chip} px-4 py-4 shadow-sm`}>
            <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${k.bar}`} />
            <p className={`text-3xl font-bold tabular-nums leading-none tracking-tight ${
              k.tone === 'emerald' ? 'text-emerald-700' : k.tone === 'violet' ? 'text-violet-700' : 'text-brand-800'
            }`}>{k.value}</p>
            <p className="text-sm font-semibold text-stone-800 mt-3">{k.label}</p>
            <p className="text-[11px] text-stone-400 mt-0.5">{k.hint}</p>
          </div>
        ))}
      </div>

      <div className="px-6 sm:px-8 py-5 flex flex-col sm:flex-row gap-2.5 border-t border-stone-100 bg-white/80">
        <button type="button" className="btn-primary flex-1 !h-11" onClick={() => navigate('/ats')}>
          Open Candidates
        </button>
        <button type="button" className="btn-secondary flex-1 !h-11" onClick={resetAll}>
          Import another file
        </button>
        {(importResult.remainingReview > 0 || importResult.remainingBlocked > 0) && (
          <button type="button" className="btn-secondary !h-11" onClick={() => navigate('/pending-review')}>
            <Inbox size={16} /> Pending Review
          </button>
        )}
      </div>
    </div>
  );
}
