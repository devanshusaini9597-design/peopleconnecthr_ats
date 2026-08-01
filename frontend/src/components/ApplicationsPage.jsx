import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Plus, LayoutGrid, List, Star, Clock,
  Phone, Mail, Briefcase, FileText,
  X, User, Calendar, CheckCircle2,
  AlertCircle, Activity, XCircle, Award, Target,
  Loader2, Trash2, Save, Video, MapPin
} from 'lucide-react';
import { ShieldCheck, FileSignature } from 'lucide-react';
import API_URL from '../config';
import { useAuth } from '../context/AuthContext';
import { planHasFeature } from '../config/planFeatures';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import Modal from './ui/Modal';
import EmptyState from './ui/EmptyState';
import PremiumSelect from './ui/PremiumSelect';

const STAGES = [
  { id: 'Applied', label: 'Applied', color: 'bg-sky-50', borderColor: 'border-sky-200', textColor: 'text-sky-700', bar: 'bg-sky-500', icon: FileText },
  { id: 'Screening', label: 'Screening', color: 'bg-amber-50', borderColor: 'border-amber-200', textColor: 'text-amber-700', bar: 'bg-amber-500', icon: Target },
  { id: 'Interview', label: 'Interview', color: 'bg-violet-50', borderColor: 'border-violet-200', textColor: 'text-violet-700', bar: 'bg-violet-500', icon: Calendar },
  { id: 'Offer', label: 'Offer', color: 'bg-emerald-50', borderColor: 'border-emerald-200', textColor: 'text-emerald-700', bar: 'bg-emerald-500', icon: Award },
  { id: 'Hired', label: 'Hired', color: 'bg-teal-50', borderColor: 'border-teal-200', textColor: 'text-teal-700', bar: 'bg-teal-500', icon: CheckCircle2 },
];

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor(Math.abs(now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
};

/** Normalize backend Application docs (candidateId/jobId populated) for UI */
const normalizeApp = (raw) => {
  if (!raw) return null;
  const candidate = raw.candidate || raw.candidateId || {};
  const job = raw.job || raw.jobId || {};
  return {
    ...raw,
    candidate: typeof candidate === 'object' ? candidate : { _id: candidate },
    job: typeof job === 'object' ? job : { _id: job },
    stage: raw.stage || 'Applied',
    rating: raw.rating || 0,
    notes: raw.notes || '',
  };
};

const jobTitle = (job) => job?.title || job?.role || 'Untitled role';

const emptyAddForm = {
  jobId: '',
  name: '',
  email: '',
  phone: '',
  source: 'Direct',
};

export default function ApplicationsPage() {
  const { organization } = useAuth();
  const hasBackgroundCheck = planHasFeature(organization?.plan, 'integrations.backgroundCheck');
  const hasEsign = planHasFeature(organization?.plan, 'integrations.esign');

  const [enterpriseActionLoading, setEnterpriseActionLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState({ total: 0, byStage: {}, avgTime: 'N/A' });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('kanban');

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
  const [scheduleForm, setScheduleForm] = useState({ scheduledAt: '', mode: 'Video', location: '', remark: '' });
  const [scheduling, setScheduling] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState(null);
  const [draggedAppId, setDraggedAppId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

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
    setScheduling(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/api/applications/${selectedApp._id}/schedule`, {
        method: 'PUT',
        body: JSON.stringify(scheduleForm),
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
    if (!term) return applications;
    return applications.filter((app) => {
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
  }, [applications, searchQuery]);

  const getAppsByStage = (stageId) => filteredApplications.filter((app) => app.stage === stageId);

  const openAddModal = () => {
    setAddForm({ ...emptyAddForm, jobId: selectedJobId || '' });
    setIsAddModalOpen(true);
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

  const sourceOptions = [
    { value: 'Direct', label: 'Direct', icon: User },
    { value: 'Referral', label: 'Referral', icon: User },
    { value: 'LinkedIn', label: 'LinkedIn', icon: Briefcase },
    { value: 'Job Board', label: 'Job Board', icon: Briefcase },
    { value: 'Careers Page', label: 'Careers Page', icon: FileText },
    { value: 'Agency', label: 'Agency', icon: Briefcase },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 bg-stone-50/60 overflow-hidden content-fill-ats">
      {/* Top Bar */}
      <div className="bg-white/95 backdrop-blur-xl border-b border-stone-200/70 px-3 sm:px-5 lg:px-6 py-3 sm:py-3.5 flex-shrink-0 z-20 shadow-[var(--shadow-card)]">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3 min-w-0 lg:min-w-[11.5rem] flex-shrink-0">
            <div className="icon-box-ats !w-10 !h-10 !rounded-xl flex-shrink-0">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gradient tracking-tight leading-tight" style={{ letterSpacing: '-0.025em' }}>
                Pipeline Board
              </h1>
              <p className="text-[11px] sm:text-xs text-stone-500 font-medium mt-0.5 truncate max-w-[14rem]">
                {selectedJob ? jobTitle(selectedJob) : 'Drag candidates across stages'}
              </p>
            </div>
          </div>

          {/* Controls cluster — one fitted toolbar */}
          <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5">
            <PremiumSelect
              className="w-full sm:flex-1 sm:min-w-[11rem] sm:max-w-xs"
              value={selectedJobId}
              onChange={setSelectedJobId}
              options={jobOptions}
              placeholder="Select a Job"
              icon={Briefcase}
              searchable
              searchPlaceholder="Search jobs…"
              emptyLabel="No jobs found"
              allowClear
            />

            <div className="relative w-full sm:flex-1 sm:min-w-[10rem] sm:max-w-sm">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                placeholder={selectedJobId ? 'Search name, email, stage…' : 'Select a job to search'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-ats !pl-10 w-full"
                disabled={!selectedJobId}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 self-stretch sm:self-auto">
              <div className="flex bg-stone-100 p-1 rounded-xl h-[42px] items-center">
                <button
                  type="button"
                  onClick={() => setViewMode('kanban')}
                  className={classNames(
                    'h-8 w-8 flex items-center justify-center rounded-lg transition-all',
                    viewMode === 'kanban' ? 'bg-white shadow-sm text-brand-600' : 'text-stone-500 hover:text-stone-700'
                  )}
                  title="Kanban view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={classNames(
                    'h-8 w-8 flex items-center justify-center rounded-lg transition-all',
                    viewMode === 'table' ? 'bg-white shadow-sm text-brand-600' : 'text-stone-500 hover:text-stone-700'
                  )}
                  title="Table view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={openAddModal}
                className="btn-primary !h-[42px] !py-0 !px-3.5 sm:!px-4 inline-flex items-center gap-1.5 flex-1 sm:flex-none justify-center"
              >
                <Plus className="w-4 h-4" />
                <span className="whitespace-nowrap text-sm font-semibold">Add Application</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 overflow-hidden relative flex min-h-0">
        {!selectedJobId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-brand-200/40 blur-2xl scale-150" />
              <div className="relative w-20 h-20 rounded-full border-2 border-dashed border-brand-200 bg-gradient-to-br from-brand-50 to-white flex items-center justify-center">
                <Target className="w-9 h-9 text-brand-400" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-stone-800 tracking-tight mb-2">Select a Job</h2>
            <p className="text-sm text-stone-500 max-w-sm leading-relaxed mb-5">
              Choose a job from the dropdown to view its hiring pipeline, or add an application to get started.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={openAddModal} className="btn-primary" disabled={jobs.length === 0}>
                <Plus size={16} /> Add Application
              </button>
            </div>
            {jobs.length === 0 && (
              <p className="text-xs text-stone-400 mt-4">No open jobs yet — post a role from Job Openings first.</p>
            )}
          </div>
        ) : loading ? (
          <div className="flex-1 p-4 sm:p-6 flex gap-4 sm:gap-5 overflow-x-auto">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-[280px] sm:w-[300px] flex-shrink-0 space-y-3">
                <div className="h-11 skeleton-ats rounded-xl" />
                <div className="h-28 skeleton-ats rounded-xl" />
                <div className="h-28 skeleton-ats rounded-xl" />
              </div>
            ))}
          </div>
        ) : applications.length === 0 && !searchQuery ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="card-ats-bordered w-full max-w-md">
              <EmptyState
                icon={User}
                message="No applications yet"
                subMessage="Add a candidate to this role or share your careers page."
                action={
                  <button type="button" onClick={openAddModal} className="btn-primary">
                    <Plus size={16} /> Add Application
                  </button>
                }
              />
            </div>
          </div>
        ) : viewMode === 'kanban' ? (
          <div className="flex-1 overflow-x-auto overflow-y-hidden p-3 sm:p-5 lg:p-6">
            <div className="flex gap-3 sm:gap-4 h-full items-stretch min-w-max pb-2">
              {STAGES.map((stage) => {
                const stageApps = getAppsByStage(stage.id);
                const isOver = dragOverStage === stage.id;
                return (
                  <div
                    key={stage.id}
                    className={classNames(
                      'w-[280px] sm:w-[300px] lg:w-[320px] flex-shrink-0 flex flex-col max-h-full rounded-2xl border transition-all duration-200 bg-stone-100/60',
                      isOver ? 'border-brand-400 bg-brand-50/40 shadow-inner ring-2 ring-brand-200/60' : 'border-stone-200/70'
                    )}
                    onDragOver={(e) => handleDragOver(e, stage.id)}
                    onDrop={(e) => handleDrop(e, stage.id)}
                  >
                    <div className={classNames('px-3.5 py-3 border-b flex items-center justify-between rounded-t-2xl', stage.color, stage.borderColor)}>
                      <div className="flex items-center gap-2 min-w-0">
                        <stage.icon className={classNames('w-4 h-4 flex-shrink-0', stage.textColor)} />
                        <h3 className={classNames('font-bold text-sm truncate', stage.textColor)}>{stage.label}</h3>
                      </div>
                      <span className={classNames('px-2 py-0.5 rounded-full text-xs font-bold bg-white/90 shadow-sm border', stage.textColor, stage.borderColor)}>
                        {stageApps.length}
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2.5 min-h-[120px] scrollbar-thin">
                      {stageApps.map((app) => (
                        <div
                          key={app._id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, app._id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => openPanel(app)}
                          className={classNames(
                            'bg-white p-3.5 rounded-xl shadow-sm border border-stone-200/80 cursor-grab active:cursor-grabbing transition-all duration-200',
                            'hover:shadow-md hover:border-brand-300 hover:-translate-y-0.5 group',
                            draggedAppId === app._id ? 'opacity-40 ring-2 ring-brand-400' : ''
                          )}
                        >
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {(app.candidate?.name || '?').charAt(0).toUpperCase()}
                              </div>
                              <h4 className="font-bold text-stone-900 text-sm truncate group-hover:text-brand-700 transition-colors">
                                {app.candidate?.name || 'Unknown'}
                              </h4>
                            </div>
                            {app.source && (
                              <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded-md flex-shrink-0">
                                {app.source}
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-stone-500 mb-3 flex items-center gap-1.5 pl-0.5">
                            <Briefcase className="w-3 h-3 text-stone-400 flex-shrink-0" />
                            <span className="truncate">{jobTitle(app.job) || jobTitle(selectedJob)}</span>
                          </div>

                          <div className="flex items-center justify-between pt-2.5 border-t border-stone-100">
                            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  aria-label={`Rate ${star}`}
                                  onClick={() => handleRatingChange(app._id, star)}
                                  className="p-0.5"
                                >
                                  <Star
                                    className={classNames(
                                      'w-3.5 h-3.5 transition-colors',
                                      star <= (app.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-stone-300 hover:text-amber-200'
                                    )}
                                  />
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-stone-400 font-medium">
                              <Clock className="w-3 h-3" />
                              {formatDate(app.createdAt || app.appliedAt)}
                            </div>
                          </div>
                        </div>
                      ))}

                      {stageApps.length === 0 && (
                        <div className="h-24 border-2 border-dashed border-stone-200 rounded-xl flex items-center justify-center text-stone-400 text-xs font-medium">
                          Drop here
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-3 sm:p-5 lg:p-6">
            <div className="table-shell-ats overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[720px]">
                <thead className="bg-stone-50/80 border-b border-stone-200 text-stone-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 sm:px-5 py-3.5 font-bold">Candidate</th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold">Position</th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold">Stage</th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold">Source</th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold">Applied</th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredApplications.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-stone-500">No candidates match your search.</td>
                    </tr>
                  ) : (
                    filteredApplications.map((app) => {
                      const stageMeta = STAGES.find((s) => s.id === app.stage) || STAGES[0];
                      return (
                        <tr
                          key={app._id}
                          className="hover:bg-brand-50/30 cursor-pointer transition-colors"
                          onClick={() => openPanel(app)}
                        >
                          <td className="px-4 sm:px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {(app.candidate?.name || '?').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-stone-900 truncate">{app.candidate?.name}</div>
                                <div className="text-stone-500 text-xs truncate">{app.candidate?.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 sm:px-5 py-3.5 text-stone-700">{jobTitle(app.job) || jobTitle(selectedJob)}</td>
                          <td className="px-4 sm:px-5 py-3.5">
                            <span className={classNames('px-2.5 py-1 rounded-lg text-xs font-bold border', stageMeta.color, stageMeta.textColor, stageMeta.borderColor)}>
                              {app.stage}
                            </span>
                          </td>
                          <td className="px-4 sm:px-5 py-3.5 text-stone-600">{app.source || '—'}</td>
                          <td className="px-4 sm:px-5 py-3.5 text-stone-600">{formatDate(app.createdAt || app.appliedAt)}</td>
                          <td className="px-4 sm:px-5 py-3.5">
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star key={star} className={classNames('w-3.5 h-3.5', star <= (app.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-stone-300')} />
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detail panel */}
        {isPanelOpen && selectedApp && (
          <>
            <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-40" onClick={closePanel} aria-hidden />
            <div className="fixed inset-y-0 right-0 w-full sm:max-w-md md:max-w-[480px] bg-white shadow-2xl z-50 flex flex-col animate-slide-up border-l border-stone-200/60">
              <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 flex-shrink-0" />
              <div className="px-4 sm:px-5 py-4 border-b border-stone-100 flex items-center justify-between gap-3 flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center font-bold text-lg flex-shrink-0 shadow-md shadow-brand-500/25">
                    {(selectedApp.candidate?.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-stone-900 truncate tracking-tight">{selectedApp.candidate?.name}</h2>
                    <p className="text-sm text-stone-500 truncate">{jobTitle(selectedApp.job) || jobTitle(selectedJob)}</p>
                  </div>
                </div>
                <button type="button" onClick={closePanel} className="p-2.5 hover:bg-stone-100 rounded-xl text-stone-400 hover:text-stone-600 transition-colors flex-shrink-0" aria-label="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
                <div className="flex flex-wrap gap-2 items-center">
                  <PremiumSelect
                    className="w-full sm:w-44"
                    value={selectedApp.stage}
                    onChange={(v) => handleStageChange(selectedApp._id, v)}
                    options={STAGES.map((s) => ({
                      value: s.id,
                      label: s.label,
                      icon: s.icon,
                    }))}
                    placeholder="Stage"
                    icon={Target}
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const existing = selectedApp.metadata?.interview?.scheduledAt;
                      const defaultAt = existing
                        ? new Date(existing).toISOString().slice(0, 16)
                        : new Date(Date.now() + 86400000).toISOString().slice(0, 16);
                      setScheduleForm({
                        scheduledAt: defaultAt,
                        mode: selectedApp.metadata?.interview?.mode || 'Video',
                        location: selectedApp.metadata?.interview?.location || '',
                        remark: '',
                      });
                      setIsScheduleOpen(true);
                    }}
                    className="btn-secondary !py-2 !px-3 !text-xs !h-[42px]"
                  >
                    <Calendar className="w-3.5 h-3.5" /> Schedule
                  </button>

                  {hasBackgroundCheck && (
                    <button
                      type="button"
                      onClick={() => orderBackgroundCheck(selectedApp._id)}
                      disabled={enterpriseActionLoading || selectedApp.backgroundCheck?.status === 'pending'}
                      className="btn-secondary !py-2 !px-3 !text-xs !border-emerald-200 !text-emerald-700 hover:!bg-emerald-50"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {selectedApp.backgroundCheck?.status === 'pending' ? 'Check pending…' : 'BG Check'}
                    </button>
                  )}

                  {hasEsign && (
                    <button
                      type="button"
                      onClick={() => sendForEsign(selectedApp._id)}
                      disabled={enterpriseActionLoading || selectedApp.esign?.status === 'sent'}
                      className="btn-secondary !py-2 !px-3 !text-xs !border-rose-200 !text-rose-700 hover:!bg-rose-50"
                    >
                      <FileSignature className="w-3.5 h-3.5" />
                      {selectedApp.esign?.status === 'sent' ? 'Sent' : 'e-Sign'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsRejectModalOpen(true)}
                    className="btn-secondary !py-2 !px-3 !text-xs !border-red-200 !text-red-600 hover:!bg-red-50 ml-auto"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>

                {selectedApp.metadata?.interview?.scheduledAt && (
                  <div className="rounded-xl border border-violet-200 bg-violet-50/70 px-3.5 py-3 text-sm text-violet-800 flex items-start gap-2.5">
                    <Video className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-xs uppercase tracking-wide text-violet-600 mb-0.5">Interview scheduled</p>
                      <p className="font-medium">{new Date(selectedApp.metadata.interview.scheduledAt).toLocaleString()}</p>
                      <p className="text-xs text-violet-600 mt-0.5">
                        {selectedApp.metadata.interview.mode}
                        {selectedApp.metadata.interview.location ? ` · ${selectedApp.metadata.interview.location}` : ''}
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="section-title-ats !mb-3">Candidate Details</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-3 text-stone-600">
                      <Mail className="w-4 h-4 text-stone-400 flex-shrink-0" />
                      <a href={`mailto:${selectedApp.candidate?.email}`} className="hover:text-brand-600 truncate">{selectedApp.candidate?.email || '—'}</a>
                    </div>
                    {(selectedApp.candidate?.phone || selectedApp.candidate?.contact) && (
                      <div className="flex items-center gap-3 text-stone-600">
                        <Phone className="w-4 h-4 text-stone-400 flex-shrink-0" />
                        <a href={`tel:${selectedApp.candidate?.phone || selectedApp.candidate?.contact}`} className="hover:text-brand-600">
                          {selectedApp.candidate?.phone || selectedApp.candidate?.contact}
                        </a>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-stone-600">
                      <Clock className="w-4 h-4 text-stone-400 flex-shrink-0" />
                      Applied {selectedApp.createdAt || selectedApp.appliedAt
                        ? new Date(selectedApp.createdAt || selectedApp.appliedAt).toLocaleString()
                        : '—'}
                    </div>
                    <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                      <span className="text-xs font-semibold text-stone-500 mr-1">Rating</span>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} type="button" onClick={() => handleRatingChange(selectedApp._id, star)} className="p-0.5">
                          <Star className={classNames('w-4 h-4', star <= (selectedApp.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-stone-300')} />
                        </button>
                      ))}
                    </div>
                    {(selectedApp.resumeUrl || selectedApp.candidate?.resume) && (
                      <a
                        href={selectedApp.resumeUrl || selectedApp.candidate?.resume}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 mt-2 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-sm font-semibold transition-colors"
                      >
                        <FileText className="w-4 h-4" /> View Resume
                      </a>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="section-title-ats !mb-3">Notes</h3>
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Add a note about this candidate…"
                    className="textarea-ats min-h-[110px]"
                  />
                  <div className="flex justify-between items-center mt-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(selectedApp)}
                      className="btn-ghost !py-1.5 !px-2.5 !text-xs text-red-600 hover:!bg-red-50"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                    <button type="button" onClick={handleSaveNote} disabled={savingNote} className="btn-primary !py-1.5 !text-xs">
                      {savingNote ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      {savingNote ? 'Saving…' : 'Save Note'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Application */}
      <Modal
        open={isAddModalOpen}
        onClose={() => !adding && setIsAddModalOpen(false)}
        title="Add Application"
        description="Create a pipeline entry for a candidate on a job."
        size="md"
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={adding} onClick={() => setIsAddModalOpen(false)}>Cancel</button>
            <button type="submit" form="add-app-form" className="btn-primary" disabled={adding}>
              {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {adding ? 'Adding…' : 'Submit'}
            </button>
          </>
        }
      >
        <form id="add-app-form" onSubmit={handleAddApplication} className="space-y-4">
          <div>
            <label className="label-ats">Job *</label>
            <PremiumSelect
              value={addForm.jobId}
              onChange={(v) => setAddForm({ ...addForm, jobId: v })}
              options={jobOptions}
              placeholder="Select a job"
              icon={Briefcase}
              searchable
              searchPlaceholder="Search jobs…"
              emptyLabel="No jobs found"
            />
          </div>
          <div>
            <label className="label-ats">Candidate Name *</label>
            <input required type="text" className="input-ats" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder="Full name" />
          </div>
          <div>
            <label className="label-ats">Email *</label>
            <input required type="email" className="input-ats" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} placeholder="name@email.com" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-ats">Phone</label>
              <input type="tel" className="input-ats" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} placeholder="Optional" />
            </div>
            <div>
              <label className="label-ats">Source</label>
              <PremiumSelect
                value={addForm.source}
                onChange={(v) => setAddForm({ ...addForm, source: v })}
                options={sourceOptions}
                placeholder="Source"
                icon={User}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Reject */}
      <Modal
        open={isRejectModalOpen}
        onClose={() => !rejecting && setIsRejectModalOpen(false)}
        title="Reject application?"
        description="This candidate will be removed from the active pipeline."
        size="sm"
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={rejecting} onClick={() => setIsRejectModalOpen(false)}>Cancel</button>
            <button type="button" className="btn-danger" disabled={rejecting} onClick={handleReject}>
              {rejecting ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
              {rejecting ? 'Rejecting…' : 'Confirm Reject'}
            </button>
          </>
        }
      >
        <label className="label-ats">Reason (optional)</label>
        <textarea
          className="textarea-ats h-24"
          placeholder="e.g. Skills mismatch, role filled…"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>

      {/* Schedule */}
      <Modal
        open={isScheduleOpen}
        onClose={() => !scheduling && setIsScheduleOpen(false)}
        title="Schedule interview"
        description="Set a time and mode — we'll move them to Interview if needed."
        size="md"
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={scheduling} onClick={() => setIsScheduleOpen(false)}>Cancel</button>
            <button type="submit" form="schedule-form" className="btn-primary" disabled={scheduling}>
              {scheduling ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}
              {scheduling ? 'Saving…' : 'Save Schedule'}
            </button>
          </>
        }
      >
        <form id="schedule-form" onSubmit={handleSchedule} className="space-y-4">
          <div>
            <label className="label-ats">Date & time *</label>
            <input
              required
              type="datetime-local"
              className="input-ats"
              value={scheduleForm.scheduledAt}
              onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledAt: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-ats">Mode</label>
              <PremiumSelect
                value={scheduleForm.mode}
                onChange={(v) => setScheduleForm({ ...scheduleForm, mode: v })}
                options={[
                  { value: 'Video', label: 'Video', icon: Video },
                  { value: 'Phone', label: 'Phone', icon: Phone },
                  { value: 'On-site', label: 'On-site', icon: MapPin },
                  { value: 'Hybrid', label: 'Hybrid', icon: Briefcase },
                ]}
                placeholder="Mode"
                icon={Video}
              />
            </div>
            <div>
              <label className="label-ats">Location / link</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  className="input-ats !pl-9"
                  placeholder="Zoom / office"
                  value={scheduleForm.location}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div>
            <label className="label-ats">Remark</label>
            <input
              type="text"
              className="input-ats"
              placeholder="Optional note"
              value={scheduleForm.remark}
              onChange={(e) => setScheduleForm({ ...scheduleForm, remark: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Delete */}
      <Modal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete application?"
        description="This permanently removes the pipeline entry."
        size="sm"
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button type="button" className="btn-danger" disabled={deleting} onClick={handleDeleteApp}>
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </>
        }
      >
        <p className="text-sm text-stone-600">
          Remove <strong>{deleteTarget?.candidate?.name}</strong> from this pipeline?
        </p>
      </Modal>

      {toast && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[100] flex justify-end pointer-events-none">
          <div className={classNames(
            'pointer-events-auto px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 text-sm font-medium max-w-sm animate-slide-up',
            toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-stone-900 text-white'
          )}>
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
            {toast.message}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        .scrollbar-thin::-webkit-scrollbar { width: 5px; height: 5px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #d6d3d1; border-radius: 20px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #a8a29e; }
      ` }}
      />
    </div>
  );
}
