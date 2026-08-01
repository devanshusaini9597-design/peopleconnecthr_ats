import React, { useState, useEffect, useCallback } from 'react';
import { CalendarClock, Plus, Trash2, Lock, Loader2, Power } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
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

const ScheduleModal = ({ onClose, onSave, saving }) => {
  const [form, setForm] = useState(emptyForm);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-stone-900/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl sm:rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col border border-stone-200/60 shadow-2xl modal-panel-ats overflow-hidden">
        <div className="p-5 border-b border-stone-100"><h3 className="text-lg font-bold text-stone-900">New Scheduled Report</h3></div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="text-sm font-medium text-stone-700">Schedule name</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Weekly recruiter summary" className="mt-1 input-ats" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-stone-700">Report</label>
              <select value={form.reportType} onChange={(e) => set('reportType', e.target.value)} className="mt-1 input-ats">
                {REPORT_TYPES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700">Format</label>
              <select value={form.format} onChange={(e) => set('format', e.target.value)} className="mt-1 input-ats">
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700">Date range</label>
              <select value={form.dateRange} onChange={(e) => set('dateRange', e.target.value)} className="mt-1 input-ats">
                <option value="week">Last 7 days</option>
                <option value="month">This month</option>
                <option value="quarter">This quarter</option>
                <option value="year">This year</option>
                <option value="all">All time</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700">Frequency</label>
              <select value={form.frequency} onChange={(e) => set('frequency', e.target.value)} className="mt-1 input-ats">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-stone-700">Recipients (comma-separated emails)</label>
            <input value={form.recipients} onChange={(e) => set('recipients', e.target.value)} placeholder="hr@company.com, cfo@company.com" className="mt-1 input-ats" />
          </div>
        </div>
        <div className="p-5 border-t border-stone-100 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={() => onSave({ ...form, recipients: form.recipients.split(',').map((r) => r.trim()).filter(Boolean) })}
            disabled={saving || !form.name.trim()}
            className="btn-primary"
          >
            {saving ? 'Creating…' : 'Create Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function ScheduledReportsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const remove = async (schedule) => {
    if (!window.confirm(`Delete the "${schedule.name}" schedule?`)) return;
    const res = await authenticatedFetch(`/api/report-schedules/${schedule._id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) { toast?.success?.('Deleted'); load(); } else toast?.error?.(data.message);
  };

  if (loading) return <div className="page-shell-ats"><div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 text-brand-600 animate-spin" /></div></div>;

  if (upgradeRequired) {
    return (
      <div className="page-shell-ats">
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="max-w-md w-full text-center card-ats-bordered border-amber-200/80 bg-amber-50/30 p-10">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4"><Lock className="w-7 h-7 text-amber-600" /></div>
            <h2 className="text-xl font-bold text-stone-900">Scheduled Reports is an Enterprise feature</h2>
            <p className="text-stone-500 mt-2 text-sm">Upgrade to Enterprise to automatically email reports on a recurring cadence.</p>
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
            <div key={s._id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-stone-900">{s.name}</div>
                <div className="text-xs text-stone-400 mt-0.5">
                  {REPORT_TYPES.find((r) => r.id === s.reportType)?.label || s.reportType} · {s.frequency} · {s.recipients.join(', ')}
                </div>
                {s.lastRunAt && (
                  <div className={`text-xs mt-1 ${s.lastRunStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    Last run: {s.lastRunStatus} ({new Date(s.lastRunAt).toLocaleString()})
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className={`text-xs px-2 py-0.5 rounded-full mr-2 ${s.isActive ? 'bg-green-50 text-green-700' : 'bg-stone-100 text-stone-500'}`}>{s.isActive ? 'Active' : 'Paused'}</span>
                <button onClick={() => toggle(s)} className="p-2 hover:bg-stone-100 rounded-lg text-stone-500" title={s.isActive ? 'Pause' : 'Resume'}><Power className="w-4 h-4" /></button>
                <button onClick={() => remove(s)} className="p-2 hover:bg-red-50 rounded-lg text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>

      {showModal && <ScheduleModal onClose={() => setShowModal(false)} onSave={create} saving={saving} />}
    </div>
  );
}
