import React from 'react';

const CategoryBadge = ({ cat }) => {
  if (cat === 'blocked') {
    return (
      <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-red-50 text-red-700 border-red-100">
        Blocked
      </span>
    );
  }
  return (
    <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-800 border-amber-100">
      Needs review
    </span>
  );
};

export default CategoryBadge;
