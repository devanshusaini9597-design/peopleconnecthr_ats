import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Single premium enterprise pager.
 */
export default function DeskPager({
  page,
  setPage,
  total,
  pageSize,
  label = 'items',
  className = '',
  hint = '',
}) {
  const totalPages = Math.max(1, Math.ceil(Math.max(0, Number(total) || 0) / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total > 0 ? (safePage - 1) * pageSize + 1 : 0;
  const end = Math.min(safePage * pageSize, total);

  const numbers = useMemo(() => {
    const maxButtons = 5;
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safePage <= 3) return [1, 2, 3, 4, 5];
    if (safePage >= totalPages - 2) {
      return Array.from({ length: 5 }, (_, i) => totalPages - 4 + i);
    }
    return [safePage - 2, safePage - 1, safePage, safePage + 1, safePage + 2];
  }, [safePage, totalPages]);

  if (!total) return null;

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}
    >
      <div className="min-w-0">
        <p className="text-[13px] text-stone-800 tabular-nums font-semibold tracking-tight">
          {start}–{end}
          <span className="text-stone-400 font-medium"> of </span>
          {total.toLocaleString()}
          <span className="text-stone-500 font-medium"> {label}</span>
        </p>
        {hint ? (
          <p className="text-[11px] text-stone-400 mt-0.5 truncate">{hint}</p>
        ) : (
          <p className="text-[11px] text-stone-400 mt-0.5 tabular-nums">
            Page {safePage} of {totalPages}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
        <button
          type="button"
          onClick={() => setPage(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
          className="h-9 px-3 rounded-full border border-stone-200 bg-white text-[12px] font-semibold text-stone-700 hover:border-brand-400 hover:bg-brand-50/40 disabled:opacity-35 disabled:hover:bg-white disabled:hover:border-stone-200 inline-flex items-center gap-1 transition-all shadow-sm"
        >
          <ChevronLeft size={14} strokeWidth={2.25} />
          Prev
        </button>
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setPage(n)}
            className={`h-9 min-w-[36px] px-2.5 rounded-full text-[12px] font-semibold border transition-all shadow-sm ${
              n === safePage
                ? 'bg-gradient-to-br from-stone-900 to-stone-800 text-white border-stone-900'
                : 'text-stone-600 border-stone-200 bg-white hover:bg-stone-50 hover:border-brand-300'
            }`}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPage(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages}
          className="h-9 px-3 rounded-full border border-stone-200 bg-white text-[12px] font-semibold text-stone-700 hover:border-brand-400 hover:bg-brand-50/40 disabled:opacity-35 disabled:hover:bg-white disabled:hover:border-stone-200 inline-flex items-center gap-1 transition-all shadow-sm"
        >
          Next
          <ChevronRight size={14} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}
