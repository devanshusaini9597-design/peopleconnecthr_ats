import React from 'react';
import { ClipboardList, Clock, FileEdit, Flag, Mail } from 'lucide-react';
import PresenceAvatar from '../ui/PresenceAvatar';

const chip = 'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap';

function submittedLabel(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AssessmentQueueCard({ row, onGrade, canGrade = true }) {
  const name = row.candidateId?.name || 'Candidate';
  const email = row.candidateId?.email || '';
  const title = row.assessmentId?.title || 'Assessment';

  return (
    <article className="group/card relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:shadow-md hover:border-brand-200">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />

      <div className="flex min-w-0 flex-1 flex-col px-4 pt-4 pb-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            <FileEdit size={11} strokeWidth={2.25} /> Pending review
          </span>
        </div>

        <div className="mt-3 flex min-w-0 items-start gap-3">
          <PresenceAvatar name={name} email={email} size={40} />
          <div className="min-w-0 flex-1">
            <h4 className="text-[15px] font-semibold leading-snug tracking-tight text-stone-900 truncate">{name}</h4>
            {email ? (
              <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-stone-500">
                <Mail size={12} className="shrink-0 text-stone-400" strokeWidth={2.25} />
                <span className="truncate">{email}</span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex min-w-0 flex-wrap content-start items-start gap-1.5">
          <span title={title} className={`${chip} max-w-full min-w-0 border-brand-100 bg-brand-50 text-brand-800`}>
            <ClipboardList size={11} className="shrink-0 text-brand-600" strokeWidth={2.25} />
            <span className="truncate">{title}</span>
          </span>
          <span className={`${chip} border-stone-200 bg-stone-50 text-stone-700`}>
            <Clock size={11} className="text-stone-400" strokeWidth={2.25} />
            {submittedLabel(row.submittedAt)}
          </span>
          {row.proctoring?.flagged || row.proctoring?.tabSwitchCount ? (
            <span className={`${chip} ${row.proctoring?.flagged ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              <Flag size={11} strokeWidth={2.25} />
              {row.proctoring?.flagged ? `Risk ${row.proctoring.riskScore || 0}` : `${row.proctoring.tabSwitchCount} tab switch${row.proctoring.tabSwitchCount === 1 ? '' : 'es'}`}
            </span>
          ) : null}
        </div>
      </div>

      {canGrade ? (
        <div className="flex min-h-[3.25rem] items-center border-t border-stone-100 bg-stone-50/70 px-4 py-3">
          <button
            type="button"
            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 text-[12px] font-bold text-brand-800 shadow-sm hover:bg-brand-100"
            onClick={() => onGrade?.(row)}
          >
            <FileEdit size={14} strokeWidth={2.25} /> Grade submission
          </button>
        </div>
      ) : null}
    </article>
  );
}
