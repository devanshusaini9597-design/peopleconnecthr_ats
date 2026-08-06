import React from 'react';
import { X, Share2, RefreshCw, Check, Users } from 'lucide-react';

export default function ShareCandidateModals(props) {
  const {
    showShareModal, showShareConfirmation, setShowShareModal, setShowShareConfirmation,
    selectedCandidatesForShare, teamMembers, selectedShareMembers, setSelectedShareMembers,
    handleShareCandidate, isSharingCandidate, shareCandidate, candidates,
  } = props;
  return (
    <>
      {/* Share Candidate Modal - Member Selection */}
      {showShareModal && !showShareConfirmation && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-900/55 backdrop-blur-sm" onClick={() => setShowShareModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-stone-900">Share Candidate{selectedCandidatesForShare.length > 1 ? 's' : ''}</h3>
              <button onClick={() => { setShowShareModal(false); setShowShareConfirmation(false); }} className="p-2 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer">
                <X size={20} className="text-stone-600" />
              </button>
            </div>
            
            <p className="text-sm text-stone-600 mb-4">
              {selectedCandidatesForShare.length === 1 ? (
                <>Share <span className="font-semibold text-stone-900">{shareCandidate?.fullName || shareCandidate?.name || 'candidate'}</span> with team members</>
              ) : (
                <>Share <span className="font-semibold text-stone-900">{selectedCandidatesForShare.length} candidates</span> with team members</>
              )}
            </p>

            <div className="space-y-3 max-h-64 overflow-y-auto mb-6">
              {teamMembers && teamMembers.length > 0 ? (
                teamMembers.map((member) => (
                  <label key={member._id} className="flex items-center gap-3 p-3 hover:bg-stone-50 rounded-lg cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedShareMembers.includes(member._id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedShareMembers([...selectedShareMembers, member._id]);
                        } else {
                          setSelectedShareMembers(selectedShareMembers.filter(id => id !== member._id));
                        }
                      }}
                      className="w-4 h-4 text-brand-600 rounded cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-900">{member.name}</p>
                      <p className="text-xs text-stone-500">{member.email}</p>
                    </div>
                    {member.role && (
                      <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-1 rounded whitespace-nowrap">
                        {member.role}
                      </span>
                    )}
                  </label>
                ))
              ) : (
                <EmptyState
                  icon={Users}
                  tone="emerald"
                  compact
                  message="No team members available"
                  subMessage="Invite colleagues to share candidates with them."
                />
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowShareModal(false); setShowShareConfirmation(false); }}
                className="px-4 py-2 text-stone-700 font-medium rounded-lg hover:bg-stone-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleShareCandidate}
                disabled={selectedShareMembers.length === 0}
                className="px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Share2 size={16} />
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Confirmation Modal */}
      {showShareConfirmation && selectedShareMembers.length > 0 && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-900/55 backdrop-blur-sm" onClick={() => setShowShareConfirmation(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-stone-900">Confirm Share</h3>
              <button onClick={() => setShowShareConfirmation(false)} className="p-2 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer">
                <X size={20} className="text-stone-600" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {/* Candidates being shared */}
              <div className="p-4 bg-brand-50 rounded-xl border border-brand-200">
                <p className="text-xs font-semibold text-brand-900 mb-2">CANDIDATES ({selectedCandidatesForShare.length})</p>
                <div className="space-y-2">
                  {selectedCandidatesForShare.length === 1 && shareCandidate ? (
                    <p className="text-sm text-brand-800">{shareCandidate.fullName || shareCandidate.name || 'Unknown'}</p>
                  ) : (
                    <p className="text-sm text-brand-800">{selectedCandidatesForShare.length} candidates selected</p>
                  )}
                </div>
              </div>

              {/* Team members being shared with */}
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs font-semibold text-green-900 mb-2">SHARING WITH ({selectedShareMembers.length})</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {teamMembers && teamMembers.filter(m => selectedShareMembers.includes(m._id)).map((member) => (
                    <div key={member._id} className="text-sm text-green-800">
                      <p className="font-medium">{member.name}</p>
                      <p className="text-xs text-green-700">{member.email}</p>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-stone-500">Once shared, team members can view and interact with these candidates. This action cannot be undone.</p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowShareConfirmation(false)}
                className="px-4 py-2 text-stone-700 font-medium rounded-lg hover:bg-stone-100 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleShareCandidate}
                disabled={isSharingCandidate}
                className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isSharingCandidate ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Sharing...
                  </>
                ) : (
                  <>
                    <Share2 size={16} />
                    Confirm Share
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
