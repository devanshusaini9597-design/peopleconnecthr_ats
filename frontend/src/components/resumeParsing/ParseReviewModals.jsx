import React from 'react';
import {
  CheckCircle, ThumbsUp, ThumbsDown, Loader2, UserPlus, Trash2, RotateCcw, Eye, Download,
} from 'lucide-react';
import Modal from '../ui/Modal';
import { FIELD_DEFS, StatusBadge } from './resumeParsingConstants';

export function ParseReviewModals({
  navigate, toast,
  reviewIdx, setReviewIdx, reviewResult, reviewStatus,
  editingIdx, editBuffer,
  handleCancelEdit, handleSaveEdit, handleEditChange,
  openEditInModal, setRowStatus, removeRows, addToCandidate,
  handleViewResume, handleDownloadResume,
  confirmAddAllOpen, setConfirmAddAllOpen,
  approvedDataList, addingAll, addAllAsCandidates,
  addSuccessModal, setAddSuccessModal,
}) {
  return (
    <>
      {/* Manage / review modal */}
      <Modal
        open={reviewIdx != null && !!reviewResult}
        onClose={() => { setReviewIdx(null); handleCancelEdit(); }}
        title="Manage parsed resume"
        description={reviewResult?.fileName || ''}
        size="lg"
        footer={
          reviewResult?.success ? (
            <>
              {reviewStatus === 'approved' ? (
                <button type="button" className="btn-ghost sm:mr-auto" onClick={() => setRowStatus(reviewIdx, 'pending')}>
                  <RotateCcw size={14} /> Unapprove
                </button>
              ) : reviewStatus === 'rejected' ? (
                <button type="button" className="btn-ghost sm:mr-auto" onClick={() => setRowStatus(reviewIdx, 'pending')}>
                  <RotateCcw size={14} /> Restore to Pending
                </button>
              ) : (
                <button type="button" className="btn-ghost !text-red-600 sm:mr-auto" onClick={() => setRowStatus(reviewIdx, 'rejected')}>
                  <ThumbsDown size={14} /> Reject
                </button>
              )}
              {editingIdx === reviewIdx ? (
                <>
                  <button type="button" className="btn-secondary" onClick={handleCancelEdit}>Cancel edit</button>
                  <button type="button" className="btn-primary" onClick={() => handleSaveEdit(reviewIdx)}>Save fields</button>
                </>
              ) : (
                <>
                  <button type="button" className="btn-secondary" onClick={() => openEditInModal(reviewIdx)}>Edit fields</button>
                  {reviewStatus !== 'approved' && (
                    <button type="button" className="btn-secondary" onClick={() => { setRowStatus(reviewIdx, 'approved'); toast.success('Approved'); }}>
                      <ThumbsUp size={14} /> Approve
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={reviewStatus === 'rejected'}
                    onClick={() => addToCandidate(reviewResult.data)}
                    title={reviewStatus === 'rejected' ? 'Restore or approve before adding' : 'Open Add Candidate with these fields'}
                  >
                    <UserPlus size={16} /> Add as candidate
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button type="button" className="btn-ghost !text-red-600 sm:mr-auto" onClick={() => removeRows([reviewIdx])}>
                <Trash2 size={14} /> Remove
              </button>
              <button type="button" className="btn-secondary" onClick={() => setReviewIdx(null)}>Close</button>
            </>
          )
        }
      >
        {reviewResult && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={reviewStatus} />
              <button
                type="button"
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:text-brand-600"
                title={reviewResult.fileName ? `View · ${reviewResult.fileName}` : 'View resume'}
                onClick={() => handleViewResume(reviewResult)}
              >
                <Eye size={14} />
              </button>
              <button
                type="button"
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:text-brand-600"
                title={reviewResult.fileName ? `Download · ${reviewResult.fileName}` : 'Download resume'}
                onClick={() => handleDownloadResume(reviewResult)}
              >
                <Download size={14} />
              </button>
              <span className="text-xs text-stone-500">
                {reviewStatus === 'approved' && 'Ready for bulk import to Candidates.'}
                {reviewStatus === 'pending' && 'Needs review — approve to include in bulk import.'}
                {reviewStatus === 'rejected' && 'Excluded from import. Restore to Pending to reconsider.'}
                {reviewStatus === 'failed' && (reviewResult.error || 'Extraction failed.')}
              </span>
            </div>
            {reviewResult.success && reviewResult.data && (
              editingIdx === reviewIdx ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {FIELD_DEFS.map(({ key: k, label, type }) => (
                    <div key={k} className={k === 'skills' ? 'sm:col-span-2' : ''}>
                      <label className="label-ats">{label}</label>
                      {k === 'skills' ? (
                        <textarea
                          name={k}
                          value={editBuffer[k] || ''}
                          onChange={handleEditChange}
                          rows={2}
                          className="textarea-ats"
                          placeholder={label}
                        />
                      ) : (
                        <input
                          type={type}
                          name={k}
                          value={editBuffer[k] || ''}
                          onChange={handleEditChange}
                          className="field-premium"
                          placeholder={label}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {FIELD_DEFS.map(({ key: k, label }) => (
                    <div key={k} className={`rounded-xl border border-stone-200 px-3 py-2.5 bg-stone-50/50 ${k === 'skills' ? 'sm:col-span-2' : ''}`}>
                      <span className="text-stone-500 text-[10px] font-bold uppercase tracking-wide block mb-0.5">{label}</span>
                      <span className="text-stone-900 font-medium break-words">{reviewResult.data[k] || '—'}</span>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={confirmAddAllOpen}
        onClose={() => setConfirmAddAllOpen(false)}
        title="Add approved candidates"
        description={`Add ${approvedDataList.length} approved candidate(s) to Candidates? Duplicates (same email/phone) are skipped.`}
        footer={
          <>
            <button type="button" onClick={() => setConfirmAddAllOpen(false)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={addAllAsCandidates} disabled={addingAll} className="btn-primary">
              {addingAll ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={16} />}
              Confirm add
            </button>
          </>
        }
      />

      <Modal
        open={!!addSuccessModal}
        onClose={() => setAddSuccessModal(null)}
        title="Import complete"
        description={
          addSuccessModal
            ? `${addSuccessModal.created} added.${
              addSuccessModal.skipped || addSuccessModal.errors
                ? ` ${addSuccessModal.skipped || 0} skipped · ${addSuccessModal.errors || 0} failed.`
                : ''
            }`
            : ''
        }
        footer={
          <>
            <button type="button" onClick={() => setAddSuccessModal(null)} className="btn-secondary">Stay here</button>
            <button type="button" onClick={() => { setAddSuccessModal(null); navigate('/ats'); }} className="btn-primary">Go to Candidates</button>
          </>
        }
      >
        <div className="flex justify-center py-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
            <CheckCircle size={28} className="text-emerald-600" />
          </div>
        </div>
      </Modal>
    </>
  );
}
