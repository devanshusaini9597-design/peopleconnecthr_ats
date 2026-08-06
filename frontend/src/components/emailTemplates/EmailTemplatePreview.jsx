import React from 'react';
import { Mail, Edit3 } from 'lucide-react';
import Modal from '../ui/Modal';
import PremiumSelect from '../ui/PremiumSelect';
import { VARIABLE_OPTIONS, TIME_OPTIONS } from './emailTemplatesConstants';

export default function EmailTemplatePreview({
  open,
  onClose,
  previewTemplate,
  previewVars,
  setPreviewVars,
  renderPreviewText,
  onEdit,
}) {
  return (
    <Modal
      open={open && !!previewTemplate}
      onClose={onClose}
      title="Template preview"
      description="Adjust sample values to see the final email."
      size="xl"
      footer={
        <>
          <button
            type="button"
            onClick={() => { onClose(); onEdit(previewTemplate); }}
            className="btn-secondary"
          >
            <Edit3 size={14} /> Edit template
          </button>
          <button type="button" onClick={onClose} className="btn-primary">Close</button>
        </>
      }
    >
      {previewTemplate && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {previewTemplate.variables?.length > 0 && (
            <div className="lg:col-span-4 min-w-0 rounded-lg border border-stone-200 bg-stone-50/80 overflow-hidden">
              <div className="px-3 py-2.5 border-b border-stone-200 bg-white">
                <p className="text-[11px] font-bold text-stone-800">Sample values</p>
                <p className="text-[10px] text-stone-500 mt-0.5">Edit to refresh the preview.</p>
              </div>
              <div className="p-3 space-y-2.5 max-h-80 overflow-y-auto">
                {previewTemplate.variables.map((v) => {
                  const opt = VARIABLE_OPTIONS.find((o) => o.key === v);
                  if (opt?.isTime) {
                    const current = previewVars[v];
                    let timeVal = '';
                    if (current) {
                      const m = current.match(/(\d+):(\d+)\s*(AM|PM)/i);
                      if (m) {
                        let h = parseInt(m[1], 10);
                        const ampm = m[3].toUpperCase();
                        if (ampm === 'PM' && h !== 12) h += 12;
                        if (ampm === 'AM' && h === 12) h = 0;
                        timeVal = `${String(h).padStart(2, '0')}:${m[2]}`;
                      }
                    }
                    return (
                      <div key={v}>
                        <label className="block text-[10px] font-semibold text-stone-500 mb-1">{opt?.label || v}</label>
                        <PremiumSelect
                          value={timeVal}
                          onChange={(val) => {
                            if (!val) return;
                            const [h, m] = val.split(':');
                            const hr = parseInt(h, 10);
                            const ampm = hr >= 12 ? 'PM' : 'AM';
                            const hr12 = hr % 12 || 12;
                            setPreviewVars((prev) => ({ ...prev, [v]: `${hr12}:${m} ${ampm}` }));
                          }}
                          options={TIME_OPTIONS}
                          placeholder="Select time"
                          compact
                        />
                      </div>
                    );
                  }
                  return (
                    <div key={v}>
                      <label className="block text-[10px] font-semibold text-stone-500 mb-1">{opt?.label || v}</label>
                      <input
                        type={v === 'date' ? 'date' : 'text'}
                        value={previewVars[v] || ''}
                        onChange={(e) => setPreviewVars((prev) => ({ ...prev, [v]: e.target.value }))}
                        placeholder={opt?.example || ''}
                        className="input-ats !py-1.5 !rounded-lg !bg-white"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className={`${previewTemplate.variables?.length ? 'lg:col-span-8' : 'lg:col-span-12'} min-w-0`}>
            <div className="rounded-lg border border-stone-200 overflow-hidden bg-white shadow-sm">
              <div className="px-4 py-2.5 bg-stone-100 border-b border-stone-200 flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide">Message preview</p>
              </div>
              <div className="px-4 py-3 border-b border-stone-100 bg-white">
                <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400 mb-1">Subject</p>
                <p className="text-sm font-semibold text-stone-900 leading-snug">
                  {renderPreviewText(previewTemplate.subject)}
                </p>
              </div>
              <div className="p-4 sm:p-5 bg-white min-h-[12rem]">
                <div
                  className="email-preview-html text-[13px] text-stone-700 leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html:
                      previewTemplate.name === 'Subscribe for Updates' && previewTemplate.category === 'marketing'
                        ? renderPreviewText(
                            String(previewTemplate.body || '').replace(
                              /Subscribe now:\s*\{\{subscribeLink\}\}/gi,
                              ''
                            )
                          )
                        : renderPreviewText(previewTemplate.body),
                  }}
                />
                {previewTemplate.name === 'Subscribe for Updates' && previewTemplate.category === 'marketing' && (
                  <div className="mt-5">
                    <a
                      href={previewVars.subscribeLink?.startsWith('http') ? previewVars.subscribeLink : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 rounded-lg bg-brand-700 text-white text-[13px] font-semibold hover:bg-brand-800 transition-colors"
                    >
                      Subscribe for updates
                    </a>
                  </div>
                )}
              </div>
              <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-100">
                <p className="text-[10px] text-stone-400 font-medium">Skillnix Recruitment Services</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
