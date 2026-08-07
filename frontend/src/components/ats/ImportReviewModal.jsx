import React from 'react';
import { X, AlertTriangle, Check, RefreshCw, SquarePen, FileText } from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import { REVIEW_STATUS_OPTIONS } from './atsConstants';

export default function ImportReviewModal(props) {
  const {
    showReviewModal, reviewData, setShowReviewModal, setReviewData, setEditingRow,
    reviewFilter, setReviewFilter, getFilteredReviewData, editingRow,
    handleRevalidateRecord, handleSaveEditedRecord, handleImportReviewed,
    importConfirmation, setImportConfirmation,
  } = props;
  if (!(showReviewModal && reviewData)) return null;
  return (
    <>
      {showReviewModal && reviewData && (
        <div className="fixed inset-0 bg-stone-900/55 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full my-8">
            {/* Header */}
            <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-stone-900">Review & Import Candidates</h1>
                <p className="text-sm text-stone-500 mt-0.5">Ready: {reviewData.ready?.length || 0} | Review: {reviewData.review?.length || 0} | Blocked: {reviewData.blocked?.length || 0}</p>
              </div>
              <button 
                onClick={() => { setShowReviewModal(false); setReviewData(null); setEditingRow(null); }} 
                className="p-2 hover:bg-stone-100 rounded-lg transition text-stone-500 hover:text-stone-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 px-6 py-3 border-b border-stone-200">
              {[
                { key: 'ready', label: `Ready (${reviewData.ready?.length || 0})`, color: 'text-green-700' },
                { key: 'review', label: `Review (${reviewData.review?.length || 0})`, color: 'text-amber-700' },
                { key: 'blocked', label: `Blocked (${reviewData.blocked?.length || 0})`, color: 'text-red-700' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setReviewFilter(tab.key); setEditingRow(null); }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    reviewFilter === tab.key 
                      ? 'bg-brand-600 text-white' 
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="bg-white p-6 min-h-80 max-h-[65vh] overflow-y-auto">
              {(() => {
                let categoryData;
                if (reviewFilter === 'ready') {
                  categoryData = reviewData.ready;
                } else if (reviewFilter === 'review') {
                  categoryData = reviewData.review;
                } else if (reviewFilter === 'blocked') {
                  categoryData = reviewData.blocked;
                } else { // 'all' - show all records
                  categoryData = [
                    ...(reviewData.ready || []),
                    ...(reviewData.review || []),
                    ...(reviewData.blocked || [])
                  ];
                }
                
                if (!categoryData || categoryData.length === 0) {
                  return (
                    <EmptyState
                      icon={FileText}
                      tone="sky"
                      compact
                      message="No records in this category"
                      subMessage="Switch category or upload a new file."
                    />
                  );
                }

                return (
                  <div className="space-y-4">
                    {/* Records Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-stone-50 border-b border-stone-200">
                            <th className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Name</th>
                            <th className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Email</th>
                            <th className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Contact</th>
                            <th className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Position</th>
                            <th className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">CTC</th>
                            <th className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Confidence</th>
                            <th className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryData.map((row, idx) => (
                            <tr key={idx} className={`border-b border-stone-100 hover:bg-stone-50/60 transition ${
                              row.validation.category === 'ready' ? 'bg-green-50/50' :
                              row.validation.category === 'review' ? 'bg-amber-50/50' :
                              'bg-red-50/50'
                            }`}>
                              <td className="px-4 py-3 text-sm font-semibold text-stone-900">{row.fixed?.name || '-'}</td>
                              <td className="px-4 py-3 text-sm text-stone-600">{row.fixed?.email || '-'}</td>
                              <td className="px-4 py-3 text-sm text-stone-600">{row.fixed?.contact || '-'}</td>
                              <td className="px-4 py-3 text-sm text-stone-600">{row.fixed?.position || '-'}</td>
                              <td className="px-4 py-3 text-sm text-stone-600">{row.fixed?.ctc ? `${row.fixed.ctc} LPA` : '-'}</td>
                              <td className="px-4 py-3 text-sm text-stone-600">{row.fixed?.status || '-'}</td>
                              <td className="px-4 py-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  row.validation.confidence >= 80 ? 'bg-green-200 text-green-800' :
                                  row.validation.confidence >= 50 ? 'bg-amber-200 text-amber-800' :
                                  'bg-red-200 text-red-800'
                                }`}>
                                  {row.validation.confidence}%
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => setEditingRow(row)}
                                  className="px-3 py-1 text-xs bg-brand-600 text-white rounded hover:bg-brand-700 transition font-semibold"
                                >
                                  ✏️ Edit
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Editing Panel */}
                    {editingRow && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/55 p-4">
                        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-96 overflow-y-auto">
                          <h3 className="text-lg font-bold text-stone-900 mb-5">Edit Record — {editingRow.fixed?.name}</h3>
                          
                          <div className="grid grid-cols-3 gap-3 mb-5">
                            {[
                              { field: 'name', label: 'Name', type: 'text' },
                              { field: 'email', label: 'Email', type: 'email' },
                              { field: 'contact', label: 'Contact', type: 'tel' },
                              { field: 'position', label: 'Position', type: 'text' },
                              { field: 'experience', label: 'Experience', type: 'text' },
                              { field: 'ctc', label: 'CTC (LPA)', type: 'text' },
                              { field: 'expectedCtc', label: 'Expected CTC', type: 'text' },
                              { field: 'noticePeriod', label: 'Notice Period', type: 'text' },
                              { field: 'companyName', label: 'Company', type: 'text' },
                              { field: 'location', label: 'Location', type: 'text' },
                              { field: 'client', label: 'Client', type: 'text' },
                              { field: 'source', label: 'Source', type: 'text' },
                              { field: 'fls', label: 'FLS/Non FLS', type: 'text' },
                              { field: 'spoc', label: 'SPOC', type: 'text' },
                              { field: 'date', label: 'Date', type: 'date' },
                              { field: 'status', label: 'Status', type: 'select' }
                            ].map(({ field, label, type }) => (
                              <div key={field}>
                                <label className="block text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1">{label}</label>
                                {type === 'select' ? (
                                  <PremiumSelect
                                    compact
                                    allowClear
                                    placeholder="Select status"
                                    options={REVIEW_STATUS_OPTIONS}
                                    value={editingRow.fixed?.[field] || ''}
                                    onChange={(v) => setEditingRow({ ...editingRow, fixed: { ...editingRow.fixed, [field]: v } })}
                                  />
                                ) : (
                                  <input
                                    type={type}
                                    value={editingRow.fixed?.[field] || ''}
                                    onChange={(e) => setEditingRow({ ...editingRow, fixed: { ...editingRow.fixed, [field]: e.target.value } })}
                                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                                  />
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Validation Summary */}
                          {editingRow.validation && (
                            <div className="mb-5 p-4 bg-stone-50 rounded-lg border border-stone-200">
                              {editingRow.validation.errors?.length > 0 && (
                                <div className="mb-3">
                                  <p className="font-bold text-red-700 mb-1">❌ Errors:</p>
                                  {editingRow.validation.errors.map((e, i) => (
                                    <p key={i} className="text-sm text-red-600">• {e.field}: {e.message}</p>
                                  ))}
                                </div>
                              )}
                              {editingRow.validation.warnings?.length > 0 && (
                                <div>
                                  <p className="font-bold text-amber-700 mb-1">⚠️ Warnings:</p>
                                  {editingRow.validation.warnings.map((w, i) => (
                                    <p key={i} className="text-sm text-amber-600">• {w.field}: {w.message}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleSaveEditedRecord()}
                              className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition"
                            >
                              Save & Import
                            </button>
                            <button
                              onClick={() => handleRevalidateRecord(editingRow)}
                              className="flex-1 px-4 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700 transition"
                            >
                              Re-validate
                            </button>
                            <button
                              onClick={() => setEditingRow(null)}
                              className="flex-1 px-4 py-2.5 bg-white border border-stone-200 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50 transition"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Import Confirmation Modal */}
            {importConfirmation?.show && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/55 backdrop-blur-sm p-4">
                <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center">
                  <div className="mb-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-stone-900 mb-1">Imported Successfully</h3>
                    <p className="text-sm text-stone-600">
                      <strong>{importConfirmation.candidateName}</strong> has been saved to the database.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setImportConfirmation(null);
                      setReviewFilter('ready');
                    }}
                    className="w-full px-4 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700 transition"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Footer Action Buttons */}
            <div className="flex gap-3 px-6 py-4 border-t border-stone-100 justify-end">
              <button
                onClick={() => { setShowReviewModal(false); setReviewData(null); setEditingRow(null); }}
                className="btn-secondary"
              >
                Close
              </button>
              <button
                onClick={handleImportReviewed}
                className="btn-primary !bg-emerald-600 hover:!bg-emerald-700"
              >
                Import All Ready Records
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
