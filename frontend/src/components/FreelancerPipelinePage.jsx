import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Kanban, RefreshCw, Send, User, Briefcase, Clock, Eye,
  Search, CheckCircle2, XCircle, Loader2,
  X, Users, Filter, Lock, Info,
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import PremiumSelect from './ui/PremiumSelect';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import PipelineStageSummary from './ui/PipelineStageSummary';
import FreelanceKanbanBoard from './freelance/FreelanceKanbanBoard';
import {
  FREELANCER_PIPELINE_TOUR_KEY,
  FREELANCER_PIPELINE_TOUR_STEPS,
} from './freelance/freelanceTourConstants';

const AUTO_REFRESH_MS = 60_000;

const STAGES = [
  {
    id: 'submitted',
    label: 'Submitted',
    hint: 'Awaiting hiring manager',
    icon: Send,
    bar: 'bg-sky-500',
    soft: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-800',
    chip: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  {
    id: 'reviewing',
    label: 'Reviewing',
    hint: 'In progress',
    icon: Search,
    bar: 'bg-amber-500',
    soft: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-900',
    chip: 'bg-amber-50 text-amber-900 border-amber-200',
  },
  {
    id: 'shortlisted',
    label: 'Shortlisting',
    hint: 'Shortlist / screening forward',
    icon: CheckCircle2,
    bar: 'bg-emerald-500',
    soft: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-800',
    chip: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  {
    id: 'selection',
    label: 'Selection',
    hint: 'Offer / selection stage',
    icon: Users,
    bar: 'bg-violet-500',
    soft: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-800',
    chip: 'bg-violet-50 text-violet-800 border-violet-200',
  },
  {
    id: 'joined',
    label: 'Joined',
    hint: 'Candidate joined',
    icon: Briefcase,
    bar: 'bg-teal-500',
    soft: 'bg-teal-50',
    border: 'border-teal-200',
    text: 'text-teal-800',
    chip: 'bg-teal-50 text-teal-800 border-teal-200',
  },
  {
    id: 'rejected',
    label: 'Rejected',
    hint: 'Not progressing',
    icon: XCircle,
    bar: 'bg-red-500',
    soft: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    chip: 'bg-red-50 text-red-800 border-red-200',
  },
];

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

function stageOf(row) {
  return STAGES.some((s) => s.id === row.status) ? row.status : 'submitted';
}

export default function FreelancerPipelinePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(FREELANCER_PIPELINE_TOUR_KEY);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [spocFilter, setSpocFilter] = useState('all');
  const [recencyFilter, setRecencyFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updated-desc');

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await authenticatedFetch('/api/freelancer/submissions');
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load pipeline');
      setRows(Array.isArray(data.data) ? data.data : []);
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
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  const counts = useMemo(() => {
    const base = {
      all: rows.length,
      submitted: 0,
      reviewing: 0,
      shortlisted: 0,
      selection: 0,
      joined: 0,
      rejected: 0,
    };
    for (const row of rows) {
      const status = stageOf(row);
      if (base[status] !== undefined) base[status] += 1;
    }
    return base;
  }, [rows]);

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
        jobTitle(job),
        job.jobCode,
        jobClient(job),
        jobLocation(job),
        spoc.name,
        spoc.email,
        row.status,
        row.note,
        row.feedback,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });

    next.sort((a, b) => {
      if (sortBy === 'name') {
        return String(candidateOf(a).name || '').localeCompare(String(candidateOf(b).name || ''));
      }
      const diff = rowTime(a) - rowTime(b);
      return sortBy === 'updated-asc' ? diff : -diff;
    });
    return next;
  }, [rows, query, jobFilter, spocFilter, recencyFilter, sortBy]);

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
        subtitle="Separate Kanban board for each candidate you shared. Status updates when the hiring team reviews them."
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
        className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-5"
      >
        <span className="inline-flex items-center gap-1.5 text-brand-700 font-semibold">
          <Info size={14} /> Tip
        </span>
        <span>
          This board is private to you. Status and reviewer notes update when the company reviews your submissions.
          {' '}Press the help button for a tour.
        </span>
      </div>

      <div className="mb-5">
        <PipelineStageSummary
          stages={STAGES}
          counts={counts}
          stageFilter={statusFilter}
          setStageFilter={setStatusFilter}
          total={counts.all}
          hint="Tap a stage to focus that column"
          tourAttr="freelancer-stage-summary"
        />
      </div>

      <div
        data-tour="freelancer-pipeline-filters"
        className="rounded-2xl border border-stone-200/90 bg-white shadow-[var(--shadow-card)] mb-5 overflow-hidden"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-stone-100 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/30">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-stone-500">
            <Lock size={13} className="text-brand-600" />
            Private to you · {filtered.length.toLocaleString()} of {rows.length.toLocaleString()} candidates
          </span>
          <span className="text-[11px] text-stone-400 tabular-nums inline-flex items-center gap-1.5 rounded-lg bg-white/80 border border-stone-100 px-2.5 py-1">
            <Clock size={12} className="text-brand-600" />
            {lastSyncedAt
              ? `Synced ${relativeTime(lastSyncedAt)} · auto every ${AUTO_REFRESH_MS / 1000}s`
              : 'Syncing…'}
          </span>
        </div>

        <div className="px-4 sm:px-5 py-4 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-100 text-brand-700 inline-flex items-center justify-center">
              <Filter size={14} />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-700">Filters</p>
              <p className="text-[11px] text-stone-400">Search, mandate, hiring manager</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="min-w-0">
              <label className="label-ats" htmlFor="pipeline-search">Search</label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-600 pointer-events-none z-[1]" />
                <input
                  id="pipeline-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search candidate, mandate, or hiring manager"
                  className="input-ats input-ats-icon !pr-9 !h-11 rounded-xl"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="min-w-0">
                <label className="label-ats">Mandate</label>
                <PremiumSelect
                  variant="list"
                  compact
                  className="rounded-xl"
                  value={jobFilter}
                  onChange={(v) => setJobFilter(v || 'all')}
                  options={jobOptions}
                  placeholder="All mandates"
                  icon={Briefcase}
                  searchable
                  searchPlaceholder="Mandate…"
                  emptyLabel="No mandates"
                />
              </div>
              <div className="min-w-0">
                <label className="label-ats">Hiring manager</label>
                <PremiumSelect
                  variant="list"
                  compact
                  className="rounded-xl"
                  value={spocFilter}
                  onChange={(v) => setSpocFilter(v || 'all')}
                  options={spocOptions}
                  placeholder="All managers"
                  icon={User}
                  searchable
                  searchPlaceholder="Manager…"
                  emptyLabel="No managers"
                />
              </div>
              <div className="min-w-0">
                <label className="label-ats">Recency</label>
                <PremiumSelect
                  variant="list"
                  compact
                  className="rounded-xl"
                  value={recencyFilter}
                  onChange={(v) => setRecencyFilter(v || 'all')}
                  options={RECENCY_OPTIONS}
                  placeholder="Any time"
                  icon={Clock}
                />
              </div>
              <div className="min-w-0">
                <label className="label-ats">Sort</label>
                <PremiumSelect
                  variant="list"
                  compact
                  className="rounded-xl"
                  value={sortBy}
                  onChange={(v) => setSortBy(v || 'updated-desc')}
                  options={SORT_OPTIONS}
                  placeholder="Sort"
                  icon={Eye}
                />
              </div>
            </div>
          </div>

          {hasActiveFilters ? (
            <button type="button" onClick={clearFilters} className="text-xs font-semibold text-brand-700 hover:text-brand-800">
              Clear filters
            </button>
          ) : null}
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
            message="No handoffs yet"
            subMessage="Submit a candidate against an open mandate — it will appear on this pipeline board."
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-stone-200/90 bg-white shadow-[var(--shadow-card)]">
          <EmptyState
            icon={Search}
            tone="amber"
            message="No matching handoffs"
            subMessage="Try a different mandate, manager, or search term."
            action={(
              <button type="button" className="btn-secondary" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          />
        </div>
      ) : (
        <div data-tour="freelancer-pipeline-boards">
          <FreelanceKanbanBoard
            stages={STAGES}
            rows={filtered}
            stageFilter={statusFilter}
            interactive={false}
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
