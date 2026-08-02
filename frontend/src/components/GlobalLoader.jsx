import React from 'react';
import { useGlobalLoader } from '../context/GlobalLoaderContext';
import { Briefcase } from 'lucide-react';

/**
 * Full-screen overlay loader. Shown when global loading state is true.
 * Use via useGlobalLoader().setGlobalLoading(true, 'Message') from any component.
 */
export default function GlobalLoader() {
  const { show, message } = useGlobalLoader();

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-stone-900/50 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="relative flex flex-col items-center gap-5 rounded-2xl border border-white/20 bg-white/95 px-10 py-9 shadow-2xl ring-1 ring-stone-200/60 backdrop-blur-xl min-w-[240px]">
        <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-brand-400/25 blur-lg scale-125 animate-pulse" />
          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 via-teal-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/25">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          <div
            className="absolute -inset-2.5 rounded-[1.15rem] border-2 border-transparent border-t-brand-500 border-r-teal-400/50 animate-spin"
            style={{ animationDuration: '0.9s' }}
            aria-hidden
          />
        </div>
        <p className="text-sm font-semibold text-stone-700 max-w-[220px] text-center leading-snug">
          {message || 'Working…'}
        </p>
        <div className="w-32 h-1 rounded-full bg-stone-100 overflow-hidden">
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 animate-[gl-shimmer_1.3s_ease-in-out_infinite]" />
        </div>
      </div>
      <style>{`
        @keyframes gl-shimmer {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(220%); }
        }
      `}</style>
    </div>
  );
}
