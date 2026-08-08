import React from 'react';

export default function CategoryBadge({ cat, isDbDuplicate }) {
  const map = {
    ready: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    review: 'bg-amber-50 text-amber-800 border-amber-100',
    blocked: 'bg-red-50 text-red-700 border-red-100',
  };
  const label = cat === 'ready' ? 'Ready' : cat === 'review' ? 'Needs review' : 'Blocked';
  return (
    <div className="flex flex-col gap-1 items-start">
      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${map[cat] || map.blocked}`}>
        {label}
      </span>
      {isDbDuplicate && (
        <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border bg-violet-50 text-violet-700 border-violet-100" title="Same email/phone already in Candidates — import will update that record">
          In ATS · update
        </span>
      )}
    </div>
  );
}

