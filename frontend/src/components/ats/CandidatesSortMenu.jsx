import React from 'react';
import { ArrowUpNarrowWide, ArrowDownWideNarrow } from 'lucide-react';

/**
 * Date-only sort — icon-only Oldest / Newest toggle.
 */
export default function CandidatesSortMenu({
  sortOrder = 'desc',
  onChange,
  disabled = false,
}) {
  const order = sortOrder === 'asc' ? 'asc' : 'desc';

  const setOrder = (next) => {
    onChange?.('date', next);
  };

  return (
    <div
      className="inline-flex h-11 items-stretch rounded-lg border border-stone-200 bg-white p-0.5 flex-shrink-0"
      role="group"
      aria-label="Sort by date"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOrder('asc')}
        className={`inline-flex h-full w-10 items-center justify-center rounded-md transition-colors ${
          order === 'asc'
            ? 'bg-stone-900 text-white shadow-sm'
            : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800'
        } disabled:opacity-50 disabled:pointer-events-none`}
        title="Oldest first"
        aria-label="Oldest first"
        aria-pressed={order === 'asc'}
      >
        <ArrowUpNarrowWide size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOrder('desc')}
        className={`inline-flex h-full w-10 items-center justify-center rounded-md transition-colors ${
          order === 'desc'
            ? 'bg-stone-900 text-white shadow-sm'
            : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800'
        } disabled:opacity-50 disabled:pointer-events-none`}
        title="Newest first"
        aria-label="Newest first"
        aria-pressed={order === 'desc'}
      >
        <ArrowDownWideNarrow size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}
