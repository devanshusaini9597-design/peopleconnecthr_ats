import React, { useState, useEffect, useCallback } from 'react';
import { Palette, Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';

const WhiteLabelSettingsPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [brandColor, setBrandColor] = useState('#4F46E5');
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
    setFeedback(null);
    try {
      const res = await authenticatedFetch('/api/white-label', {
        method: 'PUT',
        body: JSON.stringify({ brandColor, enabled, hidePoweredBy, emailFromName })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.code === 'UPGRADE_REQUIRED') setUpgradeRequired(true);
        setFeedback({ type: 'error', message: data.message || 'Failed to save' });
        return;
      }
      setFeedback({ type: 'success', message: 'White-label settings saved.' });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="page-shell-ats"><div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 text-brand-600 animate-spin" /></div></div>;
  }

  return (
    <div className="page-shell-ats max-w-2xl">
        <PageHeader
          icon={Palette}
          title="White-Label Kit"
          subtitle="Your logo and brand color are always free to customize (Organization → General). This add-on removes our branding from candidate-facing pages and lets you set a custom sender display name for emails."
        />

        {upgradeRequired && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900">White-Label Kit is an Enterprise add-on</p>
              <p className="text-sm text-amber-700 mt-0.5">Upgrade to Enterprise to turn these settings on. You can still preview them below.</p>
              <a href="/billing" className="inline-block mt-2 text-sm font-medium text-amber-900 underline">View Plans</a>
            </div>
          </div>
        )}

        <div className="card-ats-bordered p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Careers page brand color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="w-12 h-10 rounded-lg border border-stone-200 cursor-pointer" />
              <input
                type="text"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="flex-1 input-ats font-mono"
              />
            </div>
            <p className="text-xs text-stone-400 mt-1">Always free — used on your public careers page and job listings.</p>
          </div>

          <div className="border-t border-stone-100 pt-5 space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium text-stone-900">Enable White-Label Kit</span>
                <p className="text-xs text-stone-500">Master switch for the settings below.</p>
              </div>
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-5 h-5 rounded border-stone-300" />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium text-stone-900">Hide "Powered by SkillNix ATS"</span>
                <p className="text-xs text-stone-500">Removes the footer credit from your public careers page.</p>
              </div>
              <input type="checkbox" checked={hidePoweredBy} onChange={(e) => setHidePoweredBy(e.target.checked)} disabled={!enabled} className="w-5 h-5 rounded border-stone-300 disabled:opacity-40" />
            </label>

            <div>
              <label className="block text-sm font-medium text-stone-900 mb-1">Email sender display name</label>
              <input
                type="text"
                value={emailFromName}
                onChange={(e) => setEmailFromName(e.target.value)}
                disabled={!enabled}
                placeholder="e.g. Acme Talent Team"
                className="input-ats disabled:opacity-40"
              />
              <p className="text-xs text-stone-400 mt-1">Shown as the "From" name on candidate emails instead of your default sender.</p>
            </div>
          </div>

          {feedback && (
            <div className={`text-sm flex items-center gap-2 p-3 rounded-lg ${feedback.type === 'success' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
              {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {feedback.message}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>
    </div>
  );
};

export default WhiteLabelSettingsPage;
