import React from 'react';
import {
  ShieldCheck, Loader2, Search, Save, X,
  Mail, Phone, MessageCircle, Users, BadgeCheck
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { initials } from './consentConstants';

export const ToggleRow = ({ icon: Icon, label, hint, checked, onChange }) => (
  <div className="flex items-start justify-between gap-3 p-3 sm:p-3.5 rounded-2xl border border-stone-200/70 bg-white hover:border-stone-300/90 transition-colors">
    <div className="flex items-start gap-3 min-w-0">
      <span className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${
        checked
          ? 'bg-brand-50 border-brand-200 text-brand-700'
          : 'bg-stone-50 border-stone-200 text-stone-400'
      }`}>
        <Icon className="w-4 h-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-stone-900">{label}</span>
        {hint ? <span className="block text-[11px] text-stone-500 mt-0.5 leading-relaxed">{hint}</span> : null}
      </span>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`mt-1 relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
        checked ? 'bg-brand-600' : 'bg-stone-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow translate-y-0.5 transition ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  </div>
);

export function ConsentCandidateList({
  q, setQ, listLabel, searching, candidates, selected, loadConsent,
}) {
  return (
    <div
      data-tour="consent-candidates"
      className="lg:col-span-4 card-ats-bordered relative overflow-hidden flex flex-col min-w-0 min-h-[28rem]"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="relative px-4 sm:px-5 pt-4 pb-3 border-b border-stone-100 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-stone-900 tracking-tight">Candidates</h2>
            <p className="text-[11px] text-stone-400 mt-0.5">{listLabel}</p>
          </div>
          <span className="badge-neutral text-[10px] flex-shrink-0 inline-flex items-center gap-1">
            <Users className="w-3 h-3" /> Search
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            id="consent-search"
            type="search"
            className="input-ats !pl-10 !pr-9 w-full"
            placeholder="Name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Find candidate"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto overscroll-contain bg-[linear-gradient(180deg,#fafaf9_0%,#ffffff_40%)]">
        {searching ? (
          <div className="p-3.5 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 skeleton-ats rounded-xl" />
            ))}
          </div>
        ) : !q.trim() ? (
          <div className="p-4 h-full min-h-[16rem] flex items-center justify-center">
            <EmptyState
              icon={Search}
              tone="brand"
              compact
              message="Search candidates"
              subMessage="Type a name or email to manage their consent."
            />
          </div>
        ) : candidates.length === 0 ? (
          <div className="p-4 h-full min-h-[16rem] flex items-center justify-center">
            <EmptyState
              icon={Search}
              tone="amber"
              compact
              message="No candidates found"
              subMessage="Try another name or email."
            />
          </div>
        ) : (
          candidates.map((c) => {
            const active = selected?._id === c._id;
            return (
              <button
                key={c._id}
                type="button"
                onClick={() => loadConsent(c)}
                className={`w-full text-left px-4 py-3 border-b border-stone-50 flex items-center gap-3 min-w-0 transition-colors ${
                  active
                    ? 'bg-brand-50/80 border-l-2 border-l-brand-500'
                    : 'hover:bg-brand-50/40 border-l-2 border-l-transparent'
                }`}
              >
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    active
                      ? 'bg-brand-600 text-white'
                      : 'bg-stone-100 text-stone-600 border border-stone-200'
                  }`}
                >
                  {initials(c.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-stone-900 truncate">
                    {c.name || 'Unnamed'}
                  </span>
                  <span className="block text-xs text-stone-500 truncate mt-0.5">
                    {c.email || 'No email'}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function ConsentPanel({
  selected, loading, dirty, form, setForm, saving, requestSave,
}) {
  return (
    <div
      data-tour="consent-panel"
      className="lg:col-span-8 card-ats-bordered relative overflow-hidden flex flex-col min-w-0 min-h-[28rem]"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />

      {!selected ? (
        <div className="relative flex-1 flex flex-col justify-center p-5 sm:p-6">
          <EmptyState
            icon={ShieldCheck}
            tone="brand"
            message="Select a candidate"
            subMessage="Choose someone from the list to review messaging and talent-pool consent."
          />
        </div>
      ) : loading ? (
        <div className="relative flex-1 p-4 sm:p-5 space-y-3">
          <div className="h-14 skeleton-ats rounded-xl" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 skeleton-ats rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="relative px-4 sm:px-5 pt-4 pb-3 border-b border-stone-100 flex items-start justify-between gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                {initials(selected.name)}
              </span>
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold text-stone-900 tracking-tight truncate">
                  {selected.name || 'Candidate'}
                </h2>
                <p className="text-[11px] text-stone-500 mt-0.5 truncate">
                  {selected.email || 'No email'}
                  {selected.contact || selected.phone ? ` · ${selected.contact || selected.phone}` : ''}
                </p>
              </div>
            </div>
            <span className={`badge-neutral text-[10px] flex-shrink-0 ${dirty ? '!text-amber-700 !border-amber-200 !bg-amber-50' : ''}`}>
              {dirty ? 'Unsaved changes' : 'Saved'}
            </span>
          </div>

          <div className="relative flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-2.5 bg-[linear-gradient(180deg,#fafaf9_0%,#ffffff_48%)]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 px-0.5">
              Outreach channels
            </p>
            <ToggleRow
              icon={Mail}
              label="Email outreach"
              hint="Transactional and recruiting emails"
              checked={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
            />
            <ToggleRow
              icon={Phone}
              label="SMS / text"
              hint="Requires verified phone where applicable"
              checked={form.sms}
              onChange={(v) => setForm({ ...form, sms: v })}
            />
            <ToggleRow
              icon={MessageCircle}
              label="WhatsApp"
              hint="WhatsApp business messaging"
              checked={form.whatsapp}
              onChange={(v) => setForm({ ...form, whatsapp: v })}
            />

            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 px-0.5 pt-2">
              Retention & verification
            </p>
            <ToggleRow
              icon={Users}
              label="Talent pool retention"
              hint="Keep in warm talent pools after reject"
              checked={form.talentPoolOptIn}
              onChange={(v) => setForm({ ...form, talentPoolOptIn: v })}
            />
            <ToggleRow
              icon={BadgeCheck}
              label="Phone verified"
              hint="Mark phone as verified for SMS"
              checked={form.phoneVerified}
              onChange={(v) => setForm({ ...form, phoneVerified: v })}
            />
          </div>

          <div className="relative px-4 sm:px-5 py-3 border-t border-stone-100 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-[11px] text-stone-400 leading-snug">
              Turning a channel off stops future sequences and inbox sends on that channel.
            </p>
            <button
              type="button"
              className="btn-primary w-full sm:w-auto"
              disabled={saving || !dirty}
              onClick={requestSave}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save consent
            </button>
          </div>
        </>
      )}
    </div>
  );
}
