import React from 'react';
import {
  Video, Phone, User, MapPin, Briefcase, Star, FileText, X, Plus, Users,
  Search, Loader2, Link2, CheckCircle2, Calendar as CalendarIcon, Clock,
} from 'lucide-react';
import Modal from '../ui/Modal';
import ConfirmationModal from '../ConfirmationModal';
import PremiumSelect from '../ui/PremiumSelect';
import PremiumDatePicker from '../ui/PremiumDatePicker';
import InterviewTranscriptPanel from '../InterviewTranscriptPanel';
import {
  TYPE_OPTIONS, DURATION_OPTIONS, RECS, DEFAULT_TEMPLATE_VALUE,
  candidateName, jobName,
} from './constants';

export default function InterviewsModals(props) {
  const {
    showSchedule, setShowSchedule, scheduling, handleSchedule,
    appQuery, setAppQuery, appResults, searchingApps,
    selectedApp, setSelectedApp, scheduleForm, setScheduleForm,
    showScorecard, setShowScorecard, scorecardTarget,
    recommendation, setRecommendation,
    ratings, setRatings, skillNotes, setSkillNotes,
    finalNotes, setFinalNotes, submittingScorecard, handleScorecard,
    templates = [], templatesLoading, selectedTemplateId, applyTemplateSelection,
    activeCriteria, templateOptions, previewOverall,
    cancelTarget, setCancelTarget, cancelling, handleCancel,
    transcriptTarget, setTranscriptTarget,
  } = props;

  return (
    <>
      <Modal
        open={showSchedule}
        onClose={() => setShowSchedule(false)}
        title="Schedule Interview"
        description="Select a candidate application, then set the schedule details."
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setShowSchedule(false)} className="btn-secondary" disabled={scheduling}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSchedule}
              disabled={scheduling || !selectedApp || !scheduleForm.scheduledDate || !scheduleForm.scheduledTime}
              className="btn-primary"
            >
              {scheduling
                ? <><Loader2 size={16} className="animate-spin" /> Scheduling…</>
                : <><CalendarIcon className="w-4 h-4" /> Schedule</>}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Candidate */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg bg-brand-50 border border-brand-100 text-brand-700 inline-flex items-center justify-center flex-shrink-0">
                <User size={14} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-stone-900 tracking-tight">Candidate</p>
                <p className="text-[11px] text-stone-500">Application from your pipeline</p>
              </div>
            </div>

            {selectedApp ? (
              <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50/80 to-white px-3.5 py-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center text-sm font-bold flex-shrink-0 ring-1 ring-brand-200/60">
                  {(selectedApp.candidateId?.name || selectedApp.candidate?.name || 'C').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-stone-900 break-words text-sm">
                    {selectedApp.candidateId?.name || selectedApp.candidate?.name || 'Candidate'}
                  </p>
                  <p className="text-xs text-stone-500 break-words mt-0.5">
                    {selectedApp.jobId?.title || selectedApp.jobId?.role || 'Role'}
                    {selectedApp.stage ? ` · ${selectedApp.stage}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedApp(null)}
                  className="h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-stone-600 hover:text-brand-700 hover:border-brand-300 flex-shrink-0"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-[1]" />
                  <input
                    value={appQuery}
                    onChange={(e) => setAppQuery(e.target.value)}
                    className="field-premium field-premium-icon w-full !pr-9"
                    placeholder="Search by name, email, or role…"
                    autoFocus
                  />
                  {appQuery ? (
                    <button
                      type="button"
                      onClick={() => setAppQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                      aria-label="Clear search"
                    >
                      <X size={13} />
                    </button>
                  ) : null}
                </div>

                {searchingApps ? (
                  <div className="flex items-center gap-2 px-1 py-1 text-xs font-medium text-stone-500">
                    <Loader2 className="w-3.5 h-3.5 text-brand-600 animate-spin" /> Loading applications…
                  </div>
                ) : appResults.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-sm">
                    {appResults.map((a) => (
                      <button
                        key={a._id}
                        type="button"
                        onClick={() => setSelectedApp(a)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-brand-50/60 border-b border-stone-100 last:border-b-0 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {(a.candidateId?.name || a.candidate?.name || 'C').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-stone-900 truncate text-sm">
                            {a.candidateId?.name || a.candidate?.name || 'Candidate'}
                          </p>
                          <p className="text-[11px] text-stone-500 truncate">
                            {a.jobId?.title || a.jobId?.role || 'Role'} · {a.stage || 'Applied'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-500 px-0.5 leading-relaxed">
                    {appQuery.trim()
                      ? 'No match — try another name or email.'
                      : 'Type to search applications in your pipeline.'}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Schedule details */}
          <section className="space-y-3 border-t border-stone-100 pt-4">
            <div className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg bg-teal-50 border border-teal-100 text-teal-700 inline-flex items-center justify-center flex-shrink-0">
                <CalendarIcon size={14} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-stone-900 tracking-tight">Schedule details</p>
                <p className="text-[11px] text-stone-500">Date, time, format, and location</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="label-ats">Date *</label>
                <PremiumDatePicker
                  value={scheduleForm.scheduledDate}
                  onChange={(v) => setScheduleForm((f) => ({ ...f, scheduledDate: v }))}
                  placeholder="Select date"
                />
              </div>
              <div>
                <label className="label-ats">Time *</label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-[1]" />
                  <input
                    type="time"
                    className="field-premium field-premium-icon w-full [&::-webkit-calendar-picker-indicator]:opacity-50"
                    value={scheduleForm.scheduledTime}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, scheduledTime: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="label-ats">Interview type *</label>
                <PremiumSelect
                  variant="list"
                  value={scheduleForm.type}
                  onChange={(v) => setScheduleForm((f) => ({ ...f, type: v }))}
                  options={TYPE_OPTIONS}
                  placeholder="Select type"
                  icon={Video}
                  className="w-full"
                />
              </div>
              <div>
                <label className="label-ats">Duration *</label>
                <PremiumSelect
                  variant="list"
                  value={String(scheduleForm.duration || '60')}
                  onChange={(v) => setScheduleForm((f) => ({ ...f, duration: v }))}
                  options={DURATION_OPTIONS}
                  placeholder="Duration"
                  icon={Clock}
                  className="w-full"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label-ats">
                  {scheduleForm.type === 'in_person' ? 'Location / room' : scheduleForm.type === 'phone_screen' ? 'Phone notes' : 'Meeting link'}
                </label>
                <div className="relative">
                  {scheduleForm.type === 'in_person' ? (
                    <MapPin className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-[1]" />
                  ) : scheduleForm.type === 'phone_screen' ? (
                    <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-[1]" />
                  ) : (
                    <Link2 className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-[1]" />
                  )}
                  <input
                    className="field-premium field-premium-icon w-full"
                    value={scheduleForm.type === 'in_person' ? scheduleForm.location : scheduleForm.meetingLink}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (scheduleForm.type === 'in_person') {
                        setScheduleForm((f) => ({ ...f, location: v }));
                      } else {
                        setScheduleForm((f) => ({ ...f, meetingLink: v }));
                      }
                    }}
                    placeholder={
                      scheduleForm.type === 'in_person'
                        ? 'Office / room'
                        : scheduleForm.type === 'phone_screen'
                          ? 'Optional dial-in notes'
                          : 'https://meet.google.com/…'
                    }
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="label-ats">Notes (optional)</label>
                <input
                  className="field-premium w-full"
                  value={scheduleForm.remark}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, remark: e.target.value }))}
                  placeholder="Panel round, bring laptop…"
                />
              </div>
            </div>
          </section>
        </div>
      </Modal>

      <Modal
        open={showScorecard}
        onClose={() => setShowScorecard(false)}
        title="Interview Scorecard"
        description={scorecardTarget ? `${candidateName(scorecardTarget)} · ${jobName(scorecardTarget)}` : ''}
        size="xl"
        footer={
          <>
            <button type="button" onClick={() => setShowScorecard(false)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={handleScorecard} disabled={submittingScorecard || !recommendation} className="btn-primary">
              {submittingScorecard ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : 'Submit Scorecard'}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <div>
            <label className="label-ats mb-2">Scorecard template</label>
            <PremiumSelect
              variant="list"
              icon={FileText}
              value={selectedTemplateId}
              onChange={(v) => applyTemplateSelection(v || DEFAULT_TEMPLATE_VALUE)}
              options={templateOptions}
              placeholder={templatesLoading ? 'Loading templates…' : 'Choose a template'}
              searchable={templates.length > 5}
              searchPlaceholder="Search templates…"
              disabled={templatesLoading}
            />
            <p className="text-[11px] text-stone-400 mt-1.5 leading-snug">
              Templates come from Scorecard Templates. Weighted criteria affect the overall score.
              {templates.length === 0 && !templatesLoading
                ? ' No custom templates yet — using default criteria.'
                : ''}
            </p>
          </div>

          <div>
            <label className="label-ats mb-2">Overall Recommendation</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {RECS.map((rec) => (
                <button
                  key={rec.value}
                  type="button"
                  onClick={() => setRecommendation(rec.value)}
                  className={`py-2.5 px-2 text-xs font-semibold border rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/30 ${
                    recommendation === rec.value
                      ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm'
                      : 'border-stone-200 text-stone-600 hover:border-brand-300 hover:bg-brand-50/50'
                  }`}
                >
                  {rec.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="section-title-ats !mb-0">Criteria evaluation</h3>
              <span className="badge-brand text-[10px] tabular-nums">
                Weighted score ~{previewOverall}/5
              </span>
            </div>
            {templatesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 skeleton-ats rounded-2xl" />
                ))}
              </div>
            ) : (
              activeCriteria.map((criterion) => (
                <div key={criterion.key} className="bg-stone-50/80 p-4 rounded-2xl border border-stone-100">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-stone-800">{criterion.name}</span>
                        <span className="badge-neutral text-[10px] tabular-nums">×{criterion.weight}</span>
                      </div>
                      {criterion.description ? (
                        <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">{criterion.description}</p>
                      ) : null}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRatings((r) => ({ ...r, [criterion.key]: star }))}
                          className="p-0.5 touch-target"
                          aria-label={`Rate ${criterion.name} ${star} stars`}
                        >
                          <Star
                            className={`w-5 h-5 transition-colors ${
                              (ratings[criterion.key] || 0) >= star
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-stone-300 hover:text-amber-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    placeholder="Add notes…"
                    className="textarea-ats"
                    rows={2}
                    value={skillNotes[criterion.key] || ''}
                    onChange={(e) => setSkillNotes((n) => ({ ...n, [criterion.key]: e.target.value }))}
                  />
                </div>
              ))
            )}
          </div>

          <div>
            <label className="label-ats">Final Notes</label>
            <textarea
              placeholder="Overall summary, strengths, concerns…"
              className="textarea-ats resize-y"
              rows={4}
              value={finalNotes}
              onChange={(e) => setFinalNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        title="Cancel interview?"
        message={`Cancel the interview with ${candidateName(cancelTarget || {})}?`}
        confirmText="Cancel Interview"
        type="delete"
        isLoading={cancelling}
      />

      <InterviewTranscriptPanel
        interview={transcriptTarget}
        open={!!transcriptTarget}
        onClose={() => setTranscriptTarget(null)}
      />

    </>
  );
}
