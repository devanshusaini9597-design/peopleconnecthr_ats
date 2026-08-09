import React from 'react';

const TONE = {
  ready: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  review: 'bg-amber-50 text-amber-900 border-amber-200',
  blocked: 'bg-red-50 text-red-800 border-red-200',
  neutral: 'bg-stone-50 text-stone-600 border-stone-200',
};

export default function StatusChip({ tone = 'neutral', children }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${TONE[tone] || TONE.neutral}`}>
      {children}
    </span>
  );
}
