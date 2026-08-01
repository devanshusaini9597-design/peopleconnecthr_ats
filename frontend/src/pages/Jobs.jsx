import React, { useState, useEffect } from 'react';
import { Plus, MapPin, BookOpen, UserCheck, Briefcase, IndianRupee, Globe2, Loader2 } from 'lucide-react';
import JDLibraryModal from '../components/JDLibraryModal';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import BASE_API_URL from '../config';
import { useAuth } from '../context/AuthContext';
import { planHasFeature } from '../config/planFeatures';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';

const Jobs = () => {
  const API_URL = `${BASE_API_URL}/jobs`;
  const { organization } = useAuth();
  const hasJobBoard = planHasFeature(organization?.plan, 'integrations.jobBoard');
  const [postingJobId, setPostingJobId] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  const initialForm = {
    role: '',
    location: '',
    ctc: '',
    experience: '',
    skills: [],
    description: '',
    hiringManagers: [],
    status: 'Open'
  };

  const [formData, setFormData] = useState(initialForm);
  const managersList = ['hr@company.com', 'tech.lead@company.com', 'cto@company.com', 'product.mgr@company.com'];

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchJobs(); }, []);

  const handleSelectTemplate = (template) => {
    setFormData({
      ...formData,
      role: template.role,
      experience: template.experience || '',
      skills: template.skills || [],
      description: template.description || ''
    });
    setShowLibrary(false);
    setShowModal(true);
  };

  const handlePostToJobBoard = async (job) => {
    const provider = window.prompt('Post to which job board provider? (indeed_feed / webhook)', 'indeed_feed');
    if (!provider) return;
    setPostingJobId(job._id);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}/api/job-board/jobs/${job._id}/post`, {
        method: 'POST',
        body: JSON.stringify({ provider })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to post job');
      alert('Job posted to job board!');
    } catch (error) {
      alert(error.message);
    } finally {
      setPostingJobId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await authenticatedFetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ ...formData, isTemplate: false })
      });
      if (isUnauthorized(response)) return handleUnauthorized();
      if (response.ok) {
        setShowModal(false);
        setFormData(initialForm);
        fetchJobs();
      } else {
        const err = await response.json().catch(() => ({}));
        alert(err.message || 'Failed to create job');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to create job');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell-ats">
      <PageHeader
        icon={Briefcase}
        title="Job Openings"
        subtitle="Create and manage open roles for your hiring pipeline."
        gradientTitle
      >
        <button type="button" onClick={() => setShowLibrary(true)} className="btn-secondary">
          <BookOpen size={16} /> JD Library
        </button>
        <button type="button" onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={16} /> Post New Job
        </button>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-stone-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-brand-600" /> Loading jobs…
        </div>
      ) : jobs.length === 0 ? (
        <div className="card-ats-bordered">
          <EmptyState
            icon={Briefcase}
            message="No job openings yet"
            subMessage="Post your first role to start receiving applications."
            action={
              <button type="button" onClick={() => setShowModal(true)} className="btn-primary">
                <Plus size={16} /> Post New Job
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {jobs.map((job) => (
            <div
              key={job._id}
              className="card-ats p-6 relative overflow-hidden group"
            >
              <div className="absolute top-4 right-4">
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${
                  job.status === 'Open'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-700'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${job.status === 'Open' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  {job.status}
                </span>
              </div>

              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 border border-brand-200/70 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Briefcase className="w-5 h-5 text-brand-600" />
              </div>

              <h3 className="text-lg font-bold text-stone-900 mb-3 pr-16 tracking-tight">{job.role || job.title}</h3>

              <div className="space-y-2 text-sm text-stone-500">
                <p className="flex items-center gap-2"><MapPin size={15} className="text-stone-400" /> {job.location || '—'}</p>
                <p className="flex items-center gap-2"><Briefcase size={15} className="text-stone-400" /> {job.experience || 'Exp not specified'}</p>
                <p className="flex items-center gap-2 font-semibold text-stone-800">
                  <IndianRupee size={15} className="text-stone-400" /> {job.ctc || 'As per industry'}
                </p>
              </div>

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

              {hasJobBoard && (
                <div className="mt-4 pt-3 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => handlePostToJobBoard(job)}
                    disabled={postingJobId === job._id}
                    className="btn-secondary w-full !py-2 !text-xs"
                  >
                    {postingJobId === job._id ? <Loader2 size={14} className="animate-spin" /> : <Globe2 size={14} />}
                    {postingJobId === job._id ? 'Posting…' : 'Post to Job Board'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <JDLibraryModal isOpen={showLibrary} onClose={() => setShowLibrary(false)} onSelectTemplate={handleSelectTemplate} />

      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setFormData(initialForm); }}
        title="Create New Job Requisition"
        description="Fill in the role details and assign hiring managers."
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => { setShowModal(false); setFormData(initialForm); }} className="btn-secondary" disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="create-job-form" className="btn-primary" disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {saving ? 'Creating…' : 'Create & Post Job'}
            </button>
          </>
        }
      >
        <form id="create-job-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-sm font-semibold text-stone-700 mb-1.5 block">Job Role *</label>
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
              <label className="text-sm font-semibold text-stone-700 mb-1.5 block">Location</label>
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
              <label className="text-sm font-semibold text-stone-700 mb-1.5 block">Experience Required</label>
              <input
                type="text"
                placeholder="e.g. 3-5 Years"
                className="input-ats"
                value={formData.experience}
                onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-semibold text-stone-700 mb-1.5 block">CTC / Salary Range</label>
              <input
                type="text"
                placeholder="e.g. 12 - 15 LPA"
                className="input-ats"
                value={formData.ctc}
                onChange={(e) => setFormData({ ...formData, ctc: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-semibold text-stone-700 mb-1.5 block">Assign Hiring Managers</label>
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
              <p className="text-[11px] mt-1.5 text-stone-400 italic">Hold Ctrl (Win) or Cmd (Mac) to select multiple.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-semibold text-stone-700 mb-1.5 block">Job Description</label>
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
    </div>
  );
};

export default Jobs;
