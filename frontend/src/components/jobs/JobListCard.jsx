import React, { useState } from 'react';
import {
  AlertTriangle, Briefcase, Building2, Check, Copy, Eye, MapPin, Pencil, Pin, Share2, UserCheck,
} from 'lucide-react';
import JobApplicantCounts from './JobApplicantCounts';
import JobCardActionsMenu from './JobCardActionsMenu';
import { STATUS_STYLES } from './jobsConstants';

export default function JobListCard({
  job,
  unread,
  menuOpen,
  onToggleMenu,
  onView,
  onEdit,
  onPublish,
  onShare,
  onOpenApplicants,
  onMarkOpen,
  onHold,
  onClose,
  onToggleUrgent,
  onTogglePin,
  onSaveTemplate,
  onDelete,
  onCopiedJobId,
}) {
  const title = job.role || job.title || 'Untitled role';
  const status = job.status || 'Open';
  const urgent = String(job.priority || '').toLowerCase() === 'urgent';
  const jobIdLabel = job.jobCode || 'Job ID pending';
  const offerLine = [job.experience, job.ctc].filter(Boolean).join(' · ');
  const [copied, setCopied] = useState(false);

  const copyJobId = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!job.jobCode) return;
    try {
      await navigator.clipboard.writeText(job.jobCode);
      setCopied(true);
      onCopiedJobId?.(job.jobCode);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <article
      className={`group/card relative flex h-full min-h-[17.5rem] min-w-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:shadow-md ${
        urgent
          ? 'border-red-200/80 hover:border-red-300'
          : unread
            ? 'border-brand-200/90 hover:border-brand-300'
            : 'border-stone-200/90 hover:border-brand-200'
      }`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-[2px] ${
          urgent
            ? 'bg-red-500'
            : unread
              ? 'bg-gradient-to-r from-brand-600 to-teal-400'
              : 'bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600'
        }`}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pt-4 pb-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
          <div className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-teal-200/90 bg-teal-50/80 pl-2 pr-1 py-0.5 text-teal-800">
            <Briefcase size={11} className="shrink-0 text-teal-600" strokeWidth={2.25} />
            <span
              title={`Job ID ${jobIdLabel}`}
              className="min-w-0 truncate font-mono text-[10px] font-semibold tabular-nums tracking-wide leading-none"
            >
              {jobIdLabel}
            </span>
            {job.jobCode ? (
              <button
                type="button"
                onClick={copyJobId}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-teal-700 transition-colors hover:bg-teal-100 hover:text-teal-900"
                title={copied ? 'Copied' : 'Copy Job ID'}
                aria-label={copied ? 'Job ID copied' : `Copy Job ID ${jobIdLabel}`}
              >
                {copied
                  ? <Check size={11} strokeWidth={2.75} className="text-emerald-600" />
                  : <Copy size={11} strokeWidth={2.25} />}
              </button>
            ) : null}
          </div>
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {unread ? (
              <span className="inline-flex items-center rounded-full bg-brand-600 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] text-white">
                New
              </span>
            ) : null}
            {job.pinned ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] text-amber-800">
                <Pin size={9} strokeWidth={2.5} />
                Pinned
              </span>
            ) : null}
            {urgent ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] text-red-700">
                <AlertTriangle size={9} strokeWidth={2.5} />
                Urgent
              </span>
            ) : null}
            <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] ${STATUS_STYLES[status] || STATUS_STYLES.Open}`}>
              {status}
            </span>
          </div>
        </div>

        <div className="mt-2 flex min-w-0 items-start gap-2">
          <button
            type="button"
            onClick={() => onView(job)}
            title={title}
            className="min-w-0 flex-1 text-left text-[15px] font-semibold leading-snug tracking-tight text-stone-900 transition-colors hover:text-brand-700 line-clamp-2 break-words uppercase"
          >
            {title}
          </button>
          <button
            type="button"
            onClick={() => onView(job)}
            className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 shadow-sm transition-all hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
            title="View job"
            aria-label={`View ${title}`}
          >
            <Eye size={14} strokeWidth={2.25} />
          </button>
        </div>

        <div className="mt-2.5 flex min-h-[3.25rem] min-w-0 flex-wrap content-start items-start gap-1.5">
          {job.clientName ? (
            <span
              title={job.clientName}
              className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-medium text-stone-600"
            >
              <Building2 size={11} className="shrink-0 text-stone-400" />
              <span className="truncate">{job.clientName}</span>
            </span>
          ) : null}
          {job.grade ? (
            <span className="inline-flex items-center rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-medium text-stone-600">
              Grade {job.grade}
            </span>
          ) : null}
          <span
            title={job.location || 'Location TBD'}
            className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-medium text-stone-600"
          >
            <MapPin size={11} className="shrink-0 text-stone-400" />
            <span className="truncate">{job.location || 'Location TBD'}</span>
          </span>
          {offerLine ? (
            <span
              title={offerLine}
              className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-medium text-stone-600"
            >
              <Briefcase size={11} className="shrink-0 text-stone-400" />
              <span className="truncate">{offerLine}</span>
            </span>
          ) : null}
          {(job.skills || []).slice(0, 3).map((skill) => (
            <span key={skill} className="inline-flex max-w-[10rem] truncate rounded-md border border-brand-100 bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-800">
              {skill}
            </span>
          ))}
          {(job.skills || []).length > 3 ? (
            <span className="text-[10px] font-semibold text-stone-500">+{job.skills.length - 3}</span>
          ) : null}
        </div>

        <div className="mt-3">
          <JobApplicantCounts
            job={job}
            compact
            onOpen={(j, kind) => onOpenApplicants?.(j, kind)}
          />
        </div>
      </div>

      <div className="flex min-h-[3.25rem] min-w-0 items-center gap-2 border-t border-stone-100 bg-stone-50/70 px-4 py-3">
        <div className="min-w-0 flex-1 overflow-hidden">
          {job.hiringManagers?.length > 0 ? (
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              {job.hiringManagers.slice(0, 2).map((email, idx) => (
                <span key={`${email}-${idx}`} className="inline-flex max-w-full items-center gap-1 truncate rounded-md border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-stone-700">
                  <UserCheck size={10} /> {String(email).split('@')[0]}
                </span>
              ))}
              {job.hiringManagers.length > 2 ? (
                <span className="text-[10px] font-semibold text-stone-400">+{job.hiringManagers.length - 2}</span>
              ) : null}
            </div>
          ) : (
            <p className="text-[11px] text-stone-400">No hiring manager assigned</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onTogglePin?.(job)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border shadow-sm transition-colors ${
              job.pinned
                ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                : 'border-stone-200 bg-white text-stone-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800'
            }`}
            title={job.pinned ? 'Unpin job' : 'Pin job'}
            aria-label={job.pinned ? 'Unpin job' : 'Pin job'}
          >
            <Pin size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => onEdit(job)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            title="Edit job"
          >
            <Pencil size={14} strokeWidth={2} />
          </button>
          {status === 'Draft' || status === 'On Hold' ? (
            <button
              type="button"
              onClick={() => onPublish(job)}
              className="h-8 px-2.5 inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-[11px] font-bold uppercase tracking-wide text-emerald-800 shadow-sm hover:bg-emerald-100"
              title="Publish & open — live on careers"
            >
              Publish
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onShare(job)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 shadow-sm transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
              title="Share apply link"
            >
              <Share2 size={14} strokeWidth={2} />
            </button>
          )}
          <JobCardActionsMenu
            open={menuOpen}
            onToggle={onToggleMenu}
            job={job}
            status={status}
            onMarkOpen={onMarkOpen}
            onHold={onHold}
            onClose={onClose}
            onToggleUrgent={onToggleUrgent}
            onTogglePin={() => onTogglePin?.(job)}
            onSaveTemplate={onSaveTemplate}
            onDelete={onDelete}
          />
        </div>
      </div>
    </article>
  );
}
