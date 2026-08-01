import React, { useState, useEffect, useCallback } from 'react';
import { CalendarClock, Plus, Trash2, Lock, Loader2, Power } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import Modal from './ui/Modal';
import ConfirmationModal from './ConfirmationModal';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';

const REPORT_TYPES = [
  { id: 'recruitment-summary', label: 'Recruitment Summary' },
  { id: 'source-performance', label: 'Source Performance' },
  { id: 'position-report', label: 'Position-wise Report' },
  { id: 'client-report', label: 'Client Report' },
  { id: 'pipeline-status', label: 'Pipeline Status' }
];

const emptyForm = { name: '', reportType: 'recruitment-summary', format: 'xlsx', dateRange: 'month', frequency: 'weekly', recipients: '' };

const ScheduleModal = ({ open, onClose, onSave, saving }) => {
  const [form, setForm] = useState(emptyForm);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (open) setForm(emptyForm);
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Scheduled Report"
      description="Email a report to your team on a recurring cadence."
      size="md"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            type="button"
            onClick={() => onSave({ ...form, recipients: form.recipients.split(',').map((r) => r.trim()).filter(Boolean) })}
            disabled={saving || !form.name.trim()}
            className="btn-primary"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : 'Create Schedule'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label-ats">Schedule name</label>
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Weekly recruiter summary"
            className="input-ats"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label-ats">Report</label>
            <select value={form.reportType} onChange={(e) => set('reportType', e.target.value)} className="input-ats">
              {REPORT_TYPES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label-ats">Format</label>
            <select value={form.format} onChange={(e) => set('format', e.target.value)} className="input-ats">
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
          <div>
            <label className="label-ats">Date range</label>
            <select value={form.dateRange} onChange={(e) => set('dateRange', e.target.value)} className="input-ats">
              <option value="week">Last 7 days</option>
              <option value="month">This month</option>
              <option value="quarter">This quarter</option>
              <option value="year">This year</option>
              <option value="all">All time</option>
            </select>
          </div>
          <div>
            <label className="label-ats">Frequency</label>
            <select value={form.frequency} onChange={(e) => set('frequency', e.target.value)} className="input-ats">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label-ats">Recipients (comma-separated emails)</label>
          <input
            value={form.recipients}
            onChange={(e) => set('recipients', e.target.value)}
            placeholder="hr@company.com, cfo@company.com"
            className="input-ats"
          />
        </div>
      </div>
    </Modal>
  );
};

export default function ScheduledReportsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/report-schedules');
      if (res.status === 401) return handleUnauthorized();
      const data = await res.json();
      if (res.status === 403 && data.code === 'UPGRADE_REQUIRED') { setUpgradeRequired(true); return; }
      if (data.success) setSchedules(data.data || []);
    } catch (err) {
      toast?.error?.('Failed to load scheduled reports');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const create = async (form) => {
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/report-schedules', { method: 'POST', body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok || !data.success) { toast?.error?.(data.message || 'Failed to create schedule'); return; }
      toast?.success?.('Schedule created');
      setShowModal(false);
      load();
    } catch (err) {
      toast?.error?.('Failed to create schedule');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (schedule) => {
    const res = await authenticatedFetch(`/api/report-schedules/${schedule._id}`, { method: 'PUT', body: JSON.stringify({ isActive: !schedule.isActive }) });
    const data = await res.json();
    if (data.success) load(); else toast?.error?.(data.message);
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authenticatedFetch(`/api/report-schedules/${deleteTarget._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast?.success?.('Deleted');
        setDeleteTarget(null);
        load();
      } else {
        toast?.error?.(data.message);
      }
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell-ats">
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
          <p className="text-sm text-stone-500 font-medium">Loading scheduled reports…</p>
        </div>
      </div>
    );
  }

  if (upgradeRequired) {
    return (
      <div className="page-shell-ats">
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center card-ats-bordered border-amber-200/80 bg-amber-50/40 p-8 sm:p-10 animate-slide-up">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4 ring-4 ring-amber-100/60">
              <Lock className="w-7 h-7 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">Scheduled Reports is an Enterprise feature</h2>
            <p className="text-stone-500 mt-2 text-sm leading-relaxed">
              Upgrade to Enterprise to automatically email reports on a recurring cadence.
            </p>
            <a href="/billing" className="btn-primary inline-flex mt-6">View Plans</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-ats max-w-4xl">
      <PageHeader
        icon={CalendarClock}
        title="Scheduled Reports"
        subtitle="Automatically email reports to your team or stakeholders on a recurring cadence."
        gradientTitle
      >
        <button type="button" onClick={() => setShowModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> New Schedule
        </button>
      </PageHeader>

      <div className="card-ats-bordered divide-y divide-stone-100 overflow-hidden">
        {schedules.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            message="No scheduled reports yet."
            subMessage="Create a schedule to automatically email reports on a recurring cadence."
            action={
              <button type="button" onClick={() => setShowModal(true)} className="btn-primary">
                <Plus className="w-4 h-4" /> New Schedule
              </button>
            }
          />
        ) : schedules.map((s) => (
          <div key={s._id} className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-brand-50/20 transition-colors">
            <div className="min-w-0">
              <div className="font-semibold text-stone-900">{s.name}</div>
              <div className="text-xs text-stone-400 mt-0.5 leading-relaxed">
                {REPORT_TYPES.find((r) => r.id === s.reportType)?.label || s.reportType} · {s.frequency} · {s.recipients.join(', ')}
              </div>
              {s.lastRunAt && (
                <div className={`text-xs mt-1.5 ${s.lastRunStatus === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                  Last run: {s.lastRunStatus} ({new Date(s.lastRunAt).toLocaleString()})
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className={`mr-2 ${s.isActive ? 'badge-success' : 'badge-neutral'}`}>
                {s.isActive ? 'Active' : 'Paused'}
              </span>
              <button
                type="button"
                onClick={() => toggle(s)}
                className="p-2.5 hover:bg-stone-100 rounded-xl text-stone-500 transition-colors touch-target"
                title={s.isActive ? 'Pause' : 'Resume'}
              >
                <Power className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(s)}
                className="p-2.5 hover:bg-red-50 rounded-xl text-stone-400 hover:text-red-500 transition-colors touch-target"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ScheduleModal open={showModal} onClose={() => setShowModal(false)} onSave={create} saving={saving} />
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        title="Delete schedule?"
        message={`Delete the "${deleteTarget?.name}" schedule?`}
        confirmText="Delete"
        type="delete"
        isLoading={deleting}
      />
    </div>
  );
}
