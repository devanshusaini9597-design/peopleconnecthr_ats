import React, { useState, useEffect, useCallback } from 'react';
import { Palette, Lock, Loader2, Save, Sparkles, Mail } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';

const ToggleRow = ({ checked, onChange, disabled, label, description }) => (
  <label className={`flex items-center justify-between gap-4 p-3.5 rounded-xl border transition-colors ${
    disabled
      ? 'opacity-50 cursor-not-allowed border-stone-100 bg-stone-50/40'
      : 'cursor-pointer border-stone-100 bg-stone-50/50 hover:bg-brand-50/30 hover:border-brand-100'
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

const PRESET_COLORS = ['#0d9488', '#0891b2', '#4f46e5', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0f172a'];

const WhiteLabelSettingsPage = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [brandColor, setBrandColor] = useState('#0d9488');
  const [enabled, setEnabled] = useState(false);
  const [hidePoweredBy, setHidePoweredBy] = useState(false);
  const [emailFromName, setEmailFromName] = useState('');

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
        body: JSON.stringify({ brandColor, enabled, hidePoweredBy, emailFromName })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.code === 'UPGRADE_REQUIRED') setUpgradeRequired(true);
        toast?.error?.(data.message || 'Failed to save');
        return;
      }
      toast?.success?.('White-label settings saved.');
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
        <div className="card-ats-bordered p-6 space-y-4 mt-2">
          <div className="h-11 w-full skeleton-ats rounded-xl" />
          <div className="h-14 w-full skeleton-ats rounded-xl" />
          <div className="h-14 w-full skeleton-ats rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-ats animate-page-enter max-w-3xl">
      <PageHeader
        icon={Palette}
        title="White-Label Kit"
        subtitle="Brand color is always free. Kit extras remove our branding from candidate-facing surfaces."
        gradientTitle
      />

      {upgradeRequired && (
        <div className="card-ats-bordered border-amber-200/80 bg-amber-50/40 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Lock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-stone-900 tracking-tight">Enterprise add-on</h3>
            <p className="text-sm text-stone-500 mt-0.5 leading-relaxed">
              Upgrade to turn kit toggles on. You can still set brand color and preview settings below.
            </p>
          </div>
          <a href="/billing" className="btn-primary !text-sm whitespace-nowrap shrink-0">View Plans</a>
        </div>
      )}

      <div className="card-ats-bordered p-5 sm:p-6 space-y-5 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />

        <div>
          <h3 className="section-title-ats !mb-3">
            <Sparkles className="w-4 h-4 text-brand-600" />
            Brand color
            <span className="ml-auto badge-success !normal-case !tracking-normal !font-bold">Free</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setBrandColor(c)}
                className={`w-8 h-8 rounded-full border-2 transition-transform ${
                  brandColor.toLowerCase() === c.toLowerCase()
                    ? 'border-stone-900 scale-110 shadow-md'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="w-12 h-11 rounded-xl border border-stone-200 cursor-pointer bg-white shrink-0"
            />
            <input
              type="text"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="flex-1 input-ats font-mono"
            />
            <div
              className="hidden sm:flex h-11 px-4 rounded-xl items-center text-white text-xs font-bold shadow-sm shrink-0"
              style={{ backgroundColor: brandColor }}
            >
              Preview
            </div>
          </div>
          <p className="text-xs text-stone-400 mt-2">Used on your public careers page and job listings.</p>
        </div>

        <div className="border-t border-stone-100 pt-5 space-y-3">
          <h3 className="section-title-ats !mb-1">
            <Palette className="w-4 h-4 text-brand-600" />
            Kit extras
          </h3>
          <ToggleRow
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            label="Enable White-Label Kit"
            description="Master switch for the settings below."
          />
          <ToggleRow
            checked={hidePoweredBy}
            onChange={(e) => setHidePoweredBy(e.target.checked)}
            disabled={!enabled}
            label={'Hide "Powered by SkillNix ATS"'}
            description="Removes the footer credit from your public careers page."
          />
          <div>
            <label className="label-ats">Email sender display name</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                type="text"
                value={emailFromName}
                onChange={(e) => setEmailFromName(e.target.value)}
                disabled={!enabled}
                placeholder="e.g. Acme Talent Team"
                className="input-ats !pl-10 disabled:opacity-40"
              />
            </div>
            <p className="text-xs text-stone-400 mt-1.5">Shown as the From name on candidate emails.</p>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-stone-100">
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary w-full sm:w-auto">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Settings</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhiteLabelSettingsPage;
