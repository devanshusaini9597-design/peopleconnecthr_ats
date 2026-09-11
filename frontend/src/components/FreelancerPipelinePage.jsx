import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Kanban, RefreshCw, Send, User, Briefcase, Clock, Eye,
  Search, CheckCircle2, XCircle, Loader2,
  X, Users, Info, SlidersHorizontal,
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import PremiumSelect from './ui/PremiumSelect';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { authenticatedFetch, isUnauthorized, handleUnauthorized, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import PipelineStageSummary from './ui/PipelineStageSummary';
import FreelanceKanbanBoard from './freelance/FreelanceKanbanBoard';
import {
  buildStageDefs,
  resolveCompanyStage,
  DEFAULT_COMPANY_STAGES,
} from './freelance/companyPipelineStages';
import {
  FREELANCER_PIPELINE_TOUR_KEY,
  FREELANCER_PIPELINE_TOUR_STEPS,
} from './freelance/freelanceTourConstants';

const AUTO_REFRESH_MS = 30_000;

const RECENCY_OPTIONS = [
  { value: 'all', label: 'Any time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

const SORT_OPTIONS = [
  { value: 'updated-desc', label: 'Recently updated' },
  { value: 'updated-asc', label: 'Oldest first' },
  { value: 'name', label: 'Candidate A–Z' },
];

function relativeTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function asDoc(value) {
  if (!value) return {};
  if (typeof value === 'string') return { _id: value };
  return value;
}

function candidateOf(row) {
  const c = asDoc(row?.candidateId);
  const snap = row?.candidateSnapshot || {};
  return {
    ...c,
    name: c.name || snap.name || '',
    email: c.email || snap.email || '',
    contact: c.contact || snap.contact || '',
    position: c.position || snap.position || '',
    status: c.status || snap.status || '',
  };
}

function jobTitle(job) {
  const j = asDoc(job);
  return j.title || j.role || 'Untitled mandate';
}

function jobLocation(job) {
  const j = asDoc(job);
  if (j.location) return j.location;
  if (Array.isArray(j.locations) && j.locations[0]) return j.locations[0];
  return '';
}

function jobClient(job) {
  const j = asDoc(job);
  return j.clientName || j.client || '';
}

function idOf(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value._id || '');
}

function rowTime(row) {
  return new Date(row.reviewedAt || row.updatedAt || row.createdAt || 0).getTime();
}

export default function FreelancerPipelinePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(FREELANCER_PIPELINE_TOUR_KEY);
  const [rows, setRows] = useState([]);
  const [orgStageLabels, setOrgStageLabels] = useState(DEFAULT_COMPANY_STAGES);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [spocFilter, setSpocFilter] = useState('all');
  const [recencyFilter, setRecencyFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updated-desc');

  const stages = useMemo(() => buildStageDefs(orgStageLabels), [orgStageLabels]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [subRes, statusRes] = await Promise.all([
        authenticatedFetch('/api/freelancer/submissions'),
        authenticatedFetch('/api/statuses'),
      ]);
      if (isUnauthorized(subRes) || isUnauthorized(statusRes)) return handleUnauthorized();
      const subData = await subRes.json();
      if (!subRes.ok) throw new Error(subData.message || 'Failed to load pipeline');
      setRows(Array.isArray(subData.data) ? subData.data : []);

      try {
        const statusJson = await readApiJson(statusRes);
        const labels = Array.isArray(statusJson)
          ? statusJson
          : (Array.isArray(statusJson?.data) ? statusJson.data : null);
        if (labels?.length) setOrgStageLabels(labels);
      } catch {
        /* keep defaults */
      }
      setLastSyncedAt(new Date());
    } catch (err) {
      if (!silent) toast.error(err.message || 'Could not load pipeline');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => load({ silent: true }), AUTO_REFRESH_MS);
    const onFocus = () => load({ silent: true });
    const onVis = () => {
      if (document.visibilityState === 'visible') load({ silent: true });
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load]);

  const counts = useMemo(() => {
    const base = { all: rows.length };
    for (const s of stages) base[s.id] = 0;
    for (const row of rows) {
      const status = resolveCompanyStage(row, stages);
      if (base[status] !== undefined) base[status] += 1;
      else base[status] = 1;
    }
    return base;
  }, [rows, stages]);

  const jobOptions = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const job = row.jobId;
      const id = idOf(job);
      if (!id || map.has(id)) continue;
      map.set(id, { value: id, label: jobTitle(job) });
    }
    return [{ value: 'all', label: 'All mandates' }, ...Array.from(map.values())];
  }, [rows]);

  const spocOptions = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const spoc = row.spocUserId;
      const id = idOf(spoc);
      if (!id || map.has(id)) continue;
      map.set(id, {
        value: id,
        label: spoc.name || spoc.email || 'Hiring manager',
        description: spoc.email && spoc.name ? spoc.email : undefined,
      });
    }
    return [{ value: 'all', label: 'All managers' }, ...Array.from(map.values())];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const maxAge = recencyFilter === '7d' ? 7 : recencyFilter === '30d' ? 30 : null;
    const now = Date.now();
    const next = rows.filter((row) => {
      if (jobFilter !== 'all' && idOf(row.jobId) !== jobFilter) return false;
      if (spocFilter !== 'all' && idOf(row.spocUserId) !== spocFilter) return false;
      if (maxAge != null) {
        const t = rowTime(row);
        if (!t || now - t > maxAge * 86_400_000) return false;
      }
      if (!q) return true;
      const candidate = candidateOf(row);
      const job = asDoc(row.jobId);
      const spoc = asDoc(row.spocUserId);
      const hay = [
        candidate.name,
        candidate.email,
        candidate.position,
        candidate.status,
        jobTitle(job),
        job.jobCode,
        jobClient(job),
        jobLocation(job),
        spoc.name,
        spoc.email,
        row.status,
        row.note,
        row.feedback,
        ...(Array.isArray(row.stageNotes) ? row.stageNotes.map((n) => n?.note) : []),
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    }).map((row) => ({
      ...row,
      // Board uses company stage ids
      boardStatus: resolveCompanyStage(row, stages),
      status: resolveCompanyStage(row, stages),
      _submissionStatus: row.status,
    }));

    next.sort((a, b) => {
      if (sortBy === 'name') {
        return String(candidateOf(a).name || '').localeCompare(String(candidateOf(b).name || ''));
      }
      const urgentA = String(asDoc(a.jobId).priority || '').toLowerCase() === 'urgent' ? 1 : 0;
      const urgentB = String(asDoc(b.jobId).priority || '').toLowerCase() === 'urgent' ? 1 : 0;
      if (urgentA !== urgentB) return urgentB - urgentA;
      const diff = rowTime(a) - rowTime(b);
      return sortBy === 'updated-asc' ? diff : -diff;
    });
    return next;
  }, [rows, query, jobFilter, spocFilter, recencyFilter, sortBy, stages]);

  const hasActiveFilters = Boolean(
    query.trim()
    || statusFilter !== 'all'
    || jobFilter !== 'all'
    || spocFilter !== 'all'
    || recencyFilter !== 'all'
    || sortBy !== 'updated-desc'
  );

  const clearFilters = () => {
    setQuery('');
    setStatusFilter('all');
    setJobFilter('all');
    setSpocFilter('all');
    setRecencyFilter('all');
    setSortBy('updated-desc');
  };

  if (user?.role && user.role !== 'freelancer') {
    return <Navigate to="/recruitment" replace />;
  }

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={Kanban}
        title="My Pipeline"
        gradientTitle
        subtitle="Track submissions across your company’s hiring stages. Progress updates when the hiring team advances candidates."
      >
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => load({ silent: true })}
            disabled={refreshing || loading}
            className="btn-secondary"
            title="Refresh pipeline"
          >
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>
          <button type="button" onClick={() => navigate('/ats')} className="btn-secondary">
            <Users size={14} />
            <span className="hidden sm:inline">Candidates</span>
          </button>
          <button type="button" onClick={() => navigate('/mandates')} className="btn-primary">
            <Send size={14} /> Mandates
          </button>
        </div>
      </PageHeader>

      <div
        data-tour="freelancer-pipeline-tip"
        className="rounded-xl border border-stone-200/90 bg-stone-50/80 px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-start gap-x-2.5 gap-y-1 mb-5"
      >
        <Info size={15} className="text-brand-600 shrink-0 mt-0.5" strokeWidth={2.25} />
        <p className="min-w-0 flex-1">
          Stages follow your company pipeline. Cards stay in place until the hiring team moves them —
          open the info icon on a board for company notes.
        </p>
      </div>

      <div className="mb-5">
        <PipelineStageSummary
          stages={stages}
          counts={counts}
          stageFilter={statusFilter}
          setStageFilter={setStatusFilter}
          total={counts.all}
          hint="Hiring pipeline"
          tourAttr="freelancer-stage-summary"
        />
      </div>

      <div
        data-tour="freelancer-pipeline-filters"
        className="rounded-2xl border border-stone-200/90 bg-white shadow-[var(--shadow-card)] mb-5 overflow-visible"
      >
        {/* Enterprise command bar */}
        <div className="px-4 sm:px-5 pt-4 pb-3 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-600 pointer-events-none z-[1]" />
              <input
                id="pipeline-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by candidate, job ID, mandate, client, or hiring manager"
                className="input-ats input-ats-icon !pr-10 !h-11 !rounded-xl w-full min-w-0 border-stone-200 shadow-sm"
                aria-label="Search pipeline"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-[12px] font-semibold text-stone-700 tabular-nums">
                <Users size={13} className="text-brand-600" strokeWidth={2.25} />
                {filtered.length.toLocaleString()}
                <span className="font-medium text-stone-400">/ {rows.length.toLocaleString()}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-500 tabular-nums">
                <Clock size={12} className="text-brand-600" strokeWidth={2.25} />
                {lastSyncedAt
                  ? `Synced ${relativeTime(lastSyncedAt)} · auto ${AUTO_REFRESH_MS / 1000}s`
                  : 'Syncing…'}
              </span>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-[11px] font-semibold text-brand-800 hover:bg-brand-100 transition-colors"
                >
                  <X size={12} strokeWidth={2.5} />
                  Clear all
                </button>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-stone-200/90 bg-stone-50/60 p-3 sm:p-3.5">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="w-7 h-7 rounded-lg bg-white border border-stone-200 text-brand-700 inline-flex items-center justify-center shadow-sm">
                <SlidersHorizontal size={13} strokeWidth={2.25} />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-stone-800 leading-none">Refine results</p>
                <p className="text-[11px] text-stone-400 mt-1 leading-none">
                  Mandate · hiring manager · timeframe · sort
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
              <div className="min-w-0">
                <label className="sr-only">Mandate</label>
                <PremiumSelect
                  variant="list"
                  compact
                  className="rounded-xl w-full min-w-0 bg-white"
                  value={jobFilter}
                  onChange={(v) => setJobFilter(v || 'all')}
                  options={jobOptions}
                  placeholder="All mandates"
                  icon={Briefcase}
                  searchable
                  searchPlaceholder="Search mandates…"
                  emptyLabel="No mandates"
                />
              </div>
              <div className="min-w-0">
                <label className="sr-only">Hiring manager</label>
                <PremiumSelect
                  variant="list"
                  compact
                  className="rounded-xl w-full min-w-0 bg-white"
                  value={spocFilter}
                  onChange={(v) => setSpocFilter(v || 'all')}
                  options={spocOptions}
                  placeholder="All hiring managers"
                  icon={User}
                  searchable
                  searchPlaceholder="Search managers…"
                  emptyLabel="No managers"
                />
              </div>
              <div className="min-w-0">
                <label className="sr-only">Recency</label>
                <PremiumSelect
                  variant="list"
                  compact
                  className="rounded-xl w-full min-w-0 bg-white"
                  value={recencyFilter}
                  onChange={(v) => setRecencyFilter(v || 'all')}
                  options={RECENCY_OPTIONS}
                  placeholder="Any time"
                  icon={Clock}
                />
              </div>
              <div className="min-w-0">
                <label className="sr-only">Sort</label>
                <PremiumSelect
                  variant="list"
                  compact
                  className="rounded-xl w-full min-w-0 bg-white"
                  value={sortBy}
                  onChange={(v) => setSortBy(v || 'updated-desc')}
                  options={SORT_OPTIONS}
                  placeholder="Sort order"
                  icon={Eye}
                />
              </div>
            </div>

            {hasActiveFilters ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {query ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600">
                    Search: “{query.length > 24 ? `${query.slice(0, 24)}…` : query}”
                    <button type="button" onClick={() => setQuery('')} className="text-stone-400 hover:text-stone-700" aria-label="Remove search">
                      <X size={11} />
                    </button>
                  </span>
                ) : null}
                {jobFilter !== 'all' ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600">
                    Mandate
                    <button type="button" onClick={() => setJobFilter('all')} className="text-stone-400 hover:text-stone-700" aria-label="Clear mandate">
                      <X size={11} />
                    </button>
                  </span>
                ) : null}
                {spocFilter !== 'all' ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600">
                    Manager
                    <button type="button" onClick={() => setSpocFilter('all')} className="text-stone-400 hover:text-stone-700" aria-label="Clear manager">
                      <X size={11} />
                    </button>
                  </span>
                ) : null}
                {recencyFilter !== 'all' ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600">
                    {RECENCY_OPTIONS.find((o) => o.value === recencyFilter)?.label || 'Recency'}
                    <button type="button" onClick={() => setRecencyFilter('all')} className="text-stone-400 hover:text-stone-700" aria-label="Clear recency">
                      <X size={11} />
                    </button>
                  </span>
                ) : null}
                {statusFilter !== 'all' ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600">
                    Stage: {statusFilter}
                    <button type="button" onClick={() => setStatusFilter('all')} className="text-stone-400 hover:text-stone-700" aria-label="Clear stage">
                      <X size={11} />
                    </button>
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-[min(70dvh,720px)] min-h-[420px] rounded-2xl border border-stone-200 bg-white skeleton-ats" />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-stone-200/90 bg-white shadow-[var(--shadow-card)] relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <EmptyState
            icon={Kanban}
            tone="violet"
            message="No submissions yet"
            subMessage="Submit a candidate on an open mandate to start tracking progress here."
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-stone-200/90 bg-white shadow-[var(--shadow-card)]">
          <EmptyState
            icon={Search}
            tone="amber"
            message="No matching candidates"
            subMessage="Adjust the search or filters to broaden results."
            action={(
              <button type="button" className="btn-secondary" onClick={clearFilters}>
                Reset filters
              </button>
            )}
          />
        </div>
      ) : (
        <div data-tour="freelancer-pipeline-boards">
          <FreelanceKanbanBoard
            stages={stages}
            rows={filtered}
            stageFilter={statusFilter}
            interactive={false}
            companyStages
          />
        </div>
      )}

      <TourHelpFab
        onClick={() => setTourOpen(true)}
        label="Take a tour"
        title="Take a tour of My Pipeline"
      />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={FREELANCER_PIPELINE_TOUR_STEPS}
        storageKey={FREELANCER_PIPELINE_TOUR_KEY}
      />
    </div>
  );
}
