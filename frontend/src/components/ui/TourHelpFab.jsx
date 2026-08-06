import React from 'react';
import { HelpCircle } from 'lucide-react';

/**
 * Fixed bottom-right help trigger — icon only, label on hover (enterprise FAB).
 */
export default function TourHelpFab({ onClick, label = 'Take a tour', title }) {
  return (
    <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-[90] group">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={title || label}
        className="relative flex items-center justify-center w-12 h-12 rounded-full border border-brand-300/80 bg-white text-stone-600 shadow-lg shadow-stone-900/10 ring-1 ring-brand-100/80 transition-all duration-300 ease-out hover:border-brand-400 hover:text-brand-700 hover:shadow-xl hover:shadow-brand-500/15 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <HelpCircle className="w-5 h-5" strokeWidth={1.75} />
        <span className="pointer-events-none absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-xl border border-stone-200/80 bg-stone-900 text-white text-xs font-semibold px-3 py-2 shadow-lg opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
          {label}
          <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-stone-900" aria-hidden />
        </span>
      </button>
    </div>
  );
}
