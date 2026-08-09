import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search, Users, Briefcase, GitPullRequest, RefreshCw, Filter,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import FeatureGate from './FeatureGate';
import UpgradeFeatureFallback from './ui/UpgradeFeatureFallback';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { SEARCH_TOUR_KEY, SEARCH_TOUR_STEPS } from './globalSearch/globalSearchConstants';
import {
  GlobalSearchKpis, GlobalSearchToolbar, GlobalSearchResults,
} from './globalSearch/GlobalSearchPanels';

export default function GlobalSearchPage() {
  const { t } = useTranslation();
  const [tourOpen, setTourOpen] = usePageTour(SEARCH_TOUR_KEY);
  const toast = useToast();
  const inputRef = useRef(null);
  const [q, setQ] = useState('');
  const [entity, setEntity] = useState('all');
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [data, setData] = useState({ candidates: [], jobs: [], applications: [] });

  const runSearch = useCallback(async (query) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setData({ candidates: [], jobs: [], applications: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await authenticatedFetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
      const json = await readApiJson(res);
      if (!json.success) throw new Error(json.message || 'Search failed');
      setData(json.data || { candidates: [], jobs: [], applications: [] });
    } catch (err) {
      toast.error(err.message || 'Search failed');
      setData({ candidates: [], jobs: [], applications: [] });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setData({ candidates: [], jobs: [], applications: [] });
      return undefined;
    }
    const t = setTimeout(() => runSearch(q), 250);
    return () => clearTimeout(t);
  }, [q, refreshTick, runSearch]);

  const counts = useMemo(() => ({
    candidates: (data.candidates || []).length,
    jobs: (data.jobs || []).length,
    applications: (data.applications || []).length
  }), [data]);

  const totalMatches = counts.candidates + counts.jobs + counts.applications;
  const visibleMatches = entity === 'all' ? totalMatches : (counts[entity] || 0);
  const hasQuery = q.trim().length >= 2;

  const columns = useMemo(() => {
    const all = [
      {
        key: 'candidates',
        title: 'Candidates',
        icon: Users,
        tone: 'brand',
        path: (r) => `/ats?highlight=${r._id}`,
        label: (r) => r.name || 'Untitled',
        sub: (r) => [r.email, r.position].filter(Boolean).join(' · ') || '—',
        meta: (r) => r.status
      },
      {
        key: 'jobs',
        title: 'Jobs',
        icon: Briefcase,
        tone: 'sky',
        path: () => '/jobs',
        label: (r) => r.title || 'Untitled role',
        sub: (r) => [r.location, r.department].filter(Boolean).join(' · ') || '—',
        meta: (r) => (r.isPublished ? 'published' : r.status)
      },
      {
        key: 'applications',
        title: 'Applications',
        icon: GitPullRequest,
        tone: 'violet',
        path: () => '/applications',
        label: (r) => r.candidateId?.name || 'Application',
        sub: (r) => `${r.jobId?.title || 'Role'} · ${r.stage || '—'}`,
        meta: (r) => r.stage
      }
    ];
    if (entity === 'all') return all;
    return all.filter((c) => c.key === entity);
  }, [entity]);

  const clearSearch = () => {
    setQ('');
    inputRef.current?.focus();
  };

  const handleRefresh = () => {
    if (!hasQuery) {
      inputRef.current?.focus();
      return;
    }
    setRefreshTick((n) => n + 1);
  };

  return (
    <FeatureGate
      feature="search.global"
      fallback={
        <UpgradeFeatureFallback
          title="Global search is available on Starter+"
          description="Search candidates, jobs, and applications from one place."
        />
      }
    >
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={Search}
          title={t('pages.globalSearch.title')}
          subtitle="Find candidates, jobs, and applications instantly across your workspace."
          gradientTitle
        >
          <Link to="/candidate-search" className="btn-secondary w-full sm:w-auto">
            <Filter className="w-4 h-4" />
            Advanced filters
          </Link>
          <button
            type="button"
            className="btn-secondary w-full sm:w-auto"
            disabled={loading}
            onClick={handleRefresh}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </PageHeader>

        <GlobalSearchKpis
          hasQuery={hasQuery}
          totalMatches={totalMatches}
          counts={counts}
          loading={loading}
          setEntity={setEntity}
        />

        <GlobalSearchToolbar
          inputRef={inputRef}
          q={q}
          setQ={setQ}
          clearSearch={clearSearch}
          hasQuery={hasQuery}
          loading={loading}
          visibleMatches={visibleMatches}
          entity={entity}
          setEntity={setEntity}
          counts={counts}
          totalMatches={totalMatches}
        />

        <GlobalSearchResults
          loading={loading}
          hasQuery={hasQuery}
          visibleMatches={visibleMatches}
          entity={entity}
          totalMatches={totalMatches}
          q={q}
          clearSearch={clearSearch}
          setEntity={setEntity}
          setQ={setQ}
          inputRef={inputRef}
          columns={columns}
          data={data}
        />

        <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Global Search" />
        <ProductTour open={tourOpen} onClose={() => setTourOpen(false)} steps={SEARCH_TOUR_STEPS} storageKey={SEARCH_TOUR_KEY} />
      </div>
    </FeatureGate>
  );
}
