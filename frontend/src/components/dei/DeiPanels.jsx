import React from 'react';
import {
  Shield, Loader2, EyeOff, AlertTriangle, Users, Percent, ClipboardList, Bell, FormInput,
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { BAR_COLORS } from './deiConstants';

export function StatCard({ icon: Icon, label, value, sub, gradient }) {
  return (
    <div className="relative card-ats-bordered p-5 min-h-[118px] flex flex-col justify-between overflow-hidden text-left w-full group transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg hover:shadow-stone-200/60 hover:border-transparent">
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient} transition-all duration-300 group-hover:h-1.5`} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-stone-500 text-sm font-medium truncate">{label}</p>
          <p className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1 tabular-nums tracking-tight truncate">
            {value}
          </p>
          {sub && <p className="text-xs text-stone-400 mt-1.5 font-medium truncate">{sub}</p>}
        </div>
        <div className={`p-3 rounded-xl flex-shrink-0 bg-gradient-to-br ${gradient} shadow-md transition-transform duration-300 ease-out group-hover:scale-110 group-hover:rotate-3`}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }) {
  return (
    <div className="flex items-start gap-3 p-3 sm:p-4 rounded-xl border border-stone-200 bg-white hover:border-brand-200 hover:shadow-sm transition-all">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:opacity-50 ${
          checked ? 'bg-brand-600' : 'bg-stone-300'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition translate-y-0.5 ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-stone-900 tracking-tight">{label}</p>
          <span className={`badge-ats text-[10px] ${checked ? 'badge-success' : 'badge-neutral'}`}>
            {checked ? 'On' : 'Off'}
          </span>
        </div>
        {description && (
          <p className="text-xs text-stone-500 mt-1 leading-relaxed">{description}</p>
        )}
      </div>
    </div>
  );
}

export function BreakdownBars({ title, data }) {
  const entries = Object.entries(data || {});
  const max = Math.max(...entries.map(([, v]) => Number(v) || 0), 1);
  const total = entries.reduce((sum, [, v]) => sum + (Number(v) || 0), 0);

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <h4 className="text-sm font-bold text-stone-800 tracking-tight truncate">{title}</h4>
        <span className="text-[11px] font-medium text-stone-400 tabular-nums flex-shrink-0">
          {total || '—'} disclosed
        </span>
      </div>
      {!entries.length ? (
        <p className="text-xs text-stone-400 py-2">No disclosed data</p>
      ) : (
        <div className="space-y-2.5">
          {entries.map(([label, value], i) => {
            const n = Number(value) || 0;
            const pct = Math.max((n / max) * 100, n > 0 ? 4 : 0);
            return (
              <div key={label} className="min-w-0">
                <div className="flex justify-between gap-2 text-xs mb-1 min-w-0">
                  <span className="text-stone-600 font-medium truncate pr-2">{label}</span>
                  <span className="text-stone-700 font-bold tabular-nums flex-shrink-0">{n}</span>
                </div>
                <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${BAR_COLORS[i % BAR_COLORS.length]} transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DeiBody({
  loading, metrics, controlsOn, showControls, showFunnel, settings, saving,
  updateToggle, shortlistDraft, onShortlistChange,
}) {
  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-[118px] skeleton-ats rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="h-80 skeleton-ats rounded-2xl" />
          <div className="lg:col-span-2 h-80 skeleton-ats rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {metrics?.alert && (
        <div className="card-ats-bordered border-amber-200/80 bg-amber-50/40 p-4 sm:p-5 relative overflow-hidden flex items-start gap-3">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500" />
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5 relative" />
          <div className="min-w-0 relative">
            <p className="text-sm font-bold text-amber-900 tracking-tight">Diverse slate alert</p>
            <p className="text-sm text-amber-900/90 leading-relaxed mt-0.5">{metrics.alert.message}</p>
          </div>
        </div>
      )}

      <div data-tour="dei-kpis" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="In pipeline"
          value={metrics?.summary?.totalCandidatesInPipeline ?? 0}
          sub="Active applications"
          gradient="from-brand-500 to-teal-400"
        />
        <StatCard
          icon={ClipboardList}
          label="Self-ID disclosed"
          value={metrics?.summary?.selfIdDisclosed ?? 0}
          sub="Voluntary responses"
          gradient="from-sky-500 to-cyan-400"
        />
        <StatCard
          icon={Percent}
          label="Disclosure rate"
          value={`${metrics?.summary?.disclosureRate ?? 0}%`}
          sub="Of pipeline candidates"
          gradient="from-emerald-500 to-lime-400"
        />
        <StatCard
          icon={Shield}
          label="Controls enabled"
          value={`${controlsOn}/3`}
          sub="Fair-hiring features on"
          gradient="from-violet-500 to-fuchsia-400"
        />
      </div>

      <div className={`grid grid-cols-1 gap-4 sm:gap-6 ${showControls && showFunnel ? 'lg:grid-cols-3' : ''}`}>
        {showControls && (
          <div data-tour="dei-controls" className={`card-ats-bordered p-5 sm:p-6 relative overflow-hidden space-y-3 h-fit min-w-0 ${showFunnel ? 'lg:col-span-1' : ''}`}>
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <div className="relative flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
                <EyeOff size={16} className="text-brand-600" /> Controls
              </h2>
              {saving && <Loader2 className="w-4 h-4 animate-spin text-stone-400 flex-shrink-0" />}
            </div>
            <p className="relative text-[11px] text-stone-400 font-medium -mt-1 mb-1">Fair hiring settings</p>

            <Toggle
              checked={!!settings.blindScreeningEnabled}
              onChange={(v) => updateToggle('blindScreeningEnabled', v)}
              disabled={saving}
              label="Blind screening"
              description="Hide names, emails, and photos during early review stages."
            />
            <Toggle
              checked={!!settings.diverseSlateAlerts}
              onChange={(v) => updateToggle('diverseSlateAlerts', v)}
              disabled={saving}
              label="Diverse slate alerts"
              description="Notify when shortlists lack disclosed diversity (aggregates only)."
            />
            <Toggle
              checked={!!settings.selfIdFormEnabled}
              onChange={(v) => updateToggle('selfIdFormEnabled', v)}
              disabled={saving}
              label="Voluntary self-ID form"
              description="Allow candidates to optionally share demographics."
            />

            <div className="relative pt-1">
              <label className="label-ats" htmlFor="dei-min-shortlist">Min shortlist size for alerts</label>
              <div className="relative">
                <Bell className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                <input
                  id="dei-min-shortlist"
                  type="number"
                  min="1"
                  className="input-ats !pl-10"
                  value={shortlistDraft}
                  onChange={(e) => onShortlistChange(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="relative rounded-xl border border-stone-200 bg-stone-50/80 p-3 flex items-start gap-2.5">
              <FormInput className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-stone-500 leading-relaxed">
                Self-ID data is never shown beside individual candidate names in recruiter lists. Metrics are aggregate-only.
              </p>
            </div>
          </div>
        )}

        {showFunnel && (
          <div data-tour="dei-funnel" className={`space-y-4 min-w-0 ${showControls ? 'lg:col-span-2' : ''}`}>
            {!metrics?.funnel?.length ? (
              <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 opacity-80" />
                <EmptyState
                  icon={Shield}
                  tone="brand"
                  message="No funnel data yet"
                  subMessage="Once applications move through stages, DEI aggregates will appear here."
                />
              </div>
            ) : (
              metrics.funnel.map((stage) => (
                <div
                  key={stage.stage}
                  className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden min-w-0"
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 opacity-80" />
                  <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2 min-w-0">
                      <ClipboardList size={16} className="text-brand-600 flex-shrink-0" />
                      <span className="truncate">{stage.stage}</span>
                    </h2>
                    <span className="badge-neutral tabular-nums flex-shrink-0">
                      {stage.total} application{stage.total === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                    <BreakdownBars title="Gender (disclosed)" data={stage.breakdown?.gender} />
                    <BreakdownBars title="Ethnicity (disclosed)" data={stage.breakdown?.ethnicity} />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
