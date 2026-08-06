import React from 'react';
import { Mail } from 'lucide-react';
import PremiumSelect from '../../ui/PremiumSelect';
import { TIME_SELECT_OPTIONS } from '../atsConstants';

export default function EmailTemplateMode({
  emailTemplates, selectedTemplate, selectEmailTemplate, setSelectedTemplate,
  templateVars, setTemplateVars,
}) {
  return (
    <>
      {!selectedTemplate ? (
        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-2">Choose a Template</label>
          {emailTemplates.length === 0 ? (
            <div className="text-center py-8 bg-stone-50 rounded-lg border border-stone-200">
              <Mail size={24} className="text-stone-300 mx-auto mb-2" />
              <p className="text-xs text-stone-500">Loading templates...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {emailTemplates.map(t => {
                const catColors = {
                  hiring: 'border-brand-200 bg-brand-50/50', interview: 'border-cyan-200 bg-cyan-50/50',
                  rejection: 'border-red-200 bg-red-50/50', onboarding: 'border-green-200 bg-green-50/50',
                  document: 'border-amber-200 bg-amber-50/50', custom: 'border-purple-200 bg-purple-50/50'
                };
                const catIcons = { hiring: '💼', interview: '📞', rejection: '❌', onboarding: '🎉', document: '📄', custom: '✏️' };
                return (
                  <button
                    key={t._id}
                    onClick={() => selectEmailTemplate(t)}
                    className={`text-left p-3 rounded-lg border-2 hover:shadow-sm transition-all ${catColors[t.category] || catColors.custom}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">{catIcons[t.category] || '✏️'}</span>
                      <h4 className="text-xs font-bold text-stone-900 truncate">{t.name}</h4>
                    </div>
                    <p className="text-[10px] text-stone-500 line-clamp-2">{t.subject}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between bg-brand-50 border border-brand-200 rounded-lg px-4 py-2.5">
            <div>
              <p className="text-xs font-bold text-brand-700">{selectedTemplate.name}</p>
              <p className="text-[10px] text-brand-500">{selectedTemplate.subject}</p>
            </div>
            <button onClick={() => setSelectedTemplate(null)} className="text-[10px] font-semibold text-brand-600 hover:text-brand-800 px-2 py-1 hover:bg-brand-100 rounded">
              Change
            </button>
          </div>

          {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-2">Fill Template Details</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedTemplate.variables.map(v => {
                  const labels = {
                    candidateName: 'Candidate Name', position: 'Position / Role', company: 'Company Name',
                    ctc: 'CTC / Salary', experience: 'Experience Required', location: 'Location',
                    date: 'Date', time: 'Time', venue: 'Venue / Address', spoc: 'SPOC Name'
                  };
                  return (
                    <div key={v}>
                      <label className="block text-[10px] font-semibold text-stone-500 mb-1">{labels[v] || v}</label>
                      {v === 'time' ? (
                        <PremiumSelect
                          compact
                          searchable
                          allowClear
                          placeholder="Select time"
                          options={TIME_SELECT_OPTIONS}
                          value={(() => { const t = templateVars[v]; if (!t) return ''; const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i); if (!m) return ''; let h = parseInt(m[1]); const ampm = m[3].toUpperCase(); if (ampm === 'PM' && h !== 12) h += 12; if (ampm === 'AM' && h === 12) h = 0; return `${String(h).padStart(2,'0')}:${m[2]}`; })()}
                          onChange={(val) => {
                            if (val) {
                              const [h, m] = val.split(':');
                              const hr = parseInt(h);
                              const ampm = hr >= 12 ? 'PM' : 'AM';
                              const hr12 = hr % 12 || 12;
                              setTemplateVars(prev => ({ ...prev, [v]: `${hr12}:${m} ${ampm}` }));
                            } else {
                              setTemplateVars(prev => ({ ...prev, [v]: '' }));
                            }
                          }}
                        />
                      ) : (
                        <input
                          type={v === 'date' ? 'date' : 'text'}
                          value={templateVars[v] || ''}
                          onChange={(e) => setTemplateVars(prev => ({ ...prev, [v]: e.target.value }))}
                          placeholder={labels[v] || v}
                          className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-2">Email Preview</label>
            <div className="border border-stone-200 rounded-xl overflow-hidden">
              <div className="bg-brand-600 px-4 py-2.5">
                <p className="text-white text-xs font-semibold">
                  {(() => {
                    let subj = selectedTemplate.subject;
                    Object.entries(templateVars).forEach(([k, v]) => { subj = subj.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || `{{${k}}}`); });
                    return subj;
                  })()}
                </p>
              </div>
              <div className="p-4 bg-white max-h-48 overflow-y-auto">
                <div className="text-xs text-stone-700 leading-relaxed whitespace-pre-line">
                  {(() => {
                    let body = selectedTemplate.body;
                    Object.entries(templateVars).forEach(([k, v]) => { body = body.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || `{{${k}}}`); });
                    return body;
                  })()}
                </div>
              </div>
              <div className="px-4 py-2 bg-stone-50 border-t border-stone-100 text-center">
                <p className="text-[9px] text-stone-400">Sent via People Connect HR</p>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
