import React from 'react';
import { Users, UserPlus, GitMerge } from 'lucide-react';

function n(value) {
  return Math.max(0, Number(value) || 0);
}

export function jobApplicantBreakdown(job) {
  const applied = n(job?.careersCount);
  const unique = job?.uniqueCandidateCount;
  const total = unique == null ? n(job?.applicationCount) : n(unique);
  const added = n(job?.addedCount) || Math.max(0, total - applied);
  const duplicates = n(job?.duplicateCount);
  return { applied, added, duplicates, total };
}

function Chip({ asButton, className, title, onActivate, children }) {
  const Tag = asButton ? 'button' : 'span';
  return (
    <Tag
      type={asButton ? 'button' : undefined}
      title={title}
      className={className}
      onClick={asButton ? (e) => { e.preventDefault(); e.stopPropagation(); onActivate?.(); } : undefined}
    >
      {children}
    </Tag>
  );
}

export default function JobApplicantCounts({
  job,
  onOpen,
  className = '',
  compact = true,
}) {
  const { applied, added, duplicates } = jobApplicantBreakdown(job);
  const asButton = typeof onOpen === 'function';
  const chip = compact
    ? 'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap'
    : 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap';
  const open = (kind) => onOpen?.(job, kind);

  return (
    <div className={`inline-flex flex-wrap items-center gap-1.5 min-w-0 ${className}`}>
      <Chip
        asButton={asButton}
        onActivate={() => open('applied')}
        className={`${chip} border-teal-200 bg-teal-50 text-teal-800 ${asButton ? 'hover:bg-teal-100 transition-colors' : ''}`}
        title="People who applied through the careers page"
      >
        <Users size={compact ? 11 : 12} strokeWidth={2.25} />
        <span>Applied</span>
        <span className="tabular-nums">{applied}</span>
      </Chip>
      <Chip
        asButton={asButton}
        onActivate={() => open('added')}
        className={`${chip} border-stone-200 bg-stone-50 text-stone-700 ${asButton ? 'hover:bg-stone-100 transition-colors' : ''}`}
        title="People tagged to this Job ID by company employees"
      >
        <UserPlus size={compact ? 11 : 12} strokeWidth={2.25} />
        <span>Added</span>
        <span className="tabular-nums">{added}</span>
      </Chip>
      {duplicates > 0 ? (
        <Chip
          asButton={asButton}
          onActivate={() => open('duplicates')}
          className={`${chip} border-amber-200 bg-amber-50 text-amber-800 ${asButton ? 'hover:bg-amber-100 transition-colors' : ''}`}
          title="Profiles added that were not merged because a duplicate already exists"
        >
          <GitMerge size={compact ? 11 : 12} strokeWidth={2.25} />
          <span>Duplicates</span>
          <span className="tabular-nums">{duplicates}</span>
        </Chip>
      ) : null}
    </div>
  );
}
