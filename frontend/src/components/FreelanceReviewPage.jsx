import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Send, Loader2, RefreshCw, Search, Briefcase,
  CheckCircle2, XCircle, Inbox, Filter, X,
  Layers, Users, Archive,
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
import LiveDesksPanel from './freelance/LiveDesksPanel';
import DeskEnterpriseBar from './freelance/DeskEnterpriseBar';
import {
  buildStageDefs,
  resolveCompanyStage,
  companyStageToSubmissionStatus,
  DEFAULT_COMPANY_STAGES,
} from './freelance/companyPipelineStages';
import { cleanStageNoteText, parseTaggedStageNotes } from './freelance/stageNoteUtils';
import {
  FREELANCE_REVIEW_TOUR_KEY,
  FREELANCE_REVIEW_TOUR_STEPS,
} from './freelance/freelanceTourConstants';

const AUTO_REFRESH_MS = 60_000;
const PRESENCE_POLL_MS = 12_000;

const COMPANY_ROLES = ['owner', 'admin', 'hr_manager', 'hr_recruiter', 'recruiter', 'sales'];

function jobTitle(job) {
  return job?.title || job?.role || 'Untitled mandate';
}

function idOf(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    if (value._id != null && value._id !== '') return String(value._id);
    if (value.id != null && value.id !== '') return String(value.id);
    if (typeof value.toHexString === 'function') {
      try { return value.toHexString(); } catch { /* ignore */ }
    }
    const asString = String(value);
    if (asString && asString !== '[object Object]') return asString;
  }
  return '';
}

function matchesRecruiterDesk(row, deskFilter) {
  if (!deskFilter || deskFilter === 'all') return true;
  const want = String(deskFilter);
  const fid = idOf(row.freelancerId);
  if (fid && fid === want) return true;
  // Defensive: some payloads only carry email on the nested user
  const email = String(row.freelancerId?.email || '').trim().toLowerCase();
  if (email && email === want.toLowerCase()) return true;
  return false;
}

function matchesMandate(row, jobFilter) {
  if (!jobFilter || jobFilter === 'all') return true;
  return idOf(row.jobId) === String(jobFilter);
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
  const [reviewers, setReviewers] = useState([]);
  const [orgStageLabels, setOrgStageLabels] = useState(DEFAULT_COMPANY_STAGES);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkSaving, setBulkSaving] = useState(false);

  const canHardDelete = ['owner', 'admin'].includes(user?.role);
  const canManageDesk = ['owner', 'admin', 'hr_manager', 'hr_recruiter'].includes(user?.role);
  const stages = useMemo(() => buildStageDefs(orgStageLabels), [orgStageLabels]);

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
      const [revRes, statusRes] = await Promise.all([
        authenticatedFetch('/api/freelancer/reviewers'),
        authenticatedFetch('/api/statuses'),
      ]);
      if (isUnauthorized(revRes) || isUnauthorized(statusRes)) {
        return handleUnauthorized();
      }
      const [revJson, statusJson] = await Promise.all([
        revRes.json(), statusRes.json(),
      ]);
      if (revRes.ok && Array.isArray(revJson.data)) {
        setReviewers(revJson.data.map((r) => ({
          ...r,
          _id: String(r._id || r.id || ''),
        })));
      } else if (!revRes.ok) {
        toast.error(revJson.message || 'Could not load company reviewers');
      }
      if (statusRes.ok) {
        const labels = Array.isArray(statusJson)
          ? statusJson
          : Array.isArray(statusJson?.data)
            ? statusJson.data.map((s) => (typeof s === 'string' ? s : s?.name || s?.label || s?.status)).filter(Boolean)
            : Array.isArray(statusJson?.statuses)
              ? statusJson.statuses
              : [];
        if (labels.length) setOrgStageLabels(labels);
      }
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

  const updateStatus = async (id, atsStage, feedback, { forceDuplicate = false } = {}) => {
    const snapshot = rows;
    const submissionStatus = companyStageToSubmissionStatus(atsStage);
    const stageKey = String(atsStage || '').trim();
    setRows((prev) => prev.map((row) => {
      if (row._id !== id) return row;
      let stageNotes = row.stageNotes;
      if (feedback !== undefined && stageKey) {
        let list = Array.isArray(row.stageNotes)
          ? row.stageNotes.map((n) => ({ ...n }))
          : [];
        // Preserve earlier stages when seeding from legacy flat feedback
        if (!list.length && row.feedback) {
          list = parseTaggedStageNotes(row.feedback, {
            fallbackStage: stageKey,
            updatedAt: row.reviewedAt || row.updatedAt,
          }).map((n) => ({
            stage: n.stage,
            note: cleanStageNoteText(n.note),
            updatedAt: n.updatedAt,
          }));
        }
        const entry = {
          stage: stageKey,
          note: String(feedback || '').trim(),
          updatedAt: new Date().toISOString(),
        };
        const idx = list.findIndex(
          (n) => String(n.stage || '').toLowerCase() === stageKey.toLowerCase()
        );
        if (idx >= 0) list[idx] = { ...list[idx], ...entry };
        else list.push(entry);
        stageNotes = list;
      }
      return {
        ...row,
        status: submissionStatus,
        feedback: feedback !== undefined ? feedback : row.feedback,
        stageNotes,
        reviewedAt: new Date().toISOString(),
        candidateId: row.candidateId && typeof row.candidateId === 'object'
          ? { ...row.candidateId, status: atsStage }
          : row.candidateId,
      };
    }));
    if (feedback !== undefined) {
      setDrafts((prev) => {
        if (prev[id] === undefined) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    setSavingId(id);
    try {
      const payload = { status: atsStage, forceDuplicate };
      if (feedback !== undefined) payload.feedback = feedback;
      const res = await authenticatedFetch(`/api/freelancer/submissions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'APPROVAL_REQUIRED') {
          toast.info(data.message || 'Approval requested for this stage move');
          await load({ silent: true });
          return true;
        }
        if (data.code === 'DUPLICATE' && Array.isArray(data.duplicates)) {
          const names = data.duplicates.map((d) => d.name || d.email).filter(Boolean).join(', ');
          const ok = window.confirm(`${data.message}\n\nMatches: ${names || 'existing profiles'}\n\nContinue anyway?`);
          if (ok) return updateStatus(id, atsStage, feedback, { forceDuplicate: true });
        }
        throw new Error(data.message || 'Update failed');
      }
      if (feedback !== undefined && String(feedback).trim()) {
        toast.success('Review saved');
      }
      // Refresh so stageNotes / scorecards match server
      await load({ silent: true });
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

  const saveScorecard = async (id, payload) => {
    setSavingId(id);
    try {
      const res = await authenticatedFetch(`/api/freelancer/submissions/${id}/scorecard`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Scorecard save failed');
      toast.success('Scorecard saved');
      await load({ silent: true });
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const decideApproval = async (id, decision) => {
    setSavingId(id);
    try {
      const res = await authenticatedFetch(`/api/freelancer/submissions/${id}/approval`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Approval update failed');
      toast.success(decision === 'approve' ? 'Stage move approved' : 'Approval rejected');
      await load({ silent: true });
      loadMeta();
      return true;
    } catch (err) {
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
      setSelectedIds((prev) => prev.filter((x) => x !== id));
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

  const runBulk = async (action, ids = []) => {
    const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
    if (!list.length) {
      toast.warning('Select at least one submission');
      return;
    }
    if (action === 'hard_delete') {
      if (!canHardDelete) {
        toast.error('Only owners and admins can permanently delete');
        return;
      }
      const ok = window.confirm(
        `Permanently delete ${list.length} submission${list.length === 1 ? '' : 's'}? This cannot be undone.`
      );
      if (!ok) return;
      setBulkSaving(true);
      try {
        let done = 0;
        for (const id of list) {
          // eslint-disable-next-line no-await-in-loop
          const success = await hardDelete(id, false);
          if (success) done += 1;
        }
        toast.success(`Deleted ${done} of ${list.length}`);
        setSelectedIds([]);
        await load({ silent: true });
      } finally {
        setBulkSaving(false);
      }
      return;
    }

    setBulkSaving(true);
    try {
      const res = await authenticatedFetch('/api/freelancer/submissions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids: list }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Bulk action failed');
      const okCount = Array.isArray(data.data?.ok) ? data.data.ok.length : list.length;
      toast.success(`Updated ${okCount} submission${okCount === 1 ? '' : 's'}`);
      setSelectedIds([]);
      await load({ silent: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBulkSaving(false);
    }
  };

  const presenceById = useMemo(() => {
    const map = new Map();
    for (const person of presence) map.set(String(person._id), person);
    return map;
  }, [presence]);

  const desks = useMemo(() => {
    const map = new Map();
    for (const person of presence) {
      const id = String(person._id || '');
      if (!id) continue;
      map.set(id, { ...person, _id: id });
    }
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
      searchText: `${person.name || ''} ${person.email || ''} ${person._id || ''}`,
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
      if (!matchesRecruiterDesk(row, deskFilter)) return false;
      if (!matchesMandate(row, jobFilter)) return false;
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
        idOf(row.freelancerId),
        row.spocUserId?.name,
        row.note,
        row.status,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, deskFilter, jobFilter]);

  const boardRows = useMemo(() => filtered.map((row) => {
    const boardStatus = resolveCompanyStage(row, stages);
    return {
      ...row,
      _submissionStatus: row.status,
      boardStatus,
      status: boardStatus,
    };
  }), [filtered, stages]);

  const counts = useMemo(() => {
    const scoped = boardRows;
    const base = { all: scoped.length };
    for (const s of stages) base[s.id] = 0;
    for (const row of scoped) {
      const key = String(row.status || '').trim();
      if (base[key] !== undefined) {
        base[key] += 1;
        continue;
      }
      // Soft-match e.g. "Screen Reject" → "Rejected"
      const soft = stages.find((s) => {
        const a = String(s.id).toLowerCase();
        const b = key.toLowerCase();
        return a === b || a.includes(b) || b.includes(a.split(' / ')[0]);
      });
      if (soft) base[soft.id] += 1;
    }
    return base;
  }, [boardRows, stages]);

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
            ? 'Archived submissions · restore to return to the active queue'
            : 'External recruiter submissions · stage, score, and advance through the hiring pipeline'
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

      <div className="mb-3">
        <PipelineStageSummary
          stages={stages}
          counts={counts}
          stageFilter={statusFilter}
          setStageFilter={setStatusFilter}
          total={counts.all}
          hint="Hiring pipeline"
          tourAttr="freelance-review-stage-summary"
        />
      </div>

      <LiveDesksPanel
        desks={desks}
        deskFilter={deskFilter}
        setDeskFilter={setDeskFilter}
        lastSyncedAt={lastSyncedAt}
        relativeTime={relativeTime}
      />

      <div
        data-tour="freelance-review-filters"
        className="rounded-2xl border border-stone-200/90 bg-white shadow-sm mb-3 overflow-visible"
      >
        <div className="px-3.5 sm:px-4 py-3 border-b border-stone-100 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-stone-500 inline-flex items-center gap-1.5">
              <Filter size={12} className="text-brand-600" />
              Queue filters
            </p>
            <p className="text-[12px] text-stone-500 mt-0.5">Search · stage · recruiter · mandate</p>
          </div>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="h-8 px-3 rounded-lg text-[12px] font-semibold text-stone-700 border border-stone-200 bg-white hover:bg-stone-50 shrink-0"
            >
              Reset filters
            </button>
          ) : null}
        </div>
        <div className="px-3.5 sm:px-4 py-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="min-w-0 sm:col-span-2 xl:col-span-1">
            <label className="label-ats" htmlFor="review-search">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-600 pointer-events-none z-[1]" />
              <input
                id="review-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, email, mandate…"
                className="input-ats input-ats-icon !pr-9 !h-11 rounded-xl"
                aria-label="Search submissions"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-stone-400 hover:text-stone-600"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="min-w-0">
            <label className="label-ats">Stage</label>
            <PremiumSelect
              compact
              value={statusFilter}
              onChange={(v) => setStatusFilter(v || 'all')}
              options={[
                { value: 'all', label: 'All stages' },
                ...stages.map((s) => ({
                  value: s.id,
                  label: s.label,
                  description: `${counts[s.id] || 0}`,
                  icon: s.icon,
                })),
              ]}
              icon={Layers}
              searchable
              searchPlaceholder="Search stages…"
              menuMinWidth={260}
            />
          </div>
          <div className="min-w-0">
            <label className="label-ats">Recruiter</label>
            <PremiumSelect
              compact
              value={deskFilter}
              onChange={(v) => setDeskFilter(v != null && v !== '' ? String(v) : 'all')}
              options={deskOptions}
              placeholder="All recruiters"
              icon={Users}
              searchable
              searchPlaceholder="Search recruiters…"
              emptyLabel="No recruiters"
              menuMinWidth={280}
            />
          </div>
          <div className="min-w-0">
            <label className="label-ats">Mandate</label>
            <PremiumSelect
              compact
              value={jobFilter}
              onChange={(v) => setJobFilter(v || 'all')}
              options={jobOptions}
              placeholder="All mandates"
              icon={Briefcase}
              searchable
              searchPlaceholder="Search mandates…"
              emptyLabel="No mandates"
              menuMinWidth={280}
            />
          </div>
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
          {(canManageDesk || canHardDelete) ? (
            <DeskEnterpriseBar
              rows={boardRows}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              onBulk={runBulk}
              bulkSaving={bulkSaving}
              canHardDelete={canHardDelete}
              canManageDesk={canManageDesk}
              showArchived={showArchived}
              deskFilter={deskFilter}
              setDeskFilter={setDeskFilter}
            />
          ) : (
            <p className="mb-3 text-[12px] text-stone-500 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
              Archive / permanent delete: ask an owner, admin, or HR manager. Use <span className="font-semibold text-stone-700">Manage</span> on each card when you have access.
            </p>
          )}
          <FreelanceKanbanBoard
            stages={stages}
            rows={boardRows}
            stageFilter={statusFilter}
            interactive
            savingId={savingId}
            deskStatus={deskStatus}
            drafts={drafts}
            selectedIds={selectedIds}
            onToggleSelect={(id) => setSelectedIds((prev) => (
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
            ))}
            onDraft={(id, value) => setDrafts((prev) => ({ ...prev, [id]: value }))}
            onMove={(id, status, note) => updateStatus(id, status, note)}
            onSaveNote={(id, stageOrStatus, text) => {
              const row = boardRows.find((r) => r._id === id);
              const atsStage = stageOrStatus
                || (row?.candidateId && typeof row.candidateId === 'object' ? row.candidateId.status : null)
                || row?.status;
              return updateStatus(id, atsStage, text);
            }}
            onOpenAts={(name) => navigate(`/ats?q=${encodeURIComponent(name)}`)}
            onArchive={canManageDesk ? archiveHandoff : undefined}
            onRestore={canManageDesk ? restoreHandoff : undefined}
            reviewers={reviewers}
            canHardDelete={canHardDelete}
            canManageDesk={canManageDesk}
            onReassign={canManageDesk ? reassignSpoc : undefined}
            onEditCandidate={canManageDesk ? editCandidate : undefined}
            onHardDelete={canHardDelete ? hardDelete : undefined}
            onSaveScorecard={saveScorecard}
            onDecideApproval={decideApproval}
            onScheduleInterview={(row) => {
              const appId = row.applicationId?._id || row.applicationId;
              const q = appId ? `?applicationId=${encodeURIComponent(String(appId))}` : '';
              navigate(`/interviews${q}`);
            }}
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
