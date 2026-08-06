import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, MapPin, BookOpen, UserCheck, Briefcase, IndianRupee, Globe2, Loader2,
  Search, Pencil, Trash2, PauseCircle, Lock, Unlock, Filter, Building2,
  BookmarkPlus, Check, Share2, MoreHorizontal,
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
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import {
  JOBS_TOUR_KEY, JOBS_TOUR_STEPS, STATUS_OPTIONS, FILTER_OPTIONS,
  JOB_BOARD_OPTIONS, STATUS_STYLES, DOT_STYLES, FALLBACK_MANAGERS, initialForm,
} from '../components/jobs/jobsConstants';
import JobFormModal from '../components/jobs/JobFormModal';

const Jobs = () => {
  const API_URL = `${BASE_API_URL}/jobs`;
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(JOBS_TOUR_KEY);
  const { organization } = useAuth();
  const hasJobBoard = planHasFeature(organization?.plan, 'integrations.jobBoard');

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [postingJobId, setPostingJobId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
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

  const managerOptions = useMemo(() => {
    if (teamMembers.length > 0) {
      return teamMembers.map((m) => ({
        email: m.email,
        name: m.name || m.email?.split('@')[0] || 'Member',
      }));
    }
    return FALLBACK_MANAGERS;
  }, [teamMembers]);

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

  const fetchTeamMembers = async () => {
    if (teamMembers.length > 0) return;
    setLoadingMembers(true);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}/api/team`);
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (data.success) setTeamMembers(data.members || []);
    } catch {
      /* keep fallback managers */
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

  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return jobs.filter((job) => {
      const title = (job.role || job.title || '').toLowerCase();
      const loc = (job.location || '').toLowerCase();
      const matchesSearch = !q || title.includes(q) || loc.includes(q) ||
        (job.skills || []).some((s) => String(s).toLowerCase().includes(q));
      const matchesStatus = statusFilter === 'All' || job.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [jobs, searchQuery, statusFilter]);

  const counts = useMemo(() => ({
    all: jobs.length,
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

  const openEdit = (job) => {
    setEditingJob(job);
    setFormData({
      role: job.role || job.title || '',
      location: job.location || '',
      ctc: job.ctc || '',
      experience: job.experience || '',
      skills: job.skills || [],
      description: job.description || '',
      hiringManagers: job.hiringManagers || [],
      status: job.status || 'Open',
    });
    setSkillsInput((job.skills || []).join(', '));
    setMenuOpenId(null);
    setShowModal(true);
    fetchTeamMembers();
  };

  const handleSelectTemplate = (template) => {
    setEditingJob(null);
    setFormData({
      ...initialForm,
      role: template.role,
      experience: template.experience || '',
      location: template.location || '',
      ctc: template.ctc || '',
      skills: template.skills || [],
      description: template.description || '',
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
      const next = prev.hiringManagers.includes(email)
        ? prev.hiringManagers.filter((e) => e !== email)
        : [...prev.hiringManagers, email];
      return { ...prev, hiringManagers: next };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...formData,
      skills: parseSkills(skillsInput),
      title: formData.role,
      isTemplate: false,
    };

    try {
      const url = editingJob ? `${API_URL}/${editingJob._id}` : API_URL;
      const method = editingJob ? 'PUT' : 'POST';
      const response = await authenticatedFetch(url, {
        method,
        body: JSON.stringify(payload),
      });
      if (isUnauthorized(response)) return handleUnauthorized();
      if (response.ok) {
        setShowModal(false);
        setEditingJob(null);
        setFormData(initialForm);
        setSkillsInput('');
        toast.success(editingJob ? 'Job updated' : 'Job created');
        fetchJobs();
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.message || 'Failed to save job');
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
        body: JSON.stringify({ status }),
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update status');
      }
      toast.success(`Marked as ${status}`);
      fetchJobs();
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
          ctc: job.ctc || '',
          experience: job.experience || '',
          skills: job.skills || [],
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

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={Briefcase}
        title="Job Openings"
        subtitle="Create and manage open roles for your hiring pipeline."
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
            <p className="text-[11px] text-stone-400">Find roles by name, location, skills, or status</p>
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
                placeholder="Search roles, location, skills…"
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
        <div data-tour="jobs-list" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {filteredJobs.map((job) => {
            const title = job.role || job.title || 'Untitled role';
            const status = job.status || 'Open';
            return (
              <article
                key={job._id}
                className="card-ats-bordered p-5 sm:p-6 relative overflow-visible group flex flex-col transition-shadow duration-300 hover:shadow-md"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 rounded-t-2xl" />

                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 border border-brand-200/70 flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0">
                    <Briefcase className="w-5 h-5 text-brand-600" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${STATUS_STYLES[status] || STATUS_STYLES.Open}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${DOT_STYLES[status] || DOT_STYLES.Open}`} />
                      {status}
                    </span>
                    <div className="relative">
                      <button
                        type="button"
                        aria-label="More job actions"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === job._id ? null : job._id);
                        }}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 shadow-sm hover:bg-stone-50 hover:border-stone-300 transition-all"
                      >
                        <MoreHorizontal size={15} strokeWidth={2} />
                      </button>
                      {menuOpenId === job._id && (
                        <div
                          className="absolute right-0 top-full mt-1 z-20 w-52 rounded-xl border border-stone-200 bg-white shadow-xl py-1.5 animate-fade-in"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {status !== 'Open' && (
                            <button type="button" onClick={() => handleStatusChange(job, 'Open')} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-stone-700 hover:bg-stone-50">
                              <Unlock size={14} className="text-emerald-500" /> Mark Open
                            </button>
                          )}
                          {status !== 'On Hold' && status !== 'Closed' && (
                            <button type="button" onClick={() => handleStatusChange(job, 'On Hold')} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-stone-700 hover:bg-stone-50">
                              <PauseCircle size={14} className="text-amber-500" /> Put On Hold
                            </button>
                          )}
                          {status !== 'Closed' && (
                            <button type="button" onClick={() => handleStatusChange(job, 'Closed')} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-stone-700 hover:bg-stone-50">
                              <Lock size={14} className="text-stone-400" /> Close job
                            </button>
                          )}
                          {hasJobBoard && (
                            <button
                              type="button"
                              onClick={() => openPostModal(job)}
                              disabled={postingJobId === job._id}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                            >
                              {postingJobId === job._id ? <Loader2 size={14} className="animate-spin" /> : <Globe2 size={14} className="text-brand-500" />}
                              Post to Job Board
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleSaveAsTemplate(job)}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-stone-700 hover:bg-stone-50"
                          >
                            <BookmarkPlus size={14} className="text-brand-500" /> Save as Template
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-stone-900 mb-3 tracking-tight leading-snug line-clamp-2">
                  {title}
                </h3>

                <div className="space-y-2 text-sm text-stone-500 flex-1">
                  <p className="flex items-center gap-2 min-w-0">
                    <MapPin size={15} className="text-stone-400 flex-shrink-0" />
                    <span className="truncate">{job.location || 'Location TBD'}</span>
                  </p>
                  <p className="flex items-center gap-2 min-w-0">
                    <Building2 size={15} className="text-stone-400 flex-shrink-0" />
                    <span className="truncate">{job.experience || 'Exp not specified'}</span>
                  </p>
                  <p className="flex items-center gap-2 font-semibold text-stone-800 min-w-0">
                    <IndianRupee size={15} className="text-stone-400 flex-shrink-0" />
                    <span className="truncate">{job.ctc || 'As per industry'}</span>
                  </p>
                </div>

                {job.skills?.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {job.skills.slice(0, 4).map((skill) => (
                      <span key={skill} className="badge-brand !py-0.5 !text-[10px] whitespace-nowrap">{skill}</span>
                    ))}
                    {job.skills.length > 4 && (
                      <span className="badge-neutral !py-0.5 !text-[10px]">+{job.skills.length - 4}</span>
                    )}
                  </div>
                )}

                <div className="mt-5 pt-4 border-t border-stone-100">
                  <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-2">Assigned Managers</p>
                  <div className="flex flex-wrap gap-1.5">
                    {job.hiringManagers?.length > 0 ? (
                      job.hiringManagers.map((email, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-brand-50 text-brand-700 border border-brand-100 whitespace-nowrap">
                          <UserCheck size={11} /> {String(email).split('@')[0]}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs italic text-stone-400">No managers assigned</span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEdit(job)}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-brand-100 bg-brand-50/80 text-brand-700 shadow-sm hover:bg-brand-100 hover:border-brand-200 transition-all"
                    title="Edit job"
                  >
                    <Pencil size={15} strokeWidth={2} />
                  </button>
                  {hasJobBoard && (
                    <button
                      type="button"
                      onClick={() => openPostModal(job)}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-teal-100 bg-teal-50/80 text-teal-700 shadow-sm hover:bg-teal-100 hover:border-teal-200 transition-all"
                      title="Post to job board"
                    >
                      <Share2 size={15} strokeWidth={2} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSaveAsTemplate(job)}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-sky-100 bg-sky-50/80 text-sky-700 shadow-sm hover:bg-sky-100 hover:border-sky-200 transition-all"
                    title="Save as template"
                  >
                    <BookmarkPlus size={15} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(job)}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-red-100 bg-red-50/70 text-red-600 shadow-sm hover:bg-red-100 hover:border-red-200 transition-all ml-auto"
                    title="Delete job"
                  >
                    <Trash2 size={15} strokeWidth={2} />
                  </button>
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

      <Modal
        open={!!postTarget}
        onClose={() => !postingJobId && setPostTarget(null)}
        title="Post to Job Board"
        description={postTarget ? `Publish “${postTarget.role || postTarget.title}” to an external board.` : ''}
        size="sm"
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
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete job opening?"
        description={deleteTarget ? `“${deleteTarget.role || deleteTarget.title}” will be permanently removed. This cannot be undone.` : ''}
        size="sm"
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
        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
          <Trash2 size={18} className="flex-shrink-0 mt-0.5" />
          <p>Applications linked to this role may become orphaned. Prefer closing the job if you only want to stop hiring.</p>
        </div>
      </Modal>
    </div>
  );
};

export default Jobs;
