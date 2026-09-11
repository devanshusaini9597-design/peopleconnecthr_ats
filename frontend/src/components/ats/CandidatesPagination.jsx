import React from 'react';
import { PAGE_SIZE } from './atsConstants';

function pageButtonClass(active) {
  return active
    ? 'bg-gradient-to-br from-brand-600 to-teal-600 text-white shadow-md shadow-brand-500/25'
    : 'text-stone-600 hover:bg-white border border-transparent hover:border-stone-200 bg-white/60';
}

export default function CandidatesPagination({
  visibleCandidates,
  currentPage,
  setCurrentPage,
  filteredCandidates,
  totalFilteredPages,
  totalCount,
}) {
  const total = typeof totalCount === 'number' ? totalCount : (filteredCandidates?.length || 0);
  const pages = Math.max(1, totalFilteredPages || 1);
  const from = visibleCandidates.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(currentPage * PAGE_SIZE, total);

  const go = (page) => {
    const next = Math.min(pages, Math.max(1, page));
    if (next !== currentPage) setCurrentPage(next);
  };

  const windowPages = (() => {
    const maxButtons = 5;
    const count = Math.min(maxButtons, pages);
    return Array.from({ length: count }, (_, i) => {
      if (pages <= maxButtons) return i + 1;
      if (currentPage <= 3) return i + 1;
      if (currentPage >= pages - 2) return pages - 4 + i;
      return currentPage - 2 + i;
    });
  })();

  return (
    <div className="border-t border-stone-100 bg-stone-50/50 px-4 sm:px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 min-w-0">
        <p className="text-xs sm:text-sm text-stone-500 font-medium">
          Showing{' '}
          <span className="text-stone-800 font-semibold tabular-nums">{from.toLocaleString()}–{to.toLocaleString()}</span>
          {' '}of{' '}
          <span className="text-stone-800 font-semibold tabular-nums">{total.toLocaleString()}</span>
        </p>
        <span className="hidden sm:inline text-stone-300" aria-hidden>|</span>
        <p className="text-xs sm:text-sm font-semibold text-stone-700 tabular-nums">
          Page <span className="text-brand-700">{currentPage.toLocaleString()}</span>
          {' '}of{' '}
          <span className="text-stone-900">{pages.toLocaleString()}</span>
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => go(1)}
          disabled={currentPage <= 1}
          className="min-h-[44px] px-3 rounded-xl border-2 border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:border-brand-300 disabled:opacity-40 transition-all"
          aria-label="First page"
        >
          First
        </button>
        <button
          type="button"
          onClick={() => go(currentPage - 1)}
          disabled={currentPage <= 1}
          className="min-h-[44px] px-4 rounded-xl border-2 border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:border-brand-300 disabled:opacity-40 transition-all"
        >
          Previous
        </button>

        <div className="flex items-center gap-1" role="navigation" aria-label="Pagination">
          {windowPages[0] > 1 && (
            <span className="px-1 text-stone-400 text-sm select-none" aria-hidden>…</span>
          )}
          {windowPages.map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => go(page)}
              aria-current={page === currentPage ? 'page' : undefined}
              className={`min-h-[44px] min-w-[44px] rounded-xl text-sm font-semibold transition ${pageButtonClass(page === currentPage)}`}
            >
              {page}
            </button>
          ))}
          {windowPages[windowPages.length - 1] < pages && (
            <span className="px-1 text-stone-400 text-sm select-none" aria-hidden>…</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => go(currentPage + 1)}
          disabled={currentPage >= pages}
          className="min-h-[44px] px-4 rounded-xl border-2 border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:border-brand-300 disabled:opacity-40 transition-all"
        >
          Next
        </button>
        <button
          type="button"
          onClick={() => go(pages)}
          disabled={currentPage >= pages}
          className="min-h-[44px] px-3 rounded-xl border-2 border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:border-brand-300 disabled:opacity-40 transition-all"
          aria-label="Last page"
        >
          Last
        </button>
      </div>
    </div>
  );
}
