import React from 'react';
import { X, AlertCircle } from 'lucide-react';

/** Deprecated duplicates review modal — preserved from ATS.jsx */
export default function DuplicatesModal(props) {
  const { showDuplicatesModal, duplicateRecords, setShowDuplicatesModal, setShowOnlyCorrect, toast } = props;
  if (!(showDuplicatesModal && duplicateRecords?.length > 0)) return null;
  return (
        <div className="fixed inset-0 bg-stone-900/55 backdrop-blur-sm flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-6xl p-8 shadow-2xl my-8">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
                <AlertCircle className="text-red-600" size={28} />
                Duplicate Records ({duplicateRecords.length})
              </h2>
              <button onClick={() => setShowDuplicatesModal(false)} className="p-2 hover:bg-stone-100 rounded-lg transition">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-stone-600 mb-4">These records were detected as duplicates and were not imported:</p>
              
              {/* Duplicates Table */}
              <div className="overflow-x-auto border-2 border-red-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-red-50 border-b-2 border-red-200 sticky top-12">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-red-700 whitespace-nowrap">Row</th>
                      <th className="px-4 py-3 text-left font-bold text-red-700">Name</th>
                      <th className="px-4 py-3 text-left font-bold text-red-700">Email</th>
                      <th className="px-4 py-3 text-left font-bold text-red-700">Contact</th>
                      <th className="px-4 py-3 text-left font-bold text-red-700">Position</th>
                      <th className="px-4 py-3 text-left font-bold text-red-700">Company</th>
                      <th className="px-4 py-3 text-left font-bold text-red-700 whitespace-nowrap">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicateRecords.map((record, idx) => (
                      <tr key={idx} className="border-b border-red-100 hover:bg-red-50 transition">
                        <td className="px-4 py-3 font-semibold text-stone-700">{record.row}</td>
                        <td className="px-4 py-3 text-stone-700">{record.name}</td>
                        <td className="px-4 py-3 text-stone-700 font-mono text-xs">{record.email}</td>
                        <td className="px-4 py-3 text-stone-700 font-mono text-xs">{record.contact}</td>
                        <td className="px-4 py-3 text-stone-700">{record.position}</td>
                        <td className="px-4 py-3 text-stone-700">{record.company}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                            🔄 {record.reason}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Info Box */}
              <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-amber-800 font-semibold mb-2">💡 Why were these marked as duplicates?</p>
                <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                  <li><strong>Duplicate Email:</strong> The same email address appeared more than once in your file</li>
                  <li><strong>Duplicate Contact:</strong> The same phone number appeared more than once in your file</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowDuplicatesModal(false)}
                  className="flex-1 py-3 bg-stone-100 text-stone-700 font-bold rounded-xl hover:bg-stone-200 transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Copy duplicates to clipboard as CSV
                    const csv = ['Row,Name,Email,Contact,Position,Company,Reason'].concat(
                      duplicateRecords.map(r => 
                        `${r.row},"${r.name}","${r.email}","${r.contact}","${r.position}","${r.company}","${r.reason}"`
                      )
                    ).join('\n');
                    navigator.clipboard.writeText(csv);
                    toast.success('Duplicates copied to clipboard as CSV');
                  }}
                  className="flex-1 py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 shadow-lg transition"
                >
                  📋 Copy as CSV
                </button>
              </div>
            </div>
          </div>
        </div>
  );
}
