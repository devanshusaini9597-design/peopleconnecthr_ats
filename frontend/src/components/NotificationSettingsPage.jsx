import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  BellRing,
  Briefcase,
  Calendar,
  ChevronRight,
  Megaphone,
  Moon,
  Phone,
  RefreshCw,
  Save,
  Share2,
  AtSign,
  Users,
  MonitorSmartphone,
} from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import PageHeader from './ui/PageHeader';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import {
  CATEGORY_ROWS,
  FREELANCER_CATEGORY_ROWS,
  NOTIF_PREFS_TOUR_KEY,
  NOTIF_PREFS_TOUR_STEPS,
  TIMEZONE_OPTIONS,
  defaultPreferences,
} from './notificationSettings/notificationSettingsConstants';

const ICONS = {
  Phone,
  Briefcase,
  Megaphone,
  AtSign,
  Calendar,
  Users,
  Share2,
};

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object') return base;
  const out = { ...base };
  for (const key of Object.keys(patch)) {
    const val = patch[key];
    if (val && typeof val === 'object' && !Array.isArray(val) && base[key] && typeof base[key] === 'object') {
      out[key] = deepMerge(base[key], val);
    } else if (val !== undefined) {
      out[key] = val;
    }
  }
  return out;
}

function ChannelToggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center justify-center cursor-pointer group">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <span
        className={`w-9 h-5 rounded-full relative transition-colors duration-200 ${
          checked ? 'bg-brand-600' : 'bg-stone-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </span>
    </label>
  );
}

export default function NotificationSettingsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isFreelancer = user?.role === 'freelancer';
  const categoryRows = isFreelancer ? FREELANCER_CATEGORY_ROWS : CATEGORY_ROWS;
  const [tourOpen, setTourOpen] = usePageTour(NOTIF_PREFS_TOUR_KEY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState(defaultPreferences());
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/notifications/preferences');
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message || 'Failed to load preferences');
      setPrefs(deepMerge(defaultPreferences(), data.preferences || {}));
      setDirty(false);
    } catch (e) {
      toast.error(e.message || 'Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const setChannel = (category, channel, value) => {
    setPrefs((prev) => ({
      ...prev,
      channels: {
        ...prev.channels,
        [category]: {
          ...prev.channels[category],
          [channel]: value,
        },
      },
    }));
    setDirty(true);
  };

  const setCallbackOpt = (key, value) => {
    setPrefs((prev) => ({
      ...prev,
      callbacks: { ...prev.callbacks, [key]: value },
    }));
    setDirty(true);
  };

  const setQuiet = (patch) => {
    setPrefs((prev) => ({
      ...prev,
      quietHours: { ...prev.quietHours, ...patch },
    }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: prefs }),
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message || 'Save failed');
      setPrefs(deepMerge(defaultPreferences(), data.preferences || prefs));
      setDirty(false);
      toast.success('Notification preferences saved');
    } catch (e) {
      toast.error(e.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    setPrefs(defaultPreferences());
    setDirty(true);
  };

  const summary = useMemo(() => {
    const on = categoryRows.filter((r) => prefs.channels?.[r.key]?.inApp).length;
    return `${on} of ${categoryRows.length} categories active in-app`;
  }, [prefs, categoryRows]);

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={BellRing}
        title="Notification preferences"
        subtitle={isFreelancer
          ? 'Alerts for your desk — callbacks, mandates, freelancer announcements, and submission updates.'
          : 'Manage in-app, email, and browser alerts — per category, like enterprise ATS software.'}
        gradientTitle
      >
        <button type="button" onClick={load} className="btn-secondary w-full sm:w-auto" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
        <button
          type="button"
          onClick={save}
          className="btn-primary w-full sm:w-auto"
          disabled={saving || !dirty}
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save changes
        </button>
      </PageHeader>

      <div className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/40 px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed">
        {summary}. Quiet hours pause non-urgent alerts. Urgent callbacks (due today / overdue) still notify you.
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 skeleton-ats rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          <div className="xl:col-span-8 space-y-4 min-w-0">
            <section
              data-tour="notif-matrix"
              className="card-ats-bordered relative overflow-hidden p-4 sm:p-5"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
              <div className="relative mb-4">
                <h2 className="text-[15px] font-bold text-stone-900 tracking-tight">Alert categories</h2>
                <p className="text-[12px] text-stone-500 mt-1">
                  Choose how each type of update reaches you.
                </p>
              </div>

              <div className="relative hidden sm:grid grid-cols-[1fr_72px_72px_72px] gap-2 px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                <span>Category</span>
                <span className="text-center">In-app</span>
                <span className="text-center">Email</span>
                <span className="text-center">Push</span>
              </div>

              <ul className="relative space-y-2">
                {categoryRows.map((row) => {
                  const Icon = ICONS[row.icon] || Bell;
                  const ch = prefs.channels?.[row.key] || {};
                  const emailDisabled = isFreelancer && row.key === 'announcements';
                  return (
                    <li
                      key={row.key}
                      className="rounded-2xl border border-stone-200/80 bg-white p-3 sm:grid sm:grid-cols-[1fr_72px_72px_72px] sm:items-center sm:gap-2"
                    >
                      <div className="flex items-start gap-3 min-w-0 mb-3 sm:mb-0">
                        <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 border border-brand-100 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-stone-900">{row.label}</span>
                          <span className="block text-[12px] text-stone-500 mt-0.5 leading-relaxed">{row.description}</span>
                        </span>
                      </div>
                      <div className="flex sm:contents items-center justify-between gap-4 pl-12 sm:pl-0">
                        {[
                          { key: 'inApp', label: 'In-app' },
                          { key: 'email', label: 'Email', disabled: emailDisabled },
                          { key: 'push', label: 'Push' },
                        ].map(({ key, label, disabled }) => (
                          <div key={key} className={`flex sm:flex-col items-center gap-2 sm:gap-1 ${disabled ? 'opacity-40' : ''}`}>
                            <span className="sm:hidden text-[11px] font-medium text-stone-500 w-12">{label}</span>
                            <ChannelToggle
                              checked={disabled ? false : ch[key] !== false}
                              onChange={(v) => {
                                if (disabled) return;
                                setChannel(row.key, key, v);
                              }}
                              label={`${row.label} ${label}${disabled ? ' (in-app only)' : ''}`}
                            />
                          </div>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="card-ats-bordered relative overflow-hidden p-4 sm:p-5">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
              <div className="relative mb-4">
                <h2 className="text-[15px] font-bold text-stone-900 tracking-tight">
                  {isFreelancer ? 'Callback options' : 'Callback routing'}
                </h2>
                <p className="text-[12px] text-stone-500 mt-1">
                  {isFreelancer
                    ? 'How callback reminders appear for candidates on your desk.'
                    : 'Enterprise desk rules — who else gets callback alerts besides the record owner.'}
                </p>
              </div>
              <div className="relative space-y-3">
                {(isFreelancer
                  ? [
                      {
                        key: 'digestOnly',
                        title: 'Morning digest only (callbacks)',
                        desc: 'Skip ramp-up reminders; one in-app summary between 7–9 AM instead.',
                      },
                    ]
                  : [
                      {
                        key: 'includeAsSpoc',
                        title: 'When I am SPOC on a candidate',
                        desc: 'Notify me for callbacks on records where my name is the SPOC.',
                      },
                      {
                        key: 'includeAsManager',
                        title: 'When my team has callbacks',
                        desc: 'Managers receive alerts for direct reports’ call-back dates.',
                      },
                      {
                        key: 'digestOnly',
                        title: 'Morning digest only (callbacks)',
                        desc: 'Skip ramp-up reminders; one in-app summary between 7–9 AM instead.',
                      },
                    ]
                ).map((opt) => (
                  <label
                    key={opt.key}
                    className="flex items-start gap-3 rounded-2xl border border-stone-200/80 bg-stone-50/50 p-3 cursor-pointer hover:border-brand-200 transition-colors"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                      checked={
                        opt.key === 'digestOnly'
                          ? prefs.callbacks?.digestOnly === true
                          : prefs.callbacks?.[opt.key] !== false
                      }
                      onChange={(e) => setCallbackOpt(opt.key, e.target.checked)}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-stone-900">{opt.title}</span>
                      <span className="block text-[12px] text-stone-500 mt-0.5 leading-relaxed">{opt.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          </div>

          <aside className="xl:col-span-4 space-y-4 min-w-0 xl:sticky xl:top-4">
            <section
              data-tour="notif-quiet"
              className="card-ats-bordered relative overflow-hidden p-4 sm:p-5"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-indigo-400" />
              <div className="relative flex items-center gap-2 mb-3">
                <Moon className="w-4 h-4 text-violet-600" />
                <h2 className="text-[15px] font-bold text-stone-900 tracking-tight">Quiet hours</h2>
              </div>
              <label className="relative flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2.5 mb-3 cursor-pointer">
                <span className="text-sm font-medium text-stone-800">Enable quiet hours</span>
                <ChannelToggle
                  checked={prefs.quietHours?.enabled === true}
                  onChange={(v) => setQuiet({ enabled: v })}
                  label="Enable quiet hours"
                />
              </label>
              <div className="relative grid grid-cols-2 gap-2 mb-2">
                <label className="text-[11px] font-semibold text-stone-500">
                  From
                  <input
                    type="time"
                    value={prefs.quietHours?.start || '20:00'}
                    onChange={(e) => setQuiet({ start: e.target.value })}
                    className="input-ats mt-1 w-full text-sm"
                    disabled={!prefs.quietHours?.enabled}
                  />
                </label>
                <label className="text-[11px] font-semibold text-stone-500">
                  Until
                  <input
                    type="time"
                    value={prefs.quietHours?.end || '08:00'}
                    onChange={(e) => setQuiet({ end: e.target.value })}
                    className="input-ats mt-1 w-full text-sm"
                    disabled={!prefs.quietHours?.enabled}
                  />
                </label>
              </div>
              <label className="relative block text-[11px] font-semibold text-stone-500">
                Timezone
                <select
                  value={prefs.quietHours?.timezone || 'Asia/Kolkata'}
                  onChange={(e) => setQuiet({ timezone: e.target.value })}
                  className="input-ats mt-1 w-full text-sm"
                  disabled={!prefs.quietHours?.enabled}
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </label>
              <p className="relative text-[11px] text-stone-400 mt-3 leading-relaxed">
                Non-urgent in-app and push alerts are paused during this window. Email digests and urgent callbacks are unaffected.
              </p>
            </section>

            <Link
              to="/push-notifications"
              className="card-ats-bordered relative overflow-hidden p-4 sm:p-5 flex items-center gap-3 group hover:border-brand-300 transition-colors"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
              <span className="relative w-10 h-10 rounded-xl bg-brand-50 text-brand-700 border border-brand-100 flex items-center justify-center shrink-0">
                <MonitorSmartphone className="w-4 h-4" />
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="block text-sm font-bold text-stone-900">Browser push setup</span>
                <span className="block text-[12px] text-stone-500 mt-0.5">Enable alerts on this device</span>
              </span>
              <ChevronRight className="relative w-4 h-4 text-stone-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
            </Link>

            <div className="card-ats-bordered p-4 sm:p-5">
              <button type="button" onClick={resetDefaults} className="btn-secondary w-full text-sm">
                Reset to defaults
              </button>
            </div>
          </aside>
        </div>
      )}

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Notification preferences tour" />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={NOTIF_PREFS_TOUR_STEPS}
        storageKey={NOTIF_PREFS_TOUR_KEY}
      />
    </div>
  );
}
