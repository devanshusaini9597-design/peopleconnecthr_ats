import React from 'react';
import { useGlobalLoader } from '../context/GlobalLoaderContext';

/**
 * Full-screen overlay loader. Shown when global loading state is true.
 * Use via useGlobalLoader().setGlobalLoading(true, 'Message') from any component.
 */
export default function GlobalLoader() {
  const { show, message } = useGlobalLoader();

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="flex flex-col items-center gap-6 rounded-2xl bg-white px-10 py-8 shadow-2xl ring-1 ring-black/5">
        {/* Professional spinner */}
        <div className="relative h-14 w-14">
          <div
            className="absolute inset-0 rounded-full border-4 border-indigo-100"
            aria-hidden
          />
          <div
            className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-600 border-r-indigo-400 animate-spin"
            style={{ animationDuration: '0.75s' }}
            aria-hidden
          />
        </div>
        <p className="text-sm font-semibold text-gray-700 max-w-[200px] text-center">
          {message}
        </p>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }}
              aria-hidden
            />
          ))}
        </div>
      </div>
    </div>
  );
}
