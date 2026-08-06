import React from 'react';
import { PAGE_SIZE } from './atsConstants';

export default function CandidatesPagination({
  visibleCandidates, currentPage, setCurrentPage, filteredCandidates, totalFilteredPages,
}) {
  return (
        <div className="border-t border-stone-100 bg-stone-50/50 px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs sm:text-sm text-stone-500 font-medium">
            Showing <span className="text-stone-800 font-semibold">{visibleCandidates.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(currentPage * PAGE_SIZE, filteredCandidates.length)}</span> of <span className="text-stone-800 font-semibold">{filteredCandidates.length.toLocaleString()}</span>
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="min-h-[44px] px-4 rounded-xl border-2 border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:border-brand-300 disabled:opacity-40 transition-all"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalFilteredPages) }, (_, i) => {
                let page;
                if (totalFilteredPages <= 5) page = i + 1;
                else if (currentPage <= 3) page = i + 1;
                else if (currentPage >= totalFilteredPages - 2) page = totalFilteredPages - 4 + i;
                else page = currentPage - 2 + i;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`min-h-[44px] min-w-[44px] rounded-xl text-sm font-semibold transition ${page === currentPage ? 'bg-gradient-to-br from-brand-600 to-teal-600 text-white shadow-md shadow-brand-500/25' : 'text-stone-600 hover:bg-white border border-transparent hover:border-stone-200'}`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            {currentPage < totalFilteredPages && (
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                className="min-h-[44px] px-4 rounded-xl border-2 border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:border-brand-300 transition-all"
              >
                Next
              </button>
            )}
          </div>
        </div>
  );
}
