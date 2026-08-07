import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Palette, Lock, Loader2, Save, Sparkles, Mail, Info, Eye, Building2,
  ChevronRight, Shield,
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';

const WL_TOUR_KEY = 'skillnix_tour_white_label_v1';
const WL_TOUR_STEPS = [
  {
    title: 'White-Label Kit',
    body: 'Make candidate-facing surfaces look like your company — colors, email From name, and remove “Powered by” credits.',
  },
  {
    target: '[data-tour="wl-tip"]',
    title: 'Tips',
    body: 'Brand color is always free. Kit extras (hide powered-by, email name) need Enterprise.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="wl-color"]',
    title: 'Brand color',
    body: 'Pick a preset or custom hex — used on careers pages and job listings.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="wl-preview"]',
    title: 'Live preview',
    body: 'See how the careers footer and email From line look before you save.',
    placement: 'left',
  },
];

const PRESET_COLORS = [
  '#0d9488', '#0891b2', '#0369a1', '#4f46e5',
  '#7c3aed', '#be185d', '#c2410c', '#15803d', '#0f172a',
];

const ToggleRow = ({ checked, onChange, disabled, label, description }) => (
  <label className={`flex items-center justify-between gap-4 p-3.5 rounded-xl border transition-colors ${
    disabled
      ? 'opacity-50 cursor-not-allowed border-stone-100 bg-stone-50/40'
      : 'cursor-pointer border-stone-200 bg-white hover:bg-stone-50/80'
  }`}>
    <div className="min-w-0">
      <span className="text-sm font-semibold text-stone-900">{label}</span>
      {description && <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{description}</p>}
    </div>
    <div className="relative inline-flex items-center shrink-0">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600 peer-disabled:opacity-60" />
    </div>
  </label>
);

function LivePreview({ brandColor, orgName, hidePoweredBy, enabled, emailFromName }) {
  const fromName = (enabled && emailFromName.trim()) ? emailFromName.trim() : (orgName || 'Your Company');
  return (
    <div className="space-y-4">
      {/* Careers footer mock */}
      <div className="rounded-xl border border-stone-200 overflow-hidden bg-white shadow-sm">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-stone-100 bg-stone-50/80">
          <span className="w-2 h-2 rounded-full bg-stone-300" />
          <span className="w-2 h-2 rounded-full bg-stone-300" />
          <span className="w-2 h-2 rounded-full bg-stone-300" />
          <span className="ml-2 flex-1 truncate rounded-md bg-white border border-stone-100 px-2 py-0.5 text-[10px] text-stone-400 font-medium">
            careers.{(orgName || 'company').toLowerCase().replace(/\s+/g, '')}.com
          </span>
        </div>
        <div className="p-4 space-y-3">
          <div
            className="h-2 w-24 rounded-full"
            style={{ backgroundColor: brandColor }}
          />
          <div className="h-3 w-40 rounded bg-stone-100" />
          <div className="h-3 w-full rounded bg-stone-50" />
          <div className="h-3 w-5/6 rounded bg-stone-50" />
          <button
            type="button"
            className="mt-2 inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-bold text-white"
            style={{ backgroundColor: brandColor }}
          >
            View open roles
          </button>
        </div>
        <div className="px-4 py-3 border-t border-stone-100 bg-stone-50/50 text-center">
          {enabled && hidePoweredBy ? (
            <p className="text-[10px] text-stone-400">© {new Date().getFullYear()} {orgName || 'Your Company'}</p>
          ) : (
            <p className="text-[10px] text-stone-400">
              Powered by <span className="font-semibold text-stone-500">People Connect HR</span>
            </p>
          )}
        </div>
      </div>

      {/* Email from mock */}
      <div className="rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400 mb-2">Candidate email</p>
        <div className="flex items-start gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
            style={{ backgroundColor: brandColor }}
          >
            {(fromName[0] || 'C').toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-900 truncate">{fromName}</p>
            <p className="text-[11px] text-stone-400 truncate">to candidate@email.com</p>
            <p className="text-xs text-stone-500 mt-1.5">Interview invitation for Senior Recruiter…</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const WhiteLabelSettingsPage = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const { organization } = useAuth();
  const [tourOpen, setTourOpen] = usePageTour(WL_TOUR_KEY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [brandColor, setBrandColor] = useState('#0d9488');
  const [enabled, setEnabled] = useState(false);
  const [hidePoweredBy, setHidePoweredBy] = useState(false);
  const [emailFromName, setEmailFromName] = useState('');

  const orgName = organization?.name || 'Your Company';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/white-label');
      if (res.status === 401) return handleUnauthorized();
      const data = await res.json();
      if (!data.success) return;
      setBrandColor(data.data.brandColor || '#0d9488');
      setEnabled(!!data.data.whiteLabel?.enabled);
      setHidePoweredBy(!!data.data.whiteLabel?.hidePoweredBy);
      setEmailFromName(data.data.whiteLabel?.emailFromName || '');
      if (!data.data.entitled) setUpgradeRequired(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/white-label', {
        method: 'PUT',
        body: JSON.stringify({ brandColor, enabled, hidePoweredBy, emailFromName }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.code === 'UPGRADE_REQUIRED') setUpgradeRequired(true);
        toast?.error?.(data.message || 'Failed to save');
        return;
      }
      toast?.success?.('White-label settings saved');
    } catch (err) {
      toast?.error?.(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell-ats animate-page-enter">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl skeleton-ats flex-shrink-0" />
          <div className="space-y-2 flex-1 pt-1">
            <div className="h-7 w-44 skeleton-ats rounded-lg" />
            <div className="h-4 w-80 max-w-full skeleton-ats rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mt-2">
          <div className="lg:col-span-3 card-ats-bordered p-6 space-y-4">
            <div className="h-11 w-full skeleton-ats rounded-xl" />
            <div className="h-14 w-full skeleton-ats rounded-xl" />
            <div className="h-14 w-full skeleton-ats rounded-xl" />
          </div>
          <div className="lg:col-span-2 card-ats-bordered p-6 h-64 skeleton-ats" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={Palette}
        title={t('pages.whiteLabel.title')}
        subtitle={t('pages.whiteLabel.subtitle')}
        gradientTitle
      >
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
          enabled
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-stone-100 text-stone-500 border-stone-200'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-stone-400'}`} />
          {enabled ? 'Kit on' : 'Kit off'}
        </span>
      </PageHeader>

      <div
        data-tour="wl-tip"
        className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1.5"
      >
        <span className="inline-flex items-center gap-1.5 text-brand-700 font-semibold">
          <Info size={14} /> Tip
        </span>
        <span>
          Brand color is free. Hide “Powered by” and custom email From name need Enterprise.
          Press <span className="font-semibold text-stone-800">?</span> for a tour.
        </span>
      </div>

      {upgradeRequired && (
        <div className="card-ats-bordered border-amber-200/80 bg-amber-50/40 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Lock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-stone-900 tracking-tight">Enterprise add-on</h3>
            <p className="text-sm text-stone-500 mt-0.5 leading-relaxed">
              You can still set brand color. Kit extras unlock on Enterprise — upgrade when ready.
            </p>
          </div>
          <a href="/billing" className="btn-primary !text-sm whitespace-nowrap shrink-0">View Plans</a>
        </div>
      )}

      {/* What / why */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            icon: Building2,
            title: 'What it is',
            body: 'Candidate careers pages and emails look like your brand, not the ATS vendor.',
          },
          {
            icon: Shield,
            title: 'Why enterprises use it',
            body: 'Agencies & employers need a polished, trusted employer brand for applicants.',
          },
          {
            icon: Sparkles,
            title: 'Goes with',
            body: 'Company Brand (logo, tagline, SEO) and Careers page builder for the full look.',
          },
        ].map((item) => (
          <div key={item.title} className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center mb-2.5">
              <item.icon className="w-4 h-4" />
            </div>
            <p className="text-sm font-bold text-stone-900">{item.title}</p>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">{item.body}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
        {/* Settings column */}
        <div className="lg:col-span-3 space-y-5">
          <div data-tour="wl-color" className="card-ats-bordered relative">
            <div className="h-1 rounded-t-2xl bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <div className="px-5 sm:px-6 py-4 border-b border-stone-100 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900">Brand color</h3>
                <p className="text-xs text-stone-500 mt-0.5">Careers page accents and CTAs</p>
              </div>
              <span className="badge-success !normal-case !tracking-normal !font-bold shrink-0">Free</span>
            </div>
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setBrandColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      brandColor.toLowerCase() === c.toLowerCase()
                        ? 'border-stone-900 scale-110 shadow-md'
                        : 'border-white ring-1 ring-stone-200 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={/^#[0-9A-Fa-f]{6}$/.test(brandColor) ? brandColor : '#0d9488'}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="w-12 h-11 rounded-xl border border-stone-200 cursor-pointer bg-white shrink-0"
                  aria-label="Pick color"
                />
                <input
                  type="text"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="flex-1 input-ats font-mono"
                  placeholder="#0d9488"
                />
              </div>
            </div>
          </div>

          <div className="card-ats-bordered relative">
            <div className="h-1 rounded-t-2xl bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <div className="px-5 sm:px-6 py-4 border-b border-stone-100 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900">Kit extras</h3>
                <p className="text-xs text-stone-500 mt-0.5">Remove vendor branding from candidate surfaces</p>
              </div>
              {upgradeRequired && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 shrink-0">
                  <Lock size={10} /> Enterprise
                </span>
              )}
            </div>
            <div className="p-5 sm:p-6 space-y-3">
              <ToggleRow
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                label="Enable White-Label Kit"
                description="Master switch for the options below"
              />
              <ToggleRow
                checked={hidePoweredBy}
                onChange={(e) => setHidePoweredBy(e.target.checked)}
                disabled={!enabled}
                label={'Hide “Powered by People Connect HR”'}
                description="Removes the footer credit from your public careers page"
              />
              <div className={!enabled ? 'opacity-40 pointer-events-none' : ''}>
                <label className="label-ats">Email sender display name</label>
                <input
                  type="text"
                  value={emailFromName}
                  onChange={(e) => setEmailFromName(e.target.value)}
                  disabled={!enabled}
                  placeholder="e.g. Acme Talent Team"
                  className="input-ats"
                />
                <p className="text-xs text-stone-400 mt-1.5">Shown as the From name on candidate emails.</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/company-brand')}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-stone-200 bg-white hover:border-brand-200 hover:bg-brand-50/30 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-stone-900">Company Brand</p>
              <p className="text-xs text-stone-500">Logo, tagline, benefits, SEO — full employer brand pack</p>
            </div>
            <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-brand-500" />
          </button>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <button type="button" onClick={load} disabled={saving} className="btn-secondary w-full sm:w-auto">
              Reset
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary w-full sm:w-auto">
              {saving
                ? <><Loader2 size={16} className="animate-spin" /> Saving…</>
                : <><Save className="w-4 h-4" /> Save Settings</>}
            </button>
          </div>
        </div>

        {/* Preview column */}
        <div data-tour="wl-preview" className="lg:col-span-2 lg:sticky lg:top-24">
          <div className="card-ats-bordered relative">
            <div className="h-1 rounded-t-2xl bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
              <Eye className="w-4 h-4 text-brand-600" />
              <div>
                <h3 className="text-sm font-bold text-stone-900">Live preview</h3>
                <p className="text-xs text-stone-500">Updates as you edit</p>
              </div>
            </div>
            <div className="p-4 sm:p-5">
              <LivePreview
                brandColor={/^#[0-9A-Fa-f]{6}$/.test(brandColor) ? brandColor : '#0d9488'}
                orgName={orgName}
                hidePoweredBy={hidePoweredBy}
                enabled={enabled}
                emailFromName={emailFromName}
              />
            </div>
          </div>
        </div>
      </div>

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of White-Label" />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={WL_TOUR_STEPS}
        storageKey={WL_TOUR_KEY}
      />
    </div>
  );
};

export default WhiteLabelSettingsPage;
