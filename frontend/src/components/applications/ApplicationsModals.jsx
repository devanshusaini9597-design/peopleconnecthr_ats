import React from 'react';
import {
  Plus, User, Mail, Phone, Briefcase, Loader2, XCircle, Trash2, Calendar, Video, MapPin,
} from 'lucide-react';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';
import PremiumSelect from '../ui/PremiumSelect';
import PremiumDatePicker from '../ui/PremiumDatePicker';
import { SOURCE_OPTIONS } from './constants';

export default function ApplicationsModals({
  isAddModalOpen,
  setIsAddModalOpen,
  adding,
  handleAddApplication,
  jobs,
  addForm,
  setAddForm,
  jobOptions,
  isRejectModalOpen,
  setIsRejectModalOpen,
  rejecting,
  handleReject,
  rejectReason,
  setRejectReason,
  isScheduleOpen,
  setIsScheduleOpen,
  scheduling,
  handleSchedule,
  scheduleForm,
  setScheduleForm,
  deleteTarget,
  setDeleteTarget,
  deleting,
  handleDeleteApp,
}) {
  return (
    <>
      {/* Add Application */}
      <Modal
        open={isAddModalOpen}
        onClose={() => !adding && setIsAddModalOpen(false)}
        title="Add Application"
        description="Create a pipeline entry for a candidate on a job."
        size="lg"
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={adding} onClick={() => setIsAddModalOpen(false)}>Cancel</button>
            <button type="submit" form="add-app-form" className="btn-primary" disabled={adding || jobs.length === 0}>
              {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {adding ? 'Adding…' : 'Submit'}
            </button>
          </>
        }
      >
        <form id="add-app-form" onSubmit={handleAddApplication} className="space-y-5">
          {jobs.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              tone="violet"
              compact
              message="No open jobs"
              subMessage="Post a role from Job Openings before adding applications."
            />
          ) : (
            <>
              <div>
                <label className="label-ats">Job *</label>
                <PremiumSelect
                  variant="list"
                  value={addForm.jobId}
                  onChange={(v) => setAddForm({ ...addForm, jobId: v })}
                  options={jobOptions}
                  placeholder="Select a job"
                  icon={Briefcase}
                  searchable
                  searchPlaceholder="Search jobs…"
                  emptyLabel="No jobs found"
                />
              </div>
              <div>
                <label className="label-ats">Candidate Name *</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                  <input
                    required
                    type="text"
                    className="field-premium field-premium-icon"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    placeholder="Full name"
                    autoComplete="name"
                  />
                </div>
              </div>
              <div>
                <label className="label-ats">Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                  <input
                    required
                    type="email"
                    className="field-premium field-premium-icon"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    placeholder="name@email.com"
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-ats">Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                    <input
                      type="tel"
                      className="field-premium field-premium-icon"
                      value={addForm.phone}
                      onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                      placeholder="Optional"
                      autoComplete="tel"
                    />
                  </div>
                </div>
                <div>
                  <label className="label-ats">Source</label>
                  <PremiumSelect
                    variant="list"
                    value={addForm.source}
                    onChange={(v) => setAddForm({ ...addForm, source: v || 'Direct' })}
                    options={SOURCE_OPTIONS}
                    placeholder="Select source"
                    icon={User}
                  />
                </div>
              </div>
            </>
          )}
        </form>
      </Modal>

      {/* Reject */}
      <Modal
        open={isRejectModalOpen}
        onClose={() => !rejecting && setIsRejectModalOpen(false)}
        title="Reject application?"
        description="This candidate will be removed from the active pipeline."
        size="sm"
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={rejecting} onClick={() => setIsRejectModalOpen(false)}>Cancel</button>
            <button type="button" className="btn-danger" disabled={rejecting} onClick={handleReject}>
              {rejecting ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
              {rejecting ? 'Rejecting…' : 'Confirm Reject'}
            </button>
          </>
        }
      >
        <label className="label-ats">Reason (optional)</label>
        <textarea
          className="textarea-ats h-24"
          placeholder="e.g. Skills mismatch, role filled…"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>

      {/* Schedule */}
      <Modal
        open={isScheduleOpen}
        onClose={() => !scheduling && setIsScheduleOpen(false)}
        title="Schedule interview"
        description="Set a time and mode — we'll move them to Interview if needed."
        size="md"
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={scheduling} onClick={() => setIsScheduleOpen(false)}>Cancel</button>
            <button type="submit" form="schedule-form" className="btn-primary" disabled={scheduling}>
              {scheduling ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}
              {scheduling ? 'Saving…' : 'Save Schedule'}
            </button>
          </>
        }
      >
        <form id="schedule-form" onSubmit={handleSchedule} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-ats">Date *</label>
              <PremiumDatePicker
                value={scheduleForm.scheduledDate}
                onChange={(v) => setScheduleForm({ ...scheduleForm, scheduledDate: v })}
                placeholder="Select date"
              />
            </div>
            <div>
              <label className="label-ats">Time *</label>
              <input
                required
                type="time"
                className="field-premium"
                value={scheduleForm.scheduledTime}
                onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledTime: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-ats">Mode</label>
              <PremiumSelect
                variant="list"
                value={scheduleForm.mode}
                onChange={(v) => setScheduleForm({ ...scheduleForm, mode: v })}
                options={[
                  { value: 'Video', label: 'Video', icon: Video },
                  { value: 'Phone', label: 'Phone', icon: Phone },
                  { value: 'On-site', label: 'On-site', icon: MapPin },
                  { value: 'Hybrid', label: 'Hybrid', icon: Briefcase },
                ]}
                placeholder="Mode"
                icon={Video}
              />
            </div>
            <div>
              <label className="label-ats">Location / link</label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                <input
                  type="text"
                  className="field-premium field-premium-icon"
                  placeholder="Zoom / office"
                  value={scheduleForm.location}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div>
            <label className="label-ats">Remark</label>
            <input
              type="text"
              className="field-premium"
              placeholder="Optional note"
              value={scheduleForm.remark}
              onChange={(e) => setScheduleForm({ ...scheduleForm, remark: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Delete */}
      <Modal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete application?"
        description="This permanently removes the pipeline entry."
        size="sm"
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button type="button" className="btn-danger" disabled={deleting} onClick={handleDeleteApp}>
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </>
        }
      >
        <p className="text-sm text-stone-600">
          Remove <strong>{deleteTarget?.candidate?.name}</strong> from this pipeline?
        </p>
      </Modal>
    </>
  );
}
