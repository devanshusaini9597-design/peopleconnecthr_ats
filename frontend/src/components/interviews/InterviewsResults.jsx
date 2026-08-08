import React from 'react';
import {
  Calendar as CalendarIcon, Video, FileText, X, Plus,
  CheckCircle2, Sparkles,
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import InterviewCard from './InterviewCard';
import {
  TYPE_META,
  STATUS_BADGE,
  actionBtn,
  actionDanger,
  formatWhen,
  candidateName,
  jobName,
} from './constants';

export default function InterviewsResults({
  activeTab,
  interviews,
  filtered,
  calendarGroups,
  openSchedule,
  openScorecard,
  setCancelTarget,
  handleComplete,
  setTranscriptTarget,
  tableScrollRef,
  onTableDragScrollStart,
  onTableDragScrollMove,
  onTableDragScrollEnd,
}) {
  if (activeTab === 'calendar') {
    if (calendarGroups.length === 0) {
      return (
        <EmptyState
          icon={CalendarIcon}
          tone="sky"
          message="No interviews on the calendar"
          subMessage="Schedule an interview to see it grouped by date."
          action={(
            <button type="button" onClick={openSchedule} className="btn-primary">
              <Plus className="w-4 h-4" /> Schedule interview
            </button>
          )}
        />
      );
    }
    return (
      <div className="space-y-6">
        {calendarGroups.map(([dateKey, items]) => (
          <div key={dateKey}>
            <h3 className="text-sm font-bold text-stone-800 mb-3 tracking-tight">
              {new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
                weekday: 'long', month: 'long', day: 'numeric',
              })}
              <span className="ml-2 text-stone-400 font-medium">{items.length}</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
              {items.map((iv) => (
                <InterviewCard
                  key={iv._id}
                  interview={iv}
                  onScorecard={openScorecard}
                  onCancel={setCancelTarget}
                  onComplete={handleComplete}
                  onTranscript={setTranscriptTarget}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={CalendarIcon}
        tone={interviews.length === 0 ? 'sky' : 'amber'}
        message={interviews.length === 0 ? 'No interviews yet' : 'No interviews match'}
        subMessage={
          interviews.length === 0
            ? 'Schedule from here or from the Pipeline Board.'
            : 'Try another tab or clear the search.'
        }
        action={
          interviews.length === 0 ? (
            <button type="button" onClick={openSchedule} className="btn-primary">
              <Plus className="w-4 h-4" /> Schedule interview
            </button>
          ) : null
        }
      />
    );
  }

  if (activeTab === 'all') {
    return (
      <div
        ref={tableScrollRef}
        className="cand-table-scroll overflow-x-auto select-none rounded-xl border border-stone-200"
        onMouseDown={onTableDragScrollStart}
        onMouseMove={onTableDragScrollMove}
        onMouseUp={onTableDragScrollEnd}
        onMouseLeave={onTableDragScrollEnd}
      >
        <table className="cand-table-drag w-full text-left border-collapse min-w-[860px] select-text border border-stone-200">
          <thead>
            <tr className="bg-stone-100">
              {['Candidate', 'Role', 'When', 'Type', 'Status', 'Actions'].map((label) => (
                <th
                  key={label}
                  className={`px-3.5 py-3.5 text-[10px] font-bold text-stone-600 uppercase tracking-wider whitespace-nowrap border border-stone-200 bg-stone-100 ${
                    label === 'Actions' ? 'text-right' : ''
                  }`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((iv, rowIndex) => {
              const { day, time } = formatWhen(iv.scheduledAt);
              const meta = TYPE_META[iv.type] || TYPE_META.video;
              const scheduled = iv.status === 'scheduled' || iv.status === 'in_progress' || iv.status === 'rescheduled';
              return (
                <tr
                  key={iv._id}
                  className={`transition-colors ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'} hover:bg-brand-50/50`}
                >
                  <td className="px-3.5 py-3 text-sm text-stone-900 font-semibold border border-stone-200 align-middle break-words min-w-[140px]">
                    {candidateName(iv)}
                  </td>
                  <td className="px-3.5 py-3 text-sm text-stone-700 font-medium border border-stone-200 align-middle break-words min-w-[140px]">
                    {jobName(iv)}
                  </td>
                  <td className="px-3.5 py-3 text-sm text-stone-700 font-medium border border-stone-200 align-middle whitespace-nowrap">
                    {day} · {time}
                  </td>
                  <td className="px-3.5 py-3 text-sm border border-stone-200 align-middle whitespace-nowrap">
                    <span className={meta.badge}>{meta.label}</span>
                  </td>
                  <td className="px-3.5 py-3 text-sm border border-stone-200 align-middle whitespace-nowrap">
                    <span className={STATUS_BADGE[iv.status] || 'badge-neutral'}>
                      {(iv.status || '').replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-sm border border-stone-200 align-middle whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      {iv.meetingLink && (
                        <a href={iv.meetingLink} target="_blank" rel="noreferrer" className={actionBtn} title="Join">
                          <Video size={14} />
                        </a>
                      )}
                      {scheduled && (
                        <button type="button" onClick={() => handleComplete(iv)} className={actionBtn} title="Mark completed">
                          <CheckCircle2 size={14} />
                        </button>
                      )}
                      {iv.status === 'completed' && (
                        <button type="button" onClick={() => openScorecard(iv)} className={actionBtn} title="Scorecard">
                          <FileText size={14} />
                        </button>
                      )}
                      {!String(iv._id).startsWith('app-') && (
                        <button type="button" onClick={() => setTranscriptTarget(iv)} className={actionBtn} title="AI transcript">
                          <Sparkles size={14} />
                        </button>
                      )}
                      {scheduled && (
                        <button type="button" onClick={() => setCancelTarget(iv)} className={actionDanger} title="Cancel">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
      {filtered.map((iv) => (
        <InterviewCard
          key={iv._id}
          interview={iv}
          onScorecard={openScorecard}
          onCancel={setCancelTarget}
          onComplete={handleComplete}
          onTranscript={setTranscriptTarget}
        />
      ))}
    </div>
  );
}
