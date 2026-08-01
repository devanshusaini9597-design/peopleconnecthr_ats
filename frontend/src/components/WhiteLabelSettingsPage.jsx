import React, { useState, useEffect, useCallback } from 'react';
import { Palette, Lock, Loader2, Save } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';

const ToggleRow = ({ checked, onChange, disabled, label, description }) => (
  <label className={`flex items-center justify-between gap-4 py-1 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
    <div className="min-w-0">
      <span className="text-sm font-medium text-stone-900">{label}</span>
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
      setBrandColor(data.data.brandColor);
      setEnabled(!!data.data.whiteLabel.enabled);
      setHidePoweredBy(!!data.data.whiteLabel.hidePoweredBy);
      setEmailFromName(data.data.whiteLabel.emailFromName || '');
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
      <div className="page-shell-ats">
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
          <p className="text-sm text-stone-500 font-medium">Loading white-label settings…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-ats max-w-2xl">
      <PageHeader
        icon={Palette}
        title="White-Label Kit"
        subtitle="Your logo and brand color are always free to customize (Organization → General). This add-on removes our branding from candidate-facing pages and lets you set a custom sender display name for emails."
        gradientTitle
      />

      {upgradeRequired && (
        <div className="flex justify-center">
          <div className="max-w-md w-full text-center card-ats-bordered border-amber-200/80 bg-amber-50/40 p-8 sm:p-10 animate-slide-up">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4 ring-4 ring-amber-100/60">
              <Lock className="w-7 h-7 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">White-Label Kit is an Enterprise add-on</h2>
            <p className="text-stone-500 mt-2 text-sm leading-relaxed">
              Upgrade to Enterprise to turn these settings on. You can still preview them below.
            </p>
            <a href="/billing" className="btn-primary inline-flex mt-6">View Plans</a>
          </div>
        </div>
      )}

      <div className="card-ats-bordered p-5 sm:p-6 space-y-5">
        <div>
          <label className="label-ats">Careers page brand color</label>
          <div className="flex items-center gap-3 mt-1">
            <input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="w-12 h-11 rounded-xl border border-stone-200 cursor-pointer bg-white"
            />
            <input
              type="text"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="flex-1 input-ats font-mono"
            />
          </div>
          <p className="text-xs text-stone-400 mt-1.5">Always free — used on your public careers page and job listings.</p>
        </div>

        <div className="border-t border-stone-100 pt-5 space-y-5">
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
            <input
              type="text"
              value={emailFromName}
              onChange={(e) => setEmailFromName(e.target.value)}
              disabled={!enabled}
              placeholder="e.g. Acme Talent Team"
              className="input-ats disabled:opacity-40"
            />
            <p className="text-xs text-stone-400 mt-1.5">Shown as the &quot;From&quot; name on candidate emails instead of your default sender.</p>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-stone-100">
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Settings</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhiteLabelSettingsPage;
