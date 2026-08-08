import React from 'react';

export const ToggleRow = ({ checked, onChange, disabled, label, description }) => (
  <div
    className={`flex items-start justify-between gap-3 p-3.5 rounded-2xl border transition-colors ${
      disabled
        ? 'opacity-50 cursor-not-allowed border-stone-100 bg-stone-50/40'
        : 'border-stone-200/70 bg-white hover:border-stone-300/90'
    }`}
  >
    <div className="min-w-0">
      <span className="text-sm font-semibold text-stone-900">{label}</span>
      {description && <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">{description}</p>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`mt-0.5 relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-60 ${
        checked ? 'bg-brand-600' : 'bg-stone-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow translate-y-0.5 transition ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  </div>
);

export default ToggleRow;
