import React from 'react';

const FieldRow = ({ label, hint, children }) => (
  <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-6 py-4 first:pt-0 last:pb-0">
    <div className="sm:w-44 shrink-0 pt-0.5">
      <p className="text-sm font-semibold text-stone-900 tracking-tight">{label}</p>
      {hint && <p className="text-[11px] text-stone-400 mt-0.5 leading-snug">{hint}</p>}
    </div>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);

export default FieldRow;
