import React from 'react';
import {
  Award, Briefcase, CircleCheck, Copy, Eye, Hourglass, ListChecks,
  Pencil, Send, ShieldCheck, Timer, Trash2,
} from 'lucide-react';

const STATUS_PILL = {
  draft: 'border-stone-200 bg-stone-50 text-stone-600',
  published: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  archived: 'border-amber-200 bg-amber-50 text-amber-800',
};

const chip = 'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap';
const iconBtn = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700';

export default function AssessmentListCard({
  assessment,
  onOpen,
  onEdit,
  onDuplicate,
  onInvite,
  onDelete,
}) {
  const archived = assessment.isActive === false || assessment.status === 'archived';
  const status = archived ? 'archived' : (assessment.status || 'draft');
  const sent = assessment.inviteStats?.total || 0;
  const openCount = (assessment.inviteStats?.pending || 0) + (assessment.inviteStats?.in_progress || 0);
  const done = assessment.inviteStats?.submitted || 0;
  const graded = assessment.inviteStats?.graded || 0;
  const review = assessment.inviteStats?.pendingReview || 0;
  const jobLabel = assessment.jobId?.title || assessment.jobId?.role;

  return (
    <article
      className={`group/card relative flex h-full min-h-[17rem] min-w-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:shadow-md ${
        archived ? 'border-amber-200/80 hover:border-amber-300' : 'border-stone-200/90 hover:border-brand-200'
      }`}
    >
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pt-4 pb-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-teal-200/90 bg-teal-50/80 px-2 py-0.5 text-teal-800">
            {assessment.proctoring?.enabled
              ? <ShieldCheck size={11} className="shrink-0 text-teal-600" strokeWidth={2.25} />
              : <ListChecks size={11} className="shrink-0 text-teal-600" strokeWidth={2.25} />}
            <span className="truncate text-[10px] font-semibold uppercase tracking-wide leading-none">
              {assessment.proctoring?.enabled ? 'Proctored test' : 'Skills test'}
            </span>
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {review > 0 ? (
              <span className="inline-flex items-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                {review} review
              </span>
            ) : null}
            <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] ${STATUS_PILL[status] || STATUS_PILL.draft}`}>
              {status}{assessment.version ? ` · v${assessment.version}` : ''}
            </span>
          </div>
        </div>

        <div className="mt-2 flex min-w-0 items-start gap-2">
          <button
            type="button"
            onClick={() => onOpen(assessment)}
            title={assessment.title}
            className="min-w-0 flex-1 text-left text-[15px] font-semibold leading-snug tracking-tight text-stone-900 hover:text-brand-700 line-clamp-2 break-words"
          >
            {assessment.title}
          </button>
          <button
            type="button"
            onClick={() => onOpen(assessment)}
            className={iconBtn}
            title="Open assessment"
            aria-label={`Open ${assessment.title}`}
          >
            <Eye size={14} strokeWidth={2.25} />
          </button>
        </div>

        {assessment.description ? (
          <p className="mt-1 text-sm text-stone-500 line-clamp-2 leading-relaxed">{assessment.description}</p>
        ) : null}

        <div className="mt-2.5 flex min-w-0 flex-wrap content-start items-start gap-1.5">
          <span className={`${chip} border-stone-200 bg-stone-50 text-stone-700`}>
            <ListChecks size={11} className="text-stone-400" strokeWidth={2.25} />
            {assessment.questions?.length || 0} questions
          </span>
          <span className={`${chip} border-stone-200 bg-stone-50 text-stone-700`}>
            <Timer size={11} className="text-stone-400" strokeWidth={2.25} />
            {assessment.durationMinutes || 0} min
          </span>
          {jobLabel ? (
            <span title={jobLabel} className={`${chip} max-w-full min-w-0 border-brand-100 bg-brand-50 text-brand-800`}>
              <Briefcase size={11} className="shrink-0 text-brand-600" strokeWidth={2.25} />
              <span className="truncate">{jobLabel}</span>
            </span>
          ) : null}
        </div>

        <div className="mt-3 inline-flex flex-wrap items-center gap-1.5">
          <span className={`${chip} border-teal-200 bg-teal-50 text-teal-800`} title="Invites sent">
            <Send size={11} strokeWidth={2.25} /> Sent <span className="tabular-nums">{sent}</span>
          </span>
          <span className={`${chip} border-sky-200 bg-sky-50 text-sky-800`} title="Not started or in progress">
            <Hourglass size={11} strokeWidth={2.25} /> Open <span className="tabular-nums">{openCount}</span>
          </span>
          <span className={`${chip} border-stone-200 bg-stone-50 text-stone-700`} title="Submitted">
            <CircleCheck size={11} strokeWidth={2.25} /> Done <span className="tabular-nums">{done}</span>
          </span>
          <span className={`${chip} border-emerald-200 bg-emerald-50 text-emerald-800`} title="Graded">
            <Award size={11} strokeWidth={2.25} /> Graded <span className="tabular-nums">{graded}</span>
          </span>
        </div>
      </div>

      <div className="flex min-h-[3.25rem] min-w-0 items-center gap-1.5 border-t border-stone-100 bg-stone-50/70 px-4 py-3">
        {onInvite ? (
          <button
            type="button"
            onClick={() => onInvite(assessment)}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 text-[11px] font-bold text-stone-700 shadow-sm hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
            title="Open & invite"
          >
            <Send size={13} strokeWidth={2.25} /> Invite
          </button>
        ) : null}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {onEdit ? (
            <button type="button" onClick={() => onEdit(assessment)} className={iconBtn} title="Edit" aria-label="Edit">
              <Pencil size={14} strokeWidth={2.25} />
            </button>
          ) : null}
          {onDuplicate ? (
            <button type="button" onClick={() => onDuplicate(assessment)} className={iconBtn} title="Duplicate" aria-label="Duplicate">
              <Copy size={14} strokeWidth={2.25} />
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(assessment)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-400 shadow-sm hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              title="Delete"
              aria-label="Delete"
            >
              <Trash2 size={14} strokeWidth={2.25} />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
