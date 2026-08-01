import React, { useState, useEffect, useCallback } from 'react';
import { CalendarClock, Plus, Trash2, Lock, Loader2, Power } from 'lucide-react';
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl">
        <div className="p-5 border-b border-gray-100"><h3 className="text-lg font-bold text-gray-900">New Scheduled Report</h3></div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="text-sm font-medium text-gray-700">Schedule name</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Weekly recruiter summary" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Report</label>
              <select value={form.reportType} onChange={(e) => set('reportType', e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                {REPORT_TYPES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Format</label>
              <select value={form.format} onChange={(e) => set('format', e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Date range</label>
              <select value={form.dateRange} onChange={(e) => set('dateRange', e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="week">Last 7 days</option>
                <option value="month">This month</option>
                <option value="quarter">This quarter</option>
                <option value="year">This year</option>
                <option value="all">All time</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Frequency</label>
              <select value={form.frequency} onChange={(e) => set('frequency', e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Recipients (comma-separated emails)</label>
            <input value={form.recipients} onChange={(e) => set('recipients', e.target.value)} placeholder="hr@company.com, cfo@company.com" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button
            onClick={() => onSave({ ...form, recipients: form.recipients.split(',').map((r) => r.trim()).filter(Boolean) })}
            disabled={saving || !form.name.trim()}
            className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
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

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 text-gray-400 animate-spin" /></div>;

  if (upgradeRequired) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-white border border-gray-200 rounded-2xl p-10 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4"><Lock className="w-7 h-7 text-amber-600" /></div>
          <h2 className="text-xl font-bold text-gray-900">Scheduled Reports is an Enterprise feature</h2>
          <p className="text-gray-500 mt-2 text-sm">Upgrade to Enterprise to automatically email reports on a recurring cadence.</p>
          <a href="/billing" className="inline-block mt-6 px-5 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors">View Plans</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 pb-20">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2"><CalendarClock className="w-6 h-6 text-gray-400" /> Scheduled Reports</h1>
            <p className="text-gray-500 mt-1 text-sm">Automatically email reports to your team or stakeholders on a recurring cadence.</p>
          </div>
          <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Schedule
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {schedules.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              <CalendarClock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p>No scheduled reports yet.</p>
            </div>
          ) : schedules.map((s) => (
            <div key={s._id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">{s.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {REPORT_TYPES.find((r) => r.id === s.reportType)?.label || s.reportType} · {s.frequency} · {s.recipients.join(', ')}
                </div>
                {s.lastRunAt && (
                  <div className={`text-xs mt-1 ${s.lastRunStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    Last run: {s.lastRunStatus} ({new Date(s.lastRunAt).toLocaleString()})
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className={`text-xs px-2 py-0.5 rounded-full mr-2 ${s.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{s.isActive ? 'Active' : 'Paused'}</span>
                <button onClick={() => toggle(s)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500" title={s.isActive ? 'Pause' : 'Resume'}><Power className="w-4 h-4" /></button>
                <button onClick={() => remove(s)} className="p-2 hover:bg-red-50 rounded-lg text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && <ScheduleModal onClose={() => setShowModal(false)} onSave={create} saving={saving} />}
    </div>
  );
}
