import React from 'react';
import { Loader2, BarChart3 } from 'lucide-react';

export function AnalyticsInlineLoader({ label = 'Loading analytics…' }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-brand-200/70 bg-brand-50/50 px-4 py-3 text-sm text-brand-800">
      <Loader2 size={18} className="animate-spin text-brand-600 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold truncate">{label}</p>
        <div className="mt-2 h-1.5 w-full rounded-full bg-brand-100 overflow-hidden">
          <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-brand-500 to-teal-400 animate-shimmer" />
        </div>
      </div>
    </div>
  );
}

export function AnalyticsPanelSkeleton({ compact = false }) {
  if (compact) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 opacity-70">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-[118px] skeleton-ats rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <div key={i} className="h-[118px] skeleton-ats rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-72 skeleton-ats rounded-2xl" />
        <div className="h-72 skeleton-ats rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => <div key={i} className="h-56 skeleton-ats rounded-2xl" />)}
      </div>
    </div>
  );
}

export function AnalyticsPanelOverlay({ label = 'Updating analytics…' }) {
  return (
    <div className="absolute inset-0 z-20 rounded-2xl bg-white/75 backdrop-blur-[2px] flex flex-col items-center justify-center gap-4 p-6">
      <div className="h-14 w-14 rounded-2xl bg-brand-50 border border-brand-100 text-brand-600 inline-flex items-center justify-center shadow-sm">
        <BarChart3 size={24} className="animate-pulse" />
      </div>
      <div className="text-center max-w-xs">
        <p className="text-sm font-bold text-stone-900">{label}</p>
        <p className="text-xs text-stone-500 mt-1">Please wait while we prepare your metrics</p>
      </div>
      <Loader2 size={28} className="animate-spin text-brand-600" />
      <div className="w-full max-w-sm h-1.5 rounded-full bg-stone-100 overflow-hidden">
        <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-brand-500 via-teal-400 to-brand-500 animate-shimmer" />
      </div>
    </div>
  );
}
