import React, { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus, MapPin, BookOpen, UserCheck, Briefcase, IndianRupee, Globe2, Loader2,
  Search, Pencil, Trash2, Filter, Building2,
  BookmarkPlus, Check, Share2, Eye, Mail, Bell,
} from 'lucide-react';
import JDLibraryModal from '../components/JDLibraryModal';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import PremiumSelect from '../components/ui/PremiumSelect';
import ProductTour from '../components/ui/ProductTour';
import TourHelpFab from '../components/ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { useToast } from '../components/Toast';
import BASE_API_URL from '../config';
import { useAuth } from '../context/AuthContext';
import { planHasFeature } from '../config/planFeatures';
import { authenticatedFetch, isUnauthorized, handleUnauthorized, planLimitErrorMessage } from '../utils/fetchUtils';
import {
  JOBS_TOUR_KEY, JOBS_TOUR_STEPS, STATUS_OPTIONS, FILTER_OPTIONS,
  JOB_BOARD_OPTIONS, STATUS_STYLES, DOT_STYLES, initialForm,
  jobFromRecord, composeJobDescriptionHtml, htmlToList, splitLocations,
} from '../components/jobs/jobsConstants';
import JobFormModal from '../components/jobs/JobFormModal';
import JobViewModal from '../components/jobs/JobViewModal';
import JobCardActionsMenu from '../components/jobs/JobCardActionsMenu';
import FreelanceSubmissionsPanel from '../components/FreelanceSubmissionsPanel';
import { ensureJobsBadge, markJobsSeen } from '../hooks/useJobNavUpdates';

const Jobs = () => {
  const { t } = useTranslation();
  const API_URL = `${BASE_API_URL}/api/jobs`;
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(JOBS_TOUR_KEY);
  const { organization, user } = useAuth();
  const orgId = organization?._id || organization?.id;
  const userId = user?._id || user?.id;
  const hasJobBoard = planHasFeature(organization?.plan, 'integrations.jobBoard');

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [postingJobId, setPostingJobId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [viewingJob, setViewingJob] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [skillsInput, setSkillsInput] = useState('');
  const [formData, setFormData] = useState(initialForm);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [postTarget, setPostTarget] = useState(null);
  const [postProvider, setPostProvider] = useState('indeed_feed');

  const managerOptions = useMemo(
    () => teamMembers.map((m) => ({
      email: m.email,
      name: m.name || m.email?.split('@')[0] || 'Member',
      role: m.role || '',
    })),
    [teamMembers],
  );

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`${API_URL}?isTemplate=false`);
      if (isUnauthorized(res)) return handleUnauthorized();
      if (!res.ok) throw new Error('Failed to load jobs');
      const data = await res.json();
      if (Array.isArray(data)) setJobs(data);
      else if (Array.isArray(data?.data)) setJobs(data.data);
      else setJobs([]);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setJobs([]);
      toast.error('Jobs are unavailable right now. Retry when the API is back.');
    } finally {
      setLoading(false);
    }
  };

  /** Real org staff (+ team directory) — never show placeholder sample managers. */
  const fetchTeamMembers = async () => {
    setLoadingMembers(true);
    try {
      const [orgRes, teamRes] = await Promise.all([
        authenticatedFetch(`${BASE_API_URL}/api/organization/members`),
        authenticatedFetch(`${BASE_API_URL}/api/team`),
      ]);
      if (isUnauthorized(orgRes) || isUnauthorized(teamRes)) {
        handleUnauthorized();
        return;
      }

      const byEmail = new Map();

      if (orgRes.ok) {
        const data = await orgRes.json();
        const list = Array.isArray(data) ? data : (data?.data || []);
        for (const m of list) {
          const email = String(m?.email || '').trim();
          if (!email) continue;
          if (m.isActive === false) continue;
          if (/\b(freelancer|external|stakeholder)\b/i.test(String(m.role || ''))) continue;
          byEmail.set(email.toLowerCase(), {
            email,
            name: m.name || email.split('@')[0],
            role: m.role || '',
          });
        }
      }

      if (teamRes.ok) {
        const data = await teamRes.json();
        for (const m of (data.members || [])) {
          const email = String(m?.email || '').trim();
          if (!email) continue;
          const key = email.toLowerCase();
          if (byEmail.has(key)) continue;
          if (/\b(freelancer|external|stakeholder)\b/i.test(String(m.role || m.designation || ''))) continue;
          byEmail.set(key, {
            email,
            name: m.name || email.split('@')[0],
            role: m.role || m.designation || '',
          });
        }
      }

      setTeamMembers(
        [...byEmail.values()].sort((a, b) =>
          String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' })
        )
      );
    } catch {
      setTeamMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => { fetchJobs(); }, []);
  useEffect(() => { markJobsSeen(); }, []);

  useEffect(() => {
    if (!menuOpenId) return undefined;
    const close = () => setMenuOpenId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuOpenId]);

  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return jobs.filter((job) => {
      const title = (job.role || job.title || '').toLowerCase();
      const loc = (job.location || '').toLowerCase();
      const matchesSearch = !q || title.includes(q) || loc.includes(q) ||
        String(job.jobCode || '').toLowerCase().includes(q) ||
        String(job.clientName || '').toLowerCase().includes(q) ||
        String(job.industry || '').toLowerCase().includes(q) ||
        String(job.grade || '').toLowerCase().includes(q) ||
        (job.skills || []).some((s) => String(s).toLowerCase().includes(q));
      const matchesStatus = statusFilter === 'All' || job.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [jobs, searchQuery, statusFilter]);

  const counts = useMemo(() => ({
    all: jobs.length,
    draft: jobs.filter((j) => j.status === 'Draft').length,
    open: jobs.filter((j) => j.status === 'Open').length,
    hold: jobs.filter((j) => j.status === 'On Hold').length,
    closed: jobs.filter((j) => j.status === 'Closed').length,
  }), [jobs]);

  const openCreate = () => {
    setEditingJob(null);
    setFormData(initialForm);
    setSkillsInput('');
    setShowModal(true);
    fetchTeamMembers();
  };

  const openView = (job) => {
    setViewingJob(job);
    setMenuOpenId(null);
  };

  const openEdit = (job) => {
    setEditingJob(job);
    setFormData(jobFromRecord(job));
    setSkillsInput((job.skills || []).join(', '));
    setMenuOpenId(null);
    setShowModal(true);
    fetchTeamMembers();
  };

  const handleSelectTemplate = (template) => {
    setEditingJob(null);
    setFormData({
      ...initialForm,
      ...jobFromRecord({
        ...template,
        role: template.role,
        title: template.role,
      }),
    });
    setSkillsInput((template.skills || []).join(', '));
    setShowLibrary(false);
    setShowModal(true);
    fetchTeamMembers();
  };

  const parseSkills = (raw) =>
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const toggleManager = (email) => {
    setFormData((prev) => {
      const current = prev.hiringManagers || [];
      const key = String(email || '').toLowerCase();
      const exists = current.some((e) => String(e || '').toLowerCase() === key);
      const next = exists
        ? current.filter((e) => String(e || '').toLowerCase() !== key)
        : [...current, email];
      return { ...prev, hiringManagers: next };
    });
  };

  const handleSubmit = async (e, { asDraft = false } = {}) => {
    e?.preventDefault?.();
    if (!String(formData.role || '').trim()) {
      toast.error('Job title is required');
      return;
    }
    setSaving(true);
    let locations = splitLocations(formData.locations, formData.location);
    if (!locations.length) {
      if (asDraft) {
        locations = ['TBD'];
      } else {
        setSaving(false);
        toast.error('Add at least one location');
        return;
      }
    }
    if (!asDraft && !String(formData.industry || '').trim()) {
      setSaving(false);
      toast.error('Select an industry classification (e.g., Banking, Insurance) before publishing');
      return;
    }
    const payload = {
      role: formData.role,
      title: formData.role,
      grade: formData.grade,
      clientName: formData.clientName,
      industry: formData.industry,
      locations,
      location: locations.join(', '),
      ctc: formData.ctc,
      experience: formData.experience,
      employmentType: formData.employmentType || 'full_time',
      openings: Number(formData.openings) || 1,
      priority: formData.priority === 'urgent' ? 'urgent' : 'medium',
      skills: (formData.skills || []).length ? formData.skills : parseSkills(skillsInput),
      summary: formData.summary,
      responsibilities: htmlToList(formData.responsibilitiesText),
      requirements: htmlToList(formData.requirementsText),
      preferredProfile: formData.preferredProfile,
      description: composeJobDescriptionHtml({ ...formData, locations, location: locations.join(', ') }),
      hiringManagers: formData.hiringManagers,
      status: asDraft ? 'Draft' : (formData.status || 'Open'),
      spocName: formData.spocName || '',
      spocContact: formData.spocContact || '',
      spocEmail: formData.spocEmail || '',
      internalNotes: formData.internalNotes || '',
      isTemplate: false,
      notifyEmail: !asDraft
        && formData.notifyEmail !== false
        && (!editingJob || editingJob.status === 'Draft'),
    };

    const customCode = String(formData.jobCode || '').trim();
    if (formData.customJobCode && customCode) {
      payload.jobCode = customCode;
      payload.customJobCode = true;
    } else if (editingJob && customCode && customCode !== String(editingJob.jobCode || '')) {
      payload.jobCode = customCode;
    }

    try {
      const url = editingJob ? `${API_URL}/${editingJob._id}` : API_URL;
      const method = editingJob ? 'PUT' : 'POST';
      const response = await authenticatedFetch(url, {
        method,
        body: JSON.stringify(payload),
      });
      if (isUnauthorized(response)) return handleUnauthorized();
      const saved = await response.json().catch(() => null);
      if (response.ok) {
        setShowModal(false);
        setEditingJob(null);
        setFormData(initialForm);
        setSkillsInput('');
        toast.success(
          asDraft
            ? 'Saved as draft — you can edit it anytime'
            : editingJob
              ? (payload.notifyEmail ? 'Job is live — notifying the hiring team' : 'Job updated')
              : payload.notifyEmail
                ? 'Job posted — notifying the hiring team by email'
                : 'Job created'
        );
        fetchJobs();
        const openedNow = !asDraft && String(payload.status || 'Open').toLowerCase() === 'open';
        if (openedNow) {
          ensureJobsBadge(1);
        } else {
          window.dispatchEvent(new CustomEvent('jobs:changed'));
        }
        window.dispatchEvent(new CustomEvent('notifications:refresh'));
        if (saved && saved._id && !asDraft) setViewingJob(saved);
      } else {
        toast.error(planLimitErrorMessage(saved || {}, 'jobs'));
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save job. Please try again later.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (job, status) => {
    setMenuOpenId(null);
    try {
      const res = await authenticatedFetch(`${API_URL}/${job._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status,
          notifyEmail: status === 'Open' && job.status !== 'Open',
        }),
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update status');
      }
      toast.success(
        status === 'Open' && job.status !== 'Open'
          ? 'Job is live — notifying the hiring team'
          : `Marked as ${status}`
      );
      fetchJobs();
      if (status === 'Open' && job.status !== 'Open') {
        ensureJobsBadge(1);
        window.dispatchEvent(new CustomEvent('notifications:refresh'));
      } else {
        window.dispatchEvent(new CustomEvent('jobs:changed'));
      }
    } catch (error) {
      toast.error(error.message || 'Failed to update status');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/${deleteTarget._id}`, { method: 'DELETE' });
      if (isUnauthorized(res)) return handleUnauthorized();
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to delete job');
      }
      setDeleteTarget(null);
      toast.success('Job deleted');
      fetchJobs();
    } catch (error) {
      toast.error(error.message || 'Failed to delete job');
    } finally {
      setDeleting(false);
    }
  };

  const openPostModal = (job) => {
    setMenuOpenId(null);
    setPostTarget(job);
    setPostProvider('indeed_feed');
  };

  const handlePostToJobBoard = async () => {
    if (!postTarget) return;
    setPostingJobId(postTarget._id);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}/api/job-board/jobs/${postTarget._id}/post`, {
        method: 'POST',
        body: JSON.stringify({ provider: postProvider }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to post job');
      toast.success('Job posted to job board');
      setPostTarget(null);
    } catch (error) {
      toast.error(error.message || 'Job board posting unavailable right now.');
    } finally {
      setPostingJobId(null);
    }
  };

  const handleSaveAsTemplate = async (job) => {
    setMenuOpenId(null);
    try {
      const res = await authenticatedFetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
          role: job.role || job.title,
          title: job.role || job.title,
          location: job.location || 'TBD',
          locations: job.locations || [],
          ctc: job.ctc || '',
          experience: job.experience || '',
          grade: job.grade || '',
          clientName: job.clientName || '',
          industry: job.industry || '',
          employmentType: job.employmentType || 'full_time',
          skills: job.skills || [],
          summary: job.summary || '',
          responsibilities: job.responsibilities || [],
          requirements: job.requirements || [],
          preferredProfile: job.preferredProfile || '',
          spocName: job.spocName || '',
          spocContact: job.spocContact || '',
          spocEmail: job.spocEmail || '',
          internalNotes: job.internalNotes || '',
          description: job.description || '',
          hiringManagers: [],
          status: 'Draft',
          isTemplate: true,
        }),
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to save template');
      }
      toast.success('Saved to JD Library');
    } catch (error) {
      toast.error(error.message || 'Failed to save template');
    }
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setEditingJob(null);
    setFormData(initialForm);
    setSkillsInput('');
  };

  if (user?.role === 'freelancer') {
    return <Navigate to="/mandates" replace />;
  }

  const showFreelancePanel = ['owner', 'admin', 'hr_manager', 'hr_recruiter', 'recruiter', 'sales'].includes(user?.role);

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={Briefcase}
        title={t('pages.jobs.title')}
        subtitle={t('pages.jobs.subtitle')}
        gradientTitle
      >
        <div data-tour="jobs-actions" className="flex flex-1 sm:flex-none items-center gap-2 w-full sm:w-auto">
          <button type="button" onClick={() => setShowLibrary(true)} className="btn-secondary flex-1 sm:flex-none">
            <BookOpen size={16} />
            <span className="whitespace-nowrap">JD Library</span>
          </button>
          <button type="button" onClick={openCreate} className="btn-primary flex-1 sm:flex-none">
            <Plus size={16} />
            <span className="whitespace-nowrap">Post New Job</span>
          </button>
        </div>
      </PageHeader>

      {showFreelancePanel && <FreelanceSubmissionsPanel />}

      <div className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/40 px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          <span className="font-semibold text-stone-800">Sidebar</span> badge for new openings
        </span>
        <span className="hidden sm:inline text-stone-300">·</span>
        <span className="inline-flex items-center gap-1">
          <Mail size={13} className="text-brand-600" />
          <span className="font-semibold text-stone-800">Email</span> team when you post (optional)
        </span>
        <span className="hidden sm:inline text-stone-300">·</span>
        <span className="inline-flex items-center gap-1">
          <Bell size={13} className="text-brand-600" />
          <span className="font-semibold text-stone-800">In-app</span> alerts in notification bell
        </span>
        <span className="hidden sm:inline text-stone-300">·</span>
        <span>
          <span className="font-semibold text-stone-800">Dashboard</span> shows recent openings
        </span>
      </div>

      <div data-tour="jobs-tip" className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/40 px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed">
        Search and filter openings, reuse JD templates, and manage status from each card.
        Press <span className="font-semibold text-stone-800">?</span> for a tour.
      </div>

      {/* Filters — one enterprise panel */}
      <div data-tour="jobs-filters" className="card-ats-bordered p-4 sm:p-5 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="flex items-center gap-2 mb-4">
          <span className="h-7 w-7 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 inline-flex items-center justify-center">
            <Filter size={13} strokeWidth={2} />
          </span>
          <div>
            <p className="text-xs font-bold text-stone-800">Search & filters</p>
            <p className="text-[11px] text-stone-400">Find roles by title, client, location, skills, or status</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="sm:col-span-2 lg:col-span-2 min-w-0">
            <label className="label-ats">Search</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none z-[1]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, client, location, skills…"
                className="input-ats input-ats-icon"
              />
            </div>
          </div>
          <div className="min-w-0">
            <label className="label-ats">Status</label>
            <PremiumSelect
              variant="list"
              value={statusFilter}
              onChange={setStatusFilter}
              options={FILTER_OPTIONS}
              placeholder="All statuses"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-stone-100">
          {[
            { key: 'All', label: 'All', count: counts.all },
            { key: 'Draft', label: 'Draft', count: counts.draft },
            { key: 'Open', label: 'Open', count: counts.open },
            { key: 'On Hold', label: 'On Hold', count: counts.hold },
            { key: 'Closed', label: 'Closed', count: counts.closed },
          ].map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStatusFilter(s.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                statusFilter === s.key
                  ? 'bg-brand-50 text-brand-800 border-brand-200'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300 hover:bg-stone-50'
              }`}
            >
              {s.label}
              <span className={`tabular-nums ${statusFilter === s.key ? 'text-brand-600' : 'text-stone-400'}`}>{s.count}</span>
            </button>
          ))}
          {(searchQuery || statusFilter !== 'All') && (
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setStatusFilter('All'); }}
              className="text-xs font-semibold text-stone-500 hover:text-brand-700 ml-auto"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div data-tour="jobs-list" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-ats-bordered p-6 space-y-4">
              <div className="h-10 w-10 rounded-xl skeleton-ats" />
              <div className="h-5 w-2/3 skeleton-ats rounded-lg" />
              <div className="h-4 w-full skeleton-ats rounded-lg" />
              <div className="h-4 w-4/5 skeleton-ats rounded-lg" />
              <div className="h-16 skeleton-ats rounded-xl" />
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div data-tour="jobs-list" className="card-ats-bordered">
          <EmptyState
            icon={Briefcase}
            tone="brand"
            message="No job openings yet"
            subMessage="Post your first role to start receiving applications."
            action={
              <button type="button" onClick={openCreate} className="btn-primary">
                <Plus size={16} /> Post New Job
              </button>
            }
          />
        </div>
      ) : filteredJobs.length === 0 ? (
        <div data-tour="jobs-list" className="card-ats-bordered">
          <EmptyState
            icon={Search}
            tone="amber"
            message="No matching jobs"
            subMessage="Try adjusting your search or status filter."
            action={
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setStatusFilter('All'); }}
                className="btn-secondary"
              >
                Clear filters
              </button>
            }
          />
        </div>
      ) : (
        <div data-tour="jobs-list" className="space-y-3">
          {filteredJobs.map((job) => {
            const title = job.role || job.title || 'Untitled role';
            const status = job.status || 'Open';
            return (
              <article
                key={job._id}
                className="card-ats-bordered relative overflow-visible group px-4 sm:px-5 py-3.5 sm:py-4 transition-shadow duration-200 hover:shadow-md"
              >
                <div className="absolute inset-y-0 left-0 w-1 rounded-l-2xl bg-gradient-to-b from-brand-500 via-teal-400 to-brand-600 opacity-90" />

                <div className="pl-2 sm:pl-3 flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3 min-w-0">
                    <div className="hidden sm:flex w-10 h-10 rounded-lg bg-stone-100 border border-stone-200/80 items-center justify-center flex-shrink-0">
                      <Briefcase className="w-4.5 h-4.5 text-brand-700" size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 gap-y-1.5">
                        <h3 className="text-[15px] sm:text-base font-bold text-stone-900 tracking-tight leading-snug uppercase">
                          <button
                            type="button"
                            onClick={() => openView(job)}
                            className="text-left hover:text-brand-700 hover:underline decoration-brand-200 underline-offset-2"
                          >
                            {title}
                          </button>
                        </h3>
                        {job.jobCode && (
                          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md border border-stone-200 bg-stone-50 text-stone-600 tabular-nums tracking-wide">
                            {job.jobCode}
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${STATUS_STYLES[status] || STATUS_STYLES.Open}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${DOT_STYLES[status] || DOT_STYLES.Open}`} />
                          {status}
                        </span>
                      </div>
                      {(job.clientName || job.grade) && (
                        <p className="mt-0.5 text-[12px] text-stone-500 truncate">
                          {[job.clientName, job.grade ? `Grade ${job.grade}` : ''].filter(Boolean).join(' · ')}
                        </p>
                      )}

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] sm:text-[13px] text-stone-600">
                        <span className="inline-flex items-center gap-1 min-w-0">
                          <MapPin size={13} className="text-stone-400 flex-shrink-0" />
                          <span className="truncate font-medium">{job.location || 'Location TBD'}</span>
                        </span>
                        <span className="text-stone-300 hidden sm:inline" aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 min-w-0">
                          <Building2 size={13} className="text-stone-400 flex-shrink-0" />
                          <span className="truncate">{job.experience || 'Exp TBD'}</span>
                        </span>
                        <span className="text-stone-300 hidden sm:inline" aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 min-w-0 font-semibold text-stone-800">
                          <IndianRupee size={13} className="text-stone-400 flex-shrink-0" />
                          <span className="truncate">{job.ctc || 'CTC TBD'}</span>
                        </span>
                      </div>

                      {(job.skills?.length > 0 || job.hiringManagers?.length > 0) && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          {(job.skills || []).slice(0, 5).map((skill) => (
                            <span key={skill} className="inline-flex max-w-[14rem] truncate px-2 py-0.5 rounded-md text-[10px] font-semibold bg-brand-50 text-brand-800 border border-brand-100">
                              {skill}
                            </span>
                          ))}
                          {(job.skills || []).length > 5 && (
                            <span className="text-[10px] font-semibold text-stone-500">+{job.skills.length - 5}</span>
                          )}
                          {job.hiringManagers?.length > 0 && (
                            <>
                              <span className="text-stone-300 mx-0.5" aria-hidden="true">|</span>
                              {job.hiringManagers.slice(0, 3).map((email, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                                  <UserCheck size={10} /> {String(email).split('@')[0]}
                                </span>
                              ))}
                              {job.hiringManagers.length > 3 && (
                                <span className="text-[10px] font-semibold text-stone-500">+{job.hiringManagers.length - 3}</span>
                              )}
                            </>
                          )}
                          {!job.hiringManagers?.length && (
                            <>
                              <span className="text-stone-300 mx-0.5" aria-hidden="true">|</span>
                              <span className="text-[11px] text-stone-400 italic">No managers assigned</span>
                            </>
                          )}
                        </div>
                      )}
                      {!job.skills?.length && !job.hiringManagers?.length && (
                        <p className="mt-2 text-[11px] text-stone-400 italic">No skills or managers assigned</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0 self-end sm:self-start">
                      <button
                        type="button"
                        onClick={() => openView(job)}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-colors"
                        title="View job"
                      >
                        <Eye size={14} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(job)}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-colors"
                        title="Edit job"
                      >
                        <Pencil size={14} strokeWidth={2} />
                      </button>
                      {hasJobBoard && (
                        <button
                          type="button"
                          onClick={() => openPostModal(job)}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                          title="Post to job board"
                        >
                          <Share2 size={14} strokeWidth={2} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSaveAsTemplate(job)}
                        className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-sky-300 hover:text-sky-700 hover:bg-sky-50 transition-colors"
                        title="Save as template"
                      >
                        <BookmarkPlus size={14} strokeWidth={2} />
                      </button>
                      <div className="relative">
                        <JobCardActionsMenu
                          open={menuOpenId === job._id}
                          onToggle={() => setMenuOpenId(menuOpenId === job._id ? null : job._id)}
                          job={job}
                          status={status}
                          hasJobBoard={hasJobBoard}
                          posting={postingJobId === job._id}
                          onView={() => { setMenuOpenId(null); openView(job); }}
                          onMarkOpen={() => { setMenuOpenId(null); handleStatusChange(job, 'Open'); }}
                          onHold={() => { setMenuOpenId(null); handleStatusChange(job, 'On Hold'); }}
                          onClose={() => { setMenuOpenId(null); handleStatusChange(job, 'Closed'); }}
                          onPostBoard={() => { setMenuOpenId(null); openPostModal(job); }}
                          onSaveTemplate={() => { setMenuOpenId(null); handleSaveAsTemplate(job); }}
                          onDelete={() => {
                            setMenuOpenId(null);
                            setDeleteTarget(job);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Jobs" />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={JOBS_TOUR_STEPS}
        storageKey={JOBS_TOUR_KEY}
      />

      <JDLibraryModal isOpen={showLibrary} onClose={() => setShowLibrary(false)} onSelectTemplate={handleSelectTemplate} />

      <JobFormModal
          open={showModal}
          onClose={closeModal}
          editingJob={editingJob}
          formData={formData}
          setFormData={setFormData}
          skillsInput={skillsInput}
          setSkillsInput={setSkillsInput}
          saving={saving}
          onSubmit={handleSubmit}
          toggleManager={toggleManager}
          managerOptions={managerOptions}
          loadingMembers={loadingMembers}
        />

      <JobViewModal
        open={!!viewingJob}
        job={viewingJob}
        onClose={() => setViewingJob(null)}
        onEdit={(job) => {
          setViewingJob(null);
          openEdit(job);
        }}
      />

      <Modal
        open={!!postTarget}
        onClose={() => !postingJobId && setPostTarget(null)}
        title="Post to Job Board"
        description={postTarget ? `Publish “${postTarget.role || postTarget.title}” to an external board.` : ''}
        size="sm"
        icon={Globe2}
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={!!postingJobId} onClick={() => setPostTarget(null)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={!!postingJobId} onClick={handlePostToJobBoard}>
              {postingJobId ? <Loader2 size={16} className="animate-spin" /> : <Globe2 size={16} />}
              {postingJobId ? 'Posting…' : 'Post Job'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-brand-100 bg-gradient-to-r from-brand-50/80 via-white to-teal-50/50 px-3.5 py-3 text-[13px] text-stone-600 leading-relaxed">
            Choose a provider to publish this opening. You can remove it later from the same board settings.
          </div>
          <div>
            <label className="label-ats">Provider</label>
            <PremiumSelect
              variant="list"
              value={postProvider}
              onChange={setPostProvider}
              options={JOB_BOARD_OPTIONS}
              icon={Globe2}
              placeholder="Select provider"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete job opening?"
        description={deleteTarget ? `“${deleteTarget.role || deleteTarget.title}” will be permanently removed. This cannot be undone.` : ''}
        size="sm"
        icon={Trash2}
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={deleting} onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button type="button" className="btn-danger" disabled={deleting} onClick={handleDelete}>
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {deleting ? 'Deleting…' : 'Delete Job'}
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-gradient-to-r from-red-50 to-orange-50/40 border border-red-100 text-sm text-red-700 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-red-100 text-red-600 inline-flex items-center justify-center flex-shrink-0">
            <Trash2 size={16} />
          </span>
          <p className="leading-relaxed break-words min-w-0">
            Applications linked to this role may become orphaned. Prefer closing the job if you only want to stop hiring.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default Jobs;
