import React from 'react';
import { X, Mail, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { EMAIL_TYPE_OPTIONS } from '../atsConstants';

/** Deprecated bulk email wizard (~5078-5494) — gated with false in original */
export default function BulkEmailWizard(props) {
  // Original was `{false && bulkEmailStep && (` — kept for reference, never shown unless enabled
  const enabled = props.forceEnable === true;
  if (!enabled || !props.bulkEmailStep) return null;
  const {
    bulkEmailStep, setBulkEmailStep, closeBulkEmailFlow, emailType, setEmailType,
    selectedEmails, toggleEmailSelection, selectAllEmails, candidates, selectedIds,
    handleConfirmSend, campaignStatus, emailStatuses,
  } = props;
  return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            
            {/* SELECT STEP */}
            {bulkEmailStep === 'select' && (
              <div>
                {/* Header */}
                <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-stone-900">Bulk Email Manager</h2>
                    <p className="text-sm text-stone-500 mt-0.5">Send professional emails to multiple candidates</p>
                  </div>
                  <button 
                    onClick={closeBulkEmailFlow}
                    className="p-2 hover:bg-stone-100 rounded-lg transition text-stone-500 hover:text-stone-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="p-6">
                  {/* Email Type Selection */}
                  <div className="mb-6">
                    <h3 className="text-sm font-bold text-stone-900 mb-4 flex items-center gap-2">
                      Step 1: Select Email Type
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { value: 'interview', label: 'Interview Call', icon: '📞' },
                        { value: 'offer', label: 'Offer Letter', icon: '💼' },
                        { value: 'rejection', label: 'Rejection', icon: '❌' },
                        { value: 'document', label: 'Documents', icon: '📄' },
                        { value: 'onboarding', label: 'Onboarding', icon: '🎯' },
                        { value: 'custom', label: 'Custom', icon: '✏️' },
                      ].map((opt) => (
                        <label key={opt.value} className={`relative p-4 border-2 rounded-xl cursor-pointer transition-all ${
                          emailType === opt.value
                            ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500'
                            : 'border-stone-200 bg-white hover:border-stone-300'
                        }`}>
                          <input
                            type="radio"
                            name="emailType"
                            value={opt.value}
                            checked={emailType === opt.value}
                            onChange={(e) => setEmailType(e.target.value)}
                            className="absolute opacity-0"
                          />
                          <div className="text-center">
                            <div className="text-2xl mb-1.5">{opt.icon}</div>
                            <div className={`text-sm font-semibold ${emailType === opt.value ? 'text-brand-700' : 'text-stone-700'}`}>
                              {opt.label}
                            </div>
                          </div>
                          {emailType === opt.value && (
                            <div className="absolute top-2 right-2 bg-brand-600 text-white rounded-full w-5 h-5 flex items-center justify-center">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-white border border-stone-200 rounded-xl p-4">
                      <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Total Candidates</div>
                      <div className="text-2xl font-bold text-stone-900">
                        {candidates.filter(c => selectedIds.includes(c._id) && c.email).length}
                      </div>
                    </div>
                    <div className="bg-white border border-stone-200 rounded-xl p-4">
                      <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Valid Emails</div>
                      <div className="text-2xl font-bold text-stone-900">
                        {candidates.filter(c => selectedIds.includes(c._id) && c.email && c.email.includes('@')).length}
                      </div>
                    </div>
                    <div className="bg-white border border-stone-200 rounded-xl p-4">
                      <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Selected</div>
                      <div className="text-2xl font-bold text-brand-600">{selectedEmails.size}</div>
                    </div>
                  </div>

                  {/* Candidate Selection Table */}
                  <div className="mb-6">
                    <h3 className="text-sm font-bold text-stone-900 mb-4">
                      Step 2: Select Recipients
                    </h3>
                    <div className="border border-stone-200 rounded-xl overflow-hidden">
                      <div className="max-h-80 overflow-y-auto">
                        <table className="w-full">
                          <thead className="bg-stone-50 border-b border-stone-200 sticky top-0 z-10">
                            <tr>
                              <th className="px-4 py-3 text-center w-12">
                                <input 
                                  type="checkbox" 
                                  checked={selectedEmails.size === candidates.filter(c => selectedIds.includes(c._id) && c.email).length && selectedEmails.size > 0}
                                  onChange={selectAllEmails}
                                  className="w-4 h-4 cursor-pointer accent-brand-600"
                                />
                              </th>
                              <th className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Name</th>
                              <th className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Email</th>
                              <th className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Position</th>
                              <th className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {candidates
                              .filter(c => selectedIds.includes(c._id) && c.email)
                              .map((candidate) => (
                                <tr key={candidate._id} className="border-b border-stone-100 hover:bg-stone-50/60 transition">
                                  <td className="px-4 py-3 text-center">
                                    <input 
                                      type="checkbox" 
                                      checked={selectedEmails.has(candidate.email)}
                                      onChange={() => toggleEmailSelection(candidate.email)}
                                      className="w-4 h-4 cursor-pointer accent-brand-600"
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-sm font-semibold text-stone-900">{candidate.name}</td>
                                  <td className="px-4 py-3 text-sm text-stone-600">{candidate.email}</td>
                                  <td className="px-4 py-3 text-sm text-stone-600">{candidate.position || '—'}</td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                                      candidate.status === 'Hired' || candidate.status === 'Joined' ? 'bg-green-100 text-green-700' :
                                      candidate.status === 'Rejected' || candidate.status === 'Dropped' ? 'bg-red-100 text-red-700' :
                                      candidate.status === 'Interview' ? 'bg-purple-100 text-purple-700' :
                                      candidate.status === 'Offer' ? 'bg-cyan-100 text-cyan-700' :
                                      'bg-amber-100 text-amber-700'
                                    }`}>
                                      {candidate.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {selectedEmails.size === 0 && (
                      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs text-amber-800 font-medium">Please select at least one recipient to continue</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between items-center pt-5 border-t border-stone-200">
                    <button 
                      onClick={closeBulkEmailFlow}
                      className="px-4 py-2.5 bg-white border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => setBulkEmailStep('confirm')}
                      disabled={selectedEmails.size === 0}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition text-sm font-semibold ${
                        selectedEmails.size === 0 
                          ? 'bg-stone-100 text-stone-400 cursor-not-allowed' 
                          : 'bg-brand-600 text-white hover:bg-brand-700'
                      }`}
                    >
                      Next: Confirm
                      <span className="bg-white/20 px-2 py-0.5 rounded text-xs">
                        {selectedEmails.size} selected
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* CONFIRM STEP */}
            {bulkEmailStep === 'confirm' && (
              <div>
                {/* Header */}
                <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-stone-900">Confirm Sending</h2>
                    <p className="text-sm text-stone-500 mt-0.5">Review your campaign before sending</p>
                  </div>
                  <button 
                    onClick={closeBulkEmailFlow}
                    className="p-2 hover:bg-stone-100 rounded-lg transition text-stone-500 hover:text-stone-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="p-6">
                  {/* Campaign Summary */}
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 mb-6">
                    <div className="text-center mb-5">
                      <p className="text-lg font-bold text-stone-900">
                        Ready to send <span className="text-brand-600">{selectedEmails.size}</span> emails
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-2 mb-5">
                      <span className="text-sm text-stone-500">Email Type:</span>
                      <span className="inline-flex items-center gap-1.5 bg-brand-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold">
                        {emailType === 'interview' ? '📞 Interview Call' :
                         emailType === 'offer' ? '💼 Offer Letter' :
                         emailType === 'rejection' ? '❌ Rejection' :
                         emailType === 'document' ? '📄 Document Collection' :
                         emailType === 'onboarding' ? '🎯 Onboarding' :
                         '✏️ Custom Email'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white border border-stone-200 rounded-xl p-4 text-center">
                        <div className="text-xs text-stone-500 font-semibold uppercase mb-1">Processing</div>
                        <div className="text-sm font-bold text-stone-900">Batch Mode</div>
                      </div>
                      <div className="bg-white border border-stone-200 rounded-xl p-4 text-center">
                        <div className="text-xs text-stone-500 font-semibold uppercase mb-1">Est. Time</div>
                        <div className="text-sm font-bold text-stone-900">~{Math.ceil(selectedEmails.size / 5)}s</div>
                      </div>
                      <div className="bg-white border border-stone-200 rounded-xl p-4 text-center">
                        <div className="text-xs text-stone-500 font-semibold uppercase mb-1">Service</div>
                        <div className="text-sm font-bold text-stone-900">AWS SES</div>
                      </div>
                    </div>

                    <div className="mt-4 bg-brand-50 border border-brand-200 p-3 rounded-xl">
                      <p className="text-xs text-brand-700 font-medium">
                        Each email will be sent once. Make sure all information is correct before proceeding.
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between items-center pt-5 border-t border-stone-200">
                    <button 
                      onClick={() => setBulkEmailStep('select')}
                      className="px-4 py-2.5 bg-white border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition text-sm font-medium"
                    >
                      Back
                    </button>
                    <button 
                      onClick={handleConfirmSend}
                      disabled={isSendingEmail}
                      className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSendingEmail ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Sending...
                        </>
                      ) : (
                        <>
                          Send All Emails Now
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SENDING STEP */}
            {bulkEmailStep === 'sending' && campaignStatus && (
              <div>
                {/* Header */}
                <div className="px-6 py-5 border-b border-stone-200">
                  <h2 className="text-xl font-bold text-stone-900">Sending In Progress</h2>
                  <p className="text-sm text-stone-500 mt-0.5">Please wait while we send your emails...</p>
                </div>

                <div className="p-6">
                  <div className="mb-6">
                    <p className="text-sm font-semibold text-stone-900 mb-4">
                      Sending {campaignStatus.totalEmails} emails
                    </p>

                    {/* Progress Bar */}
                    <div className="mb-6">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-medium text-stone-500">Overall Progress</span>
                        <span className="text-sm font-bold text-brand-600">
                          {Math.min(100, Math.round(((campaignStatus.completed + campaignStatus.failed) / campaignStatus.totalEmails) * 100))}%
                        </span>
                      </div>
                      <div className="h-3 bg-stone-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-brand-600 transition-all duration-500 rounded-full"
                          style={{ width: `${Math.min(100, ((campaignStatus.completed + campaignStatus.failed) / campaignStatus.totalEmails) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-stone-500 mt-1">{campaignStatus.completed + campaignStatus.failed} / {campaignStatus.totalEmails} processed</p>
                    </div>

                    {/* Status Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white border border-stone-200 rounded-xl p-4">
                        <div className="text-xs font-semibold text-stone-500 uppercase mb-1">Queued</div>
                        <div className="text-2xl font-bold text-stone-900">{campaignStatus.waiting || 0}</div>
                      </div>
                      <div className="bg-white border border-stone-200 rounded-xl p-4">
                        <div className="text-xs font-semibold text-amber-600 uppercase mb-1">Processing</div>
                        <div className="text-2xl font-bold text-stone-900">{campaignStatus.processing || 0}</div>
                      </div>
                      <div className="bg-white border border-stone-200 rounded-xl p-4">
                        <div className="text-xs font-semibold text-green-600 uppercase mb-1">Sent</div>
                        <div className="text-2xl font-bold text-green-700">{campaignStatus.completed || 0}</div>
                      </div>
                      <div className="bg-white border border-stone-200 rounded-xl p-4">
                        <div className="text-xs font-semibold text-red-600 uppercase mb-1">Failed</div>
                        <div className="text-2xl font-bold text-red-700">{campaignStatus.failed || 0}</div>
                      </div>
                    </div>

                    <div className="text-center mt-5">
                      <div className="inline-flex items-center gap-2 bg-stone-50 px-4 py-2 rounded-lg">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-stone-600 font-medium">Processing emails... Please wait</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* RESULTS STEP */}
            {bulkEmailStep === 'results' && campaignStatus && (
              <div>
                {/* Header */}
                <div className="px-6 py-5 border-b border-stone-200">
                  <h2 className="text-xl font-bold text-stone-900">Campaign Complete</h2>
                  <p className="text-sm text-stone-500 mt-0.5">Your bulk email campaign has finished processing</p>
                </div>

                <div className="p-6">
                  {/* Success Banner */}
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-green-800 mb-1">All Emails Processed</h3>
                    <p className="text-sm text-green-700">Campaign completed successfully</p>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-white border border-stone-200 rounded-xl p-5 text-center">
                      <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Total Emails</div>
                      <div className="text-3xl font-bold text-stone-900">{campaignStatus.totalEmails || 0}</div>
                    </div>
                    <div className="bg-white border border-stone-200 rounded-xl p-5 text-center">
                      <div className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">Successfully Sent</div>
                      <div className="text-3xl font-bold text-green-700">{campaignStatus.completed || 0}</div>
                    </div>
                    <div className="bg-white border border-stone-200 rounded-xl p-5 text-center">
                      <div className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-1">Failed</div>
                      <div className="text-3xl font-bold text-red-700">{campaignStatus.failed || 0}</div>
                    </div>
                  </div>

                  {/* Success Rate */}
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-0.5">Success Rate</div>
                        <div className="text-sm text-stone-600">Overall campaign performance</div>
                      </div>
                      <div className="text-3xl font-bold text-brand-600">
                        {campaignStatus.successRate || '0%'}
                      </div>
                    </div>
                  </div>

                  {/* Email Type */}
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <span className="text-sm text-stone-500">Email Type:</span>
                    <span className="inline-flex items-center gap-1.5 bg-brand-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold">
                      {emailType === 'interview' ? '📞 Interview Call' :
                       emailType === 'offer' ? '💼 Offer Letter' :
                       emailType === 'rejection' ? '❌ Rejection' :
                       emailType === 'document' ? '📄 Document Collection' :
                       emailType === 'onboarding' ? '🎯 Onboarding' :
                       '✏️ Custom Email'}
                    </span>
                  </div>

                  {/* Action Button */}
                  <div className="flex justify-center pt-5 border-t border-stone-200">
                    <button 
                      onClick={closeBulkEmailFlow}
                      className="px-6 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition text-sm font-semibold"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
  );
}
