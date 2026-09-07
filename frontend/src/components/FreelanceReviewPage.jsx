import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Send, Loader2, RefreshCw, Search, Briefcase,
  CheckCircle2, XCircle, Inbox, Filter, X,
  Layers, Users, Archive, Info,
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
import { presenceFromLastActive } from './ui/PresenceBadge';
import PipelineStageSummary from './ui/PipelineStageSummary';
import FreelanceKanbanBoard from './freelance/FreelanceKanbanBoard';
import DeskEnterpriseBar from './freelance/DeskEnterpriseBar';
import LiveDesksPanel from './freelance/LiveDesksPanel';
import {
  FREELANCE_REVIEW_TOUR_KEY,
  FREELANCE_REVIEW_TOUR_STEPS,
} from './freelance/freelanceTourConstants';

const AUTO_REFRESH_MS = 60_000;
const PRESENCE_POLL_MS = 12_000;

const STAGES = [
  { id: 'submitted', label: 'Submitted', hint: 'Awaiting internal review', icon: Inbox, bar: 'bg-sky-500', soft: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-800', chip: 'bg-sky-50 text-sky-800 border-sky-200', hoverBorder: 'hover:border-sky-300' },
  { id: 'reviewing', label: 'Under review', hint: 'Being evaluated', icon: Search, bar: 'bg-amber-500', soft: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', chip: 'bg-amber-50 text-amber-900 border-amber-200', hoverBorder: 'hover:border-amber-300' },
  { id: 'shortlisted', label: 'Shortlisting', hint: 'Advanced for shortlist', icon: CheckCircle2, bar: 'bg-emerald-500', soft: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', chip: 'bg-emerald-50 text-emerald-800 border-emerald-200', hoverBorder: 'hover:border-emerald-300' },
  { id: 'selection', label: 'Selection', hint: 'Offer / selection stage', icon: Users, bar: 'bg-violet-500', soft: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-800', chip: 'bg-violet-50 text-violet-800 border-violet-200', hoverBorder: 'hover:border-violet-300' },
  { id: 'joined', label: 'Joined', hint: 'Candidate joined', icon: Briefcase, bar: 'bg-teal-500', soft: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-800', chip: 'bg-teal-50 text-teal-800 border-teal-200', hoverBorder: 'hover:border-teal-300' },
  { id: 'rejected', label: 'Declined', hint: 'Not progressing', icon: XCircle, bar: 'bg-red-500', soft: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', chip: 'bg-red-50 text-red-800 border-red-200', hoverBorder: 'hover:border-red-300' },
];

const COMPANY_ROLES = ['owner', 'admin', 'hr_manager', 'hr_recruiter', 'recruiter', 'sales'];

function jobTitle(job) {
  return job?.title || job?.role || 'Untitled mandate';
}

function idOf(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value._id || '');
}

function relativeTime(value) {
  if (!value) return '—';
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function stageOf(row) {
  return STAGES.some((s) => s.id === row.status) ? row.status : 'submitted';
}

export default function FreelanceReviewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(FREELANCE_REVIEW_TOUR_KEY);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deskFilter, setDeskFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [presence, setPresence] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [reviewers, setReviewers] = useState([]);
  const [placement, setPlacement] = useState(null);

  const canHardDelete = ['owner', 'admin'].includes(user?.role);

  const loadPresence = useCallback(async () => {
    try {
      const res = await authenticatedFetch('/api/freelancer/presence');
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (res.ok && Array.isArray(data.data)) setPresence(data.data);
    } catch {
      /* keep last known presence */
    }
  }, []);

  const loadMeta = useCallback(async () => {
    try {
      const [revRes, placeRes] = await Promise.all([
        authenticatedFetch('/api/freelancer/reviewers'),
        authenticatedFetch('/api/freelancer/placement-stats'),
      ]);
      if (isUnauthorized(revRes) || isUnauthorized(placeRes)) return handleUnauthorized();
      const [revJson, placeJson] = await Promise.all([revRes.json(), placeRes.json()]);
      if (revRes.ok && Array.isArray(revJson.data)) {
        setReviewers(revJson.data.map((r) => ({
          ...r,
          _id: String(r._id || r.id || ''),
        })));
      } else if (!revRes.ok) {
        toast.error(revJson.message || 'Could not load company reviewers');
      }
      if (placeRes.ok) setPlacement(placeJson.data || null);
    } catch {
      /* optional meta */
    }
  }, [toast]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const qs = showArchived ? '?includeArchived=1' : '';
      const res = await authenticatedFetch(`/api/freelancer/submissions${qs}`);
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load submissions');
      const list = Array.isArray(data.data) ? data.data : [];
      setRows(showArchived ? list.filter((row) => row.archivedAt) : list);
      setLastSyncedAt(new Date());
      setSelectedIds([]);
    } catch (err) {
      if (!silent) toast.error(err.message || 'Unable to load freelance submissions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast, showArchived]);

  useEffect(() => { load(); loadPresence(); loadMeta(); }, [load, loadPresence, loadMeta]);

  useEffect(() => {
    const id = window.setInterval(() => load({ silent: true }), AUTO_REFRESH_MS);
    const presenceId = window.setInterval(loadPresence, PRESENCE_POLL_MS);
    const onFocus = () => {
      load({ silent: true });
      loadPresence();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.clearInterval(presenceId);
      window.removeEventListener('focus', onFocus);
    };
  }, [load, loadPresence]);

  const updateStatus = async (id, status, feedback, { forceDuplicate = false } = {}) => {
    const snapshot = rows;
    setRows((prev) => prev.map((row) => (
      row._id === id
        ? {
          ...row,
          status,
          feedback: feedback !== undefined ? feedback : row.feedback,
          reviewedAt: new Date().toISOString(),
        }
        : row
    )));
    setSavingId(id);
    try {
      const payload = { status, forceDuplicate };
      if (feedback !== undefined) payload.feedback = feedback;
      const res = await authenticatedFetch(`/api/freelancer/submissions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'DUPLICATE' && Array.isArray(data.duplicates)) {
          const names = data.duplicates.map((d) => d.name || d.email).filter(Boolean).join(', ');
          const ok = window.confirm(`${data.message}\n\nMatches: ${names || 'existing profiles'}\n\nContinue anyway?`);
          if (ok) return updateStatus(id, status, feedback, { forceDuplicate: true });
        }
        throw new Error(data.message || 'Update failed');
      }
      if (feedback !== undefined && String(feedback).trim()) {
        toast.success('Reviewer notes saved');
      }
      loadMeta();
      return true;
    } catch (err) {
      setRows(snapshot);
      toast.error(err.message);
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const archiveHandoff = async (id) => {
    const snapshot = rows;
    setRows((prev) => prev.filter((row) => row._id !== id));
    setSavingId(id);
    try {
      const res = await authenticatedFetch(`/api/freelancer/submissions/${id}/archive`, {
        method: 'PATCH',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Archive failed');
      toast.success('Submission archived');
      loadMeta();
      return true;
    } catch (err) {
      setRows(snapshot);
      toast.error(err.message);
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const restoreHandoff = async (id) => {
    const snapshot = rows;
    setRows((prev) => prev.filter((row) => row._id !== id));
    setSavingId(id);
    try {
      const res = await authenticatedFetch(`/api/freelancer/submissions/${id}/restore`, {
        method: 'PATCH',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Restore failed');
      toast.success('Submission restored to the active queue');
      loadMeta();
      return true;
    } catch (err) {
      setRows(snapshot);
      toast.error(err.message);
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const reassignSpoc = async (id, spocUserId) => {
    setSavingId(id);
    try {
      const res = await authenticatedFetch(`/api/freelancer/submissions/${id}/spoc`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spocUserId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Reassign failed');
      if (data.data) {
        setRows((prev) => prev.map((row) => (row._id === id ? { ...row, ...data.data } : row)));
      }
      toast.success('Ownership transferred');
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const editCandidate = async (id, fields) => {
    setSavingId(id);
    try {
      const res = await authenticatedFetch(`/api/freelancer/submissions/${id}/candidate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Update failed');
      if (data.data?.submission) {
        setRows((prev) => prev.map((row) => (row._id === id ? { ...row, ...data.data.submission } : row)));
      }
      toast.success('Candidate profile updated');
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const hardDelete = async (id, deleteCandidate) => {
    setSavingId(id);
    try {
      const qs = deleteCandidate ? '?deleteCandidate=1' : '';
      const res = await authenticatedFetch(`/api/freelancer/submissions/${id}${qs}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Delete failed');
      setRows((prev) => prev.filter((row) => row._id !== id));
      toast.success(deleteCandidate ? 'Submission and candidate removed' : 'Submission permanently deleted');
      loadMeta();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const runBulk = async (action, ids) => {
    if (action === 'hard_delete') {
      if (!canHardDelete) return;
      const ok = window.confirm(`Permanently delete ${ids.length} submission(s)? This cannot be undone.`);
      if (!ok) return;
      setBulkSaving(true);
      for (const id of ids) {
        await hardDelete(id, false);
      }
      setBulkSaving(false);
      setSelectedIds([]);
      return;
    }
    setBulkSaving(true);
    try {
      const res = await authenticatedFetch('/api/freelancer/submissions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Bulk action failed');
      const okCount = data.data?.ok?.length || 0;
      const failCount = data.data?.failed?.length || 0;
      toast.success(`Updated ${okCount}${failCount ? ` · ${failCount} failed` : ''}`);
      await load({ silent: true });
      loadMeta();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBulkSaving(false);
      setSelectedIds([]);
    }
  };

  const presenceById = useMemo(() => {
    const map = new Map();
    for (const person of presence) map.set(String(person._id), person);
    return map;
  }, [presence]);

  const desks = useMemo(() => {
    const map = new Map();
    for (const person of presence) map.set(String(person._id), person);
    for (const row of rows) {
      const id = idOf(row.freelancerId);
      if (!id || map.has(id)) continue;
      const lastActiveAt = row.freelancerId?.lastActiveAt || row.freelancerId?.lastLoginAt || null;
      map.set(id, {
        _id: id,
        name: row.freelancerId?.name || row.freelancerId?.email || 'Freelance recruiter',
        email: row.freelancerId?.email || '',
        profilePicture: row.freelancerId?.profilePicture || '',
        lastActiveAt,
        lastLoginAt: row.freelancerId?.lastLoginAt || null,
        status: presenceFromLastActive(lastActiveAt),
      });
    }
    const rank = { online: 0, away: 1, offline: 2 };
    return Array.from(map.values()).sort((a, b) => {
      const ra = rank[a.status] ?? 9;
      const rb = rank[b.status] ?? 9;
      if (ra !== rb) return ra - rb;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }, [presence, rows]);

  const deskStatus = (freelancer) => {
    const id = idOf(freelancer);
    const live = presenceById.get(id);
    const lastActiveAt = live?.lastActiveAt || freelancer?.lastActiveAt || freelancer?.lastLoginAt;
    return {
      status: live?.status || presenceFromLastActive(lastActiveAt),
      lastActiveAt,
      lastLoginAt: live?.lastLoginAt || freelancer?.lastLoginAt || null,
    };
  };

  const deskOptions = useMemo(() => ([
    {
      value: 'all',
      label: 'All recruiters',
      description: 'Every external recruiter desk',
      icon: Users,
    },
    ...desks.map((person) => ({
      value: String(person._id),
      label: person.name || person.email || 'External recruiter',
      description: person.email && person.name ? person.email : undefined,
      avatarName: person.name || person.email,
      avatarEmail: person.email || '',
      photo: person.profilePicture || '',
      searchText: `${person.name || ''} ${person.email || ''}`,
    })),
  ]), [desks]);

  const jobOptions = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const id = idOf(row.jobId);
      if (!id || map.has(id)) continue;
      const job = row.jobId || {};
      map.set(id, {
        value: id,
        label: jobTitle(job),
        description: [job.jobCode, job.clientName].filter(Boolean).join(' · ') || undefined,
        icon: Briefcase,
        searchText: `${jobTitle(job)} ${job.jobCode || ''} ${job.clientName || ''} ${job.location || ''}`,
      });
    }
    return [
      {
        value: 'all',
        label: 'All mandates',
        description: 'Every linked mandate',
        icon: Briefcase,
      },
      ...Array.from(map.values()),
    ];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (deskFilter !== 'all' && idOf(row.freelancerId) !== deskFilter) return false;
      if (jobFilter !== 'all' && idOf(row.jobId) !== jobFilter) return false;
      if (!q) return true;
      const hay = [
        row.candidateId?.name,
        row.candidateId?.email,
        row.candidateId?.contact,
        row.candidateId?.position,
        jobTitle(row.jobId),
        row.jobId?.clientName,
        row.jobId?.jobCode,
        row.freelancerId?.name,
        row.freelancerId?.email,
        row.spocUserId?.name,
        row.note,
        row.status,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, deskFilter, jobFilter]);

  const counts = useMemo(() => {
    const scoped = rows.filter((row) => {
      if (deskFilter !== 'all' && idOf(row.freelancerId) !== deskFilter) return false;
      if (jobFilter !== 'all' && idOf(row.jobId) !== jobFilter) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const hay = [
          row.candidateId?.name,
          row.candidateId?.email,
          jobTitle(row.jobId),
          row.jobId?.clientName,
          row.freelancerId?.name,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const base = { all: scoped.length, submitted: 0, reviewing: 0, shortlisted: 0, rejected: 0 };
    for (const row of scoped) {
      const key = stageOf(row);
      if (base[key] !== undefined) base[key] += 1;
    }
    return base;
  }, [rows, deskFilter, jobFilter, query]);

  const hasActiveFilters = Boolean(
    query.trim()
    || statusFilter !== 'all'
    || deskFilter !== 'all'
    || jobFilter !== 'all'
  );

  const clearFilters = () => {
    setQuery('');
    setStatusFilter('all');
    setDeskFilter('all');
    setJobFilter('all');
  };

  if (user?.role && !COMPANY_ROLES.includes(user.role)) {
    return <Navigate to={user.role === 'freelancer' ? '/my-pipeline' : '/dashboard'} replace />;
  }

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={Send}
        title="Freelance Desk Review"
        gradientTitle
        subtitle={
          showArchived
            ? 'Archived submissions — restore to reopen review. Candidate records remain in the ATS.'
            : 'Review candidates submitted by freelance recruiters. Leadership sees every desk; recruiters see submissions assigned to them.'
        }
      >
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className={showArchived ? 'btn-primary' : 'btn-secondary'}
            title={showArchived ? 'Viewing archived submissions' : 'View archived submissions'}
          >
            <Archive size={14} />
            <span className="hidden sm:inline">{showArchived ? 'Archive' : 'Active queue'}</span>
          </button>
          <button
            type="button"
            onClick={() => { load({ silent: true }); loadPresence(); }}
            disabled={refreshing || loading}
            className="btn-secondary"
          >
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>
          <button type="button" onClick={() => navigate('/applications')} className="btn-secondary">
            <Layers size={14} />
            <span className="hidden sm:inline">Applications</span>
          </button>
          <button type="button" onClick={() => navigate('/ats')} className="btn-primary">
            <Users size={14} />
            <span className="hidden sm:inline">Candidates</span>
          </button>
        </div>
      </PageHeader>

      <div
        data-tour="freelance-review-tip"
        className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-5"
      >
        <span className="inline-flex items-center gap-1.5 text-brand-700 font-semibold">
          <Info size={14} /> Tip
        </span>
        <span>
          {showArchived
            ? 'Archived submissions stay out of the active queue until restored. Candidate records remain in ATS.'
            : 'Drag stages on each board, save reviewer notes, then use Manage submission for ownership, archive, and ATS actions.'}
          {' '}Press the help button or <span className="font-semibold text-stone-800">?</span> for a tour.
        </span>
      </div>

      <div className="mb-5">
        <PipelineStageSummary
          stages={STAGES}
          counts={counts}
          stageFilter={statusFilter}
          setStageFilter={setStatusFilter}
          total={counts.all}
          hint="Select a stage to focus the submission boards"
          tourAttr="freelance-review-stage-summary"
        />
      </div>

      <div data-tour="freelance-live-desks">
        <LiveDesksPanel
          desks={desks}
          deskFilter={deskFilter}
          setDeskFilter={setDeskFilter}
          lastSyncedAt={lastSyncedAt}
          relativeTime={relativeTime}
        />
      </div>

      <div
        data-tour="freelance-review-filters"
        className="rounded-2xl border border-stone-200/90 bg-white shadow-[var(--shadow-card)] mb-5 overflow-hidden"
      >
        <div className="px-4 sm:px-5 py-4 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-100 text-brand-700 inline-flex items-center justify-center">
              <Filter size={14} />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-700">Refine results</p>
              <p className="text-[11px] text-stone-400">Search by candidate, recruiter desk, or mandate</p>
            </div>
          </div>

          <div className="min-w-0">
            <label className="label-ats" htmlFor="review-search">Search</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-600 pointer-events-none z-[1]" />
              <input
                id="review-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Candidate name, mandate, or recruiter…"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="label-ats">External recruiter</label>
              <PremiumSelect
                value={deskFilter}
                onChange={(v) => setDeskFilter(v || 'all')}
                options={deskOptions}
                placeholder="All recruiters"
                icon={Users}
                searchable
                searchPlaceholder="Search recruiters…"
                emptyLabel="No recruiters"
              />
            </div>
            <div className="min-w-0">
              <label className="label-ats">Mandate</label>
              <PremiumSelect
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
          </div>

          {hasActiveFilters ? (
            <button type="button" onClick={clearFilters} className="text-xs font-semibold text-brand-700 hover:text-brand-800">
              Reset filters
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
            icon={showArchived ? Archive : Send}
            tone={showArchived ? 'amber' : 'violet'}
            message={showArchived ? 'No archived submissions' : 'No freelance submissions yet'}
            subMessage={
              showArchived
                ? 'Archived submissions remain here until restored to the active queue.'
                : 'When a freelance recruiter shares a candidate to your desk, it appears on this review board.'
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-stone-200/90 bg-white shadow-[var(--shadow-card)]">
          <EmptyState
            icon={Search}
            tone="amber"
            message="No matching submissions"
            subMessage="Try a different recruiter, mandate, or search term."
            action={(
              <button type="button" className="btn-secondary" onClick={clearFilters}>
                Reset filters
              </button>
            )}
          />
        </div>
      ) : (
        <div data-tour="freelance-review-boards">
          <DeskEnterpriseBar
            rows={filtered}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            onBulk={runBulk}
            bulkSaving={bulkSaving}
            placement={placement}
            canHardDelete={canHardDelete}
            showArchived={showArchived}
          />
          <FreelanceKanbanBoard
            stages={STAGES}
            rows={filtered}
            stageFilter={statusFilter}
            interactive
            savingId={savingId}
            deskStatus={deskStatus}
            drafts={drafts}
            onDraft={(id, value) => setDrafts((prev) => ({ ...prev, [id]: value }))}
            onMove={(id, status) => updateStatus(id, status)}
            onSaveNote={(id, status, text) => updateStatus(id, status, text)}
            onOpenAts={(name) => navigate(`/ats?q=${encodeURIComponent(name)}`)}
            onArchive={archiveHandoff}
            onRestore={restoreHandoff}
            selectedIds={selectedIds}
            onToggleSelect={(id) => setSelectedIds((prev) => (
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
            ))}
            reviewers={reviewers}
            canHardDelete={canHardDelete}
            onReassign={reassignSpoc}
            onEditCandidate={editCandidate}
            onHardDelete={hardDelete}
          />
        </div>
      )}

      <TourHelpFab
        onClick={() => setTourOpen(true)}
        label="Take a tour"
        title="Take a tour of Freelance Desk Review"
      />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={FREELANCE_REVIEW_TOUR_STEPS}
        storageKey={FREELANCE_REVIEW_TOUR_KEY}
      />
    </div>
  );
}
