import React from 'react';
import { Lock, Clock, Globe, Server, Users, Plus } from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import ToggleRow from './ToggleRow';
import UpgradeStrip from './UpgradeStrip';

export default function OrgPoliciesSection({
  settings,
  setSettings,
  entitlements,
  deploymentTier,
  idleValue,
  idleOptions,
  sessionCountValue,
  sessionCountOptions,
  ipInput,
  setIpInput,
  onAddIp,
  onRemoveIp,
}) {
  return (
    <section
      data-tour="sec-policies"
      className="lg:col-span-7 card-ats-bordered relative overflow-hidden p-4 sm:p-5 space-y-4 min-w-0"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="relative">
        <h2 className="text-[15px] font-bold text-stone-900 tracking-tight inline-flex items-center gap-2">
          <Lock className="w-4 h-4 text-brand-600" /> Organization policies
        </h2>
        <p className="text-[11px] text-stone-400 mt-0.5">Enforcement across your hiring team</p>
      </div>

      <div className="relative space-y-3">
        {!entitlements.mfaEnforcement && (
          <UpgradeStrip message="MFA enforcement requires Professional or higher." />
        )}
        <ToggleRow
          checked={settings.mfaEnforced}
          disabled={!entitlements.mfaEnforcement}
          onChange={(v) => setSettings((s) => ({ ...s, mfaEnforced: v }))}
          label="Require MFA for all users"
          description={
            entitlements.mfaEnforcement
              ? 'Users must enroll MFA before accessing the app.'
              : 'Upgrade to Professional to enforce MFA.'
          }
        />

        {!entitlements.sessionPolicy && (
          <UpgradeStrip message="Session policies require Professional or higher." />
        )}

        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${!entitlements.sessionPolicy ? 'opacity-50 pointer-events-none' : ''}`}>
          <div>
            <label className="label-ats inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Session idle timeout
            </label>
            <PremiumSelect
              compact
              icon={Clock}
              value={idleValue}
              onChange={(v) => setSettings((s) => ({
                ...s,
                sessionIdleMinutes: parseInt(v, 10) || 480
              }))}
              options={idleOptions}
              placeholder="Timeout"
              disabled={!entitlements.sessionPolicy}
            />
          </div>
          <div>
            <label className="label-ats inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Max concurrent sessions
            </label>
            <PremiumSelect
              compact
              icon={Users}
              value={sessionCountValue}
              onChange={(v) => setSettings((s) => ({
                ...s,
                maxConcurrentSessions: parseInt(v, 10) || 10
              }))}
              options={sessionCountOptions}
              placeholder="Sessions"
              disabled={!entitlements.sessionPolicy}
            />
          </div>
        </div>

        {!entitlements.ipAllowlist && (
          <UpgradeStrip message="IP allowlist requires Enterprise." />
        )}

        <div className={!entitlements.ipAllowlist ? 'opacity-50' : ''}>
          <label className="label-ats inline-flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" /> IP allowlist
          </label>
          <div className="flex flex-col sm:flex-row gap-2 mb-2">
            <div className="relative flex-1 min-w-0">
              <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
                disabled={!entitlements.ipAllowlist}
                className="input-ats !pl-10 font-mono text-sm w-full"
                placeholder="203.0.113.10 or 10.0.0.0/8"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onAddIp();
                  }
                }}
              />
            </div>
            <button
              type="button"
              onClick={onAddIp}
              disabled={!entitlements.ipAllowlist || !ipInput.trim()}
              className="btn-secondary w-full sm:w-auto shrink-0"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          {settings.ipAllowlist.length === 0 ? (
            <p className="text-[11px] text-stone-400 px-0.5">
              No IPs listed — access is not restricted by IP.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {settings.ipAllowlist.map((ip) => (
                <li
                  key={ip}
                  className="flex items-center justify-between gap-2 text-sm font-mono bg-white border border-stone-200/80 rounded-xl px-3 py-2"
                >
                  <span className="truncate min-w-0">{ip}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveIp(ip)}
                    disabled={!entitlements.ipAllowlist}
                    className="text-[11px] font-semibold text-stone-500 hover:text-red-600 flex-shrink-0"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-stone-200/70 bg-stone-50/60">
          <span className="w-9 h-9 rounded-xl bg-white border border-stone-200 flex items-center justify-center text-stone-500 flex-shrink-0">
            <Server className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-900">Deployment tier</p>
            <p className="text-[11px] text-stone-500 capitalize mt-0.5">
              {deploymentTier}
              {entitlements.dedicated && deploymentTier === 'dedicated'
                ? ' — dedicated infrastructure'
                : ''}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
