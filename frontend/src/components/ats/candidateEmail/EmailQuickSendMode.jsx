import React from 'react';
import { Eye } from 'lucide-react';
import PremiumSelect from '../../ui/PremiumSelect';
import { EMAIL_TYPE_OPTIONS } from '../atsConstants';
import BASE_API_URL from '../../../config';
import { authenticatedFetch } from '../../../utils/fetchUtils';

export default function EmailQuickSendMode({
  emailType, setEmailType, emailRecipient,
  quickName, setQuickName, quickPosition, setQuickPosition,
  quickDepartment, setQuickDepartment, quickJoiningDate, setQuickJoiningDate,
  customMessage, setCustomMessage,
  showQuickPreview, setShowQuickPreview,
  quickPreviewHtml, setQuickPreviewHtml,
  quickPreviewSubject, setQuickPreviewSubject,
  loadingPreview, setLoadingPreview, toast,
}) {
  return (
    <>
      <div>
        <label className="block text-xs font-semibold text-stone-600 mb-1.5">Email Type</label>
        <PremiumSelect
          compact
          value={emailType}
          onChange={(v) => { setEmailType(v); setShowQuickPreview(false); }}
          options={EMAIL_TYPE_OPTIONS}
          placeholder="Select email type"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-semibold text-stone-500 mb-1">Candidate Name</label>
          <input
            type="text"
            value={quickName}
            onChange={(e) => { setQuickName(e.target.value); setShowQuickPreview(false); }}
            placeholder="Candidate name"
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-stone-500 mb-1">Position / Role</label>
          <input
            type="text"
            value={quickPosition}
            onChange={(e) => { setQuickPosition(e.target.value); setShowQuickPreview(false); }}
            placeholder="Position applied for"
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          />
        </div>
      </div>

      {emailType === 'onboarding' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-stone-500 mb-1">Department</label>
            <input
              type="text"
              value={quickDepartment}
              onChange={(e) => { setQuickDepartment(e.target.value); setShowQuickPreview(false); }}
              placeholder="e.g. Engineering, HR, Sales"
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-stone-500 mb-1">Joining Date</label>
            <input
              type="date"
              value={quickJoiningDate}
              onChange={(e) => { setQuickJoiningDate(e.target.value); setShowQuickPreview(false); }}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
          </div>
        </div>
      )}

      {emailType === 'custom' && (
        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1.5">Custom Message</label>
          <textarea
            value={customMessage}
            onChange={(e) => { setCustomMessage(e.target.value); setShowQuickPreview(false); }}
            placeholder="Enter your custom message here..."
            rows={4}
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
          />
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={async () => {
            if (showQuickPreview) {
              setShowQuickPreview(false);
              return;
            }
            setLoadingPreview(true);
            try {
              const resp = await authenticatedFetch(`${BASE_API_URL}/api/email/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: quickName || emailRecipient?.name || 'Candidate',
                  position: quickPosition || emailRecipient?.position || 'Position',
                  emailType,
                  customMessage,
                  department: quickDepartment || 'N/A',
                  joiningDate: quickJoiningDate || 'TBD'
                })
              });
              const data = await resp.json();
              if (data.success) {
                setQuickPreviewHtml(data.html);
                setQuickPreviewSubject(data.subject);
                setShowQuickPreview(true);
              } else {
                toast.error('Failed to load preview');
              }
            } catch (err) {
              console.error('Preview error:', err);
              toast.error('Failed to generate preview');
            } finally {
              setLoadingPreview(false);
            }
          }}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-all ${
            showQuickPreview ? 'bg-brand-50 border-brand-300 text-brand-700' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
          }`}
          disabled={loadingPreview}
        >
          {loadingPreview ? (
            <><div className="animate-spin h-3.5 w-3.5 border-2 border-brand-500 border-t-transparent rounded-full" /> Generating...</>
          ) : (
            <><Eye size={14} /> {showQuickPreview ? 'Hide Preview' : 'Preview Email'}</>
          )}
        </button>
      </div>

      {showQuickPreview && quickPreviewHtml && (
        <div className="border border-stone-200 rounded-xl overflow-hidden">
          <div className="bg-brand-600 px-4 py-2.5 flex items-center justify-between">
            <p className="text-white text-xs font-semibold">{quickPreviewSubject}</p>
            <span className="text-[9px] bg-white/20 text-white px-2 py-0.5 rounded-full">Preview</span>
          </div>
          <div className="bg-white">
            <iframe
              srcDoc={quickPreviewHtml}
              title="Email Preview"
              className="w-full border-0"
              style={{ height: '260px' }}
              sandbox=""
            />
          </div>
          <div className="px-4 py-2 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
            <p className="text-[9px] text-stone-400">Sent via People Connect HR</p>
            <p className="text-[9px] text-stone-400">To: {emailRecipient?.email}</p>
          </div>
        </div>
      )}
    </>
  );
}
