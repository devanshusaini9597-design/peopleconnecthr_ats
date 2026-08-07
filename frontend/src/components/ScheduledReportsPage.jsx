import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CalendarClock, Plus, Trash2, Lock, Loader2, Power, Mail,
  Info, Search, Filter, X, Clock,
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import PremiumSelect from './ui/PremiumSelect';
import ConfirmationModal from './ConfirmationModal';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import {
  SCHED_TOUR_KEY, SCHED_TOUR_STEPS, REPORT_TYPES,
  STATUS_FILTER_OPTIONS, reportLabel,
} from './scheduledReports/scheduledReportsConstants';
import ScheduleModal from './scheduledReports/ScheduleModal';


export default function ScheduledReportsPage() {
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(SCHED_TOUR_KEY);
  const [loading, setLoading] = useState(true);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/report-schedules');
      if (res.status === 401) return handleUnauthorized();
      const data = await res.json();
      if (res.status === 403 && data.code === 'UPGRADE_REQUIRED') {
        setUpgradeRequired(true);
        return;
      }
      if (data.success) setSchedules(data.data || []);
    } catch (err) {
      toast?.error?.('Failed to load scheduled reports');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const res = await authenticatedFetch('/api/organization/members');
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data?.data || []);
      setMembers(
        list
          .filter((m) => m.email)
          .map((m) => ({
            _id: m._id,
            name: m.name || '',
            email: (m.email || '').toLowerCase(),
            role: m.role || '',
          }))
          .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email))
      );
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => { load(); loadMembers(); }, [load, loadMembers]);

  useEffect(() => {
    if (showModal && members.length === 0 && !membersLoading) loadMembers();
  }, [showModal, members.length, membersLoading, loadMembers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return schedules.filter((s) => {
      if (statusFilter === 'active' && !s.isActive) return false;
      if (statusFilter === 'paused' && s.isActive) return false;
      if (!q) return true;
      const hay = `${s.name || ''} ${reportLabel(s.reportType)} ${(s.recipients || []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [schedules, query, statusFilter]);

  const create = async (form) => {
    if (!form.recipients?.length) {
      toast?.error?.('Add at least one recipient');
      return;
    }
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/report-schedules', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to create schedule');
        return;
      }
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
    setTogglingId(schedule._id);
    try {
      const res = await authenticatedFetch(`/api/report-schedules/${schedule._id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !schedule.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        toast?.success?.(schedule.isActive ? 'Schedule paused' : 'Schedule resumed');
        load();
      } else {
        toast?.error?.(data.message);
      }
    } catch {
      toast?.error?.('Failed to update schedule');
    } finally {
      setTogglingId(null);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authenticatedFetch(`/api/report-schedules/${deleteTarget._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast?.success?.('Schedule deleted');
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

      <div
        data-tour="sched-tip"
        className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1.5"
      >
        <span className="inline-flex items-center gap-1.5 text-brand-700 font-semibold">
          <Info size={14} /> Tip
        </span>
        <span>
          Recipients can be teammates (auto-suggested) or any external email. Pause anytime with the power control.
          Press <span className="font-semibold text-stone-800">?</span> for a tour.
        </span>
      </div>

      {schedules.length > 0 && (
        <div
          data-tour="sched-filters"
          className="rounded-xl border border-stone-200/90 bg-white shadow-sm overflow-hidden"
        >
          <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="input-ats input-ats-icon"
                placeholder="Search schedules, reports, or emails…"
                aria-label="Search schedules"
              />
            </div>
            <div className="sm:w-44 flex-shrink-0">
              <PremiumSelect
                compact
                value={statusFilter}
                onChange={(v) => setStatusFilter(v || 'all')}
                options={STATUS_FILTER_OPTIONS}
                placeholder="Status"
                icon={Filter}
                variant="list"
              />
            </div>
          </div>
        </div>
      )}

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
      ) : filtered.length === 0 ? (
        <div className="card-ats-bordered">
          <EmptyState
            icon={Search}
            message="No schedules match"
            subMessage="Try a different search or status filter."
          />
        </div>
      ) : (
        <div className="card-ats-bordered overflow-hidden divide-y divide-stone-100 relative">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          {filtered.map((s) => {
            const recipientPreview = (s.recipients || []).slice(0, 2).join(', ');
            const extra = (s.recipients || []).length > 2 ? ` +${s.recipients.length - 2}` : '';
            return (
              <div
                key={s._id}
                className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-brand-50/20 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    s.isActive
                      ? 'bg-brand-50 text-brand-600 border border-brand-100'
                      : 'bg-stone-100 text-stone-400 border border-stone-200'
                  }`}>
                    <CalendarClock className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-stone-900 text-sm tracking-tight truncate">{s.name}</div>
                    <div className="text-xs text-stone-500 mt-0.5 leading-relaxed flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span>{reportLabel(s.reportType)}</span>
                      <span className="text-stone-300">·</span>
                      <span className="capitalize">{s.frequency}</span>
                      <span className="text-stone-300">·</span>
                      <span className="uppercase tracking-wide text-[10px] font-bold text-stone-400">
                        {s.format || 'xlsx'}
                      </span>
                    </div>
                    {(s.recipients || []).length > 0 && (
                      <div className="text-[11px] text-stone-400 mt-1 flex items-center gap-1 min-w-0">
                        <Mail size={11} className="flex-shrink-0" />
                        <span className="truncate">{recipientPreview}{extra}</span>
                      </div>
                    )}
                    {s.lastRunAt && (
                      <div className={`text-[11px] mt-1.5 font-medium flex items-center gap-1 ${
                        s.lastRunStatus === 'success' ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        <Clock size={11} />
                        Last run: {s.lastRunStatus} · {new Date(s.lastRunAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 pl-12 sm:pl-0">
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
                    disabled={togglingId === s._id}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:text-brand-600 hover:border-brand-300 disabled:opacity-50"
                    title={s.isActive ? 'Pause' : 'Resume'}
                    aria-label={s.isActive ? 'Pause schedule' : 'Resume schedule'}
                  >
                    {togglingId === s._id
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Power size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(s)}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-400 hover:text-red-600 hover:border-red-200"
                    title="Delete"
                    aria-label="Delete schedule"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ScheduleModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSave={create}
        saving={saving}
        members={members}
        membersLoading={membersLoading}
      />
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        title="Delete schedule?"
        message={`Delete the "${deleteTarget?.name}" schedule? Recipients will stop receiving this report.`}
        confirmText="Delete"
        type="delete"
        isLoading={deleting}
      />

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Scheduled Reports" />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={SCHED_TOUR_STEPS}
        storageKey={SCHED_TOUR_KEY}
      />
    </div>
  );
}
