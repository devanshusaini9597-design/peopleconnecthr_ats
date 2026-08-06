import React from 'react';
import { Info } from 'lucide-react';

export default function HowSendingWorks() {
  return (
    <aside data-tour="email-how" className="lg:col-span-4 min-w-0 lg:sticky lg:top-4 space-y-4">
      <div className="card-ats-bordered relative overflow-hidden p-4 sm:p-5 flex flex-col gap-3">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <h2 className="relative flex items-center gap-2 text-[15px] font-bold text-stone-900 tracking-tight">
          <Info className="w-4 h-4 text-brand-600 shrink-0" />
          How sending works
        </h2>
        <ol className="relative space-y-2.5 text-[13px] text-stone-600 leading-relaxed">
          <li className="flex gap-2.5">
            <span className="w-6 h-6 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 flex items-center justify-center text-[11px] font-bold shrink-0">1</span>
            <span>Platform email sends when it is available.</span>
          </li>
          <li className="flex gap-2.5">
            <span className="w-6 h-6 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 flex items-center justify-center text-[11px] font-bold shrink-0">2</span>
            <span>Your connected mailbox is used as a backup or primary when set.</span>
          </li>
          <li className="flex gap-2.5">
            <span className="w-6 h-6 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 flex items-center justify-center text-[11px] font-bold shrink-0">3</span>
            <span>Use <span className="font-semibold text-stone-800">Send test email</span> to confirm inbox delivery.</span>
          </li>
        </ol>
        <div className="relative rounded-2xl border border-brand-100 bg-brand-50/50 p-3 text-[12px] text-stone-600 leading-relaxed">
          Gmail tip: create an <span className="font-semibold text-stone-800">App Password</span> in your Google account (not your normal login password).
        </div>
      </div>
    </aside>
  );
}
