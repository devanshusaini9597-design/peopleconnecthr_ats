import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, MapPin, BookOpen, UserCheck, Briefcase, IndianRupee, Globe2, Loader2,
  Search, Pencil, Trash2, MoreHorizontal, X, Check, PauseCircle, Lock, Unlock,
  Filter, Building2, BookmarkPlus
} from 'lucide-react';
import JDLibraryModal from '../components/JDLibraryModal';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import BASE_API_URL from '../config';
import { useAuth } from '../context/AuthContext';
import { planHasFeature } from '../config/planFeatures';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';

const STATUS_OPTIONS = ['Open', 'On Hold', 'Closed', 'Draft'];
const STATUS_STYLES = {
  Open: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'On Hold': 'bg-amber-50 text-amber-700 border-amber-200',
  Closed: 'bg-stone-100 text-stone-600 border-stone-200',
  Draft: 'bg-sky-50 text-sky-700 border-sky-200',
  Cancelled: 'bg-red-50 text-red-700 border-red-200',
};
const DOT_STYLES = {
  Open: 'bg-emerald-500',
  'On Hold': 'bg-amber-500',
  Closed: 'bg-stone-400',
  Draft: 'bg-sky-500',
  Cancelled: 'bg-red-500',
};

const managersList = ['hr@company.com', 'tech.lead@company.com', 'cto@company.com', 'product.mgr@company.com'];

const initialForm = {
  role: '',
  location: '',
  ctc: '',
  experience: '',
  skills: [],
  description: '',
  hiringManagers: [],
  status: 'Open',
};

const Jobs = () => {
  const API_URL = `${BASE_API_URL}/jobs`;
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
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2800);
  };

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`${API_URL}?isTemplate=false`);
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (Array.isArray(data)) setJobs(data);
      else if (Array.isArray(data?.data)) setJobs(data.data);
      else setJobs([]);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setJobs([]);
      showToast('Failed to load jobs', 'error');
    } finally {
      setLoading(false);
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
  };

  const parseSkills = (raw) =>
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

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
        showToast(editingJob ? 'Job updated' : 'Job created');
        fetchJobs();
      } else {
        const err = await response.json().catch(() => ({}));
        showToast(err.message || 'Failed to save job', 'error');
      }
    } catch (error) {
      console.error('Save error:', error);
      showToast('Failed to save job', 'error');
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
      showToast(`Marked as ${status}`);
      fetchJobs();
    } catch (error) {
      showToast(error.message || 'Failed to update status', 'error');
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
      showToast('Job deleted');
      fetchJobs();
    } catch (error) {
      showToast(error.message || 'Failed to delete job', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handlePostToJobBoard = async (job) => {
    const provider = window.prompt('Post to which job board provider? (indeed_feed / webhook)', 'indeed_feed');
    if (!provider) return;
    setPostingJobId(job._id);
    setMenuOpenId(null);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}/api/job-board/jobs/${job._id}/post`, {
        method: 'POST',
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to post job');
      showToast('Job posted to job board');
    } catch (error) {
      showToast(error.message || 'Failed to post job', 'error');
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
      showToast('Saved to JD Library');
    } catch (error) {
      showToast(error.message || 'Failed to save template', 'error');
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
    <div className="page-shell-ats animate-fade-in">
      <PageHeader
        icon={Briefcase}
        title="Job Openings"
        subtitle="Create and manage open roles for your hiring pipeline."
        gradientTitle
      >
        <button type="button" onClick={() => setShowLibrary(true)} className="btn-secondary flex-1 sm:flex-none">
          <BookOpen size={16} />
          <span className="whitespace-nowrap">JD Library</span>
        </button>
        <button type="button" onClick={openCreate} className="btn-primary flex-1 sm:flex-none">
          <Plus size={16} />
          <span className="whitespace-nowrap">Post New Job</span>
        </button>
      </PageHeader>

      {/* Toolbar */}
      <div className="toolbar-ats flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 min-w-0 max-w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search roles, location, skills…"
            className="input-ats !pl-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 px-1">
            <Filter size={14} /> Filter
          </div>
          {['All', 'Open', 'On Hold', 'Closed'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                statusFilter === s
                  ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/20'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-brand-300 hover:bg-brand-50/50'
              }`}
            >
              {s}
              {s === 'All' && <span className="ml-1 opacity-70">{counts.all}</span>}
              {s === 'Open' && <span className="ml-1 opacity-70">{counts.open}</span>}
              {s === 'On Hold' && <span className="ml-1 opacity-70">{counts.hold}</span>}
              {s === 'Closed' && <span className="ml-1 opacity-70">{counts.closed}</span>}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
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
        <div className="card-ats-bordered">
          <EmptyState
            icon={Briefcase}
            tone="violet"
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
        <div className="card-ats-bordered">
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {filteredJobs.map((job) => {
            const title = job.role || job.title || 'Untitled role';
            const status = job.status || 'Open';
            return (
              <article
                key={job._id}
                className="card-ats p-5 sm:p-6 relative overflow-visible group flex flex-col"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-2xl" />

                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 border border-brand-200/70 flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0">
                    <Briefcase className="w-5 h-5 text-brand-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${STATUS_STYLES[status] || STATUS_STYLES.Open}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${DOT_STYLES[status] || DOT_STYLES.Open}`} />
                      {status}
                    </span>
                    <div className="relative">
                      <button
                        type="button"
                        aria-label="Job actions"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === job._id ? null : job._id);
                        }}
                        className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      {menuOpenId === job._id && (
                        <div
                          className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl border border-stone-200 bg-white shadow-xl py-1.5 animate-fade-in"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button type="button" onClick={() => openEdit(job)} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50">
                            <Pencil size={14} className="text-stone-400" /> Edit job
                          </button>
                          {status !== 'Open' && (
                            <button type="button" onClick={() => handleStatusChange(job, 'Open')} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50">
                              <Unlock size={14} className="text-emerald-500" /> Mark Open
                            </button>
                          )}
                          {status !== 'On Hold' && status !== 'Closed' && (
                            <button type="button" onClick={() => handleStatusChange(job, 'On Hold')} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50">
                              <PauseCircle size={14} className="text-amber-500" /> Put On Hold
                            </button>
                          )}
                          {status !== 'Closed' && (
                            <button type="button" onClick={() => handleStatusChange(job, 'Closed')} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50">
                              <Lock size={14} className="text-stone-400" /> Close job
                            </button>
                          )}
                          {hasJobBoard && (
                            <button
                              type="button"
                              onClick={() => handlePostToJobBoard(job)}
                              disabled={postingJobId === job._id}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                            >
                              {postingJobId === job._id ? <Loader2 size={14} className="animate-spin" /> : <Globe2 size={14} className="text-brand-500" />}
                              Post to Job Board
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleSaveAsTemplate(job)}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
                          >
                            <BookmarkPlus size={14} className="text-brand-500" /> Save as Template
                          </button>
                          <div className="my-1 border-t border-stone-100" />
                          <button
                            type="button"
                            onClick={() => { setMenuOpenId(null); setDeleteTarget(job); }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={14} /> Delete
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
                      <span key={skill} className="badge-brand !py-0.5 !text-[10px]">{skill}</span>
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
                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-brand-50 text-brand-700 border border-brand-100">
                          <UserCheck size={11} /> {String(email).split('@')[0]}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs italic text-stone-400">No managers assigned</span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-100 flex gap-2">
                  <button type="button" onClick={() => openEdit(job)} className="btn-secondary flex-1 !py-2 !text-xs">
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(job)}
                    className="btn-ghost !py-2 !px-3 !text-xs text-red-600 hover:!bg-red-50 hover:!text-red-700"
                    aria-label="Delete job"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <JDLibraryModal isOpen={showLibrary} onClose={() => setShowLibrary(false)} onSelectTemplate={handleSelectTemplate} />

      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingJob ? 'Edit Job Requisition' : 'Create New Job Requisition'}
        description={editingJob ? 'Update role details and hiring assignments.' : 'Fill in the role details and assign hiring managers.'}
        size="lg"
        footer={
          <>
            <button type="button" onClick={closeModal} className="btn-secondary" disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="job-form" className="btn-primary" disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : editingJob ? <Check size={16} /> : <Plus size={16} />}
              {saving ? 'Saving…' : editingJob ? 'Save Changes' : 'Create & Post Job'}
            </button>
          </>
        }
      >
        <form id="job-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label-ats">Job Role *</label>
              <input
                type="text"
                required
                placeholder="e.g. Senior Frontend Developer"
                className="input-ats"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              />
            </div>
            <div>
              <label className="label-ats">Location *</label>
              <input
                type="text"
                required
                placeholder="e.g. Pune / Remote"
                className="input-ats"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            <div>
              <label className="label-ats">Experience Required</label>
              <input
                type="text"
                placeholder="e.g. 3-5 Years"
                className="input-ats"
                value={formData.experience}
                onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
              />
            </div>
            <div>
              <label className="label-ats">CTC / Salary Range</label>
              <input
                type="text"
                placeholder="e.g. 12 - 15 LPA"
                className="input-ats"
                value={formData.ctc}
                onChange={(e) => setFormData({ ...formData, ctc: e.target.value })}
              />
            </div>
            <div>
              <label className="label-ats">Status</label>
              <select
                className="select-ats"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label-ats">Skills (comma separated)</label>
              <input
                type="text"
                placeholder="e.g. React, Node.js, TypeScript"
                className="input-ats"
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label-ats">Assign Hiring Managers</label>
              <select
                multiple
                className="input-ats h-28"
                value={formData.hiringManagers}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, (option) => option.value);
                  setFormData({ ...formData, hiringManagers: values });
                }}
              >
                {managersList.map((email) => (
                  <option key={email} value={email} className="p-2">{email}</option>
                ))}
              </select>
              <p className="text-[11px] mt-1.5 text-stone-400">Hold Ctrl (Win) or Cmd (Mac) to select multiple.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="label-ats">Job Description</label>
              <textarea
                placeholder="Paste detailed JD here…"
                className="textarea-ats h-32"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
        </form>
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

      {toast && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[100] animate-slide-up flex justify-end">
          <div className={`px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 text-sm font-medium max-w-sm ${
            toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-stone-900 text-white'
          }`}>
            {toast.type === 'error' ? <X size={16} /> : <Check size={16} className="text-emerald-400" />}
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
};

export default Jobs;
