import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus, BookOpen, Briefcase, Loader2, Search, Share2, Copy, ExternalLink,
  ChevronLeft, ChevronRight, AlertTriangle, Globe2, Trash2, Pin,
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
import { buildAtsHref } from '../utils/atsLinks';
import {
  JOBS_TOUR_KEY, JOBS_TOUR_STEPS, JOBS_PAGE_SIZE,
  JOB_BOARD_OPTIONS, initialForm,
  jobFromRecord, composeJobDescriptionHtml, htmlToList, splitLocations,
} from '../components/jobs/jobsConstants';
import JobFormModal from '../components/jobs/JobFormModal';
import JobViewModal from '../components/jobs/JobViewModal';
import JobListCard from '../components/jobs/JobListCard';
import { ensureJobsBadge, markJobSeen } from '../hooks/useJobNavUpdates';
import { careersApplyUrl as buildCareersApplyUrl } from '../utils/careersApplyUrl';

const Jobs = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
  const [talentFirst, setTalentFirst] = useState(false);
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

  const careersApplyUrl = (job) => buildCareersApplyUrl(job, orgSlug);

  const managerOptions = useMemo(
    () => teamMembers.map((m) => ({
      email: m.email,
      name: m.name || m.email?.split('@')[0] || 'Member',
      role: m.role || '',
    })),
    [teamMembers],
  );

  const fetchJobs = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
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
      if (!silent) {
        setJobs([]);
        toast.error('Jobs are unavailable right now. Retry when the API is back.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [API_URL, toast]);

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

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      fetchJobs({ silent: true }).catch(() => {});
    };
    const id = window.setInterval(tick, 30_000);
    const onFocus = () => tick();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [fetchJobs]);

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
    const rows = jobs.filter((job) => {
      const title = (job.role || job.title || '').toLowerCase();
      const loc = (job.location || '').toLowerCase();
      const matchesSearch = !q || title.includes(q) || loc.includes(q) ||
        String(job.jobCode || '').toLowerCase().includes(q) ||
        String(job.clientName || '').toLowerCase().includes(q) ||
        String(job.industry || '').toLowerCase().includes(q) ||
        String(job.grade || '').toLowerCase().includes(q) ||
        (job.skills || []).some((s) => String(s).toLowerCase().includes(q));
      const isUrgent = String(job.priority || '').toLowerCase() === 'urgent';
      const isPinned = Boolean(job.pinned);
      const matchesStatus = statusFilter === 'All'
        || (statusFilter === 'Urgent' ? isUrgent : statusFilter === 'Pinned' ? isPinned : job.status === statusFilter);
      return matchesSearch && matchesStatus;
    });
    return [...rows].sort((a, b) => {
      const ap = a.pinned ? 1 : 0;
      const bp = b.pinned ? 1 : 0;
      if (ap !== bp) return bp - ap;
      const at = new Date(a.pinnedAt || 0).getTime();
      const bt = new Date(b.pinnedAt || 0).getTime();
      if (ap && at !== bt) return bt - at;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
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
    pinned: jobs.filter((j) => Boolean(j.pinned)).length,
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
    setTalentFirst(false);
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
    const requiredJobCode = String(formData.jobCode || '').trim();
    if (!requiredJobCode) {
      toast.error('Job ID is required');
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
      department: formData.department || '',
      reportingTo: formData.reportingTo || '',
      languages: formData.languages || '',
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
      kpis: formData.kpisText || '',
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

    payload.jobCode = requiredJobCode;
    payload.customJobCode = true;

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
        if (saved && saved._id && !asDraft) {
          setTalentFirst(!editingJob);
          setViewingJob(saved);
        }
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

  const handleTogglePin = async (job) => {
    setMenuOpenId(null);
    const next = !job.pinned;
    try {
      const res = await authenticatedFetch(`${API_URL}/${job._id}`, {
        method: 'PUT',
        body: JSON.stringify({ pinned: next }),
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Could not update pin');
      }
      setJobs((prev) => prev.map((j) => (
        j._id === job._id ? { ...j, pinned: next, pinnedAt: next ? new Date().toISOString() : null } : j
      )));
      toast.success(next ? 'Job pinned to the top' : 'Job unpinned');
    } catch (error) {
      toast.error(error.message || 'Could not update pin');
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
          kpis: job.kpis || '',
          department: job.department || '',
          reportingTo: job.reportingTo || '',
          languages: job.languages || '',
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

      <div
        data-tour="jobs-filters"
        className="rounded-2xl border border-stone-200/90 bg-white shadow-[var(--shadow-card)] overflow-hidden"
      >
        <div className="px-4 sm:px-5 py-4 border-b border-stone-100 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-600 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find by job ID, title, client, location, or skills"
              className="input-ats input-ats-icon !pr-9 !h-10 rounded-xl w-full"
              aria-label="Find job"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="inline-flex flex-wrap rounded-xl border border-stone-200 bg-stone-50/80 p-1 gap-0.5">
              {[
                { key: 'All', label: 'All', count: counts.all },
                { key: 'Pinned', label: 'Pinned', count: counts.pinned },
                { key: 'Draft', label: 'Draft', count: counts.draft },
                { key: 'Open', label: 'Open', count: counts.open },
                { key: 'On Hold', label: 'On Hold', count: counts.hold },
                { key: 'Closed', label: 'Closed', count: counts.closed },
                { key: 'Urgent', label: 'Urgent', count: counts.urgent },
              ].map((s) => {
                const active = statusFilter === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStatusFilter(s.key)}
                    className={`h-8 px-3 text-[12px] font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors ${
                      active
                        ? s.key === 'Urgent'
                          ? 'bg-red-600 text-white shadow-sm shadow-red-600/25'
                          : s.key === 'Pinned'
                            ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/25'
                            : 'bg-brand-600 text-white shadow-sm shadow-brand-600/20'
                        : s.key === 'Urgent'
                          ? 'text-red-700 hover:bg-red-50 hover:text-red-800'
                          : s.key === 'Pinned'
                            ? 'text-amber-700 hover:bg-amber-50 hover:text-amber-800'
                            : 'text-stone-600 hover:bg-white hover:text-stone-900'
                    }`}
                  >
                    {s.key === 'Urgent' ? <AlertTriangle size={13} strokeWidth={2.25} /> : null}
                    {s.key === 'Pinned' ? <Pin size={13} strokeWidth={2.25} /> : null}
                    {s.label}
                    <span className={active ? 'text-white/80' : s.key === 'Urgent' ? 'text-red-400' : s.key === 'Pinned' ? 'text-amber-500' : 'text-stone-400'}>{s.count}</span>
                  </button>
                );
              })}
            </div>
            {(searchQuery || statusFilter !== 'All') ? (
              <button type="button" onClick={() => { setSearchQuery(''); setStatusFilter('All'); }} className="text-[12px] font-semibold text-brand-700 hover:text-brand-800">
                Reset
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div data-tour="jobs-list" className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-48 rounded-xl border border-stone-200 skeleton-ats" />)}
          </div>
        ) : jobs.length === 0 ? (
          <div data-tour="jobs-list">
            <EmptyState
              icon={Briefcase}
              tone="brand"
              message="No job openings yet"
              subMessage="Post your first requisition to start receiving applications."
              action={(
                <button type="button" onClick={openCreate} className="btn-primary">
                  <Plus size={16} /> Post new job
                </button>
              )}
            />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div data-tour="jobs-list">
            <EmptyState
              icon={Search}
              tone="amber"
              message="No matching jobs"
              subMessage="Change status or search terms. Search covers every page of results."
              action={(
                <button type="button" className="btn-secondary" onClick={() => { setSearchQuery(''); setStatusFilter('All'); }}>
                  Reset criteria
                </button>
              )}
            />
          </div>
        ) : (
          <>
            <div data-tour="jobs-list" className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
              {pageJobs.map((job) => (
                <JobListCard
                  key={job._id}
                  job={job}
                  unread={isJobUnread(job)}
                  menuOpen={menuOpenId === job._id}
                  onToggleMenu={() => setMenuOpenId(menuOpenId === job._id ? null : job._id)}
                  onView={openView}
                  onEdit={openEdit}
                  onPublish={(j) => handleStatusChange(j, 'Open')}
                  onShare={openShareModal}
                  onOpenApplicants={(j, kind) => navigate(buildAtsHref({
                    jobId: j.jobCode || j._id,
                    appSource: kind === 'added' ? 'added' : kind === 'duplicates' ? 'duplicates' : undefined,
                  }))}
                  onMarkOpen={() => { setMenuOpenId(null); handleStatusChange(job, 'Open'); }}
                  onHold={() => { setMenuOpenId(null); handleStatusChange(job, 'On Hold'); }}
                  onClose={() => { setMenuOpenId(null); handleStatusChange(job, 'Closed'); }}
                  onToggleUrgent={() => handleToggleUrgent(job)}
                  onTogglePin={() => handleTogglePin(job)}
                  onSaveTemplate={() => { setMenuOpenId(null); handleSaveAsTemplate(job); }}
                  onDelete={() => {
                    setMenuOpenId(null);
                    setDeleteTarget(job);
                  }}
                  onCopiedJobId={(code) => toast.success(`Job ID copied · ${code}`)}
                />
              ))}
            </div>
            <div className="px-3 py-2 border-t border-stone-200 bg-stone-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-[12px] text-stone-500">
                {pageJobs.length > 0 ? (currentPage - 1) * JOBS_PAGE_SIZE + 1 : 0}–{(currentPage - 1) * JOBS_PAGE_SIZE + pageJobs.length}
                {' of '}
                {filteredJobs.length.toLocaleString()} jobs
                <span className="text-stone-400"> · {JOBS_PAGE_SIZE} per page</span>
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="h-8 px-2.5 border border-stone-300 bg-white text-[12px] font-semibold text-stone-700 disabled:opacity-40 inline-flex items-center gap-1"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="h-8 px-2.5 border border-stone-300 bg-white text-[12px] font-semibold text-stone-700 disabled:opacity-40 inline-flex items-center gap-1"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

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
        startOnTalent={talentFirst}
        allowCopyJobId
        onCopiedJobId={(code) => toast.success(`Job ID copied · ${code}`)}
        onClose={() => { setViewingJob(null); setTalentFirst(false); }}
        onViewPipeline={(job, kind) => {
          setViewingJob(null);
          if (job?.jobCode || job?._id) {
            navigate(buildAtsHref({
              jobId: job.jobCode || job._id,
              appSource: kind === 'added' ? 'added' : kind === 'duplicates' ? 'duplicates' : undefined,
            }));
          }
        }}
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
