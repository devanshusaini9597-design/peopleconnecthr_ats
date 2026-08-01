import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar as CalendarIcon, Clock, Video, Phone, User, MapPin,
  Briefcase, Star, FileText, X, Plus, Users, Search, Loader2,
  AlertCircle, RefreshCw, CheckCircle2
} from 'lucide-react';
import { authenticatedFetch, handleUnauthorized, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import Modal from './ui/Modal';
import ConfirmationModal from './ConfirmationModal';
import PremiumSelect from './ui/PremiumSelect';

const RECS = [
  { value: 'strong_yes', label: 'Strong Yes' },
  { value: 'yes', label: 'Yes' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'no', label: 'No' },
  { value: 'strong_no', label: 'Strong No' },
];
const SKILLS = ['Technical Skills', 'Communication', 'Problem Solving', 'Culture Fit'];

const TYPE_META = {
  video: { label: 'Video', icon: Video, badge: 'badge-brand' },
  phone_screen: { label: 'Phone', icon: Phone, badge: 'badge-info' },
  in_person: { label: 'Onsite', icon: MapPin, badge: 'badge-neutral' },
  panel: { label: 'Panel', icon: Users, badge: 'badge-brand' },
  technical: { label: 'Technical', icon: Briefcase, badge: 'badge-warning' },
  hr: { label: 'HR', icon: User, badge: 'badge-neutral' },
};

const STATUS_BADGE = {
  scheduled: 'badge-warning',
  in_progress: 'badge-brand',
  completed: 'badge-success',
  cancelled: 'badge-danger',
  no_show: 'badge-danger',
  rescheduled: 'badge-info',
};

const modeToType = (mode) => {
  const m = String(mode || '').toLowerCase();
  if (m.includes('phone')) return 'phone_screen';
  if (m.includes('onsite') || m.includes('person')) return 'in_person';
  return 'video';
};

const typeToMode = (type) => {
  if (type === 'phone_screen') return 'Phone';
  if (type === 'in_person') return 'Onsite';
  return 'Video';
};

const formatWhen = (date) => {
  if (!date) return { day: '—', time: '—' };
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return { day: '—', time: '—' };
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((startThat - startToday) / 86400000);
  let day;
  if (diff === 0) day = 'Today';
  else if (diff === 1) day = 'Tomorrow';
  else if (diff === -1) day = 'Yesterday';
  else day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return { day, time };
};

const candidateName = (iv) =>
  iv.candidateName
  || iv.applicationId?.candidateId?.name
  || iv.applicationId?.candidate?.name
  || 'Candidate';

const jobName = (iv) =>
  iv.jobTitle
  || iv.applicationId?.jobId?.title
  || iv.applicationId?.jobId?.role
  || iv.applicationId?.job?.title
  || 'Role';

const normalizeInterview = (raw) => {
  if (!raw) return null;
  return {
    ...raw,
    _id: raw._id,
    source: raw.source || 'interview',
    status: raw.status || 'scheduled',
    type: raw.type || modeToType(raw.mode),
    scheduledAt: raw.scheduledAt,
    meetingLink: raw.meetingLink || '',
    location: raw.location || '',
    duration: raw.duration || 60,
    applicationId: raw.applicationId,
  };
};

const InterviewCard = ({ interview, onScorecard, onCancel, onComplete }) => {
  const meta = TYPE_META[interview.type] || TYPE_META.video;
  const TypeIcon = meta.icon;
  const { day, time } = formatWhen(interview.scheduledAt);
  const name = candidateName(interview);
  const role = jobName(interview);
  const isScheduled = interview.status === 'scheduled' || interview.status === 'rescheduled' || interview.status === 'in_progress';
  const isCompleted = interview.status === 'completed';

  return (
    <div className="card-ats p-5 flex flex-col hover:border-brand-200/80 relative overflow-hidden group">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 opacity-80" />
      <div className="flex justify-between items-start mb-4 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center font-bold text-sm ring-1 ring-brand-200/60 flex-shrink-0">
            {(name || 'C').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-stone-900 text-sm truncate tracking-tight">{name}</h4>
            <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5 truncate">
              <Briefcase className="w-3 h-3 flex-shrink-0" /> {role}
            </p>
          </div>
        </div>
        <span className={STATUS_BADGE[interview.status] || 'badge-neutral'}>
          {(interview.status || 'scheduled').replace(/_/g, ' ')}
        </span>
      </div>

      <div className="space-y-2 text-sm text-stone-600 mb-5 bg-stone-50/80 p-3.5 rounded-xl border border-stone-100">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-stone-400" />
          <span className="font-semibold text-stone-900">{day}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-stone-400" />
          {time}
          {interview.duration ? <span className="text-stone-400">· {interview.duration} min</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <TypeIcon className="w-4 h-4 text-brand-600" />
          {meta.label} interview
        </div>
        {interview.location && interview.type === 'in_person' && (
          <div className="flex items-center gap-2 truncate">
            <MapPin className="w-4 h-4 text-stone-400 flex-shrink-0" />
            <span className="truncate">{interview.location}</span>
          </div>
        )}
      </div>

      <div className="mt-auto pt-4 border-t border-stone-100 flex gap-2">
        {isScheduled && (
          <>
            {interview.meetingLink ? (
              <a
                href={interview.meetingLink}
                target="_blank"
                rel="noreferrer"
                className="btn-primary flex-1 !py-2"
              >
                <Video className="w-4 h-4" /> Join
              </a>
            ) : (
              <button type="button" onClick={() => onComplete(interview)} className="btn-secondary flex-1 !py-2">
                <CheckCircle2 className="w-4 h-4" /> Mark done
              </button>
            )}
            <button
              type="button"
              onClick={() => onCancel(interview)}
              className="p-2.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors touch-target"
              title="Cancel interview"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}
        {isCompleted && (
          <button type="button" onClick={() => onScorecard(interview)} className="btn-primary w-full">
            <FileText className="w-4 h-4" /> Fill Scorecard
          </button>
        )}
        {interview.meetingLink && isScheduled && (
          <button type="button" onClick={() => onComplete(interview)} className="btn-secondary !py-2" title="Mark completed">
            <CheckCircle2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default function InterviewsPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('upcoming');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [query, setQuery] = useState('');

  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [appQuery, setAppQuery] = useState('');
  const [appResults, setAppResults] = useState([]);
  const [searchingApps, setSearchingApps] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    scheduledAt: '',
    type: 'video',
    location: '',
    meetingLink: '',
    duration: 60,
    remark: '',
  });

  const [showScorecard, setShowScorecard] = useState(false);
  const [scorecardTarget, setScorecardTarget] = useState(null);
  const [recommendation, setRecommendation] = useState('');
  const [ratings, setRatings] = useState({});
  const [skillNotes, setSkillNotes] = useState({});
  const [finalNotes, setFinalNotes] = useState('');
  const [submittingScorecard, setSubmittingScorecard] = useState(false);

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [ivRes, appRes] = await Promise.all([
        authenticatedFetch('/api/interviews'),
        authenticatedFetch('/api/applications?limit=200&stage=Interview'),
      ]);
      if (ivRes.status === 401 || appRes.status === 401) return handleUnauthorized();

      const ivData = await readApiJson(ivRes);
      const appData = await readApiJson(appRes);

      if (!ivRes.ok || !ivData.success) {
        setLoadError(ivData.message || 'Failed to load interviews');
        setInterviews([]);
        return;
      }

      const fromApi = (ivData.data || []).map((i) => normalizeInterview(i));

      // Fallback: applications scheduled via pipeline metadata (older flow)
      const fromApps = [];
      if (appRes.ok && appData.success) {
        for (const app of appData.data || []) {
          const meta = app.metadata?.interview;
          if (!meta?.scheduledAt) continue;
          const already = fromApi.some((i) => {
            const appId = i.applicationId?._id || i.applicationId;
            return String(appId) === String(app._id);
          });
          if (already) continue;
          fromApps.push(normalizeInterview({
            _id: `app-${app._id}`,
            source: 'application',
            applicationId: app,
            candidateName: app.candidateId?.name || app.candidate?.name,
            jobTitle: app.jobId?.title || app.jobId?.role || app.job?.title,
            scheduledAt: meta.scheduledAt,
            type: modeToType(meta.mode),
            meetingLink: meta.meetingLink || (String(meta.mode || '').toLowerCase().includes('video') ? meta.location : ''),
            location: meta.location || '',
            status: 'scheduled',
            duration: 60,
          }));
        }
      }

      const merged = [...fromApi, ...fromApps].sort(
        (a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)
      );
      setInterviews(merged);
    } catch (err) {
      setLoadError(err?.message || 'Failed to load interviews');
      setInterviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!showSchedule) {
      setAppQuery('');
      setAppResults([]);
      setSelectedApp(null);
      return undefined;
    }
    const handle = setTimeout(async () => {
      setSearchingApps(true);
      try {
        const q = appQuery.trim();
        const url = q
          ? `/api/applications?limit=30&search=${encodeURIComponent(q)}`
          : '/api/applications?limit=30';
        const res = await authenticatedFetch(url);
        const data = await readApiJson(res);
        if (res.ok && data.success) {
          let list = data.data || [];
          if (q) {
            const lower = q.toLowerCase();
            list = list.filter((a) => {
              const name = (a.candidateId?.name || a.candidate?.name || '').toLowerCase();
              const email = (a.candidateId?.email || a.candidate?.email || '').toLowerCase();
              const job = (a.jobId?.title || a.jobId?.role || '').toLowerCase();
              return name.includes(lower) || email.includes(lower) || job.includes(lower);
            });
          }
          setAppResults(list.slice(0, 15));
        }
      } catch {
        setAppResults([]);
      } finally {
        setSearchingApps(false);
      }
    }, 280);
    return () => clearTimeout(handle);
  }, [appQuery, showSchedule]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    return interviews.filter((iv) => {
      if (activeTab === 'upcoming') {
        if (['cancelled'].includes(iv.status)) return false;
        if (iv.status === 'completed') return false;
        if (iv.scheduledAt && new Date(iv.scheduledAt).getTime() < now - 6 * 3600000 && iv.status === 'scheduled') {
          /* still show overdue scheduled */
        }
      } else if (activeTab === 'completed') {
        if (iv.status !== 'completed') return false;
      } else if (activeTab === 'cancelled') {
        if (iv.status !== 'cancelled') return false;
      }
      if (!q) return true;
      return (
        candidateName(iv).toLowerCase().includes(q)
        || jobName(iv).toLowerCase().includes(q)
        || (iv.type || '').toLowerCase().includes(q)
      );
    });
  }, [interviews, activeTab, query]);

  const calendarGroups = useMemo(() => {
    const groups = new Map();
    interviews
      .filter((iv) => iv.status !== 'cancelled')
      .forEach((iv) => {
        const d = iv.scheduledAt ? new Date(iv.scheduledAt) : null;
        if (!d || Number.isNaN(d.getTime())) return;
        const key = d.toISOString().slice(0, 10);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(iv);
      });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [interviews]);

  const openSchedule = () => {
    const defaultAt = new Date();
    defaultAt.setHours(defaultAt.getHours() + 24, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    const local = `${defaultAt.getFullYear()}-${pad(defaultAt.getMonth() + 1)}-${pad(defaultAt.getDate())}T${pad(defaultAt.getHours())}:${pad(defaultAt.getMinutes())}`;
    setScheduleForm({
      scheduledAt: local,
      type: 'video',
      location: '',
      meetingLink: '',
      duration: 60,
      remark: '',
    });
    setSelectedApp(null);
    setShowSchedule(true);
  };

  const handleSchedule = async () => {
    if (!selectedApp?._id || !scheduleForm.scheduledAt) {
      toast?.error?.('Select a candidate and date/time');
      return;
    }
    setScheduling(true);
    try {
      const mode = typeToMode(scheduleForm.type);
      const res = await authenticatedFetch(`/api/applications/${selectedApp._id}/schedule`, {
        method: 'PUT',
        body: JSON.stringify({
          scheduledAt: new Date(scheduleForm.scheduledAt).toISOString(),
          mode,
          location: scheduleForm.type === 'in_person' ? scheduleForm.location : scheduleForm.meetingLink,
          meetingLink: scheduleForm.meetingLink,
          duration: Number(scheduleForm.duration) || 60,
          remark: scheduleForm.remark,
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to schedule');
        return;
      }

      // Prefer Interview collection when API accepts create
      try {
        await authenticatedFetch('/api/interviews', {
          method: 'POST',
          body: JSON.stringify({
            applicationId: selectedApp._id,
            scheduledAt: new Date(scheduleForm.scheduledAt).toISOString(),
            duration: Number(scheduleForm.duration) || 60,
            type: scheduleForm.type,
            location: scheduleForm.location,
            meetingLink: scheduleForm.meetingLink,
          }),
        });
      } catch {
        /* schedule metadata already saved */
      }

      toast?.success?.('Interview scheduled');
      setShowSchedule(false);
      load();
    } catch (err) {
      toast?.error?.(err?.message || 'Failed to schedule');
    } finally {
      setScheduling(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      if (cancelTarget.source === 'application' || String(cancelTarget._id).startsWith('app-')) {
        toast?.success?.('Marked cancelled locally — open Pipeline to clear the schedule if needed');
        setInterviews((list) => list.map((i) => (i._id === cancelTarget._id ? { ...i, status: 'cancelled' } : i)));
        setCancelTarget(null);
        return;
      }
      const res = await authenticatedFetch(`/api/interviews/${cancelTarget._id}/cancel`, {
        method: 'PUT',
        body: JSON.stringify({ reason: 'Cancelled from Interviews page' }),
      });
      const data = await readApiJson(res);
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to cancel');
        return;
      }
      toast?.success?.('Interview cancelled');
      setCancelTarget(null);
      load();
    } catch (err) {
      toast?.error?.(err?.message || 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  };

  const handleComplete = async (interview) => {
    if (interview.source === 'application' || String(interview._id).startsWith('app-')) {
      setInterviews((list) => list.map((i) => (i._id === interview._id ? { ...i, status: 'completed' } : i)));
      toast?.success?.('Marked completed');
      return;
    }
    try {
      const res = await authenticatedFetch(`/api/interviews/${interview._id}/complete`, { method: 'PUT' });
      const data = await readApiJson(res);
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to complete');
        return;
      }
      toast?.success?.('Interview completed');
      load();
    } catch (err) {
      toast?.error?.(err?.message || 'Failed to complete');
    }
  };

  const openScorecard = (interview) => {
    setScorecardTarget(interview);
    setRecommendation('');
    setRatings({});
    setSkillNotes({});
    setFinalNotes('');
    setShowScorecard(true);
  };

  const handleScorecard = async () => {
    if (!scorecardTarget || !recommendation) {
      toast?.error?.('Pick a recommendation');
      return;
    }
    if (scorecardTarget.source === 'application' || String(scorecardTarget._id).startsWith('app-')) {
      toast?.error?.('Scorecards need a synced interview record. Re-schedule from this page after backend redeploy.');
      return;
    }
    const criteria = SKILLS.map((name) => ({
      name,
      rating: ratings[name] || 3,
      comment: skillNotes[name] || '',
    }));
    const overallRating = Math.round(
      criteria.reduce((s, c) => s + c.rating, 0) / criteria.length
    );
    setSubmittingScorecard(true);
    try {
      const appId = scorecardTarget.applicationId?._id || scorecardTarget.applicationId;
      const res = await authenticatedFetch(`/api/interviews/${scorecardTarget._id}/scorecard`, {
        method: 'POST',
        body: JSON.stringify({
          applicationId: appId,
          criteria,
          overallRating,
          recommendation,
          notes: finalNotes,
          isDraft: false,
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to submit scorecard');
        return;
      }
      toast?.success?.('Scorecard submitted');
      setShowScorecard(false);
      load();
    } catch (err) {
      toast?.error?.(err?.message || 'Failed to submit scorecard');
    } finally {
      setSubmittingScorecard(false);
    }
  };

  const tabs = [
    { id: 'upcoming', label: 'Upcoming', icon: CalendarIcon },
    { id: 'completed', label: 'Completed', icon: CheckCircle2 },
    { id: 'all', label: 'All', icon: Users },
    { id: 'calendar', label: 'By date', icon: Clock },
  ];

  if (loading) {
    return (
      <div className="page-shell-ats">
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-9 h-9 text-brand-600 animate-spin" />
          <p className="text-sm font-medium text-stone-500">Loading interviews…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-ats">
      <PageHeader
        icon={CalendarIcon}
        title="Interviews"
        subtitle="Schedule interviews, join meetings, and submit scorecards."
        gradientTitle
      >
        <button type="button" onClick={openSchedule} className="btn-primary">
          <Plus className="w-4 h-4" /> Schedule Interview
        </button>
      </PageHeader>

      {loadError ? (
        <div className="card-ats-bordered border-red-200/80 bg-red-50/30">
          <EmptyState
            icon={AlertCircle}
            message="Couldn’t load interviews"
            subMessage={loadError}
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button type="button" onClick={load} className="btn-secondary">
                  <RefreshCw className="w-4 h-4" /> Retry
                </button>
                <button type="button" onClick={openSchedule} className="btn-primary">
                  <Plus className="w-4 h-4" /> Schedule Interview
                </button>
              </div>
            }
          />
        </div>
      ) : (
        <div className="card-ats-bordered overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 sm:p-5 border-b border-stone-100 bg-stone-50/40">
            <div className="flex overflow-x-auto scrollbar-hide gap-1 flex-1">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-xl transition-all whitespace-nowrap
                    ${activeTab === id
                      ? 'bg-white text-brand-700 shadow-sm ring-1 ring-brand-200/70'
                      : 'text-stone-500 hover:text-stone-700 hover:bg-white/70'}`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
            {activeTab !== 'calendar' && (
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search candidate or role…"
                  className="input-ats !pl-9 !py-2"
                />
              </div>
            )}
          </div>

          <div className="p-4 sm:p-6">
            {activeTab === 'calendar' ? (
              calendarGroups.length === 0 ? (
                <EmptyState
                  icon={CalendarIcon}
                  message="No interviews on the calendar"
                  subMessage="Schedule an interview to see it grouped by date."
                  action={
                    <button type="button" onClick={openSchedule} className="btn-primary">
                      <Plus className="w-4 h-4" /> Schedule Interview
                    </button>
                  }
                />
              ) : (
                <div className="space-y-6">
                  {calendarGroups.map(([dateKey, items]) => (
                    <div key={dateKey}>
                      <h3 className="text-sm font-bold text-stone-800 mb-3 tracking-tight">
                        {new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
                          weekday: 'long', month: 'long', day: 'numeric',
                        })}
                        <span className="ml-2 text-stone-400 font-medium">{items.length}</span>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
                        {items.map((iv) => (
                          <InterviewCard
                            key={iv._id}
                            interview={iv}
                            onScorecard={openScorecard}
                            onCancel={setCancelTarget}
                            onComplete={handleComplete}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={CalendarIcon}
                message={interviews.length === 0 ? 'No interviews yet' : 'No interviews match'}
                subMessage={
                  interviews.length === 0
                    ? 'Schedule from here or from the Pipeline Board.'
                    : 'Try another tab or clear the search.'
                }
                action={
                  interviews.length === 0 ? (
                    <button type="button" onClick={openSchedule} className="btn-primary">
                      <Plus className="w-4 h-4" /> Schedule Interview
                    </button>
                  ) : null
                }
              />
            ) : activeTab === 'all' ? (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-left text-xs font-bold uppercase tracking-wide text-stone-400 border-b border-stone-100">
                      <th className="pb-3 pr-4">Candidate</th>
                      <th className="pb-3 pr-4">Role</th>
                      <th className="pb-3 pr-4">When</th>
                      <th className="pb-3 pr-4">Type</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filtered.map((iv) => {
                      const { day, time } = formatWhen(iv.scheduledAt);
                      const meta = TYPE_META[iv.type] || TYPE_META.video;
                      return (
                        <tr key={iv._id} className="hover:bg-stone-50/80">
                          <td className="py-3.5 pr-4 font-semibold text-stone-900">{candidateName(iv)}</td>
                          <td className="py-3.5 pr-4 text-stone-600">{jobName(iv)}</td>
                          <td className="py-3.5 pr-4 text-stone-600 whitespace-nowrap">{day} · {time}</td>
                          <td className="py-3.5 pr-4"><span className={meta.badge}>{meta.label}</span></td>
                          <td className="py-3.5 pr-4">
                            <span className={STATUS_BADGE[iv.status] || 'badge-neutral'}>
                              {(iv.status || '').replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-3.5">
                            <div className="flex items-center gap-1.5">
                              {iv.meetingLink && (
                                <a href={iv.meetingLink} target="_blank" rel="noreferrer" className="btn-secondary !py-1.5 !px-2.5 text-xs">
                                  Join
                                </a>
                              )}
                              {(iv.status === 'scheduled' || iv.status === 'in_progress') && (
                                <button type="button" onClick={() => setCancelTarget(iv)} className="text-xs font-semibold text-red-500 hover:text-red-600 px-2 py-1.5">
                                  Cancel
                                </button>
                              )}
                              {iv.status === 'completed' && (
                                <button type="button" onClick={() => openScorecard(iv)} className="text-xs font-semibold text-brand-600 hover:text-brand-700 px-2 py-1.5">
                                  Scorecard
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
                {filtered.map((iv) => (
                  <InterviewCard
                    key={iv._id}
                    interview={iv}
                    onScorecard={openScorecard}
                    onCancel={setCancelTarget}
                    onComplete={handleComplete}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        open={showSchedule}
        onClose={() => setShowSchedule(false)}
        title="Schedule Interview"
        description="Pick a candidate application, then set time and format."
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setShowSchedule(false)} className="btn-secondary">Cancel</button>
            <button
              type="button"
              onClick={handleSchedule}
              disabled={scheduling || !selectedApp || !scheduleForm.scheduledAt}
              className="btn-primary"
            >
              {scheduling ? <><Loader2 size={16} className="animate-spin" /> Scheduling…</> : <><Plus className="w-4 h-4" /> Schedule</>}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label-ats">Candidate application</label>
            {selectedApp ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/50 px-3.5 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-stone-900 truncate">
                    {selectedApp.candidateId?.name || selectedApp.candidate?.name || 'Candidate'}
                  </p>
                  <p className="text-xs text-stone-500 truncate">
                    {selectedApp.jobId?.title || selectedApp.jobId?.role || 'Role'}
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedApp(null)} className="text-sm font-semibold text-brand-700 hover:text-brand-800">
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={appQuery}
                    onChange={(e) => setAppQuery(e.target.value)}
                    className="input-ats !pl-9"
                    placeholder="Search candidates in applications…"
                    autoFocus
                  />
                </div>
                <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-stone-100">
                  {searchingApps ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-brand-600 animate-spin" /></div>
                  ) : appResults.length === 0 ? (
                    <p className="text-sm text-stone-400 text-center py-8">No applications found.</p>
                  ) : (
                    appResults.map((a) => (
                      <button
                        key={a._id}
                        type="button"
                        onClick={() => setSelectedApp(a)}
                        className="list-row-ats w-full text-left"
                      >
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {(a.candidateId?.name || 'C').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-stone-900 truncate">{a.candidateId?.name || a.candidate?.name || 'Candidate'}</p>
                          <p className="text-xs text-stone-500 truncate">{a.jobId?.title || a.jobId?.role || 'Role'} · {a.stage}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label-ats">Date & time</label>
              <input
                type="datetime-local"
                className="input-ats"
                value={scheduleForm.scheduledAt}
                onChange={(e) => setScheduleForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-ats">Type</label>
              <PremiumSelect
                compact
                value={scheduleForm.type}
                onChange={(v) => setScheduleForm((f) => ({ ...f, type: v }))}
                options={[
                  { value: 'video', label: 'Video', description: 'Online meeting', icon: Video },
                  { value: 'phone_screen', label: 'Phone', description: 'Call screen', icon: Phone },
                  { value: 'in_person', label: 'Onsite', description: 'In person', icon: MapPin },
                  { value: 'technical', label: 'Technical', description: 'Skills deep-dive', icon: Briefcase },
                  { value: 'hr', label: 'HR', description: 'Culture / HR round', icon: User },
                ]}
                placeholder="Interview type"
                icon={Video}
                className="w-full"
              />
            </div>
            <div>
              <label className="label-ats">Duration (minutes)</label>
              <input
                type="number"
                min="15"
                step="15"
                className="input-ats"
                value={scheduleForm.duration}
                onChange={(e) => setScheduleForm((f) => ({ ...f, duration: e.target.value }))}
              />
            </div>
            {scheduleForm.type === 'video' || scheduleForm.type === 'technical' ? (
              <div className="sm:col-span-2">
                <label className="label-ats">Meeting link</label>
                <input
                  className="input-ats"
                  value={scheduleForm.meetingLink}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, meetingLink: e.target.value }))}
                  placeholder="https://meet.google.com/…"
                />
              </div>
            ) : null}
            {scheduleForm.type === 'in_person' ? (
              <div className="sm:col-span-2">
                <label className="label-ats">Location</label>
                <input
                  className="input-ats"
                  value={scheduleForm.location}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Office / room"
                />
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <label className="label-ats">Notes (optional)</label>
              <input
                className="input-ats"
                value={scheduleForm.remark}
                onChange={(e) => setScheduleForm((f) => ({ ...f, remark: e.target.value }))}
                placeholder="Panel round, bring laptop…"
              />
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={showScorecard}
        onClose={() => setShowScorecard(false)}
        title="Interview Scorecard"
        description={scorecardTarget ? `${candidateName(scorecardTarget)} · ${jobName(scorecardTarget)}` : ''}
        size="xl"
        footer={
          <>
            <button type="button" onClick={() => setShowScorecard(false)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={handleScorecard} disabled={submittingScorecard || !recommendation} className="btn-primary">
              {submittingScorecard ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : 'Submit Scorecard'}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <div>
            <label className="label-ats mb-2">Overall Recommendation</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {RECS.map((rec) => (
                <button
                  key={rec.value}
                  type="button"
                  onClick={() => setRecommendation(rec.value)}
                  className={`py-2.5 px-2 text-xs font-semibold border rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/30 ${
                    recommendation === rec.value
                      ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm'
                      : 'border-stone-200 text-stone-600 hover:border-brand-300 hover:bg-brand-50/50'
                  }`}
                >
                  {rec.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="section-title-ats !mb-3">Skills Evaluation</h3>
            {SKILLS.map((skill) => (
              <div key={skill} className="bg-stone-50/80 p-4 rounded-2xl border border-stone-100">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-stone-800">{skill}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRatings((r) => ({ ...r, [skill]: star }))}
                        className="p-0.5 touch-target"
                        aria-label={`Rate ${skill} ${star} stars`}
                      >
                        <Star
                          className={`w-5 h-5 transition-colors ${
                            (ratings[skill] || 0) >= star
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-stone-300 hover:text-amber-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  placeholder="Add notes…"
                  className="textarea-ats"
                  rows={2}
                  value={skillNotes[skill] || ''}
                  onChange={(e) => setSkillNotes((n) => ({ ...n, [skill]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          <div>
            <label className="label-ats">Final Notes</label>
            <textarea
              placeholder="Overall summary, strengths, concerns…"
              className="textarea-ats resize-y"
              rows={4}
              value={finalNotes}
              onChange={(e) => setFinalNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        title="Cancel interview?"
        message={`Cancel the interview with ${candidateName(cancelTarget || {})}?`}
        confirmText="Cancel Interview"
        type="delete"
        isLoading={cancelling}
      />
    </div>
  );
}
