import React from 'react';
import {
  X, Mail, Phone, Clock, Star, Calendar, FileText, Trash2, Save, Loader2, Video, Target, XCircle,
} from 'lucide-react';
import { ShieldCheck, FileSignature } from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import { STAGES, classNames, jobTitle } from './constants';

export default function ApplicationDetailPanel({
  selectedApp,
  selectedJob,
  closePanel,
  handleStageChange,
  setScheduleForm,
  setIsScheduleOpen,
  hasBackgroundCheck,
  hasEsign,
  enterpriseActionLoading,
  orderBackgroundCheck,
  sendForEsign,
  setIsRejectModalOpen,
  handleRatingChange,
  noteDraft,
  setNoteDraft,
  setDeleteTarget,
  handleSaveNote,
  savingNote,
}) {
  return (
    <>
      <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-40" onClick={closePanel} aria-hidden />
      <div className="fixed inset-y-0 right-0 w-full sm:max-w-md md:max-w-[480px] bg-white shadow-2xl z-50 flex flex-col animate-slide-up border-l border-stone-200/60">
        <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 flex-shrink-0" />
        <div className="px-4 sm:px-5 py-4 border-b border-stone-100 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center font-bold text-lg flex-shrink-0 shadow-md shadow-brand-500/25">
              {(selectedApp.candidate?.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-stone-900 truncate tracking-tight">{selectedApp.candidate?.name}</h2>
              <p className="text-sm text-stone-500 truncate">{jobTitle(selectedApp.job) || jobTitle(selectedJob)}</p>
            </div>
          </div>
          <button type="button" onClick={closePanel} className="p-2.5 hover:bg-stone-100 rounded-xl text-stone-400 hover:text-stone-600 transition-colors flex-shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          <div className="flex flex-wrap gap-2 items-center">
            <PremiumSelect
              variant="list"
              className="w-full sm:w-44"
              value={selectedApp.stage}
              onChange={(v) => handleStageChange(selectedApp._id, v)}
              options={STAGES.map((s) => ({
                value: s.id,
                label: s.label,
                icon: s.icon,
              }))}
              placeholder="Stage"
              icon={Target}
            />

            <button
              type="button"
              onClick={() => {
                const existing = selectedApp.metadata?.interview?.scheduledAt;
                const d = existing ? new Date(existing) : new Date(Date.now() + 86400000);
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const hh = String(d.getHours()).padStart(2, '0');
                const mm = String(d.getMinutes()).padStart(2, '0');
                setScheduleForm({
                  scheduledDate: `${y}-${m}-${day}`,
                  scheduledTime: existing ? `${hh}:${mm}` : '10:00',
                  mode: selectedApp.metadata?.interview?.mode || 'Video',
                  location: selectedApp.metadata?.interview?.location || '',
                  remark: '',
                });
                setIsScheduleOpen(true);
              }}
              className="btn-secondary !py-2 !px-3 !text-xs !h-[42px]"
            >
              <Calendar className="w-3.5 h-3.5" /> Schedule
            </button>

            {hasBackgroundCheck && (
              <button
                type="button"
                onClick={() => orderBackgroundCheck(selectedApp._id)}
                disabled={enterpriseActionLoading || selectedApp.backgroundCheck?.status === 'pending'}
                className="btn-secondary !py-2 !px-3 !text-xs !border-emerald-200 !text-emerald-700 hover:!bg-emerald-50"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {selectedApp.backgroundCheck?.status === 'pending' ? 'Check pending…' : 'BG Check'}
              </button>
            )}

            {hasEsign && (
              <button
                type="button"
                onClick={() => sendForEsign(selectedApp._id)}
                disabled={enterpriseActionLoading || selectedApp.esign?.status === 'sent'}
                className="btn-secondary !py-2 !px-3 !text-xs !border-rose-200 !text-rose-700 hover:!bg-rose-50"
              >
                <FileSignature className="w-3.5 h-3.5" />
                {selectedApp.esign?.status === 'sent' ? 'Sent' : 'e-Sign'}
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsRejectModalOpen(true)}
              className="btn-secondary !py-2 !px-3 !text-xs !border-red-200 !text-red-600 hover:!bg-red-50 ml-auto"
            >
              <XCircle className="w-3.5 h-3.5" /> Reject
            </button>
          </div>

          {selectedApp.metadata?.interview?.scheduledAt && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/70 px-3.5 py-3 text-sm text-violet-800 flex items-start gap-2.5">
              <Video className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold text-xs uppercase tracking-wide text-violet-600 mb-0.5">Interview scheduled</p>
                <p className="font-medium">{new Date(selectedApp.metadata.interview.scheduledAt).toLocaleString()}</p>
                <p className="text-xs text-violet-600 mt-0.5">
                  {selectedApp.metadata.interview.mode}
                  {selectedApp.metadata.interview.location ? ` · ${selectedApp.metadata.interview.location}` : ''}
                </p>
              </div>
            </div>
          )}

          <div>
            <h3 className="section-title-ats !mb-3">Candidate Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-stone-600">
                <Mail className="w-4 h-4 text-stone-400 flex-shrink-0" />
                <a href={`mailto:${selectedApp.candidate?.email}`} className="hover:text-brand-600 truncate">{selectedApp.candidate?.email || '—'}</a>
              </div>
              {(selectedApp.candidate?.phone || selectedApp.candidate?.contact) && (
                <div className="flex items-center gap-3 text-stone-600">
                  <Phone className="w-4 h-4 text-stone-400 flex-shrink-0" />
                  <a href={`tel:${selectedApp.candidate?.phone || selectedApp.candidate?.contact}`} className="hover:text-brand-600">
                    {selectedApp.candidate?.phone || selectedApp.candidate?.contact}
                  </a>
                </div>
              )}
              <div className="flex items-center gap-3 text-stone-600">
                <Clock className="w-4 h-4 text-stone-400 flex-shrink-0" />
                Applied {selectedApp.createdAt || selectedApp.appliedAt
                  ? new Date(selectedApp.createdAt || selectedApp.appliedAt).toLocaleString()
                  : '—'}
              </div>
              <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                <span className="text-xs font-semibold text-stone-500 mr-1">Rating</span>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} type="button" onClick={() => handleRatingChange(selectedApp._id, star)} className="p-0.5">
                    <Star className={classNames('w-4 h-4', star <= (selectedApp.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-stone-300')} />
                  </button>
                ))}
              </div>
              {(selectedApp.resumeUrl || selectedApp.candidate?.resume) && (
                <a
                  href={selectedApp.resumeUrl || selectedApp.candidate?.resume}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 mt-2 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-sm font-semibold transition-colors"
                >
                  <FileText className="w-4 h-4" /> View Resume
                </a>
              )}
            </div>
          </div>

          <div>
            <h3 className="section-title-ats !mb-3">Notes</h3>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Add a note about this candidate…"
              className="textarea-ats min-h-[110px]"
            />
            <div className="flex justify-between items-center mt-2 gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(selectedApp)}
                className="btn-ghost !py-1.5 !px-2.5 !text-xs text-red-600 hover:!bg-red-50"
              >
                <Trash2 size={14} /> Delete
              </button>
              <button type="button" onClick={handleSaveNote} disabled={savingNote} className="btn-primary !py-1.5 !text-xs">
                {savingNote ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {savingNote ? 'Saving…' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
