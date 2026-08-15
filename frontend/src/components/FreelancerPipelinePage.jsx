import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Kanban, RefreshCw, Send, User, Briefcase, Clock, Eye,
  FileText, Search, CheckCircle2, XCircle, Loader2,
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import { formatRoleLabel } from './organization/constants';

const AUTO_REFRESH_MS = 60_000;

const STAGES = [
  {
    id: 'submitted',
    label: 'Submitted',
    hint: 'Awaiting SPOC',
    icon: Send,
    color: 'bg-sky-50',
    borderColor: 'border-sky-200',
    textColor: 'text-sky-700',
    bar: 'bg-sky-500',
  },
  {
    id: 'reviewing',
    label: 'Reviewing',
    hint: 'SPOC in progress',
    icon: Search,
    color: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-800',
    bar: 'bg-amber-500',
  },
  {
    id: 'shortlisted',
    label: 'Shortlisted',
    hint: 'Moved forward',
    icon: CheckCircle2,
    color: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-700',
    bar: 'bg-emerald-500',
  },
  {
    id: 'rejected',
    label: 'Rejected',
    hint: 'Not progressing',
    icon: XCircle,
    color: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    bar: 'bg-red-500',
  },
];

function relativeTime(value) {
  if (!value) return '';
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

function jobTitle(job) {
  return job?.title || job?.role || 'Untitled mandate';
}

export default function FreelancerPipelinePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [query, setQuery] = useState('');

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [
        row.candidateId?.name,
        row.candidateId?.email,
        row.candidateId?.position,
        jobTitle(row.jobId),
        row.spocUserId?.name,
        row.spocUserId?.email,
        row.status,
        row.note,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  const byStage = useMemo(() => {
    const map = Object.fromEntries(STAGES.map((s) => [s.id, []]));
    for (const row of filtered) {
      const key = STAGES.some((s) => s.id === row.status) ? row.status : 'submitted';
      map[key].push(row);
    }
    return map;
  }, [filtered]);

  if (user?.role && user.role !== 'freelancer') {
    return <Navigate to="/recruitment" replace />;
  }

  return (
    <div className="page-shell-ats animate-page-enter h-[calc(100vh-4rem)] flex flex-col min-h-0">
      <PageHeader
        icon={Kanban}
        title="My Pipeline"
        gradientTitle
        subtitle="Read-only view of candidates you submitted. Statuses are updated by the company SPOC — only you see this board."
        className="shrink-0"
      >
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search submissions…"
              className="input-ats !pl-9 h-10 text-sm w-full"
            />
          </div>
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
          <button type="button" onClick={() => navigate('/mandates')} className="btn-primary">
            <Send size={14} /> Mandates
          </button>
        </div>
      </PageHeader>

      <div className="flex items-center justify-between gap-2 mt-1 mb-3 shrink-0 text-[11px] text-stone-400 font-medium">
        <span className="inline-flex items-center gap-1.5">
          <Eye size={12} className="text-indigo-500" />
          Private to you · SPOC updates only
        </span>
        <span className="tabular-nums inline-flex items-center gap-1.5">
          <Clock size={11} />
          {lastSyncedAt
            ? `Synced ${relativeTime(lastSyncedAt)} · auto every ${AUTO_REFRESH_MS / 1000}s`
            : 'Syncing…'}
        </span>
      </div>

      {loading ? (
        <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton-ats rounded-2xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="card-ats-bordered relative overflow-hidden flex-1">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-brand-500 to-teal-500" />
          <EmptyState
            icon={Kanban}
            tone="violet"
            message="No submissions yet"
            subMessage="Submit a candidate against an open mandate. The SPOC will move them here as they review."
            action={(
              <button type="button" className="btn-primary" onClick={() => navigate('/mandates')}>
                Open mandates
              </button>
            )}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 w-full overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 sm:gap-4 h-full items-stretch w-max pr-2 pb-1">
            {STAGES.map((stage) => {
              const StageIcon = stage.icon;
              const cards = byStage[stage.id] || [];
              return (
                <div
                  key={stage.id}
                  className={`w-[240px] sm:w-[260px] md:w-[280px] flex-shrink-0 flex flex-col h-full rounded-2xl border bg-stone-50/80 ${stage.borderColor}`}
                >
                  <div className={`flex-shrink-0 px-3 py-2.5 border-b flex items-center justify-between gap-2 rounded-t-2xl ${stage.color} ${stage.borderColor}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <StageIcon className={`w-4 h-4 flex-shrink-0 ${stage.textColor}`} />
                        <h3 className={`font-bold text-sm truncate ${stage.textColor}`}>{stage.label}</h3>
                      </div>
                      <p className="text-[10px] text-stone-500 mt-0.5 font-medium">{stage.hint}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/90 shadow-sm border flex-shrink-0 tabular-nums ${stage.textColor} ${stage.borderColor}`}>
                      {cards.length}
                    </span>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2.5 space-y-2 scrollbar-thin">
                    {cards.length === 0 ? (
                      <p className="text-center text-[11px] text-stone-400 py-8 px-2">No candidates in this stage</p>
                    ) : (
                      cards.map((row) => {
                        const candidate = row.candidateId || {};
                        const job = row.jobId || {};
                        const spoc = row.spocUserId || {};
                        return (
                          <article
                            key={row._id}
                            className="bg-white p-3 rounded-xl shadow-sm border border-stone-200/80 hover:border-brand-300 hover:shadow-md transition-all"
                          >
                            <div className="flex items-start gap-2 mb-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {(candidate.name || '?').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-stone-900 text-sm truncate">{candidate.name || 'Candidate'}</h4>
                                <p className="text-[11px] text-stone-400 truncate">
                                  {candidate.email || candidate.position || 'From your desk'}
                                </p>
                              </div>
                            </div>

                            <div className="text-xs text-stone-500 mb-2 flex items-center gap-1.5 min-w-0">
                              <Briefcase className="w-3 h-3 text-stone-400 flex-shrink-0" />
                              <span className="truncate">{jobTitle(job)}</span>
                            </div>

                            <div className="text-[11px] text-stone-500 flex items-center gap-1.5 min-w-0 mb-2">
                              <User className="w-3 h-3 text-stone-400 flex-shrink-0" />
                              <span className="truncate">
                                SPOC: {spoc.name || spoc.email || '—'}
                                {spoc.role ? ` · ${formatRoleLabel(spoc.role)}` : ''}
                              </span>
                            </div>

                            {row.note ? (
                              <p className="text-[11px] text-stone-500 line-clamp-2 mb-2 border-t border-stone-100 pt-2">
                                {row.note}
                              </p>
                            ) : null}

                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100">
                              <span className="text-[10px] font-medium text-stone-400 tabular-nums inline-flex items-center gap-1">
                                <Clock size={10} />
                                {relativeTime(row.reviewedAt || row.updatedAt || row.createdAt)}
                              </span>
                              <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded-md inline-flex items-center gap-1">
                                <FileText size={9} /> View only
                              </span>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
