import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Briefcase, MapPin, UserPlus, Send, Loader2, Building2, User, X, CheckCircle2,
  Lock, Search, RefreshCw, Kanban, Clock,
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import PremiumSelect from './ui/PremiumSelect';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { formatRoleLabel } from './organization/constants';
import { useAuth } from '../context/AuthContext';

const AUTO_REFRESH_MS = 60_000;

function jobTitle(job) {
  return job?.title || job?.role || 'Untitled mandate';
}

function relativeTime(value) {
  if (!value) return '';
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function resolveMandateSpoc(job) {
  if (job?.mandateSpoc?._id) return job.mandateSpoc;
  if (job?.createdBy?._id) return job.createdBy;
  if (job?.hiringManager?._id) return job.hiringManager;
  return null;
}

function SpocReadOnlyCard({ spoc }) {
  if (!spoc) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-3 text-sm text-amber-900">
        No company SPOC on this mandate yet. Ask an owner or admin to assign the job poster.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/90 px-3.5 py-3 flex items-start gap-3">
      <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center shadow-sm shadow-brand-500/20">
        <User size={15} strokeWidth={2.25} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-stone-900 truncate">{spoc.name || spoc.email || 'Company SPOC'}</p>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-stone-500 bg-white border border-stone-200 px-1.5 py-0.5 rounded-md">
            <Lock size={10} strokeWidth={2.5} /> Locked
          </span>
        </div>
        <p className="text-[11px] text-stone-500 truncate mt-0.5 font-medium">
          {[formatRoleLabel(spoc.role), spoc.email].filter(Boolean).join(' · ')}
        </p>
        <p className="text-[11px] text-stone-400 mt-1.5">
          Auto-assigned to the teammate who posted this mandate. Only an owner or admin can change it.
        </p>
      </div>
    </div>
  );
}

export default function MandatesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [mandates, setMandates] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState(null);
  const [candidateId, setCandidateId] = useState('');
  const [note, setNote] = useState('');

  const canOverrideSpoc = user?.role === 'owner' || user?.role === 'admin';

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [mRes, cRes, subRes] = await Promise.all([
        authenticatedFetch('/api/freelancer/mandates'),
        authenticatedFetch('/api/freelancer/candidates'),
        authenticatedFetch('/api/freelancer/submissions'),
      ]);
      if ([mRes, cRes, subRes].some(isUnauthorized)) return handleUnauthorized();
      const [m, c, sub] = await Promise.all([mRes.json(), cRes.json(), subRes.json()]);
      if (!mRes.ok) throw new Error(m.message || 'Failed to load mandates');
      setMandates(Array.isArray(m.data) ? m.data : []);
      setCandidates(Array.isArray(c.data) ? c.data : []);
      setSubmissions(Array.isArray(sub.data) ? sub.data : []);
      setLastSyncedAt(new Date());
    } catch (err) {
      if (!silent) toast.error(err.message || 'Could not load mandates');
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

  const candidateOptions = useMemo(
    () => candidates.map((c) => ({
      value: c._id,
      label: c.name || 'Candidate',
      description: [c.position, c.email, c.contact].filter(Boolean).join(' · '),
      searchText: [c.name, c.email, c.contact, c.position, c.status, c.source].filter(Boolean).join(' '),
    })),
    [candidates]
  );

  const modalSpoc = useMemo(() => (modal ? resolveMandateSpoc(modal) : null), [modal]);

  const submittedForJob = (jobId) =>
    submissions.filter((row) => String(row.jobId?._id || row.jobId) === String(jobId)).length;

  const openSubmit = (job) => {
    setCandidateId('');
    setNote('');
    setModal(job);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!candidateId || !modal?._id) {
      toast.error('Select a candidate from your desk');
      return;
    }
    if (!modalSpoc?._id && !canOverrideSpoc) {
      toast.error('This mandate has no company SPOC assigned');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        candidateId,
        jobId: modal._id,
        note,
      };
      // Freelancers never pick SPOC — backend locks to mandate poster.
      // Owner/admin override is reserved if this flow is ever opened for them.
      if (canOverrideSpoc && modalSpoc?._id) {
        payload.spocUserId = modalSpoc._id;
      }
      const res = await authenticatedFetch('/api/freelancer/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Submit failed');
      toast.success(`Submitted to ${modalSpoc?.name || modalSpoc?.email || 'company SPOC'}`);
      setModal(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (user?.role && user.role !== 'freelancer') {
    return <Navigate to="/jobs" replace />;
  }

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={Briefcase}
        title="Open Mandates"
        gradientTitle
        subtitle="Live company requisitions you can submit against. Board refreshes automatically."
      >
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => load({ silent: true })}
            disabled={refreshing || loading}
            className="btn-secondary"
            title="Refresh mandates"
          >
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>
          <button type="button" onClick={() => navigate('/my-pipeline')} className="btn-secondary">
            <Kanban className="w-4 h-4" /> My pipeline
          </button>
          <button type="button" onClick={() => navigate('/ats?add=1')} className="btn-primary">
            <UserPlus className="w-4 h-4" /> Add candidate
          </button>
        </div>
      </PageHeader>

      <div className="flex items-center justify-end mb-3 -mt-1 text-[11px] text-stone-400 font-medium tabular-nums">
        <span className="inline-flex items-center gap-1.5">
          <Clock size={11} />
          {lastSyncedAt
            ? `Synced ${relativeTime(lastSyncedAt)} · auto every ${AUTO_REFRESH_MS / 1000}s`
            : 'Syncing…'}
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-40 skeleton-ats rounded-2xl" />)}
        </div>
      ) : mandates.length === 0 ? (
        <div className="card-ats-bordered relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-brand-500 to-teal-500" />
          <EmptyState
            icon={Briefcase}
            tone="violet"
            message="No open mandates"
            subMessage="When the company opens a requisition, it will appear here."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {mandates.map((job) => {
            const spoc = resolveMandateSpoc(job);
            const count = submittedForJob(job._id);
            return (
              <article key={job._id} className="card-ats-bordered relative overflow-hidden p-4 sm:p-5 flex flex-col gap-3">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-brand-500 to-teal-500" />
                <div className="flex items-start justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-600">Open mandate</p>
                    <h2 className="text-[15px] font-bold text-stone-900 tracking-tight mt-1 break-words">{jobTitle(job)}</h2>
                    {job.department && <p className="text-xs text-stone-500 mt-0.5">{job.department}</p>}
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">
                    {job.status || 'Open'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                  {job.location && (
                    <span className="inline-flex items-center gap-1 min-w-0">
                      <MapPin size={12} className="shrink-0" />
                      <span className="truncate">{job.location}</span>
                    </span>
                  )}
                  {(job.experience || job.ctc) && (
                    <span className="truncate">{[job.experience, job.ctc].filter(Boolean).join(' · ')}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-600 min-w-0">
                  <Building2 size={13} className="text-brand-600 shrink-0" />
                  <span className="truncate">
                    SPOC: {spoc?.name || spoc?.email || 'Awaiting company assignment'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] font-medium text-stone-400 tabular-nums">
                    {count} submitted from your desk
                  </span>
                  <button type="button" onClick={() => openSubmit(job)} className="btn-primary">
                    <Send size={14} /> Submit to SPOC
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px]" onClick={() => setModal(null)} aria-hidden />
          <form
            onSubmit={submit}
            className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-stone-200 overflow-hidden max-h-[92vh] flex flex-col"
          >
            <div className="h-1 bg-gradient-to-r from-indigo-500 via-brand-500 to-teal-500" />
            <div className="px-4 sm:px-5 py-4 border-b border-stone-100 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-600">Handoff</p>
                <h3 className="text-sm font-bold text-stone-900 mt-0.5 break-words">Submit for {jobTitle(modal)}</h3>
                {(modal.department || modal.location) && (
                  <p className="text-[11px] text-stone-500 mt-1 truncate">
                    {[modal.department, modal.location].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setModal(null)} className="p-2 rounded-xl hover:bg-stone-100 text-stone-400" aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              {candidates.length === 0 ? (
                <EmptyState
                  compact
                  icon={UserPlus}
                  tone="brand"
                  message="Your desk is empty"
                  subMessage="Add a candidate first."
                  action={(
                    <button type="button" className="btn-primary" onClick={() => navigate('/ats?add=1')}>
                      Add candidate
                    </button>
                  )}
                />
              ) : (
                <>
                  <div>
                    <label className="label-ats" htmlFor="mandate-candidate">
                      Candidate from your desk
                    </label>
                    <PremiumSelect
                      id="mandate-candidate"
                      value={candidateId}
                      onChange={setCandidateId}
                      options={candidateOptions}
                      placeholder="Search name, email, or role…"
                      icon={User}
                      searchable
                      searchPlaceholder="Type to search your desk…"
                      emptyLabel="No candidates match your search"
                      allowClear
                    />
                    <p className="mt-1.5 text-[11px] text-stone-400 inline-flex items-center gap-1">
                      <Search size={11} className="shrink-0" />
                      Search by name, email, phone, or position
                    </p>
                  </div>
                  <div>
                    <label className="label-ats">Company SPOC</label>
                    <SpocReadOnlyCard spoc={modalSpoc} />
                  </div>
                  <div>
                    <label className="label-ats" htmlFor="mandate-note">Note to SPOC (optional)</label>
                    <textarea
                      id="mandate-note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      maxLength={2000}
                      className="input-ats min-h-[88px]"
                      placeholder="Why this candidate fits the mandate…"
                    />
                    <p className="mt-1 text-[11px] text-stone-400 tabular-nums text-right">{note.length}/2000</p>
                  </div>
                </>
              )}
            </div>
            {candidates.length > 0 && (
              <div className="px-4 sm:px-5 py-3 border-t border-stone-100 flex justify-end gap-2 bg-stone-50/40">
                <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting || !candidateId || !modalSpoc?._id}
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  {submitting ? 'Sending…' : 'Notify SPOC'}
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
