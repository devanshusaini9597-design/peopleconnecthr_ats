import React from 'react';
import { CheckSquare, Square, Search, Share2, Users, Plus } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { INITIAL_FORM_STATE } from './atsConstants';

export default function CandidatesTable(props) {
  const {
    tableScrollRef, onTableDragScrollStart, onTableDragScrollMove, onTableDragScrollEnd,
    selectAll, filteredCandidates, isAllSelected, orderedColumns, visibleCandidates,
    selectedIds, toggleSelection, isLoadingInitial, viewMode, searchQuery,
    advancedSearchFilters, setEditId, setFormData, setFormErrors, setCountryCode,
    setCountryIso, setShowModal,
  } = props;
  return (
        <div
          ref={tableScrollRef}
          data-tour="cand-table"
          className="cand-table-scroll overflow-x-auto select-none"
          onMouseDown={onTableDragScrollStart}
          onMouseMove={onTableDragScrollMove}
          onMouseUp={onTableDragScrollEnd}
          onMouseLeave={onTableDragScrollEnd}
        >
          <table
            className="cand-table-drag w-full text-left border-collapse min-w-[1280px] select-text border border-stone-200"
            role="table"
            aria-label="Candidates list"
          >
            <thead>
              <tr className="bg-stone-100">
                <th scope="col" className="px-3.5 py-3.5 w-[52px] text-center border border-stone-200 bg-stone-100">
                  <button
                    type="button"
                    aria-label={isAllSelected ? 'Deselect all candidates' : 'Select all candidates'}
                    onClick={() => selectAll(filteredCandidates.map(c => c._id))}
                    className="cursor-pointer flex justify-center mx-auto p-1 rounded hover:bg-stone-200/80"
                  >
                    {isAllSelected ? <CheckSquare size={18} className="text-brand-600" aria-hidden="true" /> : <Square size={18} className="text-stone-400" aria-hidden="true" />}
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
                    >
                      {selectedIds.includes(candidate._id) ? <CheckSquare className="text-brand-600" size={17} aria-hidden="true" /> : <Square className="text-stone-300 hover:text-stone-400" size={17} aria-hidden="true" />}
                    </button>
                  </td>
                  {orderedColumns.map((column) => (
                    <td
                      key={`${candidate._id}-${column.key}`}
                      className={`px-3.5 py-3 text-sm text-stone-700 font-medium border border-stone-200 align-middle whitespace-nowrap ${column.className || ''}`}
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
                        subMessage="Add candidates manually or import from Excel to get started."
                        action={
                          <button
                            type="button"
                            onClick={() => {
                              setEditId(null);
                              setFormData(INITIAL_FORM_STATE);
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
  );
}
