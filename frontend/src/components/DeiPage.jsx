import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, RefreshCw, Download, Filter, BarChart3,
} from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import FeatureGate from './FeatureGate';
import UpgradeFeatureFallback from './ui/UpgradeFeatureFallback';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { DEI_TOUR_KEY, DEI_TOUR_STEPS, SECTIONS } from './dei/deiConstants';
import { DeiBody } from './dei/DeiPanels';

export default function DeiPage() {
  const [tourOpen, setTourOpen] = usePageTour(DEI_TOUR_KEY);
  const toast = useToast();
  const shortlistTimer = useRef(null);
  const settingsRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState('all');
  const [settings, setSettings] = useState({
    blindScreeningEnabled: false,
    diverseSlateAlerts: false,
    selfIdFormEnabled: true,
    minDiverseShortlist: 2
  });
  const [shortlistDraft, setShortlistDraft] = useState(2);
  const [metrics, setMetrics] = useState(null);

  settingsRef.current = settings;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, mRes] = await Promise.all([
        authenticatedFetch('/api/dei/settings'),
        authenticatedFetch('/api/dei/metrics')
      ]);
      const sData = await readApiJson(sRes);
      const mData = await readApiJson(mRes);
      if (sData.success) {
        const next = {
          blindScreeningEnabled: false,
          diverseSlateAlerts: false,
          selfIdFormEnabled: true,
          minDiverseShortlist: 2,
          ...sData.data
        };
        setSettings(next);
        setShortlistDraft(next.minDiverseShortlist || 2);
      }
      if (mData.success) setMetrics(mData.data);
      if (!sData.success) throw new Error(sData.message);
    } catch (err) {
      toast.error(err.message || 'Failed to load DEI data');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => () => {
    if (shortlistTimer.current) clearTimeout(shortlistTimer.current);
  }, []);

  const persistSettings = async (next) => {
    setSettings(next);
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/dei/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next)
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('DEI settings saved');
      const mRes = await authenticatedFetch('/api/dei/metrics');
      const mData = await readApiJson(mRes);
      if (mData.success) setMetrics(mData.data);
    } catch (err) {
      toast.error(err.message);
      load();
    } finally {
      setSaving(false);
    }
  };

  const updateToggle = (key, value) => {
    persistSettings({ ...settingsRef.current, [key]: value });
  };

  const onShortlistChange = (raw) => {
    const n = Math.max(1, Number(raw) || 1);
    setShortlistDraft(n);
    if (shortlistTimer.current) clearTimeout(shortlistTimer.current);
    shortlistTimer.current = setTimeout(() => {
      persistSettings({ ...settingsRef.current, minDiverseShortlist: n });
    }, 450);
  };

  const exportCsv = () => {
    if (!metrics?.funnel?.length) {
      toast.error('Nothing to export');
      return;
    }
    const rows = [['Stage', 'Total', 'Gender breakdown', 'Ethnicity breakdown']];
    for (const stage of metrics.funnel) {
      rows.push([
        stage.stage,
        stage.total,
        JSON.stringify(stage.breakdown?.gender || {}),
        JSON.stringify(stage.breakdown?.ethnicity || {})
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dei-funnel-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  const controlsOn = useMemo(() => (
    [settings.blindScreeningEnabled, settings.diverseSlateAlerts, settings.selfIdFormEnabled]
      .filter(Boolean).length
  ), [settings]);

  const showControls = section === 'all' || section === 'controls';
  const showFunnel = section === 'all' || section === 'funnel';

  return (
    <FeatureGate
      feature="analytics.dei"
      fallback={
        <UpgradeFeatureFallback
          title="DEI tools are an Enterprise feature"
          description="Upgrade for blind screening, voluntary self-ID analytics, and diverse-slate alerts."
        />
      }
    >
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={Shield}
          title="DEI & Fair Hiring"
          subtitle="Blind screening, voluntary self-ID analytics, and diverse-slate alerts."
          gradientTitle
        >
          <Link to="/analytics" className="btn-secondary w-full sm:w-auto">
            <BarChart3 className="w-4 h-4" /> Analytics
          </Link>
          <button type="button" onClick={load} className="btn-secondary w-full sm:w-auto" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="btn-primary w-full sm:w-auto"
            disabled={!metrics?.funnel?.length}
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </PageHeader>

        <div data-tour="dei-toolbar" className="toolbar-ats flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 px-1">
              <Filter size={14} /> View
            </div>
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSection(s.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  section === s.key
                    ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/20'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-brand-300 hover:bg-brand-50/50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-stone-400 font-medium sm:text-right flex-shrink-0">
            {saving ? 'Saving settings…' : loading ? 'Loading…' : 'Aggregate metrics only — never shown on candidate rows'}
          </p>
        </div>

        <DeiBody
          loading={loading}
          metrics={metrics}
          controlsOn={controlsOn}
          showControls={showControls}
          showFunnel={showFunnel}
          settings={settings}
          saving={saving}
          updateToggle={updateToggle}
          shortlistDraft={shortlistDraft}
          onShortlistChange={onShortlistChange}
        />

        <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of DEI" />
        <ProductTour open={tourOpen} onClose={() => setTourOpen(false)} steps={DEI_TOUR_STEPS} storageKey={DEI_TOUR_KEY} />
      </div>
    </FeatureGate>
  );
}
