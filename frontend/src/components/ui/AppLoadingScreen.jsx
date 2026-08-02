import React from 'react';
import { Briefcase } from 'lucide-react';

/**
 * Full-viewport enterprise loading screen — used on auth boot & route suspense.
 */
const AppLoadingScreen = ({
  message = 'Preparing your workspace',
  subMessage = 'Loading your recruitment hub…',
  fullScreen = true,
}) => (
  <div
    className={`relative flex items-center justify-center overflow-hidden ${
      fullScreen ? 'min-h-screen' : 'min-h-[50vh] p-8'
    }`}
    role="status"
    aria-live="polite"
    aria-label={message}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-stone-50 via-white to-teal-50/40" />
    <div
      className="absolute inset-0 opacity-[0.35]"
      style={{
        backgroundImage:
          'radial-gradient(circle at 20% 20%, rgba(13,148,136,0.12), transparent 42%), radial-gradient(circle at 80% 10%, rgba(20,184,166,0.1), transparent 36%), radial-gradient(circle at 70% 80%, rgba(15,118,110,0.08), transparent 40%)',
      }}
    />
    <div
      className="absolute inset-0 opacity-[0.04]"
      style={{
        backgroundImage:
          'linear-gradient(to right, #78716c 1px, transparent 1px), linear-gradient(to bottom, #78716c 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }}
    />

    <div className="relative z-10 flex flex-col items-center text-center px-6 animate-fade-in">
      <div className="relative mb-7">
        <div className="absolute inset-0 rounded-3xl bg-brand-400/20 blur-xl scale-125 animate-pulse" />
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 via-teal-500 to-brand-700 shadow-lg shadow-brand-500/25 flex items-center justify-center ring-4 ring-white">
          <Briefcase className="w-7 h-7 text-white" strokeWidth={2} />
        </div>
        <div className="absolute -inset-3 rounded-[1.35rem] border-2 border-transparent border-t-brand-500 border-r-teal-400/60 animate-spin" style={{ animationDuration: '1.1s' }} />
      </div>

      <p className="text-lg font-bold text-stone-900 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
        {message}
      </p>
      {subMessage && (
        <p className="text-sm text-stone-500 mt-1.5 max-w-xs leading-relaxed">{subMessage}</p>
      )}

      <div className="mt-6 w-40 h-1 rounded-full bg-stone-200/80 overflow-hidden">
        <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 animate-[loading-shimmer_1.4s_ease-in-out_infinite]" />
      </div>
    </div>

    <style>{`
      @keyframes loading-shimmer {
        0% { transform: translateX(-120%); }
        100% { transform: translateX(220%); }
      }
    `}</style>
  </div>
);

export default AppLoadingScreen;
