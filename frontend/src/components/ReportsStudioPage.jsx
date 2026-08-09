import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  FileBarChart, Download, RefreshCw, Filter, BarChart3
} from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import FeatureGate from './FeatureGate';
import UpgradeFeatureFallback from './ui/UpgradeFeatureFallback';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import {
  REPORTS_TOUR_KEY, REPORTS_TOUR_STEPS, SECTIONS,
} from './reportsStudio/reportsStudioConstants';
import { ReportsStudioBody } from './reportsStudio/ReportsStudioPanels';

export default function ReportsStudioPage() {
  const { t } = useTranslation();
  const [tourOpen, setTourOpen] = usePageTour(REPORTS_TOUR_KEY);
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState([]);
  const [sources, setSources] = useState([]);
  const [tth, setTth] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [section, setSection] = useState('all');
  const [jobQuery, setJobQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s, tthRes, j] = await Promise.all([
        authenticatedFetch('/api/reports-studio/pipeline').then(readApiJson),
        authenticatedFetch('/api/reports-studio/sources').then(readApiJson),
        authenticatedFetch('/api/reports-studio/time-to-hire').then(readApiJson),
        authenticatedFetch('/api/reports-studio/jobs-performance').then(readApiJson).catch(() => ({ success: false }))
      ]);
      if (!p.success && !s.success && !tthRes.success) {
        throw new Error(p.message || s.message || tthRes.message || 'Failed to load reports');
      }
      setPipeline(p.success ? (p.data || []) : []);
      setSources(s.success ? (s.data || []) : []);
      setTth(tthRes.success ? tthRes.data : null);
      setJobs(j.success ? (j.data || []) : []);
    } catch (err) {
      toast.error(err.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = (rows, filename) => {
    if (!rows?.length) {
      toast.error('Nothing to export');
      return;
    }
    const keys = Object.keys(rows[0]);
    const csv = [
      keys.join(','),
      ...rows.map((r) => keys.map((k) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('CSV downloaded');
  };

  const exportAll = () => {
    const packs = [
      [pipeline, 'pipeline.csv'],
      [sources, 'sources.csv'],
      [jobs, 'jobs-performance.csv']
    ].filter(([rows]) => rows?.length);
    if (!packs.length) {
      toast.error('Nothing to export');
      return;
    }
    packs.forEach(([rows, name]) => exportCsv(rows, name));
  };

  const filteredJobs = useMemo(() => {
    const q = jobQuery.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((j) => String(j.title || '').toLowerCase().includes(q));
  }, [jobs, jobQuery]);

  const pipelineTotal = useMemo(
    () => pipeline.reduce((sum, r) => sum + (Number(r.count) || 0), 0),
    [pipeline]
  );
  const sourcesTotal = useMemo(
    () => sources.reduce((sum, r) => sum + (Number(r.count) || 0), 0),
    [sources]
  );

  const showPipeline = section === 'all' || section === 'pipeline';
  const showSources = section === 'all' || section === 'sources';
  const showJobs = section === 'all' || section === 'jobs';

  return (
    <FeatureGate
      feature="analytics.advanced"
      fallback={
        <UpgradeFeatureFallback
          title="Reports Studio is a Professional feature"
          description="Upgrade for pipeline, source quality, and time-to-hire analytics with CSV export."
        />
      }
    >
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={FileBarChart}
          title={t('pages.reportsStudio.title')}
          subtitle="Pipeline, source quality, time-to-hire, and job performance with CSV export."
          gradientTitle
        >
          <Link to="/analytics" className="btn-secondary w-full sm:w-auto">
            <BarChart3 className="w-4 h-4" /> Analytics
          </Link>
          <button type="button" onClick={exportAll} className="btn-secondary w-full sm:w-auto" disabled={loading}>
            <Download className="w-4 h-4" /> Export all
          </button>
          <button type="button" onClick={load} className="btn-secondary w-full sm:w-auto" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </PageHeader>

        <div data-tour="reports-toolbar" className="toolbar-ats flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
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
            {loading ? 'Loading reports…' : 'Data refreshes on demand'}
          </p>
        </div>

        <ReportsStudioBody
          loading={loading}
          tth={tth}
          pipeline={pipeline}
          sources={sources}
          jobs={jobs}
          filteredJobs={filteredJobs}
          pipelineTotal={pipelineTotal}
          sourcesTotal={sourcesTotal}
          showPipeline={showPipeline}
          showSources={showSources}
          showJobs={showJobs}
          jobQuery={jobQuery}
          setJobQuery={setJobQuery}
          exportCsv={exportCsv}
        />

        <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Reports Studio" />
        <ProductTour open={tourOpen} onClose={() => setTourOpen(false)} steps={REPORTS_TOUR_STEPS} storageKey={REPORTS_TOUR_KEY} />
      </div>
    </FeatureGate>
  );
}
