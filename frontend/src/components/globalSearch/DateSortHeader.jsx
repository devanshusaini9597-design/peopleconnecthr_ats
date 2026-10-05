import React from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';

export default function DateSortHeader({ value = 'latest', onChange }) {
  const btn = (dir, Icon, title) => {
    const active = value === dir;
    return (
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-pressed={active}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onChange?.(dir);
        }}
        className={`h-6 w-6 inline-flex items-center justify-center rounded-md border transition-colors ${
          active
            ? 'border-brand-300 bg-brand-50 text-brand-800'
            : 'border-transparent text-stone-400 hover:text-stone-700 hover:bg-white'
        }`}
      >
        <Icon size={13} strokeWidth={2.25} />
      </button>
    );
  };

  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      Date
      {btn('latest', ArrowDownWideNarrow, 'Latest first')}
      {btn('oldest', ArrowUpNarrowWide, 'Oldest first')}
    </span>
  );
}
