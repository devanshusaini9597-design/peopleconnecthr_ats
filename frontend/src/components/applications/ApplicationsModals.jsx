import React, { useEffect, useState } from 'react';
import {
  Plus, Briefcase, Loader2, XCircle, Trash2, Calendar, Video, Phone, MapPin, Layers,
} from 'lucide-react';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';
import PremiumSelect from '../ui/PremiumSelect';
import PremiumDatePicker from '../ui/PremiumDatePicker';
import AddApplicationForm from './AddApplicationForm';
import { authenticatedFetch, readApiJson } from '../../utils/fetchUtils';

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
  selectedApp,
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
  const [rejectPools, setRejectPools] = useState([]);
  const [rejectPoolIds, setRejectPoolIds] = useState([]);
  const [rejectPoolsLoading, setRejectPoolsLoading] = useState(false);
  const [rejectOptedOut, setRejectOptedOut] = useState(false);

  useEffect(() => {
    if (!isRejectModalOpen || !selectedApp?._id) {
      setRejectPools([]);
      setRejectPoolIds([]);
      setRejectOptedOut(false);
      return undefined;
    }
    let cancelled = false;
    setRejectPoolsLoading(true);
    (async () => {
      try {
        const res = await authenticatedFetch(`/api/talent-pools/for-reject?applicationId=${encodeURIComponent(selectedApp._id)}`);
        const data = await readApiJson(res);
        if (cancelled) return;
        if (!res.ok || !data.success) {
          setRejectPools([]);
          return;
        }
        const pools = data.data?.pools || [];
        setRejectPools(pools);
        setRejectOptedOut(!!data.data?.optedOut);
        setRejectPoolIds(pools.filter((p) => p.suggested).map((p) => p._id));
      } catch {
        if (!cancelled) setRejectPools([]);
      } finally {
        if (!cancelled) setRejectPoolsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isRejectModalOpen, selectedApp?._id]);

  const toggleRejectPool = (id) => {
    setRejectPoolIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <>
      {/* Add Application */}
      <Modal
        open={isAddModalOpen}
        onClose={() => !adding && setIsAddModalOpen(false)}
        title="Add to pipeline"
        description="Pick someone from a matching talent pool, or add a new person (resume parse fills the fields)."
        size="lg"
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={adding} onClick={() => setIsAddModalOpen(false)}>Cancel</button>
            <button type="submit" form="add-app-form" className="btn-primary" disabled={adding || jobs.length === 0 || (addForm.mode !== 'new' && !addForm.candidateId)}>
              {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {adding ? 'Adding…' : 'Add to pipeline'}
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
              <AddApplicationForm addForm={addForm} setAddForm={setAddForm} jobOptions={jobOptions} />
            </>
          )}
        </form>
      </Modal>

      {/* Reject */}
      <Modal
        open={isRejectModalOpen}
        onClose={() => !rejecting && setIsRejectModalOpen(false)}
        title="Reject application?"
        description="This candidate will be removed from the active pipeline for this job only — they stay in your database."
        size="md"
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={rejecting} onClick={() => setIsRejectModalOpen(false)}>Cancel</button>
            <button
              type="button"
              className="btn-danger"
              disabled={rejecting}
              onClick={() => handleReject(rejectPools.length ? rejectPoolIds : undefined)}
            >
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
        {rejectPoolsLoading ? (
          <div className="flex items-center gap-2 mt-4 text-sm text-stone-500">
            <Loader2 size={14} className="animate-spin" /> Checking talent pools…
          </div>
        ) : rejectOptedOut ? (
          <p className="mt-4 text-xs text-stone-500">This person opted out of talent-pool retention.</p>
        ) : rejectPools.length > 0 ? (
          <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50/80 p-3 space-y-2">
            <p className="text-sm font-semibold text-stone-800 inline-flex items-center gap-1.5">
              <Layers size={14} className="text-brand-600" /> Keep for other roles
            </p>
            <p className="text-xs text-stone-500">
              Rejected here does not block another job. Suggested pools are ticked — e.g. Banking now, Finance later.
            </p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {rejectPools.map((p) => (
                <label key={p._id} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                    checked={rejectPoolIds.includes(p._id)}
                    onChange={() => toggleRejectPool(p._id)}
                  />
                  <span>
                    <span className="block text-sm font-medium text-stone-800">{p.name}</span>
                    <span className="block text-[11px] text-stone-500">
                      {[p.industry, p.product].filter(Boolean).join(' · ')
                        || (p.suggested ? 'Suggested from this profile' : 'Optional')}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : null}
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
