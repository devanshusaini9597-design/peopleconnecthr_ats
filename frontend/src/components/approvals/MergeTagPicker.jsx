import React from 'react';
import { OFFER_MERGE_TAGS } from './approvalsConstants';

export default function MergeTagPicker({ onInsert }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 mr-0.5">Insert</span>
      {OFFER_MERGE_TAGS.map((tag) => (
        <button
          key={tag.token}
          type="button"
          onClick={() => onInsert(tag.token)}
          className="inline-flex items-center rounded-lg border border-brand-200/80 bg-brand-50/70 px-2 py-1 text-[11px] font-semibold text-brand-800 hover:bg-brand-100/80 transition-colors"
        >
          {tag.label}
        </button>
      ))}
    </div>
  );
}
