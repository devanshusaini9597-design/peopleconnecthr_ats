import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { PAGE_SIZE } from './atsConstants';

function pageButtonClass(active) {
  return active
    ? 'bg-gradient-to-br from-brand-600 to-teal-600 text-white shadow-md shadow-brand-500/30 ring-1 ring-brand-500/20'
    : 'text-stone-600 bg-white border border-stone-200/90 hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-800 shadow-sm shadow-stone-900/5';
}

const navBtn =
  'inline-flex items-center justify-center gap-1 min-h-10 sm:min-h-[2.75rem] px-2.5 sm:px-3.5 rounded-xl border border-stone-200/90 bg-white text-xs sm:text-sm font-semibold text-stone-700 shadow-sm shadow-stone-900/5 hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-800 disabled:opacity-40 disabled:pointer-events-none transition-all';

export default function CandidatesPagination({
  visibleCandidates,
  currentPage,
  setCurrentPage,
  filteredCandidates,
  totalFilteredPages,
  totalCount,
  countPending = false,
  countPlus = false,
}) {
  const total = typeof totalCount === 'number' ? totalCount : (filteredCandidates?.length || 0);
  const hideTotal = countPending;
  const pages = Math.max(1, totalFilteredPages || 1);
  const loaded = visibleCandidates.length;
  const from = loaded > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const to = loaded > 0 ? from + loaded - 1 : 0;

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
    <div className="border-t border-stone-100/90 bg-gradient-to-b from-stone-50/80 to-white px-3 sm:px-5 py-3 sm:py-3.5">
      <div className="flex flex-col gap-3 sm:gap-3.5">
        <div className="flex flex-col xs:flex-row sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3 min-w-0">
          <p className="text-xs sm:text-sm text-stone-500 font-medium leading-snug">
            Showing{' '}
            <span className="text-stone-800 font-semibold tabular-nums">{from.toLocaleString()}–{to.toLocaleString()}</span>
            {' '}of{' '}
            <span className="text-stone-800 font-semibold tabular-nums">
              {hideTotal ? '…' : `${total.toLocaleString()}${countPlus ? '+' : ''}`}
            </span>
            <span className="text-stone-400 font-normal"> candidates</span>
          </p>
          <p className="text-xs sm:text-sm font-semibold text-stone-600 tabular-nums">
            Page <span className="text-brand-700">{currentPage.toLocaleString()}</span>
            <span className="text-stone-400 font-medium"> / </span>
            <span className="text-stone-900">{hideTotal ? '…' : pages.toLocaleString()}</span>
          </p>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={() => go(1)}
              disabled={currentPage <= 1}
              className={`${navBtn} w-10 sm:w-auto`}
              aria-label="First page"
              title="First page"
            >
              <ChevronsLeft size={16} strokeWidth={2} />
              <span className="hidden sm:inline">First</span>
            </button>
            <button
              type="button"
              onClick={() => go(currentPage - 1)}
              disabled={currentPage <= 1}
              className={`${navBtn} w-10 sm:w-auto`}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} strokeWidth={2} />
              <span className="hidden sm:inline">Prev</span>
            </button>
          </div>

          <div className="inline-flex items-center gap-1 px-1 py-0.5 rounded-xl bg-stone-100/80 border border-stone-200/60" role="navigation" aria-label="Pagination">
            {windowPages[0] > 1 && (
              <span className="px-1 text-stone-400 text-xs select-none" aria-hidden>…</span>
            )}
            {windowPages.map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => go(page)}
                aria-current={page === currentPage ? 'page' : undefined}
                className={`min-h-9 min-w-9 sm:min-h-10 sm:min-w-10 rounded-lg text-xs sm:text-sm font-semibold transition-all ${pageButtonClass(page === currentPage)}`}
              >
                {page}
              </button>
            ))}
            {windowPages[windowPages.length - 1] < pages && (
              <span className="px-1 text-stone-400 text-xs select-none" aria-hidden>…</span>
            )}
          </div>

          <div className="inline-flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={() => go(currentPage + 1)}
              disabled={currentPage >= pages}
              className={`${navBtn} w-10 sm:w-auto`}
              aria-label="Next page"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight size={16} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => go(pages)}
              disabled={currentPage >= pages}
              className={`${navBtn} w-10 sm:w-auto`}
              aria-label="Last page"
              title="Last page"
            >
              <span className="hidden sm:inline">Last</span>
              <ChevronsRight size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
