import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus, MapPin, BookOpen, UserCheck, Briefcase, IndianRupee, Loader2,
  Search, Pencil, Filter, Building2, Share2, Eye, Copy, ExternalLink,
  ChevronLeft, ChevronRight, AlertTriangle, Globe2, Trash2,
} from 'lucide-react';
import JDLibraryModal from '../components/JDLibraryModal';
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
  JOBS_TOUR_KEY, JOBS_TOUR_STEPS, FILTER_OPTIONS, JOBS_PAGE_SIZE,
  JOB_BOARD_OPTIONS, STATUS_STYLES, DOT_STYLES, initialForm,
  jobFromRecord, composeJobDescriptionHtml, htmlToList, splitLocations,
} from '../components/jobs/jobsConstants';
import JobFormModal from '../components/jobs/JobFormModal';
import JobViewModal from '../components/jobs/JobViewModal';
import JobCardActionsMenu from '../components/jobs/JobCardActionsMenu';
import { ensureJobsBadge, markJobSeen } from '../hooks/useJobNavUpdates';

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
  const [postProvider, setPostProvider] = useState('linkedin');
  const [shareTarget, setShareTarget] = useState(null);
  const [sharePublishing, setSharePublishing] = useState(false);
  const [page, setPage] = useState(1);

  const orgSlug = organization?.slug || '';

  const careersApplyUrl = (job) => {
    if (!orgSlug || !job) return '';
    const key = job.publicId || job.jobCode || job._id;
    if (!key) return '';
    return `${window.location.origin}/careers/${orgSlug}/jobs/${key}`;
  };

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

  useEffect(() => {
    if (!menuOpenId) return undefined;
    const close = () => setMenuOpenId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuOpenId]);

  const userIdStr = String(userId || '');

  const isJobUnread = useCallback((job) => {
    if (!userIdStr || !job) return false;
    if (String(job.status || '') !== 'Open') return false;
    const seen = Array.isArray(job.seenBy) ? job.seenBy : [];
    return !seen.some((id) => String(id) === userIdStr);
  }, [userIdStr]);

  const markJobOpened = useCallback((job) => {
    if (!job?._id) return;
    const id = String(job._id);
    setJobs((prev) => prev.map((j) => {
      if (String(j._id) !== id) return j;
      const seen = Array.isArray(j.seenBy) ? j.seenBy : [];
      if (seen.some((s) => String(s) === userIdStr)) return j;
      return { ...j, seenBy: [...seen, userIdStr] };
    }));
    markJobSeen(id);
  }, [userIdStr]);

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
      const isUrgent = String(job.priority || '').toLowerCase() === 'urgent';
      const matchesStatus = statusFilter === 'All'
        || (statusFilter === 'Urgent' ? isUrgent : job.status === statusFilter);
      return matchesSearch && matchesStatus;
    });
  }, [jobs, searchQuery, statusFilter]);

  useEffect(() => { setPage(1); }, [searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / JOBS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageJobs = filteredJobs.slice((currentPage - 1) * JOBS_PAGE_SIZE, currentPage * JOBS_PAGE_SIZE);

  const counts = useMemo(() => ({
    all: jobs.length,
    draft: jobs.filter((j) => j.status === 'Draft').length,
    open: jobs.filter((j) => j.status === 'Open').length,
    hold: jobs.filter((j) => j.status === 'On Hold').length,
    closed: jobs.filter((j) => j.status === 'Closed').length,
    urgent: jobs.filter((j) => String(j.priority || '').toLowerCase() === 'urgent').length,
    unread: jobs.filter((j) => isJobUnread(j)).length,
  }), [jobs, isJobUnread]);

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
    markJobOpened(job);
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
            ? 'Draft saved — publish when ready so candidates can apply'
            : editingJob
              ? (payload.notifyEmail ? 'Job published — notifying the hiring team' : 'Job published to careers')
              : payload.notifyEmail
                ? 'Job published — notifying the hiring team by email'
                : 'Job published to careers'
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

  const handleToggleUrgent = async (job) => {
    setMenuOpenId(null);
    const next = String(job.priority || '').toLowerCase() === 'urgent' ? 'medium' : 'urgent';
    try {
      const res = await authenticatedFetch(`${API_URL}/${job._id}`, {
        method: 'PUT',
        body: JSON.stringify({ priority: next }),
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Could not update priority');
      }
      setJobs((prev) => prev.map((j) => (j._id === job._id ? { ...j, priority: next } : j)));
      toast.success(next === 'urgent' ? 'Marked as urgent hiring' : 'Urgent flag cleared');
    } catch (error) {
      toast.error(error.message || 'Could not update priority');
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
    setPostProvider('linkedin');
  };

  const ensureJobPublished = async (job) => {
    if (job?.isPublished && String(job?.status || '').toLowerCase() === 'open') return job;
    setSharePublishing(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/${job._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          isPublished: true,
          status: 'Open',
          publishedAt: new Date().toISOString(),
        }),
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not publish job to careers');
      const updated = { ...job, ...data, isPublished: true, status: data.status || 'Open' };
      setJobs((prev) => prev.map((j) => (j._id === job._id ? { ...j, ...updated } : j)));
      toast.success('Job published to careers page');
      return updated;
    } finally {
      setSharePublishing(false);
    }
  };

  const openShareModal = async (job) => {
    setMenuOpenId(null);
    if (!orgSlug) {
      toast.warning('Organization careers slug is missing. Set it under Organization settings.');
      return;
    }
    const status = String(job.status || '').toLowerCase();
    // Draft / On Hold / unpublished Open → publish first (enterprise: share only when live)
    if (status !== 'open' || !job.isPublished) {
      try {
        const published = await ensureJobPublished(job);
        setShareTarget(published);
        return;
      } catch (err) {
        toast.error(err.message || 'Could not publish job');
        return;
      }
    }
    setShareTarget(job);
  };

  const copyCareersLink = async (job) => {
    const url = careersApplyUrl(job);
    if (!url) {
      toast.warning('Careers link unavailable');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Careers apply link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const shareOnLinkedIn = (job) => {
    const url = careersApplyUrl(job);
    if (!url) {
      toast.warning('Careers link unavailable');
      return;
    }
    const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${url}?src=linkedin`)}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer,width=720,height=640');
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

  return (
    <div className="page-shell-ats animate-page-enter">
      {/* Header card */}
      <div data-tour="jobs-actions" className="card-ats-bordered relative overflow-hidden p-5 sm:p-6">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0 flex items-start gap-3">
            <span className="h-11 w-11 rounded-xl bg-brand-50 text-brand-700 border border-brand-100 inline-flex items-center justify-center flex-shrink-0">
              <Briefcase size={20} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">{t('pages.jobs.title')}</h1>
                {counts.unread > 0 ? (
                  <span className="inline-flex items-center rounded-md bg-rose-50 border border-rose-100 text-rose-700 px-2 py-0.5 text-[11px] font-bold tabular-nums">
                    {counts.unread} new
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-stone-500 mt-0.5 leading-relaxed">{t('pages.jobs.subtitle')}</p>
            </div>
          </div>
          <div className="flex flex-1 sm:flex-none items-center gap-2 w-full sm:w-auto">
            <button type="button" onClick={() => setShowLibrary(true)} className="btn-secondary flex-1 sm:flex-none">
              <BookOpen size={16} />
              <span className="whitespace-nowrap">JD Library</span>
            </button>
            <button type="button" onClick={openCreate} className="btn-primary flex-1 sm:flex-none">
              <Plus size={16} />
              <span className="whitespace-nowrap">Post new job</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div data-tour="jobs-filters" className="card-ats-bordered p-4 sm:p-5 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="flex items-center gap-2 mb-4">
          <span className="h-7 w-7 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 inline-flex items-center justify-center">
            <Filter size={13} strokeWidth={2} />
          </span>
          <div>
            <p className="text-xs font-bold text-stone-800">Search & filters</p>
            <p className="text-[11px] text-stone-400">Results include every page — search and filter first, then browse pages</p>
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
                placeholder="Search title, client, location, job ID, skills…"
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
            { key: 'Urgent', label: 'Urgent', count: counts.urgent },
          ].map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStatusFilter(s.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                statusFilter === s.key
                  ? s.key === 'Urgent'
                    ? 'bg-red-50 text-red-800 border-red-200'
                    : 'bg-brand-50 text-brand-800 border-brand-200'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300 hover:bg-stone-50'
              }`}
            >
              {s.key === 'Urgent' ? <AlertTriangle size={11} /> : null}
              {s.label}
              <span className={`tabular-nums ${statusFilter === s.key ? (s.key === 'Urgent' ? 'text-red-600' : 'text-brand-600') : 'text-stone-400'}`}>{s.count}</span>
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
        <div data-tour="jobs-list" className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-stone-300/90 bg-white p-5 space-y-3">
              <div className="h-5 w-2/3 skeleton-ats rounded-lg" />
              <div className="h-4 w-full skeleton-ats rounded-lg" />
              <div className="h-4 w-4/5 skeleton-ats rounded-lg" />
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div data-tour="jobs-list" className="card-ats-bordered">
          <EmptyState
            icon={Briefcase}
            tone="brand"
            message="No job openings yet"
            subMessage="Post your first requisition to start receiving applications."
            action={
              <button type="button" onClick={openCreate} className="btn-primary">
                <Plus size={16} /> Post new job
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
            subMessage="Try adjusting your search or filter. Search covers every page of results."
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
        <>
          <div data-tour="jobs-list" className="space-y-3">
            {pageJobs.map((job) => {
              const title = job.role || job.title || 'Untitled role';
              const status = job.status || 'Open';
              const urgent = String(job.priority || '').toLowerCase() === 'urgent';
              const unread = isJobUnread(job);
              return (
                <article
                  key={job._id}
                  className={[
                    'relative overflow-hidden group px-4 sm:px-5 py-3.5 sm:py-4 rounded-2xl border transition-all duration-200',
                    unread
                      ? 'border-brand-300/80 bg-brand-50/40 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_0_0_1px_rgba(13,148,136,0.08)]'
                      : 'border-stone-300/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-stone-400/90 hover:shadow-[0_8px_24px_-8px_rgba(15,23,42,0.12)]',
                  ].join(' ')}
                >
                  <div
                    className={`absolute inset-y-0 left-0 w-[3px] rounded-l-2xl ${
                      urgent
                        ? 'bg-gradient-to-b from-red-500 to-rose-400'
                        : unread
                          ? 'bg-gradient-to-b from-brand-600 to-teal-400'
                          : 'bg-gradient-to-b from-brand-500 via-teal-400 to-brand-600 opacity-80'
                    }`}
                  />

                  <div className="pl-2.5 sm:pl-3 flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3 min-w-0">
                      <div className="hidden sm:flex w-10 h-10 rounded-xl bg-stone-100 border border-stone-200/80 items-center justify-center flex-shrink-0">
                        <Briefcase className="text-brand-700" size={18} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 gap-y-1.5">
                          <h3 className={`text-[15px] sm:text-base tracking-tight leading-snug uppercase ${unread ? 'font-extrabold text-stone-950' : 'font-bold text-stone-900'}`}>
                            <button
                              type="button"
                              onClick={() => openView(job)}
                              className="text-left hover:text-brand-700 transition-colors"
                            >
                              {title}
                            </button>
                          </h3>
                          {unread ? (
                            <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-brand-600 text-white">
                              New
                            </span>
                          ) : null}
                          {urgent ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border border-red-200 bg-red-50 text-red-700">
                              <AlertTriangle size={10} /> Urgent
                            </span>
                          ) : null}
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
                          <span className="inline-flex items-center gap-1 min-w-0">
                            <Building2 size={13} className="text-stone-400 flex-shrink-0" />
                            <span className="truncate">{job.experience || 'Exp TBD'}</span>
                          </span>
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
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-start">
                        <button
                          type="button"
                          onClick={() => openView(job)}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-colors shadow-sm"
                          title="View job"
                        >
                          <Eye size={14} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(job)}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-colors shadow-sm"
                          title="Edit job"
                        >
                          <Pencil size={14} strokeWidth={2} />
                        </button>
                        {status === 'Draft' || status === 'On Hold' ? (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(job, 'Open')}
                            className="h-8 px-2.5 inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors text-[11px] font-bold uppercase tracking-wide shadow-sm"
                            title="Publish & open — live on careers"
                          >
                            Publish
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openShareModal(job)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50 transition-colors shadow-sm"
                            title="Share apply link"
                          >
                            <Share2 size={14} strokeWidth={2} />
                          </button>
                        )}
                        <JobCardActionsMenu
                          open={menuOpenId === job._id}
                          onToggle={() => setMenuOpenId(menuOpenId === job._id ? null : job._id)}
                          job={job}
                          status={status}
                          onMarkOpen={() => { setMenuOpenId(null); handleStatusChange(job, 'Open'); }}
                          onHold={() => { setMenuOpenId(null); handleStatusChange(job, 'On Hold'); }}
                          onClose={() => { setMenuOpenId(null); handleStatusChange(job, 'Closed'); }}
                          onToggleUrgent={() => handleToggleUrgent(job)}
                          onSaveTemplate={() => { setMenuOpenId(null); handleSaveAsTemplate(job); }}
                          onDelete={() => {
                            setMenuOpenId(null);
                            setDeleteTarget(job);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {totalPages > 1 ? (
            <div className="card-ats-bordered px-4 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-sm text-stone-500">
                Showing{' '}
                <span className="font-semibold text-stone-800">
                  {(currentPage - 1) * JOBS_PAGE_SIZE + 1}–{Math.min(currentPage * JOBS_PAGE_SIZE, filteredJobs.length)}
                </span>
                {' '}of <span className="font-semibold text-stone-800">{filteredJobs.length}</span>
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-9 px-3 inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronLeft size={16} /> Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1)
                  .reduce((acc, n, idx, arr) => {
                    if (idx > 0 && n - arr[idx - 1] > 1) acc.push('…');
                    acc.push(n);
                    return acc;
                  }, [])
                  .map((n, idx) => (
                    n === '…' ? (
                      <span key={`e-${idx}`} className="px-1 text-stone-400 text-sm">…</span>
                    ) : (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setPage(n)}
                        className={`h-9 min-w-[2.25rem] px-2 rounded-xl text-sm font-bold border transition ${
                          n === currentPage ? 'bg-brand-600 text-white border-transparent shadow-sm' : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        {n}
                      </button>
                    )
                  ))}
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-9 px-3 inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ) : null}
        </>
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
          draftStorageKey={`pch_job_draft_${orgId || 'org'}_${userId || 'user'}_${editingJob?._id || 'new'}`}
        />

      <JobViewModal
        open={!!viewingJob}
        job={viewingJob}
        allowCopyJobId
        onCopiedJobId={(code) => toast.success(`Job ID copied · ${code}`)}
        onClose={() => setViewingJob(null)}
        onEdit={(job) => {
          setViewingJob(null);
          openEdit(job);
        }}
      />

      <Modal
        open={!!shareTarget}
        onClose={() => !sharePublishing && setShareTarget(null)}
        title="Share & apply link"
        description={shareTarget ? `Let candidates apply to “${shareTarget.role || shareTarget.title}” themselves.` : ''}
        size="md"
        icon={Share2}
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={sharePublishing} onClick={() => setShareTarget(null)}>
              Close
            </button>
            {shareTarget && !shareTarget.isPublished ? (
              <button
                type="button"
                className="btn-primary"
                disabled={sharePublishing}
                onClick={async () => {
                  try {
                    const published = await ensureJobPublished(shareTarget);
                    setShareTarget(published);
                  } catch (err) {
                    toast.error(err.message || 'Could not publish job');
                  }
                }}
              >
                {sharePublishing ? <Loader2 size={16} className="animate-spin" /> : null}
                {sharePublishing ? 'Publishing…' : 'Publish to careers'}
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                disabled={!orgSlug || !shareTarget?.isPublished}
                onClick={() => shareOnLinkedIn(shareTarget)}
              >
                <ExternalLink size={15} /> Share on LinkedIn
              </button>
            )}
          </>
        }
      >
        {shareTarget ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-stone-200 bg-stone-50/80 px-3.5 py-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Apply link</p>
                {shareTarget.isPublished ? (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-1.5 py-0.5">Live</span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-1.5 py-0.5">Not live</span>
                )}
              </div>
              <p className="text-sm font-medium text-stone-800 break-all leading-relaxed">
                {careersApplyUrl(shareTarget) || 'Careers slug unavailable'}
              </p>
              {!shareTarget.isPublished ? (
                <p className="text-xs text-amber-700 mt-2">
                  Publish this job to careers so candidates can open the apply page.
                </p>
              ) : null}
              {!orgSlug ? (
                <p className="text-xs text-rose-600 mt-2">Organization careers slug is missing.</p>
              ) : null}
            </div>
            <button
              type="button"
              className="btn-secondary w-full justify-center"
              disabled={!orgSlug || sharePublishing}
              onClick={() => copyCareersLink(shareTarget)}
            >
              <Copy size={15} /> Copy apply link
            </button>
            {hasJobBoard ? (
              <button
                type="button"
                className="w-full text-left rounded-xl border border-teal-100 bg-teal-50/50 px-3.5 py-3 text-sm text-teal-900 hover:bg-teal-50 transition"
                onClick={() => {
                  setShareTarget(null);
                  openPostModal(shareTarget);
                }}
              >
                <span className="font-semibold">Post via LinkedIn Jobs API</span>
                <span className="block text-xs text-teal-800/80 mt-0.5">Optional — requires LinkedIn credentials under Integrations.</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </Modal>

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
            Choose a provider to publish this opening. Applicants are directed to your public careers apply page.
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
