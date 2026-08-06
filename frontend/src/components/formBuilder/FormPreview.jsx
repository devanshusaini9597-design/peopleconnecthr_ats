import React from 'react';

export default function FormPreview({ title, fields, jobTitle }) {
  const visible = (fields || []).filter((f) => f.label?.trim());
  return (
    <div className="rounded-2xl border border-stone-200/90 bg-gradient-to-b from-stone-50 to-white overflow-hidden shadow-[0_1px_0_rgba(28,25,23,0.04)]">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-stone-100 bg-white/80">
        <span className="w-2 h-2 rounded-full bg-stone-300" />
        <span className="w-2 h-2 rounded-full bg-stone-300" />
        <span className="w-2 h-2 rounded-full bg-stone-300" />
        <span className="ml-2 flex-1 truncate rounded-md bg-stone-100 px-2 py-1 text-[10px] text-stone-400 font-medium">
          careers / apply{jobTitle ? ` · ${jobTitle}` : ''}
        </span>
      </div>
      <div className="p-4 space-y-3.5">
        <div>
          <p className="text-sm font-bold text-stone-900 tracking-tight leading-snug">
            {title || 'Application Form'}
          </p>
          <p className="text-[11px] text-stone-400 mt-0.5">Candidate-facing preview</p>
        </div>
        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-200 bg-white px-3 py-8 text-center">
            <p className="text-xs text-stone-400">Add labeled fields to preview the form.</p>
          </div>
        ) : (
          visible.map((f, i) => (
            <div key={i} className="space-y-1.5">
              <label className="text-[11px] font-semibold text-stone-700">
                {f.label}
                {f.required ? <span className="text-red-500 ml-0.5">*</span> : null}
              </label>
              {f.type === 'textarea' ? (
                <div className="rounded-xl border border-stone-200 bg-white min-h-[4.25rem] px-3 py-2.5 text-stone-400 text-sm pointer-events-none select-none">
                  {f.placeholder || ' '}
                </div>
              ) : f.type === 'yes_no' ? (
                <div className="flex gap-4 text-xs text-stone-600">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full border border-stone-300" /> Yes
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full border border-stone-300" /> No
                  </span>
                </div>
              ) : f.type === 'select' || f.type === 'radio' ? (
                <div className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-stone-400 text-sm pointer-events-none select-none">
                  {(f.options || [])[0] || 'Select…'}
                </div>
              ) : f.type === 'file' ? (
                <div className="rounded-xl border border-dashed border-stone-200 bg-white px-3 py-5 text-xs text-stone-400 text-center">
                  Upload file
                </div>
              ) : f.type === 'checkbox' ? (
                <div className="inline-flex items-center gap-2 text-xs text-stone-600">
                  <span className="w-3.5 h-3.5 rounded border border-stone-300" />
                  {f.placeholder || f.label}
                </div>
              ) : (
                <div className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-stone-400 text-sm pointer-events-none select-none">
                  {f.placeholder || ' '}
                </div>
              )}
              {f.showWhen?.fieldKey ? (
                <p className="text-[10px] text-amber-700/90 font-medium">
                  Shown when {f.showWhen.fieldKey} = {f.showWhen.equals || '…'}
                </p>
              ) : null}
            </div>
          ))
        )}
        {visible.length > 0 && (
          <div className="pt-1">
            <div className="inline-flex items-center justify-center rounded-xl bg-brand-600/90 px-4 py-2 text-xs font-semibold text-white pointer-events-none select-none">
              Submit application
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
