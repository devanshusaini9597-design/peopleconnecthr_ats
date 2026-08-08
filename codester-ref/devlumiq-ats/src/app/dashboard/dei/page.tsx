'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Download, Loader2, AlertTriangle, EyeOff } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import { useToast } from '@/components/ui/Toast';
import { PermissionGate } from '@/components/PermissionGate';

interface FunnelStage {
  stage: string;
  total: number;
  breakdown: { gender: Record<string, number>; ethnicity: Record<string, number> };
}

export default function DeiDashboardPage() {
  const toast = useToast();
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [alert, setAlert] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    blindScreeningEnabled: false,
    diverseSlateAlerts: false,
    selfIdFormEnabled: true,
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, sRes] = await Promise.all([
        fetch('/api/dei/metrics', { credentials: 'include' }),
        fetch('/api/dei/settings', { credentials: 'include' }),
      ]);
      const m = await mRes.json().catch(() => ({}));
      const s = await sRes.json().catch(() => ({}));
      if (mRes.ok) {
        setFunnel(m.funnel ?? []);
        setAlert(m.alert?.message ?? null);
      } else {
        toast.error('Error', m.error || 'Failed to load DEI metrics');
      }
      if (sRes.ok && s.settings) setSettings(s.settings);
    } catch {
      toast.error('Error', 'Failed to load DEI dashboard');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const saveSettings = async (patch: Partial<typeof settings>) => {
    setSaving(true);
    try {
      const next = { ...settings, ...patch };
      const res = await fetch('/api/dei/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSettings(data.settings);
      toast.success('Saved', 'DEI settings updated');
      await load();
    } catch (e: unknown) {
      toast.error('Error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = async () => {
    const res = await fetch('/api/dei/metrics', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) {
      toast.error('Export failed', 'Admin/compliance access required');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ofccp-eeo-aggregate-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PermissionGate
      permission="MANAGE_SETTINGS"
      fallback={
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-500">
          DEI & bias analytics are restricted to users with settings/compliance access.
        </div>
      }
    >
      <PageShell>
        <PageHeader
          icon={Shield}
          title="DEI & bias analytics"
          subtitle="Aggregate, opt-in self-ID only — separated from hiring decisions"
        >
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            onClick={() => void exportCsv()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold"
          >
            <Download className="w-4 h-4" /> OFCCP / EEO-1 export
          </motion.button>
        </PageHeader>

        <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
          <p className="text-sm font-bold text-stone-900">Settings</p>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={settings.blindScreeningEnabled}
              disabled={saving}
              onChange={(e) => void saveSettings({ blindScreeningEnabled: e.target.checked })}
            />
            <EyeOff className="w-4 h-4 text-stone-400" />
            Blind screening mode (mask name/photo/LinkedIn in review UI)
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={settings.diverseSlateAlerts}
              disabled={saving}
              onChange={(e) => void saveSettings({ diverseSlateAlerts: e.target.checked })}
            />
            Diverse-slate alerts (aggregate interview stage)
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={settings.selfIdFormEnabled}
              disabled={saving}
              onChange={(e) => void saveSettings({ selfIdFormEnabled: e.target.checked })}
            />
            Voluntary self-ID form on applications
          </label>
          <p className="text-xs text-stone-500">
            Self-ID is optional, stored in a separate table, and must not be used for individual hiring decisions.
          </p>
        </div>

        {alert && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {alert}
          </div>
        )}

        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-sm font-bold text-stone-900 mb-3">Diversity funnel (disclosed self-ID only)</p>
          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-stone-400" /></div>
          ) : funnel.length === 0 ? (
            <div className="py-10 text-center px-4">
              <p className="text-sm font-medium text-stone-600">No self-ID data yet</p>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                Aggregate funnel appears once candidates voluntarily complete the self-identification form on applications.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {funnel.map((f) => (
                <div key={f.stage} className="rounded-xl border border-stone-100 bg-stone-50 p-3">
                  <p className="text-[10px] font-bold uppercase text-stone-400">{f.stage}</p>
                  <p className="text-2xl font-bold text-stone-900 mt-1">{f.total}</p>
                  <p className="text-[11px] text-stone-500 mt-1">
                    {Object.keys(f.breakdown.ethnicity).length} ethnicity bucket(s)
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </PageShell>
    </PermissionGate>
  );
}
