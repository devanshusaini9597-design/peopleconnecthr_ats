import React from 'react';
import { X, RefreshCw } from 'lucide-react';

/** Deprecated field-corrections modal — preserved from ATS.jsx */
export default function CorrectionsModal(props) {
  const { showCorrectionsModal, correctionRecords, setShowCorrectionsModal, toast } = props;
  if (!(showCorrectionsModal && correctionRecords?.length > 0)) return null;
  return (
        <div className="fixed inset-0 bg-stone-900/55 backdrop-blur-sm flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-6xl p-8 shadow-2xl my-8">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
                <RefreshCw className="text-green-600" size={28} />
                Field Corrections ({correctionRecords.length})
              </h2>
              <button onClick={() => setShowCorrectionsModal(false)} className="p-2 hover:bg-stone-100 rounded-lg transition">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-stone-600 mb-4">🎯 These records had misaligned fields (e.g., email in wrong column) that were automatically corrected:</p>
              
              {/* Corrections Table */}
              <div className="overflow-x-auto border-2 border-green-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-green-50 border-b-2 border-green-200 sticky top-12">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-green-700 whitespace-nowrap">Row</th>
                      <th className="px-4 py-3 text-left font-bold text-green-700">Name</th>
                      <th className="px-4 py-3 text-left font-bold text-green-700">Email</th>
                      <th className="px-4 py-3 text-left font-bold text-green-700">Contact</th>
                      <th className="px-4 py-3 text-left font-bold text-green-700 whitespace-nowrap">Corrections Made</th>
                    </tr>
                  </thead>
                  <tbody>
                    {correctionRecords.map((record, idx) => (
                      <tr key={idx} className="border-b border-green-100 hover:bg-green-50 transition">
                        <td className="px-4 py-3 font-semibold text-stone-700">{record.row}</td>
                        <td className="px-4 py-3 text-stone-700">{record.name}</td>
                        <td className="px-4 py-3 text-stone-700 font-mono text-xs bg-green-50 p-2 rounded">{record.email}</td>
                        <td className="px-4 py-3 text-stone-700 font-mono text-xs bg-green-50 p-2 rounded">{record.contact}</td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {record.corrections.map((correction, cIdx) => (
                              <div key={cIdx} className="bg-green-100 text-green-800 px-3 py-1 rounded text-xs font-semibold whitespace-nowrap">
                                ✅ {correction.description}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Info Box */}
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-green-800 font-semibold mb-2">✅ What was corrected?</p>
                <ul className="text-sm text-green-700 space-y-1 list-disc list-inside">
                  <li><strong>Email ↔ Contact Swapped:</strong> Email field had phone number and Contact field had email - they were automatically swapped</li>
                  <li><strong>Field Moved:</strong> A field contained data of wrong type (e.g., Name had email) - data was moved to correct field</li>
                  <li><strong>Misaligned:</strong> Field contains data of wrong type for that column</li>
                </ul>
                <p className="text-xs text-green-700 mt-3 italic">💡 All corrections were made automatically during import</p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCorrectionsModal(false)}
                  className="flex-1 py-3 bg-stone-100 text-stone-700 font-bold rounded-xl hover:bg-stone-200 transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Copy corrections to clipboard as CSV
                    const csv = ['Row,Name,Email,Contact,Corrections'].concat(
                      correctionRecords.map(r => 
                        `${r.row},"${r.name}","${r.email}","${r.contact}","${r.corrections.map(c => c.description).join('; ')}"`
                      )
                    ).join('\n');
                    navigator.clipboard.writeText(csv);
                    toast.success('Field corrections copied to clipboard as CSV');
                  }}
                  className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg transition"
                >
                  📋 Copy as CSV
                </button>
              </div>
            </div>
          </div>
        </div>
  );
}
