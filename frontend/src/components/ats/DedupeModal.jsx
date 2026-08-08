import React from 'react';
import { X } from 'lucide-react';

export default function DedupeModal({ open, dedupeResults, onClose }) {
  if (!open) return null;
  return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-900/55 backdrop-blur-sm p-4" onClick={() => onClose()}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <div>
                <h3 className="text-lg font-bold text-stone-900">Likely duplicates</h3>
                <p className="text-xs text-stone-500 mt-0.5">Matched by normalized email, phone, or name — not LLM</p>
              </div>
              <button type="button" onClick={() => onClose()} className="p-2 rounded-lg hover:bg-stone-100"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto p-5 space-y-4 flex-1">
              {dedupeResults?.groups?.length ? dedupeResults.groups.map((group, gi) => (
                <div key={gi} className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                  <p className="text-xs font-semibold text-amber-800 mb-2">Group {gi + 1} ({group.members.length} candidates)</p>
                  <ul className="space-y-2">
                    {group.members.map((m) => (
                      <li key={m._id} className="text-sm flex flex-wrap gap-x-3 gap-y-1">
                        <span className="font-medium text-stone-900">{m.name}</span>
                        <span className="text-stone-500">{m.email}</span>
                        {(m.contact || m.phone) && <span className="text-stone-500">{m.contact || m.phone}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )) : (
                <p className="text-sm text-stone-500 text-center py-8">No duplicate groups found.</p>
              )}
            </div>
            <div className="px-5 py-3 border-t border-stone-100 text-right">
              <button type="button" onClick={() => onClose()} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
  );
}
