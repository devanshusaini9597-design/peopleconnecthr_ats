import React from 'react';
import { Users, Download, BarChart3, RefreshCw, Send } from 'lucide-react';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';

export default function AnalyticsModals({
  showPreview,
  setShowPreview,
  previewData,
  exportFormat,
  handleExport,
  navigate,
  previewScrollRef,
  onTableDragScrollStart,
  onTableDragScrollMove,
  onTableDragScrollEnd,
  showShareModal,
  setShowShareModal,
  handleShareReport,
  isSharingReport,
  selectedMembers,
  setSelectedMembers,
  isLoadingMembers,
  teamMembers,
  shareMessage,
  setShareMessage,
}) {
  return (
    <>
      <Modal
        open={showPreview && !!previewData}
        onClose={() => setShowPreview(false)}
        title={previewData?.title || 'Report Preview'}
        description={`${previewData?.rows?.length || 0} row${(previewData?.rows?.length || 0) === 1 ? '' : 's'} in this preview`}
        size="xl"
        footer={
          <>
            <p className="text-[11px] text-stone-400 mr-auto hidden sm:block">Confidential — People Connect HR</p>
            <button type="button" onClick={() => setShowPreview(false)} className="btn-secondary">Close</button>
            <button
              type="button"
              onClick={() => { setShowPreview(false); handleExport(); }}
              className="btn-primary"
            >
              <Download size={16} /> Download {exportFormat === 'pdf' ? 'PDF' : 'Excel'}
            </button>
          </>
        }
      >
        {previewData && (
          <div className="space-y-5">
            {previewData.summary?.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {previewData.summary.map((card, i) => {
                  const accents = [
                    'bg-brand-500',
                    'bg-teal-500',
                    'bg-amber-500',
                    'bg-stone-400',
                  ];
                  return (
                    <div
                      key={i}
                      className="relative rounded-xl border border-stone-200 bg-white px-3.5 py-3 min-w-0 overflow-hidden shadow-sm"
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accents[i % accents.length]}`} />
                      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 pl-1.5">{card.label}</p>
                      <p className="text-xl font-bold text-stone-900 tabular-nums mt-0.5 tracking-tight pl-1.5">{card.value}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {!previewData.rows?.length ? (
              <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/50">
                <EmptyState
                  icon={BarChart3}
                  tone="brand"
                  compact
                  message="No data for this report"
                  subMessage="Try a wider date range, or add candidates with positions to populate this preview."
                  action={
                    <button type="button" onClick={() => { setShowPreview(false); navigate('/ats?add=1'); }} className="btn-secondary !text-xs">
                      Add Candidate
                    </button>
                  }
                />
              </div>
            ) : (
              <div className="table-shell-ats overflow-hidden">
                <div className="px-4 py-2.5 border-b border-stone-100 bg-stone-50/80 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">Preview rows</p>
                  <p className="text-[11px] text-stone-400 tabular-nums">{previewData.rows.length} shown</p>
                </div>
                <div
                  ref={previewScrollRef}
                  className="cand-table-scroll overflow-x-auto max-h-[40vh] select-none"
                  onMouseDown={onTableDragScrollStart(previewScrollRef)}
                  onMouseMove={onTableDragScrollMove}
                  onMouseUp={onTableDragScrollEnd}
                  onMouseLeave={onTableDragScrollEnd}
                >
                  <table className="cand-table-drag w-full text-sm min-w-[560px] select-text">
                    <thead className="bg-stone-50 sticky top-0 z-10">
                      <tr>
                        {previewData.headers?.map((h, i) => (
                          <th key={i} className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider border-b border-stone-200 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {previewData.rows.map((row, ri) => (
                        <tr key={ri} className="hover:bg-brand-50/30 transition-colors">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-4 py-2.5 text-sm text-stone-700 whitespace-nowrap">{cell ?? '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {previewData.totalRows > (previewData.rows?.length || 0) && (
                  <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-200 text-xs text-amber-700 font-medium">
                    Showing {previewData.rows.length} of {previewData.totalRows} rows — download for the full report.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="Share Report"
        description="Send this report to team members by email."
        size="md"
        footer={
          <>
            <button type="button" onClick={() => setShowShareModal(false)} className="btn-secondary">Cancel</button>
            <button
              type="button"
              onClick={handleShareReport}
              disabled={isSharingReport || selectedMembers.length === 0}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {isSharingReport ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
              {isSharingReport ? 'Sharing…' : 'Share Report'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label-ats">Team members</label>
            {isLoadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw size={20} className="animate-spin text-emerald-500" />
              </div>
            ) : teamMembers.length === 0 ? (
              <EmptyState
                icon={Users}
                tone="emerald"
                compact
                message="No team members"
                subMessage="Invite teammates to share reports with them."
              />
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto border border-stone-200 rounded-xl p-2 bg-stone-50/60">
                {teamMembers.map((member) => {
                  const checked = selectedMembers.some((m) => m._id === member._id);
                  return (
                    <label
                      key={member._id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                        checked ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-white border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedMembers([...selectedMembers, member]);
                          else setSelectedMembers(selectedMembers.filter((m) => m._id !== member._id));
                        }}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-2 focus:ring-emerald-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-stone-900 truncate">{member.name}</p>
                        <p className="text-xs text-stone-500 truncate">{member.email}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="label-ats">Message (optional)</label>
            <textarea
              value={shareMessage}
              onChange={(e) => setShareMessage(e.target.value)}
              placeholder="Add a note for recipients…"
              rows={3}
              className="textarea-ats field-premium"
            />
          </div>

          {selectedMembers.length > 0 && (
            <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="text-xs font-semibold text-emerald-700">
                {selectedMembers.length} member{selectedMembers.length === 1 ? '' : 's'} selected
              </p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
