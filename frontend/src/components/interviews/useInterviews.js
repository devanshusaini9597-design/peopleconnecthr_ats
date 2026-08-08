import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Calendar as CalendarIcon, Clock, CheckCircle2, Ban, Users } from 'lucide-react';
import { authenticatedFetch, handleUnauthorized, readApiJson } from '../../utils/fetchUtils';
import { useToast } from '../Toast';
import usePageTour from '../../hooks/usePageTour';
import {
  INTERVIEWS_TOUR_KEY,
  DEFAULT_CRITERIA,
  DEFAULT_TEMPLATE_VALUE,
  criteriaFromTemplate,
  weightedOverall,
  modeToType,
  typeToMode,
  candidateName,
  jobName,
  normalizeInterview,
} from './constants';

export default function useInterviews() {
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(INTERVIEWS_TOUR_KEY);
  const tableScrollRef = useRef(null);
  const dragScrollRef = useRef({ active: false, startX: 0, scrollLeft: 0 });
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
    scheduledDate: '',
    scheduledTime: '10:00',
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
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATE_VALUE);
  const [activeCriteria, setActiveCriteria] = useState(DEFAULT_CRITERIA);

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [transcriptTarget, setTranscriptTarget] = useState(null);

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
    defaultAt.setDate(defaultAt.getDate() + 1);
    const pad = (n) => String(n).padStart(2, '0');
    setScheduleForm({
      scheduledDate: `${defaultAt.getFullYear()}-${pad(defaultAt.getMonth() + 1)}-${pad(defaultAt.getDate())}`,
      scheduledTime: '10:00',
      type: 'video',
      location: '',
      meetingLink: '',
      duration: 60,
      remark: '',
    });
    setSelectedApp(null);
    setShowSchedule(true);
  };

  const onTableDragScrollStart = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, a, input, select, textarea, label, [role="button"]')) return;
    if (!e.target.closest('td, th, .cand-table-drag')) return;
    const el = tableScrollRef.current;
    if (!el) return;
    dragScrollRef.current = { active: true, startX: e.pageX, scrollLeft: el.scrollLeft };
    el.dataset.dragging = '1';
  };
  const onTableDragScrollMove = (e) => {
    const state = dragScrollRef.current;
    if (!state.active) return;
    const el = tableScrollRef.current;
    if (!el) return;
    e.preventDefault();
    el.scrollLeft = state.scrollLeft - (e.pageX - state.startX);
  };
  const onTableDragScrollEnd = () => {
    if (!dragScrollRef.current.active) return;
    dragScrollRef.current.active = false;
    const el = tableScrollRef.current;
    if (el) delete el.dataset.dragging;
  };

  const handleSchedule = async () => {
    if (!selectedApp?._id || !scheduleForm.scheduledDate || !scheduleForm.scheduledTime) {
      toast?.error?.('Select a candidate and date/time');
      return;
    }
    const scheduledAt = `${scheduleForm.scheduledDate}T${scheduleForm.scheduledTime}`;
    setScheduling(true);
    try {
      const mode = typeToMode(scheduleForm.type);
      const res = await authenticatedFetch(`/api/applications/${selectedApp._id}/schedule`, {
        method: 'PUT',
        body: JSON.stringify({
          scheduledAt: new Date(scheduledAt).toISOString(),
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
            scheduledAt: new Date(scheduledAt).toISOString(),
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

  const applyTemplateSelection = useCallback((templateId, list) => {
    const catalog = list || templates;
    if (!templateId || templateId === DEFAULT_TEMPLATE_VALUE) {
      setSelectedTemplateId(DEFAULT_TEMPLATE_VALUE);
      setActiveCriteria(DEFAULT_CRITERIA);
      setRatings({});
      setSkillNotes({});
      return;
    }
    const tpl = catalog.find((t) => t._id === templateId);
    setSelectedTemplateId(templateId);
    setActiveCriteria(criteriaFromTemplate(tpl));
    setRatings({});
    setSkillNotes({});
  }, [templates]);

  const loadTemplatesForScorecard = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await authenticatedFetch('/api/scorecard-templates');
      const data = await readApiJson(res);
      const list = data.success && Array.isArray(data.data) ? data.data : [];
      setTemplates(list);
      const preferred = list.find((t) => t.isDefault) || list[0];
      if (preferred?._id) {
        applyTemplateSelection(preferred._id, list);
      } else {
        applyTemplateSelection(DEFAULT_TEMPLATE_VALUE, list);
      }
    } catch {
      setTemplates([]);
      applyTemplateSelection(DEFAULT_TEMPLATE_VALUE, []);
    } finally {
      setTemplatesLoading(false);
    }
  }, [applyTemplateSelection]);

  const openScorecard = (interview) => {
    setScorecardTarget(interview);
    setRecommendation('');
    setRatings({});
    setSkillNotes({});
    setFinalNotes('');
    setShowScorecard(true);
    loadTemplatesForScorecard();
  };

  const templateOptions = useMemo(() => {
    const opts = [
      {
        value: DEFAULT_TEMPLATE_VALUE,
        label: 'Default criteria',
        description: 'Technical, Communication, Problem Solving, Culture Fit',
      },
      ...templates.map((t) => ({
        value: t._id,
        label: t.name,
        description: t.description
          || `${t.criteria?.length || 0} criteria${t.isDefault ? ' · Default' : ''}`,
      })),
    ];
    return opts;
  }, [templates]);

  const previewOverall = useMemo(
    () => weightedOverall(activeCriteria, ratings),
    [activeCriteria, ratings]
  );

  const handleScorecard = async () => {
    if (!scorecardTarget || !recommendation) {
      toast?.error?.('Pick a recommendation');
      return;
    }
    if (scorecardTarget.source === 'application' || String(scorecardTarget._id).startsWith('app-')) {
      toast?.error?.('Scorecards need a synced interview record. Re-schedule from this page after backend redeploy.');
      return;
    }
    if (!activeCriteria.length) {
      toast?.error?.('No criteria to score');
      return;
    }
    const criteria = activeCriteria.map((c) => ({
      name: c.name,
      rating: ratings[c.key] || 3,
      weight: c.weight || 1,
      comment: skillNotes[c.key] || '',
    }));
    const overallRating = weightedOverall(activeCriteria, ratings);
    setSubmittingScorecard(true);
    try {
      const appId = scorecardTarget.applicationId?._id || scorecardTarget.applicationId;
      const res = await authenticatedFetch(`/api/interviews/${scorecardTarget._id}/scorecard`, {
        method: 'POST',
        body: JSON.stringify({
          applicationId: appId,
          templateId: selectedTemplateId === DEFAULT_TEMPLATE_VALUE ? null : selectedTemplateId,
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
    { id: 'cancelled', label: 'Cancelled', icon: Ban },
    { id: 'all', label: 'All', icon: Users },
    { id: 'calendar', label: 'By date', icon: Clock },
  ];

  return {
    tourOpen,
    setTourOpen,
    tableScrollRef,
    activeTab,
    setActiveTab,
    loading,
    loadError,
    interviews,
    query,
    setQuery,
    showSchedule,
    setShowSchedule,
    scheduling,
    appQuery,
    setAppQuery,
    appResults,
    searchingApps,
    selectedApp,
    setSelectedApp,
    scheduleForm,
    setScheduleForm,
    showScorecard,
    setShowScorecard,
    scorecardTarget,
    recommendation,
    setRecommendation,
    ratings,
    setRatings,
    skillNotes,
    setSkillNotes,
    finalNotes,
    setFinalNotes,
    submittingScorecard,
    templates,
    templatesLoading,
    selectedTemplateId,
    activeCriteria,
    cancelTarget,
    setCancelTarget,
    cancelling,
    transcriptTarget,
    setTranscriptTarget,
    load,
    filtered,
    calendarGroups,
    openSchedule,
    onTableDragScrollStart,
    onTableDragScrollMove,
    onTableDragScrollEnd,
    handleSchedule,
    handleCancel,
    handleComplete,
    applyTemplateSelection,
    openScorecard,
    templateOptions,
    previewOverall,
    handleScorecard,
    tabs,
  };
}
