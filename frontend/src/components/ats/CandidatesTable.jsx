import React from 'react';
import { CheckSquare, Square, MinusSquare, Search, Share2, Users, Plus } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { blankCandidateForm } from './atsConstants';

export default function CandidatesTable(props) {
  const {
    tableScrollRef, onTableDragScrollStart, onTableDragScrollMove, onTableDragScrollEnd,
    togglePageSelection, isPageSelected, isPagePartial, orderedColumns, visibleCandidates,
    selectedIds, toggleSelection, isLoadingInitial, viewMode, searchQuery,
    advancedSearchFilters, setEditId, setFormData, setFormErrors, setCountryCode,
    setCountryIso, setShowModal, isFreelancer, initialFormState, openAddCandidate,
  } = props;
  const pageIds = visibleCandidates.map((c) => c._id);
  const hasRows = visibleCandidates.length > 0;
  const showOverlay = Boolean(isLoadingInitial);

  return (
        <div className="relative min-h-[280px]">
          <div
            ref={tableScrollRef}
            data-tour="cand-table"
            className={`cand-table-scroll overflow-x-auto select-none transition-[filter,opacity] duration-300 ease-out ${
              showOverlay
                ? 'pointer-events-none select-none opacity-45 blur-[2.5px] saturate-75'
                : 'opacity-100 blur-0'
            }`}
            onMouseDown={showOverlay ? undefined : onTableDragScrollStart}
            onMouseMove={showOverlay ? undefined : onTableDragScrollMove}
            onMouseUp={showOverlay ? undefined : onTableDragScrollEnd}
            onMouseLeave={showOverlay ? undefined : onTableDragScrollEnd}
            aria-busy={showOverlay}
          >
          <table
            className="cand-table-drag w-max min-w-full text-left border-collapse select-text border border-stone-200"
            role="table"
            aria-label="Candidates list"
            style={{ tableLayout: 'auto' }}
          >
            <thead>
              <tr className="bg-stone-100">
                <th scope="col" className="px-3.5 py-3.5 w-[52px] text-center border border-stone-200 bg-stone-100">
                  <button
                    type="button"
                    title={isPageSelected ? 'Deselect this page' : 'Select this page only'}
                    aria-label={isPageSelected ? 'Deselect this page' : 'Select this page only'}
                    onClick={() => togglePageSelection(pageIds)}
                    className="cursor-pointer flex justify-center mx-auto p-1 rounded hover:bg-stone-200/80"
                    disabled={showOverlay}
                  >
                    {isPageSelected ? (
                      <CheckSquare size={18} className="text-brand-600" aria-hidden="true" />
                    ) : isPagePartial ? (
                      <MinusSquare size={18} className="text-brand-500" aria-hidden="true" />
                    ) : (
                      <Square size={18} className="text-stone-400" aria-hidden="true" />
                    )}
                  </button>
                </th>
                {orderedColumns.map((column) => (
                  <th
                    scope="col"
                    key={column.key}
                    className={`px-3.5 py-3.5 text-[10px] font-bold text-stone-600 uppercase tracking-wider whitespace-nowrap border border-stone-200 bg-stone-100 ${column.className || ''}`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoadingInitial && !hasRows && Array.from({ length: 8 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  <td className="px-3.5 py-3 border border-stone-200">
                    <div className="h-4 w-4 skeleton-ats rounded mx-auto" />
                  </td>
                  {orderedColumns.map((column) => (
                    <td key={column.key} className="px-3.5 py-3 border border-stone-200">
                      <div className="h-4 skeleton-ats rounded w-24 max-w-full" />
                    </td>
                  ))}
                </tr>
              ))}
              {visibleCandidates.map((candidate, index) => (
                <tr
                  key={candidate._id}
                  className={`transition-colors ${
                    selectedIds.includes(candidate._id) ? 'bg-brand-50/80' : index % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'
                  } hover:bg-brand-50/50`}
                >
                  <td className="px-3.5 py-3 text-center w-[52px] border border-stone-200">
                    <button
                      type="button"
                      aria-label={selectedIds.includes(candidate._id) ? `Deselect ${candidate.name || 'candidate'}` : `Select ${candidate.name || 'candidate'}`}
                      onClick={() => toggleSelection(candidate._id)}
                      className="cursor-pointer flex justify-center mx-auto p-1 rounded hover:bg-stone-100"
                      disabled={showOverlay}
                    >
                      {selectedIds.includes(candidate._id) ? <CheckSquare className="text-brand-600" size={17} aria-hidden="true" /> : <Square className="text-stone-300 hover:text-stone-400" size={17} aria-hidden="true" />}
                    </button>
                  </td>
                  {orderedColumns.map((column) => (
                    <td
                      key={`${candidate._id}-${column.key}`}
                      className={`px-3.5 py-3 text-sm text-stone-700 font-medium border border-stone-200 align-middle whitespace-nowrap overflow-visible ${column.className || ''}`}
                    >
                      {column.render(candidate, index)}
                    </td>
                  ))}
                </tr>
              ))}
              {visibleCandidates.length === 0 && !isLoadingInitial && (
                <tr>
                  <td colSpan={orderedColumns.length + 1} className="border border-stone-200">
                    {viewMode === 'shared' ? (
                      <EmptyState icon={Share2} tone="sky" message="No shared candidates yet" subMessage="When team members share candidates with you, they will appear here." />
                    ) : searchQuery || Object.values(advancedSearchFilters).some(Boolean) ? (
                      <EmptyState icon={Search} tone="amber" message="No candidates match your filters" subMessage="Try different keywords or clear advanced filters." />
                    ) : (
                      <EmptyState
                        icon={Users}
                        tone="brand"
                        message="No candidates yet"
                        subMessage={
                          isFreelancer
                            ? 'Create a candidate record to begin submissions against open mandates.'
                            : 'Add candidates manually or import from Excel to get started.'
                        }
                        action={
                          <button
                            type="button"
                            onClick={() => {
                              if (typeof openAddCandidate === 'function') {
                                openAddCandidate();
                                return;
                              }
                              setEditId(null);
                              setFormData(typeof initialFormState === 'function' ? initialFormState() : blankCandidateForm(isFreelancer ? 'freelancer' : ''));
                              setFormErrors({});
                              setCountryCode('+91');
                              setCountryIso('IN');
                              setShowModal(true);
                            }}
                            className="btn-primary"
                          >
                            <Plus size={16} /> Add Candidate
                          </button>
                        }
                      />
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>

          {showOverlay ? (
            <div
              className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-b from-white/70 via-stone-50/75 to-white/80 backdrop-blur-[1px]"
              role="status"
              aria-live="polite"
              aria-label="Searching candidates"
            >
              <div className="pointer-events-none flex flex-col items-center gap-3.5 rounded-2xl border border-stone-200/90 bg-white/95 px-9 py-7 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.45)] ring-1 ring-stone-900/5">
                <div className="relative h-11 w-11">
                  <span className="absolute inset-0 rounded-full border-2 border-brand-100" aria-hidden="true" />
                  <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-600 animate-spin" aria-hidden="true" />
                  <span className="absolute inset-2 rounded-full border border-teal-200/80 opacity-70 animate-pulse" aria-hidden="true" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold tracking-tight text-stone-900">Searching candidates</p>
                  <p className="mt-1 text-xs font-medium text-stone-500">Updating results for your filters</p>
                </div>
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-bounce [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-bounce [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-bounce" />
                </div>
              </div>
            </div>
          ) : null}
        </div>
  );
}
