import React, { useState, useEffect, useCallback } from 'react';
import { CalendarClock, Plus, Trash2, Lock, Loader2, Power, Mail, FileSpreadsheet } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import Modal from './ui/Modal';
import PremiumSelect from './ui/PremiumSelect';
import ConfirmationModal from './ConfirmationModal';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';

const REPORT_TYPES = [
  { id: 'recruitment-summary', label: 'Recruitment Summary', description: 'Overall hiring snapshot' },
  { id: 'source-performance', label: 'Source Performance', description: 'Channel ROI' },
  { id: 'position-report', label: 'Position-wise Report', description: 'By role' },
  { id: 'client-report', label: 'Client Report', description: 'By client' },
  { id: 'pipeline-status', label: 'Pipeline Status', description: 'Stage breakdown' },
];

const FORMAT_OPTIONS = [
  { value: 'xlsx', label: 'Excel (.xlsx)', description: 'Spreadsheet', icon: FileSpreadsheet },
  { value: 'pdf', label: 'PDF', description: 'Document', icon: FileSpreadsheet },
];

const RANGE_OPTIONS = [
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];

const FREQ_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
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
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancel</button>
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
      <div className="space-y-3">
        <div>
          <label className="label-ats">Schedule name *</label>
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
            <PremiumSelect
              value={form.reportType}
              onChange={(v) => set('reportType', v || 'recruitment-summary')}
              options={REPORT_TYPES.map((r) => ({ value: r.id, label: r.label, description: r.description }))}
              placeholder="Select report"
              searchable
              compact
            />
          </div>
          <div>
            <label className="label-ats">Format</label>
            <PremiumSelect
              value={form.format}
              onChange={(v) => set('format', v || 'xlsx')}
              options={FORMAT_OPTIONS}
              placeholder="Format"
              compact
            />
          </div>
          <div>
            <label className="label-ats">Date range</label>
            <PremiumSelect
              value={form.dateRange}
              onChange={(v) => set('dateRange', v || 'month')}
              options={RANGE_OPTIONS}
              placeholder="Range"
              compact
            />
          </div>
          <div>
            <label className="label-ats">Frequency</label>
            <PremiumSelect
              value={form.frequency}
              onChange={(v) => set('frequency', v || 'weekly')}
              options={FREQ_OPTIONS}
              placeholder="Frequency"
              compact
            />
          </div>
        </div>
        <div>
          <label className="label-ats">Recipients</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              value={form.recipients}
              onChange={(e) => set('recipients', e.target.value)}
              placeholder="hr@company.com, cfo@company.com"
              className="input-ats !pl-10"
            />
          </div>
          <p className="text-[11px] text-stone-400 mt-1.5 font-medium">Comma-separated email addresses</p>
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
      <div className="page-shell-ats animate-page-enter">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl skeleton-ats flex-shrink-0" />
          <div className="space-y-2 flex-1 pt-1">
            <div className="h-7 w-52 skeleton-ats rounded-lg" />
            <div className="h-4 w-72 max-w-full skeleton-ats rounded-lg" />
          </div>
        </div>
        <div className="card-ats-bordered divide-y divide-stone-100 overflow-hidden mt-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl skeleton-ats" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 skeleton-ats rounded-lg" />
                <div className="h-3 w-56 skeleton-ats rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (upgradeRequired) {
    return (
      <div className="page-shell-ats animate-page-enter">
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
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={CalendarClock}
        title="Scheduled Reports"
        subtitle="Automatically email reports to your team on a recurring cadence."
        gradientTitle
      >
        <button type="button" onClick={() => setShowModal(true)} className="btn-primary flex-1 sm:flex-none">
          <Plus className="w-4 h-4" /> New Schedule
        </button>
      </PageHeader>

      {schedules.length === 0 ? (
        <div className="card-ats-bordered">
          <EmptyState
            icon={CalendarClock}
            tone="sky"
            message="No scheduled reports yet"
            subMessage="Create a schedule to automatically email reports on a recurring cadence."
            action={
              <button type="button" onClick={() => setShowModal(true)} className="btn-primary">
                <Plus className="w-4 h-4" /> New Schedule
              </button>
            }
          />
        </div>
      ) : (
        <div className="card-ats-bordered overflow-hidden divide-y divide-stone-100 relative">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          {schedules.map((s) => (
            <div key={s._id} className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-brand-50/20 transition-colors">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  s.isActive ? 'bg-brand-50 text-brand-600 border border-brand-100' : 'bg-stone-100 text-stone-400 border border-stone-200'
                }`}>
                  <CalendarClock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-stone-900 text-sm tracking-tight">{s.name}</div>
                  <div className="text-xs text-stone-400 mt-0.5 leading-relaxed">
                    {REPORT_TYPES.find((r) => r.id === s.reportType)?.label || s.reportType}
                    {' · '}
                    <span className="capitalize">{s.frequency}</span>
                    {s.recipients?.length ? ` · ${s.recipients.join(', ')}` : ''}
                  </div>
                  {s.lastRunAt && (
                    <div className={`text-xs mt-1.5 font-medium ${s.lastRunStatus === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                      Last run: {s.lastRunStatus} · {new Date(s.lastRunAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 pl-12 sm:pl-0">
                <span className={`mr-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                  s.isActive
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-stone-100 text-stone-500 border-stone-200'
                }`}>
                  {s.isActive ? 'Active' : 'Paused'}
                </span>
                <button
                  type="button"
                  onClick={() => toggle(s)}
                  className="p-2 rounded-xl hover:bg-stone-100 text-stone-500 transition-colors"
                  title={s.isActive ? 'Pause' : 'Resume'}
                >
                  <Power className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(s)}
                  className="p-2 rounded-xl hover:bg-red-50 text-red-500 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
