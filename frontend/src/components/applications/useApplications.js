import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Briefcase } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import API_URL from '../../config';
import { useAuth } from '../../context/AuthContext';
import { planHasFeature } from '../../config/planFeatures';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../../utils/fetchUtils';
import usePageTour from '../../hooks/usePageTour';
import { useToast } from '../Toast';
import {
  APPS_TOUR_KEY,
  PIPELINE_TOUR_KEY,
  APPS_TOUR_STEPS,
  PIPELINE_TOUR_STEPS,
  emptyAddForm,
  normalizeApp,
  jobTitle,
} from './constants';

export default function useApplications() {
  const location = useLocation();
  const isApplicationsRoute = location.pathname.startsWith('/applications');
  const pageTitle = isApplicationsRoute ? 'Applications' : 'Pipeline Board';
  const pageSubtitle = isApplicationsRoute
    ? 'Browse and manage applications in a list'
    : 'Drag candidates across stages on the board';
  const tourKey = isApplicationsRoute ? APPS_TOUR_KEY : PIPELINE_TOUR_KEY;
  const tourSteps = isApplicationsRoute ? APPS_TOUR_STEPS : PIPELINE_TOUR_STEPS;

  const { organization } = useAuth();
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(tourKey);
  const hasBackgroundCheck = planHasFeature(organization?.plan, 'integrations.backgroundCheck');
  const hasEsign = planHasFeature(organization?.plan, 'integrations.esign');

  const [enterpriseActionLoading, setEnterpriseActionLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState({ total: 0, byStage: {}, avgTime: 'N/A' });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [viewMode, setViewMode] = useState(isApplicationsRoute ? 'table' : 'kanban');

  useEffect(() => {
    setViewMode(isApplicationsRoute ? 'table' : 'kanban');
  }, [isApplicationsRoute]);

  const [selectedApp, setSelectedApp] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [adding, setAdding] = useState(false);

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    scheduledDate: '',
    scheduledTime: '10:00',
    mode: 'Video',
    location: '',
    remark: '',
  });
  const [scheduling, setScheduling] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [draggedAppId, setDraggedAppId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const tableScrollRef = useRef(null);
  const dragScrollRef = useRef({ active: false, moved: false, startX: 0, scrollLeft: 0 });

  const showToast = useCallback((message, type = 'success') => {
    if (type === 'error') toast.error(message);
    else toast.success(message);
  }, [toast]);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await authenticatedFetch(`${API_URL}/jobs?isTemplate=false`);
      if (isUnauthorized(res)) return handleUnauthorized();
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data?.data || []);
        setJobs(list.filter((j) => j.status !== 'Closed' && j.status !== 'Cancelled'));
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    }
  }, []);

  const fetchStats = useCallback(async (jobId) => {
    try {
      const q = jobId ? `?jobId=${jobId}` : '';
      const res = await authenticatedFetch(`${API_URL}/api/applications/stats${q}`);
      if (isUnauthorized(res)) return handleUnauthorized();
      if (res.ok) {
        const json = await res.json();
        const data = json?.data || json || {};
        setStats({
          total: data.total ?? 0,
          byStage: data.byStage || {},
          avgTime: data.avgTime || 'N/A',
        });
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  const fetchApplications = useCallback(async (jobId) => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/api/applications?jobId=${jobId}&limit=200`);
      if (isUnauthorized(res)) return handleUnauthorized();
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json) ? json : (json?.data || []);
        setApplications(list.map(normalizeApp).filter(Boolean));
      }
    } catch (err) {
      console.error('Error fetching apps:', err);
      showToast('Failed to load applications', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (selectedJobId) {
      fetchApplications(selectedJobId);
      fetchStats(selectedJobId);
    } else {
      setApplications([]);
      setStats({ total: 0, byStage: {}, avgTime: 'N/A' });
    }
  }, [selectedJobId, fetchApplications, fetchStats]);

  useEffect(() => {
    if (selectedApp) setNoteDraft(selectedApp.notes || '');
  }, [selectedApp?._id]);

  const openPanel = (app) => {
    setSelectedApp(normalizeApp(app));
    setIsPanelOpen(true);
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    setSelectedApp(null);
  };

  const handleStageChange = async (appId, newStage) => {
    const previousApps = [...applications];
    setApplications((prev) => prev.map((app) => (app._id === appId ? { ...app, stage: newStage } : app)));
    if (selectedApp?._id === appId) setSelectedApp((s) => ({ ...s, stage: newStage }));

    try {
      const res = await authenticatedFetch(`${API_URL}/api/applications/${appId}/stage`, {
        method: 'PUT',
        body: JSON.stringify({ stage: newStage }),
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      if (!res.ok) throw new Error('Failed to update stage');
      showToast(`Moved to ${newStage}`);
      fetchStats(selectedJobId);
    } catch (err) {
      console.error(err);
      setApplications(previousApps);
      showToast('Failed to move application', 'error');
    }
  };

  const handleRatingChange = async (appId, rating) => {
    const previousApps = [...applications];
    setApplications((prev) => prev.map((app) => (app._id === appId ? { ...app, rating } : app)));
    if (selectedApp?._id === appId) setSelectedApp((s) => ({ ...s, rating }));

    try {
      const res = await authenticatedFetch(`${API_URL}/api/applications/${appId}/rating`, {
        method: 'PUT',
        body: JSON.stringify({ rating }),
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      if (!res.ok) throw new Error('Failed to update rating');
    } catch (err) {
      console.error(err);
      setApplications(previousApps);
      showToast('Failed to update rating', 'error');
    }
  };

  const handleSaveNote = async () => {
    if (!selectedApp) return;
    setSavingNote(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/api/applications/${selectedApp._id}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ notes: noteDraft }),
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      if (!res.ok) throw new Error('Failed to save note');
      const json = await res.json();
      const updated = normalizeApp(json.data || { ...selectedApp, notes: noteDraft });
      setSelectedApp(updated);
      setApplications((prev) => prev.map((a) => (a._id === updated._id ? { ...a, notes: updated.notes } : a)));
      showToast('Note saved');
    } catch (err) {
      showToast(err.message || 'Failed to save note', 'error');
    } finally {
      setSavingNote(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;
    setRejecting(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/api/applications/${selectedApp._id}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ reason: rejectReason.trim() || 'Not a fit' }),
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to reject');
      }
      setApplications((prev) => prev.filter((a) => a._id !== selectedApp._id));
      setIsRejectModalOpen(false);
      setRejectReason('');
      closePanel();
      showToast('Application rejected');
      fetchStats(selectedJobId);
    } catch (err) {
      showToast(err.message || 'Failed to reject', 'error');
    } finally {
      setRejecting(false);
    }
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!selectedApp) return;
    if (!scheduleForm.scheduledDate || !scheduleForm.scheduledTime) {
      showToast('Pick a date and time', 'error');
      return;
    }
    setScheduling(true);
    try {
      const scheduledAt = `${scheduleForm.scheduledDate}T${scheduleForm.scheduledTime}`;
      const res = await authenticatedFetch(`${API_URL}/api/applications/${selectedApp._id}/schedule`, {
        method: 'PUT',
        body: JSON.stringify({
          scheduledAt,
          mode: scheduleForm.mode,
          location: scheduleForm.location,
          remark: scheduleForm.remark,
        }),
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to schedule');
      const updated = normalizeApp(json.data);
      setSelectedApp(updated);
      setApplications((prev) => prev.map((a) => (a._id === updated._id ? updated : a)));
      setNoteDraft(updated.notes || '');
      setIsScheduleOpen(false);
      showToast('Interview scheduled');
      fetchStats(selectedJobId);
    } catch (err) {
      showToast(err.message || 'Failed to schedule', 'error');
    } finally {
      setScheduling(false);
    }
  };

  const handleAddApplication = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      const jobId = addForm.jobId || selectedJobId;
      if (!jobId) throw new Error('Please select a job');
      if (!addForm.name.trim() || !addForm.email.trim()) throw new Error('Name and email are required');

      const res = await authenticatedFetch(`${API_URL}/api/applications`, {
        method: 'POST',
        body: JSON.stringify({
          jobId,
          source: addForm.source || 'Direct',
          candidate: {
            name: addForm.name.trim(),
            email: addForm.email.trim(),
            contact: addForm.phone.trim() || undefined,
            phone: addForm.phone.trim() || undefined,
          },
        }),
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to add application');

      const created = normalizeApp(json.data);
      if (jobId === selectedJobId) {
        setApplications((prev) => [created, ...prev]);
        fetchStats(selectedJobId);
      } else {
        setSelectedJobId(jobId);
      }
      setIsAddModalOpen(false);
      setAddForm(emptyAddForm);
      showToast('Application added');
    } catch (err) {
      showToast(err.message || 'Failed to add application', 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteApp = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/api/applications/${deleteTarget._id}`, { method: 'DELETE' });
      if (isUnauthorized(res)) return handleUnauthorized();
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to delete');
      }
      setApplications((prev) => prev.filter((a) => a._id !== deleteTarget._id));
      if (selectedApp?._id === deleteTarget._id) closePanel();
      setDeleteTarget(null);
      showToast('Application deleted');
      fetchStats(selectedJobId);
    } catch (err) {
      showToast(err.message || 'Failed to delete', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const orderBackgroundCheck = async (appId) => {
    setEnterpriseActionLoading(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/api/background-check/applications/${appId}/order`, {
        method: 'POST',
        body: JSON.stringify({ provider: 'checkr' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to order background check');
      showToast('Background check ordered');
      setSelectedApp((prev) => (prev ? { ...prev, backgroundCheck: { status: 'pending', provider: 'checkr' } } : prev));
    } catch (err) {
      showToast(err.message || 'Failed to order background check', 'error');
    } finally {
      setEnterpriseActionLoading(false);
    }
  };

  const sendForEsign = async (appId) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setEnterpriseActionLoading(true);
      try {
        const documentBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const res = await authenticatedFetch(`${API_URL}/api/esign/applications/${appId}/send`, {
          method: 'POST',
          body: JSON.stringify({ provider: 'docusign', documentBase64, documentName: file.name }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to send for e-signature');
        showToast('Offer letter sent for e-signature');
        setSelectedApp((prev) => (prev ? { ...prev, esign: { status: 'sent', provider: 'docusign' } } : prev));
      } catch (err) {
        showToast(err.message || 'Failed to send for e-signature', 'error');
      } finally {
        setEnterpriseActionLoading(false);
      }
    };
    input.click();
  };

  const handleDragStart = (e, appId) => {
    setDraggedAppId(appId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', appId);
  };

  const handleDragEnd = () => {
    setDraggedAppId(null);
    setDragOverStage(null);
  };

  const handleDragOver = (e, stageId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStage !== stageId) setDragOverStage(stageId);
  };

  const handleDrop = (e, stageId) => {
    e.preventDefault();
    setDragOverStage(null);
    if (draggedAppId) {
      const app = applications.find((a) => a._id === draggedAppId);
      if (app && app.stage !== stageId) handleStageChange(draggedAppId, stageId);
    }
  };

  const filteredApplications = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return applications.filter((app) => {
      if (stageFilter !== 'all' && app.stage !== stageFilter) return false;
      if (!term) return true;
      const name = app.candidate?.name?.toLowerCase() || '';
      const email = app.candidate?.email?.toLowerCase() || '';
      const phone = String(app.candidate?.phone || app.candidate?.contact || '').toLowerCase();
      const source = String(app.source || '').toLowerCase();
      const stage = String(app.stage || '').toLowerCase();
      const title = jobTitle(app.job).toLowerCase();
      return (
        name.includes(term) ||
        email.includes(term) ||
        phone.includes(term) ||
        source.includes(term) ||
        stage.includes(term) ||
        title.includes(term)
      );
    });
  }, [applications, searchQuery, stageFilter]);

  const getAppsByStage = (stageId) => filteredApplications.filter((app) => app.stage === stageId);

  const isClickOnScrollbar = (el, e) => {
    const rect = el.getBoundingClientRect();
    const canScrollX = el.scrollWidth > el.clientWidth + 1;
    const canScrollY = el.scrollHeight > el.clientHeight + 1;
    const hBar = Math.max(el.offsetHeight - el.clientHeight, 0);
    const vBar = Math.max(el.offsetWidth - el.clientWidth, 0);
    if (canScrollX && e.clientY >= rect.bottom - Math.max(hBar, 16)) return true;
    if (canScrollY && e.clientX >= rect.right - Math.max(vBar, 16)) return true;
    return false;
  };

  const onTableDragScrollStart = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, a, input, select, textarea, label, [role="button"]')) return;
    if (!e.target.closest('td, th, .cand-table-drag')) return;
    const el = tableScrollRef.current;
    if (!el) return;
    if (isClickOnScrollbar(el, e)) return;
    dragScrollRef.current = { active: true, moved: false, startX: e.pageX, scrollLeft: el.scrollLeft };
    el.dataset.dragging = '1';
  };

  const onTableDragScrollMove = (e) => {
    const state = dragScrollRef.current;
    if (!state.active) return;
    const el = tableScrollRef.current;
    if (!el) return;
    e.preventDefault();
    const dx = e.pageX - state.startX;
    if (Math.abs(dx) > 3) state.moved = true;
    el.scrollLeft = state.scrollLeft - dx;
  };

  const onTableDragScrollEnd = () => {
    const state = dragScrollRef.current;
    if (!state.active) return;
    state.active = false;
    const el = tableScrollRef.current;
    if (el) delete el.dataset.dragging;
  };

  const openAddModal = () => {
    setAddForm({ ...emptyAddForm, jobId: selectedJobId || '' });
    setIsAddModalOpen(true);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStageFilter('all');
  };

  const selectedJob = jobs.find((j) => j._id === selectedJobId);

  const jobOptions = useMemo(
    () =>
      jobs.map((job) => ({
        value: job._id,
        label: jobTitle(job),
        description: job.location || job.experience || 'Open role',
        icon: Briefcase,
        searchText: `${jobTitle(job)} ${job.location || ''} ${job.experience || ''}`,
      })),
    [jobs]
  );

  return {
    isApplicationsRoute,
    pageTitle,
    pageSubtitle,
    tourKey,
    tourSteps,
    tourOpen,
    setTourOpen,
    hasBackgroundCheck,
    hasEsign,
    enterpriseActionLoading,
    jobs,
    selectedJobId,
    setSelectedJobId,
    applications,
    stats,
    loading,
    searchQuery,
    setSearchQuery,
    stageFilter,
    setStageFilter,
    viewMode,
    setViewMode,
    selectedApp,
    isPanelOpen,
    noteDraft,
    setNoteDraft,
    savingNote,
    isAddModalOpen,
    setIsAddModalOpen,
    addForm,
    setAddForm,
    adding,
    isRejectModalOpen,
    setIsRejectModalOpen,
    rejectReason,
    setRejectReason,
    rejecting,
    isScheduleOpen,
    setIsScheduleOpen,
    scheduleForm,
    setScheduleForm,
    scheduling,
    deleteTarget,
    setDeleteTarget,
    deleting,
    draggedAppId,
    dragOverStage,
    tableScrollRef,
    dragScrollRef,
    openPanel,
    closePanel,
    handleStageChange,
    handleRatingChange,
    handleSaveNote,
    handleReject,
    handleSchedule,
    handleAddApplication,
    handleDeleteApp,
    orderBackgroundCheck,
    sendForEsign,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    filteredApplications,
    getAppsByStage,
    onTableDragScrollStart,
    onTableDragScrollMove,
    onTableDragScrollEnd,
    openAddModal,
    clearFilters,
    selectedJob,
    jobOptions,
  };
}
