import React from 'react';
import { Download, ArrowRight, ShieldCheck, CheckSquare, Sparkles } from 'lucide-react';

export default function PrepareStep({ downloadTemplate, setStep }) {
  return (
    <div className="grid lg:grid-cols-5 gap-5">
      <div className="lg:col-span-3 rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="p-6 sm:p-8 space-y-5">
          <div>
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">Prepare your spreadsheet</h2>
            <p className="text-sm text-stone-500 mt-1 leading-relaxed">
              Use our template so columns map correctly. Then upload — we validate every row and you choose what enters the ATS.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={downloadTemplate} className="btn-primary">
              <Download size={16} /> Download Excel template
            </button>
            <button type="button" onClick={() => setStep('upload')} className="btn-secondary">
              I already have a file <ArrowRight size={16} />
            </button>
          </div>
          <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-2">Required columns</p>
            <p className="text-sm text-stone-700 font-mono leading-relaxed">
              name · email · contact · companyName · ctc
            </p>
            <p className="text-xs text-stone-500 mt-2">Optional: position, location, expectedCtc, experience, noticePeriod, status, source, client, spoc, remark, date</p>
          </div>
        </div>
      </div>
      <div className="lg:col-span-2 space-y-3">
        {[
          { icon: ShieldCheck, title: 'Validate first', body: 'Rows score into Ready / Needs review / Blocked. No silent writes.' },
          { icon: CheckSquare, title: 'You select', body: 'Tick rows to import. Ready is pre-selected; you can uncheck any.' },
          { icon: Sparkles, title: 'Auto-fix shown', body: 'Domain typos, phones, and casing are corrected and visible before import.' },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-xl border border-stone-200 bg-white p-4 flex gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
              <Icon size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-900">{title}</p>
              <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
