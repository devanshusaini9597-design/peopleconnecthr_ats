import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Briefcase } from 'lucide-react';
import { useNavigate, useSearchParams, useBlocker } from 'react-router-dom';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import ConfirmationModal from './ConfirmationModal';
import PageHeader from './ui/PageHeader';
import FeatureGate from './FeatureGate';
import UpgradeFeatureFallback from './ui/UpgradeFeatureFallback';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { SEARCH_TOUR_KEY, SEARCH_TOUR_STEPS, emptySearchData, ENTITY_FILTERS } from './globalSearch/globalSearchConstants';
import {
  GlobalSearchKpis, GlobalSearchWorkbench, GlobalSearchSimpleResults,
} from './globalSearch/GlobalSearchPanels';
import GlobalSearchDesk from './globalSearch/GlobalSearchDesk';
import GlobalSearchMisDesk from './globalSearch/GlobalSearchMisDesk';
import GlobalSearchMergedDesk from './globalSearch/GlobalSearchMergedDesk';
import CandidatesAdvancedFilters from './ats/CandidatesAdvancedFilters';
import { EMPTY_ADVANCED_FILTERS, PAGE_SIZE } from './ats/atsConstants';
import { CANDIDATE_LOCKED_COLUMN_KEYS } from './ats/candidateColumnPrefs';
import { fetchPicklist, PICKLIST_DROPDOWN_LIMIT } from '../utils/orgListFetch';
import { canAccessMis } from '../utils/misAccess';
import { uptoCtcOptions, fromCtcOptions } from '../utils/ctcRanges';

const SEARCH_SESSION_KEY = 'skillnix_gs_live_v1';

function clearSearchSession() {
  try {
    sessionStorage.removeItem(SEARCH_SESSION_KEY);
  } catch { /* ignore */ }
}
const STATS_INTERVAL_MS = 120000;
const TAB_KEYS = new Set(['all', 'candidates', 'mis']);

const EMPTY_GLOBAL_FILTERS = {
  ...EMPTY_ADVANCED_FILTERS,
  position: [],
  product: [],
  client: [],
  locationRadiusKm: '50',
};

function snapshotSearch({ q, filters, period, from, to, searchScope }) {
  return {
    q: String(q || '').trim(),
    filters: { ...EMPTY_GLOBAL_FILTERS, ...(filters || {}) },
    period: String(period || '').trim(),
    from: String(from || '').trim(),
    to: String(to || '').trim(),
    searchScope: String(searchScope || 'all').trim() || 'all',
  };
}

function countFilledFilters(filters = {}) {
  return Object.entries(filters).filter(([key, v]) => {
    if (key === 'locationRadiusKm' || key === 'expectedCtcMin' || key === 'expectedCtcMax') return false;
    if (Array.isArray(v)) return v.some((item) => String(item || '').trim());
    return Boolean(String(v || '').trim());
  }).length;
}

function appendFilterParams(params, filters = {}) {
  const loc = String(filters.location || '').trim();
  Object.entries(filters).forEach(([key, val]) => {
    if (key === 'expectedCtcMin' || key === 'expectedCtcMax') return;
    if (key === 'locationRadiusKm' && !loc) return;
    if (Array.isArray(val)) {
      val.map((item) => String(item || '').trim()).filter(Boolean).forEach((item) => params.append(key, item));
      return;
    }
    const v = String(val || '').trim();
    if (v) params.set(key, v);
  });
}

function buildSearchParams(snap, { page, dateSort, extra } = {}) {
  const params = new URLSearchParams();
  if (snap.q) params.set('q', snap.q);
  if (snap.searchScope && snap.searchScope !== 'all') params.set('searchScope', snap.searchScope);
  appendFilterParams(params, snap.filters);
  if (snap.period) params.set('period', snap.period);
  if (snap.from) params.set('from', snap.from);
  if (snap.to) params.set('to', snap.to);
  if (page) params.set('page', String(page));
  params.set('limit', String(PAGE_SIZE));
  if (dateSort) params.set('sortDate', dateSort);
  if (extra) {
    Object.entries(extra).forEach(([key, val]) => {
      if (val != null && val !== '') params.set(key, String(val));
    });
  }
  return params;
}

function picklistOptions(items, emptyLabel) {
  const names = (items || [])
    .map((item) => String(item?.name || item?.label || item?.value || '').trim())
    .filter(Boolean);
  const seen = new Set();
  const opts = [{ value: '', label: emptyLabel }];
  names.forEach((name) => {
    const key = name.toUpperCase();
    if (seen.has(key)) return;
    seen.add(key);
    opts.push({ value: name, label: name });
  });
  return opts;
}

export default function GlobalSearchPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const showMis = canAccessMis(user);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tourOpen, setTourOpen] = usePageTour(SEARCH_TOUR_KEY);
  const toast = useToast();
  const inputRef = useRef(null);

  const [q, setQ] = useState('');
  const [searchScope, setSearchScope] = useState('all');
  const [entity, setEntity] = useState('candidates');
  const [page, setPage] = useState(1);
  const skipPageReset = useRef(true);
  const workbenchRef = useRef(null);
  const searchAbortRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [countsLoading, setCountsLoading] = useState(false);
  const [data, setData] = useState(emptySearchData());
  const [workspaceTotals, setWorkspaceTotals] = useState(null);
  const [statsScope, setStatsScope] = useState('desk');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [advancedSearchFilters, setAdvancedSearchFilters] = useState(() => ({ ...EMPTY_GLOBAL_FILTERS }));
  const [activityPeriod, setActivityPeriod] = useState('');
  const [activityFrom, setActivityFrom] = useState('');
  const [activityTo, setActivityTo] = useState('');
  const [applied, setApplied] = useState(() => snapshotSearch({
    q: '',
    filters: { ...EMPTY_GLOBAL_FILTERS },
    period: '',
    from: '',
    to: '',
    searchScope: 'all',
  }));
  const [hasRun, setHasRun] = useState(false);
  const [masterPositions, setMasterPositions] = useState([]);
  const [masterProducts, setMasterProducts] = useState([]);
  const [masterClients, setMasterClients] = useState([]);
  const [columnMeta, setColumnMeta] = useState(null);
  const onColumnMeta = useCallback((meta) => setColumnMeta(meta), []);
  const [dateSort, setDateSort] = useState('latest');

  const draft = useMemo(
    () => snapshotSearch({
      q,
      filters: advancedSearchFilters,
      period: activityPeriod,
      from: activityFrom,
      to: activityTo,
      searchScope,
    }),
    [q, advancedSearchFilters, activityPeriod, activityFrom, activityTo, searchScope],
  );
  const filtersDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(applied),
    [draft, applied],
  );
  const activeAdvFilterCount = useMemo(
    () => countFilledFilters(applied.filters) + (applied.period ? 1 : 0),
    [applied],
  );
  const searchInProgress = Boolean(
    hasRun
    || String(q || '').trim()
    || countFilledFilters(advancedSearchFilters)
    || activityPeriod,
  );
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (
    searchInProgress && currentLocation.pathname !== nextLocation.pathname
  ));

  useEffect(() => {
    clearSearchSession();
    if (searchParams.get('q') || searchParams.get('page') || searchParams.get('type')) {
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchPicklist('/api/positions', { limit: PICKLIST_DROPDOWN_LIMIT }).catch(() => []),
      fetchPicklist('/api/org-lists/product', { limit: PICKLIST_DROPDOWN_LIMIT }).catch(() => []),
      fetchPicklist('/api/clients', { limit: PICKLIST_DROPDOWN_LIMIT }).catch(() => []),
    ]).then(([positions, products, clients]) => {
      if (cancelled) return;
      setMasterPositions(Array.isArray(positions) ? positions : []);
      setMasterProducts(Array.isArray(products) ? products : []);
      setMasterClients(Array.isArray(clients) ? clients : []);
    });
    return () => { cancelled = true; };
  }, []);

  const positionFilterOptions = useMemo(
    () => [
      { value: '', label: 'All Positions', icon: Briefcase },
      ...masterPositions.map((pos) => ({ value: pos.name, label: pos.name, icon: Briefcase })),
    ],
    [masterPositions],
  );
  const productFilterOptions = useMemo(
    () => picklistOptions(masterProducts, 'All products'),
    [masterProducts],
  );
  const clientFilterOptions = useMemo(
    () => picklistOptions(masterClients, 'All clients'),
    [masterClients],
  );
  const expOptions = useMemo(
    () => [
      { value: '', label: 'Any' },
      ...[...Array(31).keys()].map((num) => ({
        value: String(num),
        label: `${num} ${num === 1 ? 'year' : 'years'}`,
      })),
    ],
    [],
  );
  const ctcFilterOptions = useMemo(
    () => [{ value: '', label: 'Any CTC' }, ...uptoCtcOptions()],
    [],
  );
  const ctcMinFilterOptions = useMemo(
    () => [{ value: '', label: 'Any CTC' }, ...fromCtcOptions()],
    [],
  );
  const [outreachJobs, setOutreachJobs] = useState([]);

  useEffect(() => {
    let cancelled = false;
    authenticatedFetch('/api/jobs?isTemplate=false')
      .then((res) => (res.ok ? res.json() : []))
      .then((payload) => {
        if (cancelled) return;
        const list = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
        setOutreachJobs(list.filter((job) => String(job?.status || '').toLowerCase() !== 'cancelled'));
      })
      .catch(() => {
        if (!cancelled) setOutreachJobs([]);
      });
    return () => { cancelled = true; };
  }, []);

  const fetchWorkspaceStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await authenticatedFetch('/api/search?stats=1');
      const json = await readApiJson(res);
      if (json.success && json.data?.totals) {
        setWorkspaceTotals(json.data.totals);
        setStatsScope(json.data.scope === 'organization' ? 'organization' : 'desk');
      }
    } catch {
      /* keep last known totals */
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const runSearch = useCallback(async (nextApplied, nextPage) => {
    const snap = snapshotSearch(nextApplied || {});
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setLoading(true);
    setCountsLoading(true);
    let listed = false;
    try {
      const params = buildSearchParams(snap, { page: nextPage || 1, dateSort });
      const countParams = buildSearchParams(snap, { page: 1, dateSort, extra: { countOnly: '1' } });
      // Start exact count immediately alongside the page load — never show a fake "51+" floor.
      const countPromise = authenticatedFetch(`/api/search?${countParams.toString()}`, { signal: controller.signal })
        .then((res) => readApiJson(res))
        .catch((err) => {
          if (err?.name === 'AbortError' || controller.signal.aborted) return null;
          return null;
        });

      const res = await authenticatedFetch(`/api/search?${params.toString()}`, { signal: controller.signal });
      const json = await readApiJson(res);
      if (controller.signal.aborted) return;
      if (!json.success) throw new Error(json.message || 'Search failed');
      listed = true;
      const payload = json.data || {};
      const side = payload.exact || {};
      const listExact = {
        candidates: Boolean(side.candidates),
        mis: Boolean(side.mis),
        people: Boolean(side.people || (side.candidates && side.mis)),
      };
      setData({
        ...emptySearchData(),
        ...payload,
        totals: {
          ...(payload.totals || {}),
          candidates: listExact.candidates ? Number(payload.totals?.candidates) || 0 : 0,
          mis: listExact.mis ? Number(payload.totals?.mis) || 0 : 0,
          people: listExact.people ? Number(payload.totals?.people) || 0 : 0,
        },
        countsExact: Boolean(payload.countsExact) || listExact.people,
        exact: listExact,
        floors: null,
        hasMore: payload.hasMore || { candidates: false, mis: false },
      });
      setLoading(false);

      const alreadyExact = Boolean(payload.countsExact) || (listExact.candidates && listExact.mis);
      if (!alreadyExact) {
        const countJson = await countPromise;
        if (controller.signal.aborted) return;
        const counted = countJson?.data || {};
        const nextTotals = counted.totals || {};
        const countedSide = counted.exact || {};
        const candN = Number(nextTotals.candidates);
        const misN = Number(nextTotals.mis);
        const candRows = (payload.candidates || []).length;
        const misRows = (payload.mis || []).length;
        const candOk = Number.isFinite(candN) && candN >= 0 && !(candN === 0 && candRows > 0);
        const misOk = Number.isFinite(misN) && misN >= 0 && !(misN === 0 && misRows > 0);
        if (countJson?.success && (candOk || misOk)) {
          setData((prev) => {
            const candidates = candOk ? candN : (Number(prev.totals?.candidates) || 0);
            const mis = misOk ? misN : (Number(prev.totals?.mis) || 0);
            const exact = {
              candidates: Boolean(candOk && countedSide.candidates !== false),
              mis: Boolean(misOk && countedSide.mis !== false),
            };
            exact.people = exact.candidates && exact.mis;
            return {
              ...prev,
              totals: {
                ...(prev.totals || {}),
                candidates,
                mis,
                people: candidates + mis,
              },
              exact,
              countsExact: exact.people,
              floors: null,
            };
          });
        }
      }
      if (!controller.signal.aborted) setCountsLoading(false);
    } catch (err) {
      if (err?.name === 'AbortError' || controller.signal.aborted) return;
      toast.error(err.message || 'Search failed');
      if (!listed) setData(emptySearchData());
      setLoading(false);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setCountsLoading(false);
      }
    }
  }, [toast, dateSort]);

  const applySearch = useCallback(() => {
    const useAdv = showAdvancedSearch;
    if (useAdv && draft.period === 'custom' && (!draft.from || !draft.to)) {
      toast.warning('Select both From and To dates for a custom range.');
      return { ok: false };
    }
    const minCtc = parseFloat(draft.filters?.ctcMin);
    const maxCtc = parseFloat(draft.filters?.ctcMax);
    if (Number.isFinite(minCtc) && Number.isFinite(maxCtc) && minCtc > maxCtc) {
      toast.warning('Minimum CTC cannot be higher than maximum CTC.');
      return { ok: false };
    }
    const snap = snapshotSearch({
      q,
      filters: useAdv ? advancedSearchFilters : { ...EMPTY_GLOBAL_FILTERS },
      period: useAdv ? activityPeriod : '',
      from: useAdv ? activityFrom : '',
      to: useAdv ? activityTo : '',
      searchScope,
    });
    if (!useAdv) {
      setAdvancedSearchFilters({ ...EMPTY_GLOBAL_FILTERS });
      setActivityPeriod('');
      setActivityFrom('');
      setActivityTo('');
    }
    setApplied(snap);
    setPage(1);
    setHasRun(true);
    return { ok: true };
  }, [showAdvancedSearch, draft, q, advancedSearchFilters, activityPeriod, activityFrom, activityTo, searchScope, toast]);

  const setAdvancedOpen = useCallback((next) => {
    setShowAdvancedSearch((open) => (typeof next === 'function' ? next(open) : Boolean(next)));
  }, []);

  useEffect(() => {
    fetchWorkspaceStats();
  }, [fetchWorkspaceStats]);

  useEffect(() => {
    const id = setInterval(() => {
      fetchWorkspaceStats();
    }, STATS_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchWorkspaceStats]);

  useEffect(() => {
    if (!showMis && entity === 'mis') setEntity('candidates');
  }, [showMis, entity]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (entity && entity !== 'candidates') next.set('type', entity);
    setSearchParams(next, { replace: true });
  }, [entity, setSearchParams]);

  useEffect(() => {
    if (skipPageReset.current) {
      skipPageReset.current = false;
      return;
    }
    setPage(1);
  }, [entity]);

  useEffect(() => {
    if (!hasRun) return undefined;
    runSearch(applied, page);
    return () => {
      searchAbortRef.current?.abort();
    };
  }, [hasRun, applied, page, runSearch]);

  const searchCounts = useMemo(() => {
    const totals = data.totals || {};
    const flags = data.exact || {};
    const candExact = flags.candidates != null ? Boolean(flags.candidates) : Boolean(data.countsExact);
    const misExact = flags.mis != null ? Boolean(flags.mis) : Boolean(data.countsExact);
    const peopleExact = flags.people != null ? Boolean(flags.people) : (candExact && misExact);
    const candidates = candExact ? (Number(totals.candidates) || 0) : 0;
    const mis = misExact ? (Number(totals.mis) || 0) : 0;
    const people = peopleExact ? (Number(totals.people) || (candidates + mis)) : 0;
    return {
      people,
      candidates,
      jobs: Number(totals.jobs) || 0,
      applications: Number(totals.applications) || 0,
      mis,
      interviews: Number(totals.interviews) || 0,
      jobFit: Number(totals.jobFit) || 0,
      related: Number(totals.related) || 0,
      exact: peopleExact,
      exactBy: { candidates: candExact, mis: misExact, people: peopleExact, all: peopleExact },
      plus: { candidates: false, mis: false, people: false, all: false },
      floors: null,
    };
  }, [data]);

  const kpiCounts = {
    candidates: workspaceTotals?.candidates || 0,
    mis: workspaceTotals?.mis || 0,
    jobs: workspaceTotals?.jobs || 0,
  };

  const deskRows = data.candidates || [];
  const audienceQuery = useMemo(() => ({
    q: applied.q,
    searchScope: applied.searchScope,
    period: applied.period,
    from: applied.from,
    to: applied.to,
    ...(applied.filters || {}),
  }), [applied]);

  const fetchMatching = useCallback(async (kind) => {
    const snap = snapshotSearch(applied);
    const loadEntity = async (entity) => {
      const ids = [];
      const people = [];
      const contacts = [];
      const candidates = [];
      const seen = new Set();
      let after = '';
      let capped = false;
      // Page until hasMore is false — do not soft-cap by wall clock (that made bulk
      // email show a fixed-looking count like "Email 100 candidates").
      const batch = 500;
      // 500 × 400 = 200k ids max; far above real org sizes, still a safety valve.
      const MAX_PAGES = 400;

      for (let guard = 0; guard < MAX_PAGES; guard += 1) {
        const params = new URLSearchParams();
        if (snap.q) params.set('q', snap.q);
        if (snap.searchScope && snap.searchScope !== 'all') params.set('searchScope', snap.searchScope);
        appendFilterParams(params, snap.filters);
        if (snap.period) params.set('period', snap.period);
        if (snap.from) params.set('from', snap.from);
        if (snap.to) params.set('to', snap.to);
        params.set('idsOnly', '1');
        params.set('entity', entity);
        params.set('idLimit', String(batch));
        params.set('idSkip', String(seen.size));
        if (after) params.set('idAfter', after);

        let json;
        try {
          const res = await authenticatedFetch(`/api/search?${params.toString()}`);
          json = await readApiJson(res);
        } catch (err) {
          if (ids.length) {
            capped = true;
            break;
          }
          throw err;
        }
        if (!json.success) {
          if (ids.length) {
            capped = true;
            break;
          }
          throw new Error(json.message || 'Could not load matching ids');
        }
        const payload = json.data || {};
        const chunkIds = (payload.ids || []).map(String).filter(Boolean);
        let added = 0;
        chunkIds.forEach((id) => {
          if (seen.has(id)) return;
          seen.add(id);
          ids.push(id);
          added += 1;
        });
        people.push(...(payload.people || []));
        contacts.push(...(payload.contacts || []));
        candidates.push(...(payload.candidates || []));
        capped = capped || Boolean(payload.capped);

        const nextAfter = String(payload.nextAfter || chunkIds[chunkIds.length - 1] || '');
        if (!payload.hasMore || !chunkIds.length || added === 0) break;
        if (after && nextAfter && after === nextAfter) break;
        after = nextAfter;
        if (!after) break;
        if (guard === MAX_PAGES - 1) capped = true;
      }
      return { ids, people, contacts, candidates, capped };
    };

    if (kind === 'all') {
      const [cand, mis] = await Promise.all([loadEntity('candidates'), loadEntity('mis')]);
      const people = [...cand.people, ...mis.people];
      const ids = [...new Set([...cand.ids, ...mis.ids])];
      return {
        ids,
        rows: people,
        people,
        contacts: mis.contacts,
        candidates: cand.candidates,
        total: ids.length,
        capped: Boolean(cand.capped || mis.capped),
      };
    }

    const one = await loadEntity(kind === 'mis' ? 'mis' : 'candidates');
    return {
      ids: one.ids,
      rows: one.people.length ? one.people : (one.contacts.length ? one.contacts : one.candidates),
      people: one.people,
      contacts: one.contacts,
      candidates: one.candidates,
      total: one.ids.length,
      capped: one.capped,
    };
  }, [applied]);

  const onCardClick = (key) => {
    if (key === 'jobs') {
      navigate('/jobs');
      return;
    }
    if (key === 'mis' && !showMis) return;
    setEntity(TAB_KEYS.has(key) ? key : 'candidates');
    if (!hasRun) applySearch();
    window.requestAnimationFrame(() => {
      workbenchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const clearSearch = () => {
    const empty = snapshotSearch({
      q: '',
      filters: { ...EMPTY_GLOBAL_FILTERS },
      period: '',
      from: '',
      to: '',
      searchScope,
    });
    setQ('');
    setAdvancedSearchFilters({ ...EMPTY_GLOBAL_FILTERS });
    setActivityPeriod('');
    setActivityFrom('');
    setActivityTo('');
    setApplied(empty);
    setPage(1);
    setHasRun(false);
    setData(emptySearchData());
    clearSearchSession();
    toast.info('Search cleared');
    inputRef.current?.focus();
  };

  return (
    <FeatureGate
      feature="search.global"
      fallback={
        <UpgradeFeatureFallback
          title="Global Search is available on Starter+"
          description="Search candidates and MIS contacts from one place, then email or update matching records."
        />
      }
    >
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={Search}
          title={t('pages.globalSearch.title')}
          subtitle={t('pages.globalSearch.subtitle')}
          gradientTitle
        >
          <button
            type="button"
            className="btn-secondary w-full sm:w-auto"
            disabled={statsLoading}
            onClick={fetchWorkspaceStats}
          >
            <RefreshCw className={`w-4 h-4 ${statsLoading ? 'animate-spin' : ''}`} />
            Refresh totals
          </button>
        </PageHeader>

        <GlobalSearchKpis
          counts={kpiCounts}
          loading={statsLoading && !workspaceTotals}
          onCardClick={onCardClick}
          scope={statsScope}
          showMis={showMis}
        />

        <GlobalSearchWorkbench
          workbenchRef={workbenchRef}
          inputRef={inputRef}
          q={q}
          setQ={setQ}
          searchScope={searchScope}
          setSearchScope={setSearchScope}
          onSearch={applySearch}
          clearSearch={clearSearch}
          hasRun={hasRun}
          loading={loading}
          showAdvancedSearch={showAdvancedSearch}
          setShowAdvancedSearch={setAdvancedOpen}
          activeAdvFilterCount={showAdvancedSearch ? activeAdvFilterCount : 0}
          columnOptions={hasRun && entity === 'candidates' ? columnMeta?.columnOptions : undefined}
          visibleColumnIds={columnMeta?.visibleColumnIds}
          onVisibleColumnsChange={columnMeta?.setVisibleColumnIds}
          onSelectAllColumns={() => columnMeta?.setVisibleColumnIds?.(columnMeta.availableColumnKeys || [])}
          onClearAllColumns={() => columnMeta?.setVisibleColumnIds?.(
            CANDIDATE_LOCKED_COLUMN_KEYS.filter((k) => (columnMeta.availableColumnKeys || []).includes(k))
          )}
          onResetColumns={() => columnMeta?.setVisibleColumnIds?.(columnMeta.availableColumnKeys || [])}
          entity={entity}
          setEntity={(key) => setEntity(TAB_KEYS.has(key) && (key !== 'mis' || showMis) ? key : 'candidates')}
          entityTabs={ENTITY_FILTERS.filter((f) => showMis || f.key !== 'mis')}
          counts={searchCounts}
          countsLoading={countsLoading}
          rowCounts={{
            people: (data.people || []).length,
            candidates: (data.candidates || []).length,
            mis: (data.mis || []).length,
          }}
          filterPanel={(
            <CandidatesAdvancedFilters
              showAdvancedSearch={showAdvancedSearch}
              activeAdvFilterCount={activeAdvFilterCount}
              clearAdvancedFilters={() => {
                setAdvancedSearchFilters({ ...EMPTY_GLOBAL_FILTERS });
                setActivityPeriod('');
                setActivityFrom('');
                setActivityTo('');
                const empty = snapshotSearch({
                  q,
                  filters: { ...EMPTY_GLOBAL_FILTERS },
                  period: '',
                  from: '',
                  to: '',
                  searchScope,
                });
                setApplied(empty);
                setPage(1);
              }}
              advancedSearchFilters={advancedSearchFilters}
              setAdvancedSearchFilters={setAdvancedSearchFilters}
              positionFilterOptions={positionFilterOptions}
              productFilterOptions={productFilterOptions}
              clientFilterOptions={clientFilterOptions}
              expOptions={expOptions}
              ctcFilterOptions={ctcFilterOptions}
              ctcMinFilterOptions={ctcMinFilterOptions}
              activityPeriod={activityPeriod}
              setActivityPeriod={setActivityPeriod}
              activityFrom={activityFrom}
              setActivityFrom={setActivityFrom}
              activityTo={activityTo}
              setActivityTo={setActivityTo}
              applyAdvancedFilters={applySearch}
              filtersDirty={filtersDirty}
              isSearching={loading}
              onApplyError={(msg) => toast.warning(msg)}
              variant="globalSearch"
            />
          )}
          relatedJob={null}
        >
          {!hasRun ? (
            <GlobalSearchSimpleResults
              loading={loading}
              hasRun={false}
              entity={entity}
              data={data}
              relatedJob={null}
              page={page}
              pageSize={PAGE_SIZE}
              totalForEntity={0}
              onPageChange={setPage}
              appliedQuery=""
              clearSearch={clearSearch}
            />
          ) : entity === 'all' ? (
            <GlobalSearchMergedDesk
              rows={data.people || []}
              jobs={outreachJobs}
              page={page}
              setPage={setPage}
              totalCount={searchCounts.people}
              countPending={!searchCounts.exactBy.people}
              countPlus={false}
              hasMore={Boolean(data.hasMore?.candidates || data.hasMore?.mis)}
              loading={loading}
              navigate={navigate}
              onReload={() => runSearch(applied, page)}
              fetchMatching={fetchMatching}
              audienceQuery={audienceQuery}
              dateSort={dateSort}
              onDateSort={(dir) => { setDateSort(dir); setPage(1); }}
            />
          ) : entity === 'mis' && showMis ? (
            <GlobalSearchMisDesk
              rows={data.mis || []}
              jobs={outreachJobs}
              page={page}
              setPage={setPage}
              totalCount={searchCounts.mis}
              countPending={!searchCounts.exactBy.mis}
              countPlus={false}
              hasMore={Boolean(data.hasMore?.mis)}
              loading={loading}
              onReload={() => runSearch(applied, page)}
              fetchMatching={fetchMatching}
              audienceQuery={audienceQuery}
              dateSort={dateSort}
              onDateSort={(dir) => { setDateSort(dir); setPage(1); }}
            />
          ) : (
            <GlobalSearchDesk
              candidates={deskRows}
              jobs={outreachJobs.length ? outreachJobs : (data.jobs || [])}
              page={page}
              setPage={setPage}
              totalCount={searchCounts.candidates}
              countPending={!searchCounts.exactBy.candidates}
              countPlus={false}
              hasMore={Boolean(data.hasMore?.candidates)}
              loading={loading}
              searchQuery={applied.q}
              appliedFilters={applied.filters}
              onReload={() => runSearch(applied, page)}
              onColumnMeta={onColumnMeta}
              navigate={navigate}
              toast={toast}
              fetchMatching={fetchMatching}
              audienceQuery={audienceQuery}
              dateSort={dateSort}
              onDateSort={(dir) => { setDateSort(dir); setPage(1); }}
            />
          )}
        </GlobalSearchWorkbench>

        <TourHelpFab
          onClick={() => setTourOpen(true)}
          label={t('common.takeTour')}
          title={t('pages.globalSearch.tourTitle')}
        />
        <ProductTour open={tourOpen} onClose={() => setTourOpen(false)} steps={SEARCH_TOUR_STEPS} storageKey={SEARCH_TOUR_KEY} />
        <ConfirmationModal
          isOpen={blocker?.state === 'blocked'}
          type="warning"
          eyebrow="Global Search"
          title="Leave this page?"
          message="The current search, filters, and results will be discarded. This cannot be undone."
          confirmText="Leave page"
          cancelText="Stay"
          onClose={() => blocker?.reset?.()}
          onConfirm={() => {
            clearSearchSession();
            toast.info('Search discarded');
            blocker?.proceed?.();
          }}
        />
      </div>
    </FeatureGate>
  );
}
