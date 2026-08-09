import React from 'react';
import { Star, Phone, Mail, Eye, Search } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { STAGES, classNames, formatDate, jobTitle } from './constants';

export default function ApplicationsTable({
  filteredApplications,
  selectedJob,
  openPanel,
  clearFilters,
  tableScrollRef,
  dragScrollRef,
  onTableDragScrollStart,
  onTableDragScrollMove,
  onTableDragScrollEnd,
}) {
  return (
    <div className="p-3 sm:p-4 lg:p-5 min-w-0">
      <div
        ref={tableScrollRef}
        className="table-shell-ats cand-table-scroll overflow-x-auto"
        onMouseDown={onTableDragScrollStart}
        onMouseMove={onTableDragScrollMove}
        onMouseUp={onTableDragScrollEnd}
        onMouseLeave={onTableDragScrollEnd}
      >
        <table className="cand-table-drag w-full text-left text-sm min-w-[860px] select-text">
          <thead className="bg-stone-50/80 border-b border-stone-200 text-stone-500 text-[11px] uppercase tracking-wider">
            <tr>
              <th className="px-4 sm:px-5 py-3.5 font-bold whitespace-nowrap">Candidate</th>
              <th className="px-4 sm:px-5 py-3.5 font-bold whitespace-nowrap">Position</th>
              <th className="px-4 sm:px-5 py-3.5 font-bold whitespace-nowrap">Stage</th>
              <th className="px-4 sm:px-5 py-3.5 font-bold whitespace-nowrap">Source</th>
              <th className="px-4 sm:px-5 py-3.5 font-bold whitespace-nowrap">Applied</th>
              <th className="px-4 sm:px-5 py-3.5 font-bold whitespace-nowrap">Rating</th>
              <th className="px-4 sm:px-5 py-3.5 font-bold whitespace-nowrap text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filteredApplications.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5">
                  <EmptyState
                    icon={Search}
                    tone="amber"
                    compact
                    message="No candidates match"
                    subMessage="Clear search or stage filter."
                    action={
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={clearFilters}
                      >
                        Clear filters
                      </button>
                    }
                  />
                </td>
              </tr>
            ) : (
              filteredApplications.map((app) => {
                const stageMeta = STAGES.find((s) => s.id === app.stage) || STAGES[0];
                const phone = app.candidate?.phone || app.candidate?.contact;
                return (
                  <tr
                    key={app._id}
                    className="hover:bg-brand-50/30 cursor-pointer transition-colors"
                    onClick={() => {
                      if (dragScrollRef.current.moved) {
                        dragScrollRef.current.moved = false;
                        return;
                      }
                      openPanel(app);
                    }}
                  >
                    <td className="px-4 sm:px-5 py-3.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {(app.candidate?.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-stone-900 truncate max-w-[160px]">{app.candidate?.name}</div>
                          <div className="text-stone-500 text-xs truncate max-w-[180px]">{app.candidate?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 text-stone-700 whitespace-nowrap max-w-[140px] truncate">
                      {jobTitle(app.job) || jobTitle(selectedJob)}
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 whitespace-nowrap">
                      <span className={classNames('px-2.5 py-1 rounded-lg text-xs font-bold border', stageMeta.color, stageMeta.textColor, stageMeta.borderColor)}>
                        {app.stage}
                      </span>
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 text-stone-600 whitespace-nowrap">{app.source || '—'}</td>
                    <td className="px-4 sm:px-5 py-3.5 text-stone-600 whitespace-nowrap">{formatDate(app.createdAt || app.appliedAt)}</td>
                    <td className="px-4 sm:px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className={classNames('w-3.5 h-3.5', star <= (app.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-stone-300')} />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 sm:px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {app.candidate?.email && (
                          <a
                            href={`mailto:${app.candidate.email}`}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:text-brand-600 hover:border-brand-300 transition-colors"
                            title="Email"
                          >
                            <Mail size={14} />
                          </a>
                        )}
                        {phone && (
                          <a
                            href={`tel:${phone}`}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:text-brand-600 hover:border-brand-300 transition-colors"
                            title="Call"
                          >
                            <Phone size={14} />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => openPanel(app)}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:text-brand-600 hover:border-brand-300 transition-colors"
                          title="Open"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
