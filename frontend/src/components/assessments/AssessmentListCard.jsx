import React from 'react';
import {
  ClipboardList, Clock, Copy, Pencil, Send, Shield, Trash2, Timer, Users,
} from 'lucide-react';
import { STATUS_BADGE, actionBtn } from './assessmentsConstants';

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
  const open = (assessment.inviteStats?.pending || 0) + (assessment.inviteStats?.in_progress || 0);
  const done = assessment.inviteStats?.submitted || 0;
  const graded = assessment.inviteStats?.graded || 0;

  return (
    <article
      className={`group/card relative flex h-full min-h-[16.5rem] min-w-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:shadow-md hover:border-brand-200 ${
        archived ? 'border-amber-200/80' : 'border-stone-200/90'
      }`}
    >
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pt-4 pb-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="icon-box-ats !w-11 !h-11 !rounded-xl">
            {assessment.proctoring?.enabled ? <Shield strokeWidth={2.25} /> : <ClipboardList strokeWidth={2.25} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                onClick={() => onOpen(assessment)}
                className="min-w-0 text-left text-[15px] font-semibold leading-snug tracking-tight text-stone-900 hover:text-brand-700 line-clamp-2 break-words"
              >
                {assessment.title}
              </button>
              <span className={`${STATUS_BADGE[status] || 'badge-neutral'} flex-shrink-0`}>
                {status}{assessment.version ? ` v${assessment.version}` : ''}
              </span>
            </div>
            {assessment.description ? (
              <p className="text-sm text-stone-500 mt-1 line-clamp-2 leading-relaxed">{assessment.description}</p>
            ) : (
              <p className="text-sm text-stone-400 mt-1">No description</p>
            )}
          </div>
        </div>

        <div className="mt-3 flex min-w-0 flex-wrap content-start items-start gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-medium text-stone-600">
            <ClipboardList size={11} className="text-stone-400" /> {assessment.questions?.length || 0} questions
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-medium text-stone-600">
            <Timer size={11} className="text-stone-400" /> {assessment.durationMinutes || 0} min
          </span>
          {assessment.jobId?.title || assessment.jobId?.role ? (
            <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border border-brand-100 bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800">
              <span className="truncate">{assessment.jobId.title || assessment.jobId.role}</span>
            </span>
          ) : null}
          {assessment.proctoring?.enabled ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
              <Shield size={11} /> Proctored
            </span>
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {[
            ['Sent', sent, Users],
            ['Open', open, Clock],
            ['Done', done, ClipboardList],
            ['Graded', graded, ClipboardList],
          ].map(([label, value, Icon]) => (
            <div key={label} className="rounded-xl border border-stone-100 bg-stone-50/90 px-1.5 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wide text-stone-400 inline-flex items-center justify-center gap-1">
                <Icon size={10} /> {label}
              </p>
              <p className="text-sm font-bold text-stone-800 tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-h-[3.25rem] min-w-0 items-center gap-1.5 border-t border-stone-100 bg-stone-50/70 px-4 py-3">
        {onEdit ? (
          <button type="button" onClick={() => onEdit(assessment)} className={`${actionBtn} text-stone-500 hover:text-brand-600 hover:border-brand-300`} title="Edit" aria-label="Edit">
            <Pencil size={14} strokeWidth={2.25} />
          </button>
        ) : null}
        {onDuplicate ? (
          <button type="button" onClick={() => onDuplicate(assessment)} className={`${actionBtn} text-stone-500 hover:text-brand-600 hover:border-brand-300`} title="Duplicate" aria-label="Duplicate">
            <Copy size={14} strokeWidth={2.25} />
          </button>
        ) : null}
        {onInvite ? (
          <button type="button" onClick={() => onInvite(assessment)} className={`${actionBtn} text-stone-500 hover:text-brand-600 hover:border-brand-300`} title="Open & invite" aria-label="Invite">
            <Send size={14} strokeWidth={2.25} />
          </button>
        ) : null}
        {onDelete ? (
          <button type="button" onClick={() => onDelete(assessment)} className={`${actionBtn} ml-auto text-stone-400 hover:text-red-600 hover:border-red-200`} title="Delete" aria-label="Delete">
            <Trash2 size={14} strokeWidth={2.25} />
          </button>
        ) : null}
      </div>
    </article>
  );
}
