import React from 'react';

export default function PendingReviewKpis({ stats, selectedCount, readyOnPage }) {
  return (
    <div data-tour="pr-kpis" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        { label: 'Needs review', value: stats.review, tone: 'text-amber-700', sub: 'Fixable issues' },
        { label: 'Blocked', value: stats.blocked, tone: 'text-red-700', sub: 'Critical gaps' },
        { label: 'In queue', value: stats.total, tone: 'text-stone-800', sub: 'Total pending' },
        { label: 'Selected', value: selectedCount, tone: 'text-brand-700', sub: `${readyOnPage} ready on page` },
      ].map((k) => (
        <div key={k.label} className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
          <p className={`text-2xl font-bold tabular-nums leading-none ${k.tone}`}>{k.value}</p>
          <p className="text-sm font-semibold text-stone-800 mt-1.5">{k.label}</p>
          <p className="text-[11px] text-stone-400">{k.sub}</p>
        </div>
      ))}
    </div>
  );
}
