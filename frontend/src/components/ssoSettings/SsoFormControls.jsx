import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export const CopyField = ({ label, value }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="min-w-0">
      <label className="label-ats">{label}</label>
      <div className="flex items-stretch gap-2">
        <input
          readOnly
          value={value || ''}
          className="flex-1 input-ats !text-xs text-stone-600 font-mono min-w-0"
        />
        <button
          type="button"
          onClick={copy}
          className="h-[42px] w-11 inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 hover:text-brand-600 hover:border-brand-300 shrink-0"
          title="Copy"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

export const ToggleRow = ({ checked, onChange, label, description }) => (
  <label className="flex items-center justify-between gap-4 cursor-pointer p-3.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50/80 transition-colors">
    <div className="min-w-0">
      <span className="text-sm font-semibold text-stone-900">{label}</span>
      {description && <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{description}</p>}
    </div>
    <div className="relative inline-flex items-center shrink-0">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
      <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600" />
    </div>
  </label>
);

export const SectionCard = ({ icon: Icon, title, description, children, tourId }) => (
  <div
    data-tour={tourId}
    className="card-ats-bordered relative"
  >
    <div className="h-1 rounded-t-2xl bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
    <div className="px-5 sm:px-6 py-4 border-b border-stone-100">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-stone-900">{title}</h3>
          {description && <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{description}</p>}
        </div>
      </div>
    </div>
    <div className="p-5 sm:p-6 space-y-4">{children}</div>
  </div>
);
