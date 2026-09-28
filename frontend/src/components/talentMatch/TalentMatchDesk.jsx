import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Mail, Loader2, RefreshCw,   CheckSquare, Square, MinusSquare, AlertCircle, X, Send,
  UserRound, Network,
} from 'lucide-react';
import { interpretMessage, mergeConstraints, rowMatchesConstraints, filterChips } from './talentChat';
import { matchNotePresentation, MATCH_TONE_DOT } from './matchNotes';
import { authenticatedFetch } from '../../utils/fetchUtils';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import { blockTableExfil } from '../../utils/tableCopyGuard';
import { WhatsAppIcon } from '../icons/BrandIcons';
import { useCandidateEmail } from '../ats/hooks/useCandidateEmail';
import CandidateEmailModal from '../ats/CandidateEmailModal';
import ConfirmationModal from '../ConfirmationModal';
import { careersApplyUrl, withJobApplyFooter } from '../../utils/careersApplyUrl';
import { veiledEmployer, jobEmailSummary, cleanApplyUrl } from '../../utils/employerVeil';

const BAND_CLASS = {
  Strong: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Good: 'bg-teal-50 text-teal-800 border-teal-200',
  Partial: 'bg-amber-50 text-amber-800 border-amber-200',
  Low: 'bg-stone-100 text-stone-600 border-stone-200',
};

const SOURCE_BADGE = {
  candidates: { label: 'Candidate', className: 'bg-stone-100 text-stone-500 border-stone-200' },
  mis: { label: 'MIS directory', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  both: { label: 'Candidate · MIS', className: 'bg-violet-50 text-violet-700 border-violet-200' },
};

function canMessage(row) {
  if (row.unsubscribed) return false;
  if (row.marketingConsent === false) return false;
  return Boolean(row.email || row.phone);
}

const SOURCE_LABEL = {
  all: 'Candidates and MIS',
  candidates: 'Candidates',
  mis: 'MIS directory',
};

function sourceChoicesFor(sources) {
  if (sources.includes('candidates') && sources.includes('mis')) return ['all', 'candidates', 'mis'];
  if (sources.includes('mis')) return ['mis'];
  return ['candidates'];
}

export default function TalentMatchDesk({
  fixedJob = null,
  embedded = false,
  initialSource = 'candidates',
  sources = ['candidates'],
  onResultsChange = null,
}) {
  const toast = useToast();
  const toastRef = useMemo(() => ({ current: toast }), []);
  toastRef.current = toast;
  const { organization } = useAuth();
  const navigate = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(!fixedJob);
  const [pickedJobId, setPickedJobId] = useState(fixedJob?._id || '');
  const sourceChoices = sourceChoicesFor(sources);
  const [source, setSource] = useState(() => (
    sourceChoicesFor(sources).includes(initialSource) ? initialSource : sourceChoicesFor(sources)[0]
  ));
  const [loading, setLoading] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [profile, setProfile] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false });
  const [resultsPulse, setResultsPulse] = useState(false);
  const [chatLog, setChatLog] = useState(() => [{
    role: 'assistant',
    text: 'Profiles are ranked for this requisition. Tell me what to change — for example remove a title, keep only branch managers, or filter by city. The match list updates as we chat.',
  }]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [agentSteps, setAgentSteps] = useState([]);
  const [activeFilters, setActiveFilters] = useState(null);
  const constraintsRef = useRef(null);
  const chatEndRef = useRef(null);
  const resultsRef = useRef(null);

  const jobId = fixedJob?._id || pickedJobId;
  const jobTitle = fixedJob?.role || fixedJob?.title
    || jobs.find((job) => job._id === jobId)?.role
    || jobs.find((job) => job._id === jobId)?.title
    || payload?.job?.title
    || 'this role';

  useEffect(() => {
    if (fixedJob?._id) setPickedJobId(fixedJob._id);
  }, [fixedJob]);

  useEffect(() => {
    if (fixedJob) return undefined;
    let cancelled = false;
    (async () => {
      setJobsLoading(true);
      try {
        const res = await authenticatedFetch('/api/jobs');
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.data || data.jobs || []);
        if (!cancelled) {
          const open = list.filter((job) => String(job.status || '').toLowerCase() === 'open' && !job.isTemplate);
          setJobs(open);
          setPickedJobId((current) => current || open[0]?._id || '');
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load jobs');
      } finally {
        if (!cancelled) setJobsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fixedJob]);

  const applyRankPayload = useCallback((data) => {
    if (!data) return;
    setPayload(data);
    setSelected(new Set());
    setPage(1);
    if (data.constraints) {
      constraintsRef.current = data.constraints;
      setActiveFilters(filterChips(data.constraints).length ? data.constraints : null);
    }
  }, []);

  const run = useCallback(async (explain = false) => {
    if (!jobId) return null;
    setError('');
    if (explain) setExplaining(true);
    else setLoading(true);
    const controller = new AbortController();
    // Full-directory JD scan can take longer on large orgs
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const res = await authenticatedFetch('/api/ai/job-matches', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          jobId,
          source,
          limit: 20000,
          // Re-rank = full JD fit rescore (no AI credits). explain only adds optional AI notes.
          explain: Boolean(explain),
          smart: false,
          constraints: constraintsRef.current,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.success === false) {
        if (body.code === 'UPGRADE_REQUIRED') {
          throw new Error('Suggested talent is not included on the current plan. Upgrade to Professional to rank people for this job.');
        }
        throw new Error(body.message || 'Could not rank this job');
      }
      applyRankPayload(body.data);
      if (explain) {
        if (body.data?.ai?.explained) toastRef.current.success('Re-ranked from the job description · AI notes added');
        else if (body.data?.ai?.message) toastRef.current.success(body.data.ai.message);
        else toastRef.current.success(`Re-ranked · ${body.data?.results?.length || 0} matches from the job description`);
      }
      return body.data;
    } catch (err) {
      const aborted = err?.name === 'AbortError';
      setError(aborted
        ? 'Suggested talent took too long on this large directory. Try again in a moment.'
        : (err.message || 'Could not rank this job'));
      return null;
    } finally {
      clearTimeout(timer);
      setLoading(false);
      setExplaining(false);
    }
  }, [jobId, source, applyRankPayload]);

  useEffect(() => {
    if (!jobId) return;
    constraintsRef.current = null;
    setActiveFilters(null);
    run(false);
  }, [jobId, source, run]);

  const sendChat = async () => {
    const text = chatDraft.trim();
    if (!text || !jobId || chatBusy) return;
    const history = chatLog.slice(-10);
    const previewResults = (payload?.results || []).slice(0, 12).map((row) => ({
      name: row.name,
      position: row.position,
      location: row.location,
      score: row.score,
      aiReason: row.aiReason || row.why,
    }));
    setChatDraft('');
    setChatLog((current) => [...current, { role: 'user', text }]);
    setChatBusy(true);
    setAgentSteps([{ tool: 'plan', detail: 'Reading your request…' }]);
    try {
      const res = await authenticatedFetch('/api/ai/talent-chat', {
        method: 'POST',
        body: JSON.stringify({
          jobId,
          source,
          message: text,
          history,
          constraints: constraintsRef.current,
          previewResults,
          limit: 20000,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.success === false) {
        throw new Error(body.message || 'The assistant could not reply');
      }
      const data = body.data || {};
      setAgentSteps(Array.isArray(data.steps) ? data.steps : []);
      if (data.constraints) {
        constraintsRef.current = data.reset ? null : data.constraints;
        setActiveFilters(data.reset || !filterChips(data.constraints).length ? null : data.constraints);
      }
      const changedList = Array.isArray(data.results);
      if (changedList) {
        setPayload((current) => ({
          ...(current || {}),
          results: data.results,
          scanned: data.scanned ?? current?.scanned,
          job: data.job || current?.job,
          ai: data.ai || current?.ai,
          agent: data.agent || current?.agent,
          constraints: data.constraints,
          source: data.source || current?.source,
        }));
        setSelected(new Set());
        setPage(1);
        toastRef.current?.success?.(`Matches updated · ${data.results.length}`);
      }
      const countLabel = changedList ? ` See the updated matches in the table (${data.results.length}).` : '';
      setChatLog((current) => [...current, {
        role: 'assistant',
        text: `${data.reply || 'Done.'}${countLabel}`,
        steps: data.steps || [],
        seeResults: changedList,
      }]);
      if (changedList) {
        setChatOpen(false);
        window.setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setResultsPulse(true);
          window.setTimeout(() => setResultsPulse(false), 1800);
        }, 120);
      }
    } catch (err) {
      try {
        const interpreted = interpretMessage(text, fixedJob || payload?.job || {});
        const next = interpreted.reset
          ? null
          : mergeConstraints(constraintsRef.current, interpreted.constraints);
        const hasFilter = Boolean(
          next && ['locations', 'roles', 'skills', 'industries', 'excludeRoles'].some((key) => (next[key] || []).length)
        );
        constraintsRef.current = interpreted.reset ? null : (hasFilter ? next : constraintsRef.current);
        setActiveFilters(constraintsRef.current);
        if (hasFilter && payload?.results) {
          setPayload((current) => ({
            ...current,
            results: current.results.filter((row) => rowMatchesConstraints(row, constraintsRef.current)),
          }));
        }
        const data = (hasFilter || interpreted.reset) ? await run(false) : null;
        const count = data?.results?.length ?? payload?.results?.length ?? 0;
        const changed = Boolean(hasFilter || interpreted.reset);
        setChatLog((current) => [...current, {
          role: 'assistant',
          text: `${interpreted.summary(count)}${changed ? ' See the updated matches in the table.' : ''}`,
          seeResults: changed,
        }]);
        if (changed) {
          setChatOpen(false);
          window.setTimeout(() => {
            resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setResultsPulse(true);
            window.setTimeout(() => setResultsPulse(false), 1800);
          }, 120);
        }
      } catch {
        setChatLog((current) => [...current, { role: 'assistant', text: err.message || 'The assistant could not reply. Try again.' }]);
      }
    } finally {
      setChatBusy(false);
      setAgentSteps([]);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' });
  }, [chatLog, chatBusy, agentSteps]);

  const rows = payload?.results || [];
  useEffect(() => {
    onResultsChange?.(rows.length);
  }, [rows.length, onResultsChange]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const pageIds = pageRows.map((row) => row.id);
  const pageSelectedCount = pageIds.filter((id) => selected.has(id)).length;
  const isPageSelected = pageIds.length > 0 && pageSelectedCount === pageIds.length;
  const isPagePartial = pageSelectedCount > 0 && pageSelectedCount < pageIds.length;
  const selectedRows = useMemo(
    () => rows.filter((row) => selected.has(row.id)),
    [rows, selected]
  );
  const mailRows = selectedRows.filter((row) => row.email && canMessage(row));
  const phoneRows = selectedRows.filter((row) => String(row.phone || '').replace(/\D/g, '').length >= 7 && canMessage(row));
  const smartOn = payload?.agent?.mode === 'smart' || payload?.ai?.mode === 'smart' || payload?.ai?.explained;
  const chips = filterChips(activeFilters);

  const emailPeople = useMemo(() => rows.map((row) => {
    const base = {
      _id: row.id,
      name: row.name,
      email: row.email,
      contact: row.phone,
      phone: row.phone,
      position: row.position,
      location: row.location,
      experience: row.experience,
      companyName: row.companyName,
    };
    if (row.source === 'mis') return { ...base, misId: row.id, uploadBatchId: 1 };
    if (row.source === 'both') return { ...base, candidateId: row.id, misId: row.id, _kinds: ['candidates', 'mis'] };
    return { ...base, candidateId: row.id };
  }), [rows]);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const setSelectedIds = useCallback((next) => {
    setSelected(() => {
      const list = typeof next === 'function' ? next(Array.from(selected)) : next;
      return new Set((list || []).map(String));
    });
  }, [selected]);

  const email = useCandidateEmail({
    toast,
    candidates: emailPeople,
    selectedIds,
    setSelectedIds,
    setConfirmModal,
    navigate,
  });

  const jobOptions = useMemo(() => {
    if (fixedJob?._id) return [fixedJob];
    return jobs;
  }, [fixedJob, jobs]);

  const activeJob = fixedJob || jobs.find((job) => String(job._id) === String(jobId)) || null;

  const toggle = (id) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((current) => {
      if (current.size === rows.length) return new Set();
      return new Set(rows.map((row) => row.id));
    });
  };

  const togglePage = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (isPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const campaignJobTag = () => String(activeJob?.jobCode || jobId || '').trim();

  const seedJobTemplateVars = () => {
    const job = activeJob || {};
    const title = String(job.role || job.title || payload?.job?.title || '').trim();
    const code = String(job.jobCode || payload?.job?.jobCode || '').trim();
    const loc = String(job.location || payload?.job?.location || '').trim();
    const exp = String(job.experience || '').trim();
    const clientRaw = String(job.clientName || '').trim();
    const industry = String(job.industry || payload?.job?.industry || '').trim();
    const employer = veiledEmployer(industry, clientRaw);
    const ctc = String(job.ctc || '').trim();
    const orgName = String(organization?.name || '').trim();
    const summary = jobEmailSummary(
      String(job.summary || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      || String(job.description || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
      clientRaw,
    );
    if (!title && !code) return;
    const applyUrl = cleanApplyUrl(careersApplyUrl(job, organization?.slug || organization?.publicSlug));
    const meta = {
      jobTitle: title,
      jobCode: code,
      jobLocation: loc,
      jobDepartment: String(job.department || '').trim(),
      jobClient: employer,
      jobEmployer: employer,
      jobIndustry: industry,
      jobExperience: exp,
      jobSummary: summary,
      jobCtc: ctc,
      applyUrl,
      applyLink: applyUrl,
    };
    email.setCampaignJobMeta?.((prev) => ({ ...(prev || {}), ...meta }));
    email.setTemplateVars((prev) => ({
      ...prev,
      ...meta,
      position: title || prev.position || '',
      location: loc || prev.location || '',
      company: orgName || prev.company || '',
      orgName,
      jobIndustry: industry,
      ctc: ctc || prev.ctc || '',
      experience: exp || prev.experience || '',
      candidateName: '',
    }));
    if (title) email.setQuickPosition?.(title);
  };

  const openEmailComposer = async () => {
    if (!selected.size) {
      toast.warning('Select at least one profile to email.');
      return;
    }
    toast.info(`Preparing email for ${mailRows.length || selected.size} people — each message uses that person’s name.`);
    await email.startBulkEmailFlow({ jobTag: campaignJobTag() });
    seedJobTemplateVars();
  };

  const openWhatsApp = () => {
    if (!selected.size) {
      toast.warning('Select at least one profile.');
      return;
    }
    if (!phoneRows.length) {
      toast.warning('No valid phone numbers in the selected profiles.');
      return;
    }
    const jobCode = activeJob?.jobCode || payload?.job?.jobCode || '';
    const location = activeJob?.location || payload?.job?.location || '';
    const applyUrl = careersApplyUrl(activeJob || payload?.job || {}, organization?.slug || organization?.publicSlug);
    const baseMsg = `Hi {{name}}, we have an opening for ${jobTitle}${location ? ` in ${location}` : ''}${jobCode ? ` (${jobCode})` : ''}. Would you like to discuss this opportunity?`;
    const msgTemplate = withJobApplyFooter(baseMsg, {
      jobTitle,
      jobCode,
      jobLocation: location,
      jobIndustry: activeJob?.industry || payload?.job?.industry || '',
      jobClient: veiledEmployer(activeJob?.industry || payload?.job?.industry || '', ''),
      applyUrl,
    });
    setConfirmModal({
      isOpen: true,
      type: 'info',
      title: 'Open WhatsApp',
      message: `Open WhatsApp for ${phoneRows.length} selected profile${phoneRows.length === 1 ? '' : 's'}? Each chat opens in a new tab with job details prefilled.`,
      confirmText: 'Open WhatsApp',
      onConfirm: () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        phoneRows.forEach((row, index) => {
          const phone = String(row.phone || '').replace(/\D/g, '');
          const text = msgTemplate.replace(/\{\{name\}\}/gi, row.name || 'there');
          window.setTimeout(() => {
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
          }, index * 450);
        });
      },
    });
  };

  const aiBadge = smartOn
    ? { label: 'Smart match', className: 'border-teal-200 bg-teal-50 text-teal-800', Icon: Sparkles }
    : payload?.ai?.available
      ? { label: 'AI connected', className: 'border-sky-200 bg-sky-50 text-sky-800', Icon: Network }
      : { label: 'Fit score', className: 'border-stone-200 bg-white text-stone-500', Icon: Sparkles };

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-stone-200 bg-white">
        <div className={`flex flex-col gap-3 ${embedded ? 'px-4 py-3 sm:px-5' : 'gap-4 px-5 py-4 sm:px-6'}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Suggested talent</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-stone-900">
                {payload
                  ? `${rows.length.toLocaleString()} ${rows.length === 1 ? 'match' : 'matches'}`
                  : `Matching ${jobTitle}`}
                {selected.size ? (
                  <span className="ml-2 text-sm font-medium text-stone-400">{selected.size} selected</span>
                ) : null}
              </h2>
              {payload?.scanned != null ? (
                <p className="mt-1.5 text-[13px] leading-relaxed text-stone-500">
                  Reviewed {Number(payload.scanned).toLocaleString()} profiles
                  {payload.fullDirectory || payload.pullMode === 'location' ? ' in this job location' : ''}
                  {rows.length ? ' · showing people who pass location, CTC and domain' : ''}
                </p>
              ) : (
                <p className="mt-1.5 text-[13px] text-stone-500">{jobTitle}</p>
              )}
            </div>
            {sourceChoices.length > 1 && (
              <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-1">
                {sourceChoices.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setSource(item)}
                    className={`h-9 rounded-md px-3 text-[12px] font-medium transition-colors ${
                      source === item
                        ? 'bg-white text-stone-900 shadow-sm'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    {SOURCE_LABEL[item] || item}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!fixedJob && (
            <select
              value={jobId}
              onChange={(event) => setPickedJobId(event.target.value)}
              disabled={jobsLoading}
              className="h-9 max-w-sm rounded-lg border border-stone-200 bg-white px-3 text-[13px] font-medium text-stone-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
            >
              {!jobs.length && <option value="">No open jobs</option>}
              {jobs.map((job) => (
                <option key={job._id} value={job._id}>
                  {[job.jobCode, job.role || job.title].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium ${aiBadge.className}`}>
              <aiBadge.Icon size={12} />
              {aiBadge.label}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => run(false)} disabled={!jobId || loading} className="btn-secondary h-9 px-3 text-[13px]" title="Refresh matches">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => run(false)}
                disabled={!jobId || loading || explaining}
                className="btn-primary h-9 px-3.5 text-[13px]"
                title="Re-rank everyone against the full job description"
              >
                {explaining || loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Re-rank
              </button>
              <button type="button" className="btn-secondary h-9 px-3 text-[13px]" disabled={!selected.size} onClick={openEmailComposer} title="Email selected">
                <Mail size={14} />
                Email{mailRows.length ? ` (${mailRows.length})` : ''}
              </button>
              <button type="button" className="btn-secondary h-9 px-3 text-[13px]" disabled={!selected.size} onClick={openWhatsApp} title="WhatsApp selected">
                <WhatsAppIcon size={14} />
                WhatsApp{phoneRows.length ? ` (${phoneRows.length})` : ''}
              </button>
              <button
                type="button"
                className="btn-secondary h-9 px-3 text-[13px]"
                onClick={() => setChatOpen(true)}
                title="Open talent assistant"
              >
                <UserRound size={14} />
                Assistant
              </button>
            </div>
          </div>
        </div>
      </div>

      {chips.length ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-stone-200 bg-white px-4 py-1.5 sm:px-5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Filters</span>
          {chips.map((item) => (
            <span key={item} className="rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-medium text-stone-700">
              {item}
            </span>
          ))}
          <button
            type="button"
            className="text-[11px] font-semibold text-stone-500 hover:text-stone-900"
            onClick={() => {
              constraintsRef.current = null;
              setActiveFilters(null);
              setChatLog((current) => [...current, { role: 'assistant', text: 'Filters cleared. Restoring the requisition shortlist.' }]);
              run(false);
            }}
          >
            Clear
          </button>
        </div>
      ) : null}

      {error && (
        <div className="mx-4 mt-2 flex shrink-0 items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-800 sm:mx-5">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <section
        ref={resultsRef}
        className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white transition-shadow duration-500 ${
          resultsPulse ? 'ring-2 ring-inset ring-teal-400/70' : ''
        }`}
      >
        <div className="min-h-0 flex-1 overflow-auto">
          {loading && !rows.length ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-stone-500">
              <Loader2 size={22} className="animate-spin text-teal-600" />
              <p>Smart-matching people for <span className="font-semibold text-stone-700">{jobTitle}</span>…</p>
            </div>
          ) : !jobId ? (
            <p className="py-20 text-center text-sm text-stone-500">Select an open job to rank people against it.</p>
          ) : !rows.length ? (
            <div className="px-6 py-20 text-center text-sm text-stone-500">
              <p>No matching profiles yet.</p>
              <button type="button" className="mt-2 font-semibold text-teal-700 underline hover:text-teal-900" onClick={() => setChatOpen(true)}>
                Open the assistant
              </button>
              <span> to adjust titles, location, or other criteria.</span>
            </div>
          ) : (
            <div className="table-shell-ats mx-0 h-full rounded-none border-0 shadow-none">
              <div
                className="cand-table-scroll h-full overflow-auto select-none"
                onCopy={blockTableExfil}
                onCut={blockTableExfil}
                onDragStart={blockTableExfil}
                data-tour="cand-table"
              >
                <table
                  className="w-full min-w-[72rem] table-fixed border-collapse text-left text-[13px] select-none"
                  aria-label="Suggested matches"
                >
                  <thead>
                    <tr className="bg-stone-50">
                      <th className="w-12 sticky top-0 z-10 border-b border-stone-200 bg-stone-50 px-3 py-3 text-center">
                        <button type="button" onClick={togglePage} className="mx-auto flex rounded p-1 hover:bg-stone-200/80" aria-label="Select this page" title={isPageSelected ? 'Deselect this page' : 'Select this page'}>
                          {isPageSelected
                            ? <CheckSquare size={18} className="text-brand-600" />
                            : isPagePartial
                              ? <MinusSquare size={18} className="text-brand-500" />
                              : <Square size={18} className="text-stone-400" />}
                        </button>
                      </th>
                      {[
                        { label: '#', className: 'w-12 text-center' },
                        { label: 'Name', className: 'w-[18%]' },
                        { label: 'Current role', className: 'w-[16%]' },
                        { label: 'Experience', className: 'w-[9%]' },
                        { label: 'Location', className: 'w-[11%]' },
                        { label: 'CTC', className: 'w-[8%]' },
                        { label: 'Match', className: 'w-[11%]' },
                        { label: 'Match notes', className: 'w-[24%]' },
                      ].map((col) => (
                        <th
                          key={col.label}
                          className={`sticky top-0 z-10 border-b border-stone-200 bg-stone-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-stone-500 ${col.className || ''}`}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row, index) => {
                      const checked = selected.has(row.id);
                      const serial = (page - 1) * pageSize + index + 1;
                      const sourceMeta = SOURCE_BADGE[row.source] || SOURCE_BADGE.candidates;
                      const score = Math.max(0, Math.min(100, Number(row.score) || 0));
                      const notes = matchNotePresentation(row);
                      const initial = String(row.name || '?').charAt(0).toUpperCase();
                      return (
                        <tr
                          key={row.id}
                          className={`transition-colors ${
                            checked ? 'bg-brand-50/80' : index % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'
                          } hover:bg-brand-50/40`}
                        >
                          <td className="w-12 border-b border-stone-100 px-3 py-3 text-center">
                            <button type="button" onClick={() => toggle(row.id)} aria-label={`Select ${row.name}`} className="mx-auto flex rounded p-1 hover:bg-stone-100">
                              {checked
                                ? <CheckSquare size={17} className="text-brand-600" />
                                : <Square size={17} className="text-stone-300" />}
                            </button>
                          </td>
                          <td className="border-b border-stone-100 px-2 py-3 text-center text-[12px] font-medium tabular-nums text-stone-400">
                            {serial}
                          </td>
                          <td className="border-b border-stone-100 px-4 py-3 align-middle">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-teal-700 text-[12px] font-bold text-white">
                                {initial}
                              </div>
                              <div className="min-w-0">
                                <button
                                  type="button"
                                  onClick={() => setProfile(row)}
                                  className="block max-w-full truncate text-left text-[13px] font-semibold text-stone-900 hover:text-teal-800 hover:underline"
                                  title="Open profile"
                                >
                                  {row.name || '—'}
                                </button>
                                <div className="truncate text-[12px] text-stone-500">{row.email || 'No email on file'}</div>
                                <span className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${sourceMeta.className}`}>
                                  {sourceMeta.label}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="border-b border-stone-100 px-4 py-3 align-middle text-[13px] font-medium text-stone-700">
                            <div className="leading-snug break-words">{row.position || '—'}</div>
                            {row.companyName ? <div className="mt-0.5 text-[12px] font-normal text-stone-400 leading-snug break-words">{row.companyName}</div> : null}
                          </td>
                          <td className="border-b border-stone-100 px-4 py-3 whitespace-nowrap text-[13px] font-medium tabular-nums text-stone-700">
                            {row.experience || '—'}
                          </td>
                          <td className="border-b border-stone-100 px-4 py-3 text-[13px] font-medium text-stone-700">
                            <span className="break-words">{row.location || '—'}</span>
                          </td>
                          <td className="border-b border-stone-100 px-4 py-3 whitespace-nowrap text-[13px] font-medium tabular-nums text-stone-700">
                            {row.ctc || row.expectedCtc || '—'}
                          </td>
                          <td className="border-b border-stone-100 px-4 py-3 align-middle">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-semibold tabular-nums text-stone-900">{row.score}</span>
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${BAND_CLASS[row.band] || BAND_CLASS.Low}`}>
                                {row.band}
                              </span>
                            </div>
                            <div className="mt-1.5 h-1.5 w-full max-w-[7.5rem] overflow-hidden rounded-full bg-stone-200">
                              <div className="h-full rounded-full bg-teal-600" style={{ width: `${score}%` }} />
                            </div>
                          </td>
                          <td className="border-b border-stone-100 px-4 py-3 align-top" title={notes.full}>
                            <ul className="space-y-1">
                              {notes.lines.map((line) => (
                                <li key={`${row.id}-${line.label}-${line.text}`} className="flex items-start gap-2 text-[12.5px] leading-5 text-stone-600">
                                  <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${MATCH_TONE_DOT[line.tone] || MATCH_TONE_DOT.partial}`} aria-hidden />
                                  <span className="min-w-0 break-words">
                                    {line.label ? (
                                      <>
                                        <span className="font-medium text-stone-700">{line.label}</span>
                                        <span className="text-stone-400"> · </span>
                                      </>
                                    ) : null}
                                    {line.text}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {rows.length > 0 && (
          <div className="flex shrink-0 flex-col gap-2 border-t border-stone-200 bg-white px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-[12px] font-medium text-stone-500">
              <span>
                Showing{' '}
                <span className="font-semibold tabular-nums text-stone-800">
                  {rows.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, rows.length)}
                </span>
                {' '}of{' '}
                <span className="font-semibold tabular-nums text-stone-800">{rows.length.toLocaleString()}</span>
              </span>
              <span className="text-stone-300">|</span>
              <label className="inline-flex items-center gap-1.5">
                <span>Per page</span>
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value) || 50);
                    setPage(1);
                  }}
                  className="h-8 rounded-lg border border-stone-200 bg-white px-2 text-[12px] font-semibold text-stone-700"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
              <button
                type="button"
                className="btn-secondary h-8 px-2.5 text-[12px]"
                onClick={toggleAll}
                title={selected.size === rows.length ? 'Clear selection' : 'Select all matches'}
              >
                {selected.size === rows.length && rows.length
                  ? `Clear all (${rows.length.toLocaleString()})`
                  : `Select all (${rows.length.toLocaleString()})`}
              </button>
              {selected.size ? (
                <span className="font-semibold text-teal-700 tabular-nums">{selected.size.toLocaleString()} selected</span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" className="btn-secondary h-8 px-2.5 text-[12px]" disabled={page <= 1} onClick={() => setPage(1)}>First</button>
              <button type="button" className="btn-secondary h-8 px-2.5 text-[12px]" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
              <span className="px-1.5 text-[12px] font-semibold tabular-nums text-stone-600">
                Page {page} of {totalPages}
              </span>
              <button type="button" className="btn-secondary h-8 px-2.5 text-[12px]" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button>
              <button type="button" className="btn-secondary h-8 px-2.5 text-[12px]" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>Last</button>
            </div>
          </div>
        )}
      </section>

      {chatOpen ? (
        <div className="absolute inset-0 z-40 flex items-end justify-end bg-stone-900/30 p-3 sm:p-5" onClick={() => setChatOpen(false)}>
          <div
            className="flex h-[min(640px,92%)] w-full max-w-[400px] flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label="Talent agent chat"
          >
            <div className="flex shrink-0 items-center gap-3 border-b border-teal-800/20 bg-teal-700 px-4 py-3.5 text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                <UserRound size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Talent assistant</p>
                <p className="truncate text-[11px] text-teal-100/90">
                  {chatBusy ? 'Updating matched profiles…' : 'Describe what you need — the list updates live'}
                </p>
              </div>
              <button type="button" onClick={() => setChatOpen(false)} className="rounded-md p-1.5 text-teal-100 hover:bg-white/10 hover:text-white" aria-label="Close chat">
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f7f8fa] px-3.5 py-3.5">
              {chatLog.map((entry, index) => (
                <div key={`${entry.role}-${index}`} className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[92%] rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      entry.role === 'user'
                        ? 'rounded-br-sm bg-stone-900 text-white'
                        : 'rounded-bl-sm border border-stone-200 bg-white text-stone-800 shadow-sm'
                    }`}
                  >
                    {entry.text}
                  </div>
                </div>
              ))}
              {chatBusy ? (
                <div className="flex justify-start">
                  <div className="max-w-[92%] space-y-1 rounded-lg rounded-bl-sm border border-stone-200 bg-white px-3.5 py-2.5 text-[13px] text-stone-600 shadow-sm">
                    <div className="inline-flex items-center gap-2 font-medium">
                      <Loader2 size={14} className="animate-spin text-teal-600" />
                      Thinking
                    </div>
                    {(agentSteps.length ? agentSteps : [{ detail: 'Reading your request' }]).slice(0, 3).map((step) => (
                      <p key={`${step.tool}-${step.detail}`} className="text-[11px] text-stone-500">{step.detail || step.tool}</p>
                    ))}
                  </div>
                </div>
              ) : null}
              <div ref={chatEndRef} />
            </div>
            <form
              className="flex shrink-0 items-end gap-2 border-t border-stone-200 bg-white p-3"
              onSubmit={(event) => {
                event.preventDefault();
                sendChat();
              }}
            >
              <textarea
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendChat();
                  }
                }}
                rows={3}
                autoFocus
                placeholder="Example: remove branch sales manager, keep only branch manager"
                className="min-h-[72px] flex-1 resize-none rounded-lg border border-stone-300 px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
              <button
                type="submit"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40"
                disabled={!chatDraft.trim() || chatBusy}
                aria-label="Send"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {/* Profile drawer */}
      {profile ? (
        <div className="fixed inset-0 z-[80] flex justify-end bg-stone-900/40">
          <button type="button" className="flex-1" aria-label="Close profile" onClick={() => setProfile(null)} />
          <aside className="flex h-full w-full max-w-md flex-col border-l border-stone-200 bg-white shadow-2xl">
            <div className="border-b border-stone-200 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400">Suggested fit</p>
                  <h3 className="mt-1 text-xl font-bold tracking-tight text-stone-900 leading-snug">
                    {profile.name || 'Unnamed record'}
                  </h3>
                </div>
                <button type="button" onClick={() => setProfile(null)} className="rounded-md p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="Close">
                  <X size={18} />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="text-2xl font-bold tabular-nums tracking-tight text-stone-900">{profile.score}</span>
                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${BAND_CLASS[profile.band] || BAND_CLASS.Low}`}>
                  {profile.band}
                </span>
                <div className="h-1.5 flex-1 max-w-[140px] overflow-hidden rounded-full bg-stone-200">
                  <div
                    className="h-full rounded-full bg-teal-600"
                    style={{ width: `${Math.max(0, Math.min(100, Number(profile.score) || 0))}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 text-sm text-stone-700">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                {[
                  ['Email', profile.email || 'Not on file'],
                  ['Phone', profile.phone || 'Not on file'],
                  ['Current role', profile.position || '—'],
                  ['Company', profile.companyName || '—'],
                  ['Experience', profile.experience || '—'],
                  ['CTC', profile.ctc || profile.expectedCtc || '—'],
                  ['Location', profile.location || '—'],
                  ['Source', profile.source === 'both' ? 'Candidate and MIS' : profile.source === 'mis' ? 'MIS directory' : 'Candidates'],
                ].map(([label, value]) => (
                  <div key={label} className={label === 'Email' || label === 'Source' ? 'col-span-2' : ''}>
                    <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-stone-400">{label}</dt>
                    <dd className="mt-1 font-medium text-stone-900 break-words">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="rounded-xl border border-stone-200 bg-stone-50/80 px-3.5 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-stone-400">Why this person</p>
                {(() => {
                  const notes = matchNotePresentation(profile);
                  return (
                    <ul className="mt-2 space-y-1.5">
                      {notes.lines.map((line) => (
                        <li key={`${line.label}-${line.text}`} className="flex items-start gap-2 text-[13px] leading-snug text-stone-700">
                          <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${MATCH_TONE_DOT[line.tone] || MATCH_TONE_DOT.partial}`} />
                          <span>
                            {line.label ? <span className="font-semibold text-stone-800">{line.label} · </span> : null}
                            {line.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </div>
              {(profile.strengths || []).length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-stone-400">Strengths</p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-stone-700">{profile.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              )}
              {(profile.gaps || []).length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-stone-400">Gaps</p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-stone-700">{profile.gaps.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-stone-200 bg-stone-50 px-5 py-3">
              <button
                type="button"
                className="btn-primary h-9"
                disabled={!profile.email || !canMessage(profile)}
                onClick={async () => {
                  setSelected(new Set([profile.id]));
                  setProfile(null);
                  window.setTimeout(async () => {
                    await email.startBulkEmailFlow({ jobTag: campaignJobTag() });
                    seedJobTemplateVars();
                  }, 0);
                }}
              >
                <Mail size={14} /> Email this role
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <CandidateEmailModal
        showEmailModal={email.showEmailModal}
        emailRecipient={email.emailRecipient}
        setShowEmailModal={email.setShowEmailModal}
        bulkEmailRecipients={email.bulkEmailRecipients}
        setBulkEmailRecipients={email.setBulkEmailRecipients}
        bulkAudience={email.bulkAudience}
        setBulkAudience={email.setBulkAudience}
        setSelectedIds={setSelectedIds}
        emailChannel={email.emailChannel}
        setEmailChannel={email.setEmailChannel}
        channelsAvailable={email.channelsAvailable}
        emailSenderInfo={email.emailSenderInfo}
        emailMode={email.emailMode}
        setEmailMode={email.setEmailMode}
        emailCC={email.emailCC}
        setEmailCC={email.setEmailCC}
        emailBCC={email.emailBCC}
        setEmailBCC={email.setEmailBCC}
        teamMembers={[]}
        ccInput={email.ccInput}
        setCcInput={email.setCcInput}
        bccInput={email.bccInput}
        setBccInput={email.setBccInput}
        showCCPicker={email.showCCPicker}
        setShowCCPicker={email.setShowCCPicker}
        showBCCPicker={email.showBCCPicker}
        setShowBCCPicker={email.setShowBCCPicker}
        emailTemplates={email.emailTemplates}
        emailTemplatesLoading={email.emailTemplatesLoading}
        selectedTemplate={email.selectedTemplate}
        selectEmailTemplate={email.selectEmailTemplate}
        setSelectedTemplate={email.setSelectedTemplate}
        templateVars={email.templateVars}
        setTemplateVars={email.setTemplateVars}
        templateDraftSubject={email.templateDraftSubject}
        setTemplateDraftSubject={email.setTemplateDraftSubject}
        templateDraftBody={email.templateDraftBody}
        setTemplateDraftBody={email.setTemplateDraftBody}
        templateDraftDirty={email.templateDraftDirty}
        setTemplateDraftDirty={email.setTemplateDraftDirty}
        emailType={email.emailType}
        setEmailType={email.setEmailType}
        quickName={email.quickName}
        setQuickName={email.setQuickName}
        quickPosition={email.quickPosition}
        setQuickPosition={email.setQuickPosition}
        quickDepartment={email.quickDepartment}
        setQuickDepartment={email.setQuickDepartment}
        quickJoiningDate={email.quickJoiningDate}
        setQuickJoiningDate={email.setQuickJoiningDate}
        customMessage={email.customMessage}
        setCustomMessage={email.setCustomMessage}
        quickSubject={email.quickSubject}
        setQuickSubject={email.setQuickSubject}
        showQuickPreview={email.showQuickPreview}
        setShowQuickPreview={email.setShowQuickPreview}
        quickPreviewHtml={email.quickPreviewHtml}
        setQuickPreviewHtml={email.setQuickPreviewHtml}
        quickPreviewSubject={email.quickPreviewSubject}
        setQuickPreviewSubject={email.setQuickPreviewSubject}
        loadingPreview={email.loadingPreview}
        setLoadingPreview={email.setLoadingPreview}
        isSendingEmail={email.isSendingEmail}
        sendTemplateEmail={email.sendTemplateEmail}
        sendSingleEmail={email.sendSingleEmail}
        recipientNoun="profiles"
        jobs={jobOptions}
        campaignJobId={email.campaignJobId}
        setCampaignJobId={email.setCampaignJobId}
        campaignJobMeta={email.campaignJobMeta}
        setCampaignJobMeta={email.setCampaignJobMeta}
      />

      <ConfirmationModal
        isOpen={Boolean(confirmModal?.isOpen)}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal?.onConfirm}
        title={confirmModal?.title}
        message={confirmModal?.message}
        confirmText={confirmModal?.confirmText}
        type={confirmModal?.type || 'info'}
      />
    </div>
  );
}
