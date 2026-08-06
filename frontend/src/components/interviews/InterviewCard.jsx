import React from 'react';
import {
  Calendar as CalendarIcon, Clock, Video, Briefcase, FileText, X,
  CheckCircle2, Sparkles, MapPin,
} from 'lucide-react';
import {
  TYPE_META, STATUS_BADGE, formatWhen, candidateName, jobName,
  actionBtn, actionDanger,
} from './constants';

export default function InterviewCard({ interview, onScorecard, onCancel, onComplete, onTranscript }) => {
  const meta = TYPE_META[interview.type] || TYPE_META.video;
  const TypeIcon = meta.icon;
  const { day, time } = formatWhen(interview.scheduledAt);
  const name = candidateName(interview);
  const role = jobName(interview);
  const isScheduled = interview.status === 'scheduled' || interview.status === 'rescheduled' || interview.status === 'in_progress';
  const isCompleted = interview.status === 'completed';

  return (
    <div className="card-ats p-5 flex flex-col hover:border-brand-200/80 relative group">
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 opacity-80 pointer-events-none" />
      <div className="flex justify-between items-start mb-4 gap-2 pt-1">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center font-bold text-sm ring-1 ring-brand-200/60 flex-shrink-0">
            {(name || 'C').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-stone-900 text-sm break-words tracking-tight">{name}</h4>
            <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5 break-words">
              <Briefcase className="w-3 h-3 flex-shrink-0" /> {role}
            </p>
          </div>
        </div>
        <span className={`${STATUS_BADGE[interview.status] || 'badge-neutral'} flex-shrink-0`}>
          {(interview.status || 'scheduled').replace(/_/g, ' ')}
        </span>
      </div>

      <div className="space-y-2 text-sm text-stone-600 mb-5 bg-stone-50/80 p-3.5 rounded-xl border border-stone-100">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-stone-400 flex-shrink-0" />
          <span className="font-semibold text-stone-900">{day}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-stone-400 flex-shrink-0" />
          {time}
          {interview.duration ? <span className="text-stone-400">· {interview.duration} min</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <TypeIcon className="w-4 h-4 text-brand-600 flex-shrink-0" />
          {meta.label} interview
        </div>
        {interview.location && interview.type === 'in_person' && (
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-4 h-4 text-stone-400 flex-shrink-0" />
            <span className="break-words">{interview.location}</span>
          </div>
        )}
      </div>

      <div className="mt-auto pt-4 border-t border-stone-100 flex flex-wrap items-center justify-end gap-1.5">
        {isScheduled && interview.meetingLink && (
          <a href={interview.meetingLink} target="_blank" rel="noreferrer" className={actionBtn} title="Join meeting">
            <Video size={14} />
          </a>
        )}
        {isScheduled && (
          <button type="button" onClick={() => onComplete(interview)} className={actionBtn} title="Mark completed">
            <CheckCircle2 size={14} />
          </button>
        )}
        {isCompleted && (
          <button type="button" onClick={() => onScorecard(interview)} className={actionBtn} title="Scorecard">
            <FileText size={14} />
          </button>
        )}
        {onTranscript && !String(interview._id).startsWith('app-') && (
          <button type="button" onClick={() => onTranscript(interview)} className={actionBtn} title="AI transcript">
            <Sparkles size={14} />
          </button>
        )}
        {isScheduled && (
          <button type="button" onClick={() => onCancel(interview)} className={actionDanger} title="Cancel interview">
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

