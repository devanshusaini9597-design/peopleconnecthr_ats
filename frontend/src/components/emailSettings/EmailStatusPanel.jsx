import React from 'react';
import { CheckCircle2, AlertCircle, Loader2, Send } from 'lucide-react';

export default function EmailStatusPanel({
  activeSender,
  zeptoActive,
  hasPersonalSmtp,
  savedPreset,
  settings,
  testingCurrent,
  onTest,
}) {
  return (
    <section
      data-tour="email-status"
      className="card-ats-bordered relative overflow-hidden p-4 sm:p-5 flex flex-col gap-4"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border ${
            activeSender.ok
              ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
              : 'bg-amber-50 text-amber-600 border-amber-100'
          }`}>
            {activeSender.ok ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Delivery status</p>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-stone-900 tracking-tight">{activeSender.label}</h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                activeSender.ok
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {activeSender.ok ? 'Active' : 'Action needed'}
              </span>
            </div>
            <p className="text-sm text-stone-500 mt-0.5 truncate">{activeSender.detail}</p>
            {zeptoActive && hasPersonalSmtp && (
              <p className="text-xs text-stone-400 mt-1">
                Fallback mailbox · {savedPreset.label} · {settings.smtpEmail}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onTest}
          disabled={testingCurrent || !activeSender.ok}
          className="btn-secondary shrink-0 w-full sm:w-auto"
        >
          {testingCurrent ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {testingCurrent ? 'Sending…' : 'Send test email'}
        </button>
      </div>
    </section>
  );
}
