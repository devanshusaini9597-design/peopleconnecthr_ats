import React from 'react';
import { Lock } from 'lucide-react';

/** Branded plan-upgrade empty state — matches Inbox/Skills Professional gates. */
export default function UpgradeFeatureFallback({ title, description }) {
  return (
    <div className="page-shell-ats animate-page-enter">
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center card-ats-bordered border-amber-200/80 bg-amber-50/40 p-8 sm:p-10 animate-slide-up relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4 ring-4 ring-amber-100/60">
            <Lock className="w-7 h-7 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">{title}</h2>
          {description ? (
            <p className="text-stone-500 mt-2 text-sm leading-relaxed">{description}</p>
          ) : null}
          <a href="/billing" className="btn-primary inline-flex mt-6 w-full sm:w-auto justify-center">View Plans</a>
        </div>
      </div>
    </div>
  );
}
