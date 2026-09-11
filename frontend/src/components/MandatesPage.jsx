import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Briefcase, MapPin, UserPlus, Send, Loader2, User, X, CheckCircle2,
  Lock, Search, RefreshCw, Kanban, Clock, ChevronLeft, ChevronRight, Eye,
  Building2, Layers, CircleDot, Sparkles, Info, Tags, AlertTriangle, ShieldAlert,
  FileText, StickyNote, Timer, IndianRupee, Check, Ban, Copy,
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import Modal from './ui/Modal';
import PremiumSelect from './ui/PremiumSelect';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { formatRoleLabel } from './organization/constants';
import { useAuth } from '../context/AuthContext';
import { markJobsSeen } from '../hooks/useJobNavUpdates';
import { splitLocations } from './jobs/jobsConstants';
import JobViewModal from './jobs/JobViewModal';
import ContactActionButtons from './ui/ContactActionButtons';
import {
  MANDATES_TOUR_KEY,
  MANDATES_TOUR_STEPS,
} from './freelance/freelanceTourConstants';

const AUTO_REFRESH_MS = 30_000;
const PAGE_SIZE = 20;

function jobTitle(job) {
  return displayMandateHeading(job?.title || job?.role || 'Untitled mandate');
}

/** Soften ALL-CAPS mandate titles into readable headings. */
function displayMandateHeading(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'Untitled mandate';
  const letters = s.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 4 && letters === letters.toUpperCase()) {
    return s
      .toLowerCase()
      .replace(/\b([a-z])/g, (c) => c.toUpperCase());
  }
  return s;
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
  if (job?.hiringManager?._id) return job.hiringManager;
  if (job?.createdBy?._id) return job.createdBy;
  return null;
}

function jobRecency(job) {
  const created = new Date(job?.createdAt || 0).getTime();
  const updated = new Date(job?.updatedAt || job?.createdAt || 0).getTime();
  return Math.max(created || 0, updated || 0);
}

function isUrgentJob(job) {
  return String(job?.priority || '').toLowerCase() === 'urgent';
}

function mandateSortKey(job) {
  // Urgent hiring always floats to the top, then newest activity.
  return (isUrgentJob(job) ? 1e15 : 0) + jobRecency(job);
}

function recencyTag(job, latestId) {
  const created = new Date(job?.createdAt || 0).getTime();
  const updated = new Date(job?.updatedAt || 0).getTime();
  const now = Date.now();
  const day = 86_400_000;
  if (latestId && String(job?._id) === String(latestId)) {
    return { label: 'Latest', className: 'bg-brand-50 text-brand-800 border-brand-200', icon: Sparkles };
  }
  if (created && now - created < 7 * day) {
    return { label: 'New', className: 'bg-sky-50 text-sky-800 border-sky-200', icon: Sparkles };
  }
  if (updated && created && now - updated < 3 * day && updated - created > day) {
    return { label: 'Updated', className: 'bg-amber-50 text-amber-900 border-amber-200', icon: Clock };
  }
  return null;
}

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

const TAG_PALETTE = [
  'bg-indigo-50 text-indigo-700 border-indigo-200',
  'bg-violet-50 text-violet-700 border-violet-200',
  'bg-sky-50 text-sky-700 border-sky-200',
  'bg-teal-50 text-teal-700 border-teal-200',
  'bg-amber-50 text-amber-800 border-amber-200',
  'bg-rose-50 text-rose-700 border-rose-200',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
];

/** Stable color per industry name so the same tag always renders the same way. */
function tagClasses(label) {
  const str = String(label || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

function SpocReadOnlyCard({ spoc }) {
  if (!spoc) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-[13px] text-amber-900">
        No hiring manager assigned. Ask an owner or admin to set one on this job.
      </div>
    );
  }

  const name = spoc.name || spoc.email || 'Hiring manager';

  return (
    <div className="rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50/80 via-white to-teal-50/40 px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center text-xs font-bold shadow-sm shadow-brand-500/20">
          {initials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-stone-900 truncate">{name}</p>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-brand-700 bg-white border border-brand-100 px-1.5 py-0.5 rounded-md">
              <Lock size={10} strokeWidth={2.5} /> Locked
            </span>
          </div>
          <p className="text-[12px] text-stone-500 mt-1 truncate">
            {formatRoleLabel(spoc.role) || 'Hiring manager'}
          </p>
          {spoc.email ? (
            <p className="text-[12px] text-stone-400 mt-0.5 truncate">{spoc.email}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function QualityCheckItem({ ok, label, Icon }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold ${
        ok
          ? 'border-emerald-200/80 bg-white/70 text-emerald-800'
          : 'border-amber-200/80 bg-white/60 text-amber-900'
      }`}
      title={ok ? `${label} ready` : `${label} missing`}
    >
      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-md ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
        <Icon size={12} strokeWidth={2.4} />
      </span>
      {label}
      {ok ? <Check size={12} strokeWidth={2.75} className="text-emerald-600" /> : <Ban size={12} strokeWidth={2.5} className="text-amber-700" />}
    </span>
  );
}

function MandateCard({ job, serial, count, recency, onView, onSubmit, onOpenSubmitted, onCopied }) {
  const spoc = resolveMandateSpoc(job);
  const title = jobTitle(job);
  const hmName = spoc?.name || spoc?.email || 'Unassigned';
  const offerLine = [job.experience, job.ctc].filter(Boolean).join(' · ');
  const RecencyIcon = recency?.icon;
  const urgent = isUrgentJob(job);
  const jobIdLabel = job.jobCode || `REQ-${serial}`;
  const canOpenSubmitted = count > 0 && typeof onOpenSubmitted === 'function';
  const [copied, setCopied] = useState(false);

  const copyJobId = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(jobIdLabel);
      setCopied(true);
      onCopied?.(jobIdLabel);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <article
      className={`group/card relative flex h-full min-h-[17.5rem] min-w-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:shadow-md ${
      urgent
        ? 'border-red-200/80 hover:border-red-300'
        : 'border-stone-200/90 hover:border-brand-200'
    }`}
    >
      <div className={`absolute inset-x-0 top-0 h-[2px] ${
        urgent
          ? 'bg-red-500'
          : 'bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600'
      }`}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pt-4 pb-3">
        {/* Top strip: job ID + copy · status badges */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
          <div className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-teal-200/90 bg-teal-50/80 pl-2 pr-1 py-0.5 text-teal-800">
            <Briefcase size={11} className="shrink-0 text-teal-600" strokeWidth={2.25} />
            <span
              title={`Job ID ${jobIdLabel}`}
              className="min-w-0 truncate font-mono text-[10px] font-semibold tabular-nums tracking-wide leading-none"
            >
              {jobIdLabel}
            </span>
            <button
              type="button"
              onClick={copyJobId}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-teal-700 transition-colors hover:bg-teal-100 hover:text-teal-900"
              title={copied ? 'Copied' : 'Copy Job ID'}
              aria-label={copied ? 'Job ID copied' : `Copy Job ID ${jobIdLabel}`}
            >
              {copied
                ? <Check size={11} strokeWidth={2.75} className="text-emerald-600" />
                : <Copy size={11} strokeWidth={2.25} />}
            </button>
          </div>
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {urgent ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] text-red-700">
                <AlertTriangle size={9} strokeWidth={2.5} />
                Urgent
              </span>
            ) : null}
            {recency ? (
              <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] ${recency.className}`}>
                {RecencyIcon ? <RecencyIcon size={9} strokeWidth={2.5} className="shrink-0" /> : null}
                <span>{recency.label}</span>
              </span>
            ) : null}
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] text-emerald-800">
              {job.status || 'Open'}
            </span>
          </div>
        </div>

        {/* Title + View icon (moved up so footer stays uncongested) */}
        <div className="mt-2 flex min-w-0 items-start gap-2">
          <button
            type="button"
            onClick={onView}
            title={title}
            className="min-w-0 flex-1 text-left text-[15px] font-semibold leading-snug tracking-tight text-stone-900 transition-colors hover:text-brand-700 line-clamp-2 break-words"
          >
            {title}
          </button>
          <button
            type="button"
            onClick={onView}
            className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 shadow-sm transition-all hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
            title="View mandate details"
            aria-label={`View ${title}`}
          >
            <Eye size={14} strokeWidth={2.25} />
          </button>
        </div>

        <div className="mt-2.5 flex min-h-[3.25rem] min-w-0 flex-wrap content-start items-start gap-1.5">
          {job.industry ? (
            <span
              title={job.industry}
              className={`inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${tagClasses(job.industry)}`}
            >
              <Tags size={10} strokeWidth={2.5} className="shrink-0" />
              <span className="truncate">{job.industry}</span>
            </span>
          ) : null}
          {job.clientName ? (
            <span
              title={job.clientName}
              className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-medium text-stone-600"
            >
              <Building2 size={11} className="shrink-0 text-stone-400" />
              <span className="truncate">{job.clientName}</span>
            </span>
          ) : null}
          <span
            title={job.location || 'Location TBD'}
            className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-medium text-stone-600"
          >
            <MapPin size={11} className="shrink-0 text-stone-400" />
            <span className="truncate">{job.location || 'Location TBD'}</span>
          </span>
          {offerLine ? (
            <span
              title={offerLine}
              className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-medium text-stone-600"
            >
              <Briefcase size={11} className="shrink-0 text-stone-400" />
              <span className="truncate">{offerLine}</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-[3.75rem] min-w-0 items-center gap-2.5 border-t border-stone-100 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-800 text-[11px] font-semibold text-white">
          {initials(hmName)}
        </span>
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-stone-400 leading-none">
            Hiring manager
          </p>
          <p className="mt-0.5 truncate text-[13px] font-medium leading-tight text-stone-900" title={hmName}>{hmName}</p>
          <p className="truncate text-[11px] leading-tight text-stone-400">{formatRoleLabel(spoc?.role) || 'Hiring manager'}</p>
        </div>
        {(spoc?.email || spoc?.phone) ? (
          <div className="shrink-0">
            <ContactActionButtons
              email={spoc?.email}
              phone={spoc?.phone}
              mailTitle="Email hiring manager"
              waTitle="WhatsApp hiring manager"
              subject={`Regarding ${job.jobCode || title}`}
              body={`Hi ${spoc?.name || 'there'},\n\nI would like to discuss ${title}${job.jobCode ? ` (${job.jobCode})` : ''}.\n`}
              waText={`Hi, regarding ${job.jobCode || title}.`}
            />
          </div>
        ) : null}
      </div>

      {/* Footer: submitted status + Submit only (View moved up next to title) */}
      <div className="mt-auto flex min-h-[3.25rem] min-w-0 items-center justify-between gap-3 border-t border-stone-100 bg-stone-50/70 px-4 py-3">
        <div className="min-w-0 text-[11px] text-stone-500">
          {canOpenSubmitted ? (
            <button
              type="button"
              onClick={onOpenSubmitted}
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50/70 px-2 py-1 font-semibold text-brand-800 transition-colors hover:border-brand-300 hover:bg-brand-100"
              title="View the candidate profiles you submitted to this mandate"
            >
              <Eye size={12} strokeWidth={2.25} className="shrink-0" />
              <span className="truncate">{count} submitted</span>
            </button>
          ) : count > 0 ? (
            <span className="font-semibold text-brand-800">{count} submitted</span>
          ) : (
            <span className="text-stone-400">Not submitted yet</span>
          )}
        </div>
        <button
          type="button"
          onClick={onSubmit}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[12px] font-semibold text-white shadow-sm transition-all hover:bg-brand-700"
        >
          <Send size={13} /> Submit
        </button>
      </div>
    </article>
  );
}

export default function MandatesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(MANDATES_TOUR_KEY);
  const [mandates, setMandates] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState(null);
  const [viewingJob, setViewingJob] = useState(null);
  const [candidateId, setCandidateId] = useState('');
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [locationFilter, setLocationFilter] = useState('all');
  const [spocFilter, setSpocFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [submitFilter, setSubmitFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [qualityPreview, setQualityPreview] = useState(null);
  const [duplicateBlock, setDuplicateBlock] = useState(null);

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
  useEffect(() => { markJobsSeen(); }, []);

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

  const candidateOptions = useMemo(
    () => candidates.map((c) => ({
      value: c._id,
      label: c.name || 'Candidate',
      description: [c.position, c.email, c.contact].filter(Boolean).join(' · '),
      searchText: [c.name, c.email, c.contact, c.position, c.status, c.source].filter(Boolean).join(' '),
    })),
    [candidates]
  );

  const submissionsForJob = useCallback((jobId) => (
    submissions.filter((row) => String(row.jobId?._id || row.jobId) === String(jobId))
  ), [submissions]);

  const submittedForJob = useCallback((jobId) => submissionsForJob(jobId).length, [submissionsForJob]);

  const openSubmittedCandidates = useCallback((job) => {
    const rows = submissionsForJob(job?._id);
    const ids = [...new Set(
      rows
        .map((row) => String(row.candidateId?._id || row.candidateId || row.candidateSnapshot?._id || '').trim())
        .filter(Boolean)
    )];
    if (!ids.length) {
      toast.info('No candidates submitted to this mandate yet.');
      return;
    }
    const params = new URLSearchParams();
    params.set('ids', ids.join(','));
    if (job?.jobCode) params.set('mandate', String(job.jobCode));
    else if (job?.title || job?.role) params.set('mandate', String(job.title || job.role));
    navigate(`/ats?${params.toString()}`);
  }, [navigate, submissionsForJob, toast]);

  const locationOptions = useMemo(() => {
    const seen = new Map();
    for (const job of mandates) {
      for (const loc of splitLocations(job.locations, job.location)) {
        const key = loc.toLowerCase();
        if (!seen.has(key)) seen.set(key, loc);
      }
    }
    return [
      { value: 'all', label: 'All locations' },
      ...[...seen.values()].sort((a, b) => a.localeCompare(b)).map((v) => ({ value: v, label: v })),
    ];
  }, [mandates]);

  const deptOptions = useMemo(() => {
    const seen = new Map();
    for (const job of mandates) {
      const dept = String(job.department || '').trim();
      if (!dept) continue;
      const key = dept.toLowerCase();
      if (!seen.has(key)) seen.set(key, dept);
    }
    return [
      { value: 'all', label: 'All departments' },
      ...[...seen.values()].sort((a, b) => a.localeCompare(b)).map((v) => ({ value: v, label: v })),
    ];
  }, [mandates]);

  const industryCounts = useMemo(() => {
    const seen = new Map();
    for (const job of mandates) {
      const industry = String(job.industry || '').trim();
      if (!industry) continue;
      const key = industry.toLowerCase();
      const entry = seen.get(key) || { value: industry, label: industry, count: 0 };
      entry.count += 1;
      seen.set(key, entry);
    }
    return [...seen.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [mandates]);

  const industryOptions = useMemo(() => [
    { value: 'all', label: 'All industries' },
    ...industryCounts.map((row) => ({ value: row.value, label: `${row.label} (${row.count})` })),
  ], [industryCounts]);

  const spocOptions = useMemo(() => {
    const seen = new Map();
    for (const job of mandates) {
      const spoc = resolveMandateSpoc(job);
      if (!spoc?._id) continue;
      const id = String(spoc._id);
      if (!seen.has(id)) {
        seen.set(id, {
          value: id,
          label: spoc.name || spoc.email || 'Hiring manager',
          description: [formatRoleLabel(spoc.role), spoc.email].filter(Boolean).join(' · '),
          searchText: [spoc.name, spoc.email, spoc.role].filter(Boolean).join(' '),
        });
      }
    }
    return [
      { value: 'all', label: 'All hiring managers' },
      ...[...seen.values()].sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [mandates]);

  const modalSpoc = useMemo(() => (modal ? resolveMandateSpoc(modal) : null), [modal]);

  const latestMandateId = useMemo(() => {
    if (!mandates.length) return '';
    return [...mandates].sort((a, b) => mandateSortKey(b) - mandateSortKey(a))[0]?._id || '';
  }, [mandates]);

  const filteredMandates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = mandates.filter((job) => {
      const spoc = resolveMandateSpoc(job);
      const count = submittedForJob(job._id);
      if (locationFilter !== 'all') {
        const jobLocs = splitLocations(job.locations, job.location);
        if (!jobLocs.includes(locationFilter)) return false;
      }
      if (deptFilter !== 'all' && String(job.department || '').trim() !== deptFilter) return false;
      if (industryFilter !== 'all' && String(job.industry || '').trim().toLowerCase() !== industryFilter.toLowerCase()) return false;
      if (spocFilter !== 'all' && String(spoc?._id || '') !== spocFilter) return false;
      if (submitFilter === 'submitted' && count === 0) return false;
      if (submitFilter === 'none' && count > 0) return false;
      if (priorityFilter === 'urgent' && !isUrgentJob(job)) return false;
      if (!q) return true;
      const hay = [
        jobTitle(job),
        job.jobCode,
        job.clientName,
        job.department,
        job.industry,
        job.location,
        job.experience,
        job.ctc,
        job.status,
        job.priority,
        spoc?.name,
        spoc?.email,
        spoc?.role,
        job.postedBy?.name,
        job.postedBy?.email,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
    return next.sort((a, b) => mandateSortKey(b) - mandateSortKey(a));
  }, [mandates, query, locationFilter, deptFilter, industryFilter, spocFilter, submitFilter, priorityFilter, submittedForJob]);

  useEffect(() => { setPage(1); }, [query, locationFilter, deptFilter, industryFilter, spocFilter, submitFilter, priorityFilter]);

  const counts = useMemo(() => {
    const all = mandates.length;
    let submitted = 0;
    let none = 0;
    let urgent = 0;
    for (const job of mandates) {
      if (submittedForJob(job._id) > 0) submitted += 1;
      else none += 1;
      if (isUrgentJob(job)) urgent += 1;
    }
    return { all, submitted, none, urgent };
  }, [mandates, submittedForJob]);

  const hasActiveFilters = Boolean(
    query.trim()
    || locationFilter !== 'all'
    || deptFilter !== 'all'
    || industryFilter !== 'all'
    || spocFilter !== 'all'
    || submitFilter !== 'all'
    || priorityFilter !== 'all'
  );

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (industryFilter !== 'all') {
      chips.push({ key: 'industry', label: `Industry: ${industryFilter}`, onRemove: () => setIndustryFilter('all') });
    }
    if (locationFilter !== 'all') {
      chips.push({ key: 'location', label: `Location: ${locationFilter}`, onRemove: () => setLocationFilter('all') });
    }
    if (spocFilter !== 'all') {
      const match = spocOptions.find((o) => o.value === spocFilter);
      chips.push({ key: 'spoc', label: `Hiring manager: ${match?.label || 'Selected'}`, onRemove: () => setSpocFilter('all') });
    }
    if (deptFilter !== 'all') {
      chips.push({ key: 'dept', label: `Department: ${deptFilter}`, onRemove: () => setDeptFilter('all') });
    }
    if (priorityFilter === 'urgent') {
      chips.push({ key: 'priority', label: 'Urgent hiring', onRemove: () => setPriorityFilter('all') });
    }
    return chips;
  }, [industryFilter, locationFilter, spocFilter, deptFilter, priorityFilter, spocOptions]);

  const clearFilters = () => {
    setQuery('');
    setLocationFilter('all');
    setDeptFilter('all');
    setIndustryFilter('all');
    setSpocFilter('all');
    setSubmitFilter('all');
    setPriorityFilter('all');
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filteredMandates.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedMandates = filteredMandates.slice(pageStart, pageStart + PAGE_SIZE);

  const openSubmit = (job) => {
    setCandidateId('');
    setNote('');
    setQualityPreview(null);
    setDuplicateBlock(null);
    setModal(job);
  };

  const closeSubmit = () => {
    setModal(null);
    setDuplicateBlock(null);
    setQualityPreview(null);
    setCandidateId('');
    setNote('');
  };

  useEffect(() => {
    if (!modal || !candidateId) {
      setQualityPreview(null);
      return undefined;
    }
    const t = window.setTimeout(() => {
      authenticatedFetch('/api/freelancer/submissions/preview-quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, note }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data?.data) setQualityPreview(data.data);
        })
        .catch(() => {});
    }, 280);
    return () => window.clearTimeout(t);
  }, [modal, candidateId, note]);

  const submit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!candidateId || !modal?._id) {
      toast.error('Select a candidate to submit');
      return;
    }
    if (!modalSpoc?._id && !canOverrideSpoc) {
      toast.error('This mandate has no hiring manager assigned');
      return;
    }
    setSubmitting(true);
    setDuplicateBlock(null);
    try {
      const payload = {
        candidateId,
        jobId: modal._id,
        note,
      };
      if (canOverrideSpoc && modalSpoc?._id) {
        payload.spocUserId = modalSpoc._id;
      }
      const res = await authenticatedFetch('/api/freelancer/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'DUPLICATE') {
          setDuplicateBlock({
            message: data.message
              || 'The candidate is duplicate kindly check with the hiring manager',
            duplicates: data.duplicates || [],
            jobTitle: jobTitle(modal),
            jobCode: modal.jobCode || '',
          });
          return;
        }
        if (data.code === 'QUALITY' && Array.isArray(data.missing)) {
          throw new Error(`Complete candidate profile first: ${data.missing.join(', ')}`);
        }
        throw new Error(data.message || 'Submit failed');
      }
      toast.success(`Submitted to ${modalSpoc?.name || modalSpoc?.email || 'hiring manager'}`);
      closeSubmit();
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
        subtitle="Active requisitions available for submission. Each submission is routed to the hiring manager on the job."
        className="mb-5"
      >
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <div className="grid grid-cols-2 gap-2 sm:contents">
            <button
              type="button"
              onClick={() => load({ silent: true })}
              disabled={refreshing || loading}
              className="btn-secondary !h-10 w-full justify-center gap-1.5 sm:w-auto"
              title="Refresh requisitions"
            >
              {refreshing ? <Loader2 size={15} className="animate-spin" strokeWidth={2.25} /> : <RefreshCw size={15} strokeWidth={2.25} />}
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate('/my-pipeline')}
              className="btn-secondary !h-10 w-full justify-center gap-1.5 sm:w-auto"
            >
              <Kanban size={15} strokeWidth={2.25} />
              Pipeline
            </button>
          </div>
          <button
            type="button"
            onClick={() => navigate('/ats?add=1')}
            className="btn-primary !h-10 w-full justify-center gap-1.5 sm:w-auto"
          >
            <UserPlus size={15} strokeWidth={2.25} />
            Add Candidate
          </button>
        </div>
      </PageHeader>

      <div
        data-tour="mandates-tip"
        className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-5"
      >
        <span className="inline-flex items-center gap-1.5 text-brand-700 font-semibold">
          <Info size={14} /> Guidance
        </span>
        <span>
          Create a candidate under Candidates, then submit against a mandate. Company reviewers process submissions in Freelance Desk Review.
          {' '}Use help for a short product tour.
        </span>
      </div>

      <div
        data-tour="mandates-workbench"
        className="rounded-2xl border border-stone-200/90 bg-white shadow-[var(--shadow-card)] overflow-hidden"
      >
        <div className="px-4 sm:px-5 py-4 border-b border-stone-100 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-600 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find by job ID, requisition, client, industry, or hiring manager"
              className="input-ats input-ats-icon !pr-9 !h-10 rounded-xl w-full"
              aria-label="Find requisition"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-auto sm:min-w-[10rem] sm:flex-1 sm:max-w-[14rem]">
              <PremiumSelect
                variant="list"
                compact
                value={industryFilter}
                onChange={(v) => setIndustryFilter(v || 'all')}
                options={industryOptions}
                placeholder="Industry"
                icon={Tags}
                searchable
                searchPlaceholder="Industry…"
                emptyLabel="No industries tagged yet"
              />
            </div>
            <div className="w-full sm:w-auto sm:min-w-[10rem] sm:flex-1 sm:max-w-[14rem]">
              <PremiumSelect
                variant="list"
                compact
                value={locationFilter}
                onChange={(v) => setLocationFilter(v || 'all')}
                options={locationOptions}
                placeholder="Location"
                icon={MapPin}
                searchable
                searchPlaceholder="Location…"
                emptyLabel="No locations"
              />
            </div>
            <div className="w-full sm:w-auto sm:min-w-[10rem] sm:flex-1 sm:max-w-[14rem]">
              <PremiumSelect
                variant="list"
                compact
                value={spocFilter}
                onChange={(v) => setSpocFilter(v || 'all')}
                options={spocOptions}
                placeholder="Hiring manager"
                icon={User}
                searchable
                searchPlaceholder="Hiring manager…"
                emptyLabel="No hiring managers"
              />
            </div>
            {deptOptions.length > 1 ? (
              <div className="w-full sm:w-auto sm:min-w-[10rem] sm:flex-1 sm:max-w-[14rem]">
                <PremiumSelect
                  variant="list"
                  compact
                  value={deptFilter}
                  onChange={(v) => setDeptFilter(v || 'all')}
                  options={deptOptions}
                  placeholder="Department"
                  icon={Briefcase}
                  searchable
                  searchPlaceholder="Department…"
                  emptyLabel="No departments"
                />
              </div>
            ) : null}
          </div>

          {activeFilterChips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onRemove}
                  className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 text-[11px] font-semibold rounded-full bg-brand-50 text-brand-800 border border-brand-200 hover:bg-brand-100 transition-colors"
                >
                  {chip.label}
                  <X size={11} strokeWidth={2.5} />
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="inline-flex flex-wrap rounded-xl border border-stone-200 bg-stone-50/80 p-1 gap-0.5">
              {[
                { key: 'all', label: 'All', count: counts.all, icon: Layers, kind: 'submit' },
                { key: 'none', label: 'Available', count: counts.none, icon: CircleDot, kind: 'submit' },
                { key: 'submitted', label: 'Worked', count: counts.submitted, icon: CheckCircle2, kind: 'submit' },
                { key: 'urgent', label: 'Urgent hiring', count: counts.urgent, icon: AlertTriangle, kind: 'priority' },
              ].map((tab) => {
                const TabIcon = tab.icon;
                const active = tab.kind === 'priority'
                  ? priorityFilter === 'urgent' && submitFilter === 'all'
                  : submitFilter === tab.key && priorityFilter === 'all';
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      if (tab.kind === 'priority') {
                        setPriorityFilter('urgent');
                        setSubmitFilter('all');
                      } else {
                        setSubmitFilter(tab.key);
                        setPriorityFilter('all');
                      }
                    }}
                    className={`h-8 px-3 text-[12px] font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors ${
                      active
                        ? tab.kind === 'priority'
                          ? 'bg-red-600 text-white shadow-sm shadow-red-600/25'
                          : 'bg-brand-600 text-white shadow-sm shadow-brand-600/20'
                        : tab.kind === 'priority'
                          ? 'text-red-700 hover:bg-red-50 hover:text-red-800'
                          : 'text-stone-600 hover:bg-white hover:text-stone-900'
                    }`}
                  >
                    <TabIcon size={13} strokeWidth={2.25} />
                    {tab.label}
                    <span className={active ? 'text-white/80' : tab.kind === 'priority' ? 'text-red-400' : 'text-stone-400'}>{tab.count}</span>
                  </button>
                );
              })}
            </div>
            {hasActiveFilters ? (
              <button type="button" onClick={clearFilters} className="text-[12px] font-semibold text-brand-700 hover:text-brand-800">
                Reset
              </button>
            ) : null}
            <p className="ml-auto text-[11px] text-stone-400 tabular-nums inline-flex items-center gap-1.5 rounded-lg bg-stone-50 px-2.5 py-1">
              <Clock size={12} className="text-brand-600" />
              {lastSyncedAt
                ? `Synced ${relativeTime(lastSyncedAt)} · auto ${AUTO_REFRESH_MS / 1000}s`
                : 'Syncing…'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-48 rounded-xl border border-stone-200 skeleton-ats" />)}
          </div>
        ) : mandates.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            tone="neutral"
            message="No open requisitions"
            subMessage="When the company publishes a mandate, it will appear in this list."
          />
        ) : filteredMandates.length === 0 ? (
          <EmptyState
            icon={Search}
            tone="neutral"
            message="No requisitions match the current criteria"
            subMessage="Change location, hiring manager, or search terms."
            action={(
              <button type="button" className="btn-secondary" onClick={clearFilters}>
                Reset criteria
              </button>
            )}
          />
        ) : (
          <>
            <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
              {pagedMandates.map((job, index) => (
                <MandateCard
                  key={job._id}
                  job={job}
                  serial={pageStart + index + 1}
                  count={submittedForJob(job._id)}
                  recency={recencyTag(job, latestMandateId)}
                  onView={() => setViewingJob(job)}
                  onSubmit={() => openSubmit(job)}
                  onOpenSubmitted={() => openSubmittedCandidates(job)}
                  onCopied={(code) => toast.success(`Job ID copied · ${code}`)}
                />
              ))}
            </div>

            <div className="px-3 py-2 border-t border-stone-200 bg-stone-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-[12px] text-stone-500">
                {pagedMandates.length > 0 ? pageStart + 1 : 0}–{pageStart + pagedMandates.length}
                {' of '}
                {filteredMandates.length.toLocaleString()} requisitions
                <span className="text-stone-400"> · {PAGE_SIZE} per page</span>
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="h-8 px-2.5 border border-stone-300 bg-white text-[12px] font-semibold text-stone-700 disabled:opacity-40 inline-flex items-center gap-1"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let n;
                  if (totalPages <= 5) n = i + 1;
                  else if (safePage <= 3) n = i + 1;
                  else if (safePage >= totalPages - 2) n = totalPages - 4 + i;
                  else n = safePage - 2 + i;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className={`h-8 min-w-[32px] text-[12px] font-semibold border ${
                        n === safePage
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'text-stone-600 border-stone-300 bg-white hover:bg-stone-50'
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="h-8 px-2.5 border border-stone-300 bg-white text-[12px] font-semibold text-stone-700 disabled:opacity-40 inline-flex items-center gap-1"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <Modal
        open={!!modal}
        onClose={closeSubmit}
        closeOnBackdrop={false}
        size="lg"
        icon={Send}
        title="Submit to requisition"
        description={[
          jobTitle(modal || {}),
          modal?.jobCode,
          modal?.clientName,
          modal?.location,
        ].filter(Boolean).join(' · ')}
        footer={candidates.length > 0 ? (
          <>
            <button type="button" className="btn-secondary" onClick={closeSubmit} disabled={submitting}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={submit}
              disabled={
                submitting
                || !candidateId
                || !modalSpoc?._id
                || (qualityPreview?.quality && !qualityPreview.quality.complete)
              }
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} strokeWidth={2.25} />}
              {submitting ? 'Submitting…' : 'Submit to hiring manager'}
            </button>
          </>
        ) : null}
      >
        {candidates.length === 0 ? (
          <EmptyState
            compact
            icon={UserPlus}
            tone="brand"
            message="No candidates available"
            subMessage="Add a candidate before submitting against this requisition."
            action={(
              <button type="button" className="btn-primary" onClick={() => navigate('/ats?add=1')}>
                Add Candidate
              </button>
            )}
          />
        ) : (
          <div className="space-y-5">
            <div>
              <label className="label-ats" htmlFor="mandate-candidate">Candidate</label>
              <PremiumSelect
                id="mandate-candidate"
                value={candidateId}
                onChange={(v) => {
                  setCandidateId(v);
                  setDuplicateBlock(null);
                }}
                options={candidateOptions}
                placeholder="Search name, email, or role…"
                icon={User}
                searchable
                searchPlaceholder="Name, email, or role…"
                emptyLabel="No candidates match"
                allowClear
              />
            </div>
            <div>
              <p className="label-ats" id="mandate-hiring-manager-label">Hiring manager</p>
              <div aria-labelledby="mandate-hiring-manager-label">
                <SpocReadOnlyCard spoc={modalSpoc} />
              </div>
              <p className="mt-2 text-[12px] text-stone-400">
                Submissions are routed to this person. You cannot change the recipient.
              </p>
            </div>
            <div>
              <label className="label-ats" htmlFor="mandate-note">Cover note</label>
              <textarea
                id="mandate-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                maxLength={2000}
                className="input-ats min-h-[112px] rounded-xl"
                placeholder="Optional — why this candidate fits the role…"
              />
              <p className="mt-1.5 text-right text-[11px] tabular-nums text-stone-400">{note.length}/2000</p>
            </div>
            {qualityPreview?.quality ? (
              <div
                className={`rounded-2xl border px-3.5 py-3 ${
                  qualityPreview.quality.complete
                    ? 'border-emerald-200/90 bg-gradient-to-br from-emerald-50 via-white to-teal-50/40 text-emerald-950'
                    : 'border-amber-200/90 bg-gradient-to-br from-amber-50 via-white to-orange-50/30 text-amber-950'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm ${
                      qualityPreview.quality.complete
                        ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                        : 'bg-amber-500 text-white shadow-amber-500/20'
                    }`}
                  >
                    {qualityPreview.quality.complete
                      ? <CheckCircle2 size={16} strokeWidth={2.4} />
                      : <AlertTriangle size={16} strokeWidth={2.4} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold tracking-tight">
                      {qualityPreview.quality.complete ? 'Quality checklist passed' : 'Quality checklist incomplete'}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <QualityCheckItem ok={qualityPreview.quality.hasResume} label="Resume" Icon={FileText} />
                      <QualityCheckItem ok={qualityPreview.quality.hasNote} label="Note" Icon={StickyNote} />
                      <QualityCheckItem ok={qualityPreview.quality.hasNotice} label="Notice" Icon={Timer} />
                      <QualityCheckItem ok={qualityPreview.quality.hasExpectedCtc} label="CTC" Icon={IndianRupee} />
                    </div>
                    {qualityPreview.quality.missing?.length ? (
                      <p className="mt-2 text-[12px] font-medium">
                        Required before submit: {qualityPreview.quality.missing.join(', ')}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
            {qualityPreview?.duplicates?.length ? (
              <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50/40 px-3.5 py-3 text-[12px] text-orange-950">
                <div className="flex items-start gap-2.5">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-white shadow-sm shadow-orange-600/20">
                    <ShieldAlert size={16} strokeWidth={2.4} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold tracking-tight">Duplicate candidate</p>
                    <p className="mt-1 leading-relaxed text-orange-900/90">
                      The candidate is duplicate kindly check with the hiring manager
                    </p>
                    <p className="mt-2 font-semibold text-orange-950">
                      Matches:{' '}
                      {qualityPreview.duplicates.map((d) => d.name || d.email || d.contact).filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      <Modal
        open={!!duplicateBlock}
        onClose={() => setDuplicateBlock(null)}
        closeOnBackdrop={false}
        size="md"
        icon={ShieldAlert}
        title="Duplicate candidate"
        description="Please check with the hiring manager before submitting again."
        footer={(
          <button type="button" className="btn-primary" onClick={() => setDuplicateBlock(null)}>
            Understood
          </button>
        )}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-orange-200/90 bg-gradient-to-br from-orange-50 via-white to-amber-50/50 px-4 py-3.5">
            <p className="text-[13px] font-semibold leading-relaxed text-stone-800">
              {duplicateBlock?.message
                || 'The candidate is duplicate kindly check with the hiring manager'}
            </p>
          </div>
          {(duplicateBlock?.jobTitle || duplicateBlock?.jobCode) ? (
            <p className="text-[12px] text-stone-500">
              Mandate:{' '}
              <span className="font-semibold text-stone-800">
                {[duplicateBlock?.jobCode, duplicateBlock?.jobTitle].filter(Boolean).join(' · ')}
              </span>
            </p>
          ) : null}
          {Array.isArray(duplicateBlock?.duplicates) && duplicateBlock.duplicates.length > 0 ? (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-stone-500">Existing ATS matches</p>
              <ul className="space-y-2">
                {duplicateBlock.duplicates.map((dup) => (
                  <li
                    key={String(dup._id || dup.email || dup.contact || dup.name)}
                    className="rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-2.5"
                  >
                    <p className="text-[13px] font-semibold text-stone-900">{dup.name || 'Existing candidate'}</p>
                    <p className="mt-0.5 text-[12px] text-stone-500">
                      {[dup.email, dup.contact, dup.matchOn ? `Matched on ${dup.matchOn}` : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-[12px] leading-relaxed text-stone-500">
            Select a different candidate, or request that the company team review the existing profile in Candidates.
          </p>
        </div>
      </Modal>

      <JobViewModal
        open={!!viewingJob}
        job={viewingJob}
        onClose={() => setViewingJob(null)}
        allowCopyJobId
        onCopiedJobId={(code) => toast.success(`Job ID copied · ${code}`)}
      />

      <TourHelpFab
        onClick={() => setTourOpen(true)}
        label="Take a tour"
        title="Take a tour of Open Mandates"
      />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={MANDATES_TOUR_STEPS}
        storageKey={MANDATES_TOUR_KEY}
      />
    </div>
  );
}
