/**
 * Job Posting Page
 * =================
 * Full CRUD management for job listings with templates, analytics stats,
 * and job status toggling. Delete operations require confirmation.
 */
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Briefcase, Plus, Building2, MapPin, DollarSign, Clock, CheckCircle, 
  Globe, Share2, Sparkles, X, Eye, Users,
  FileText, BarChart3, Award, Zap, Calendar, Trash2, Pencil, Loader2,
  AlignLeft, ListChecks, Gift
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import StatCard from '@/components/ui/StatCard';
import Link from 'next/link';
import { useLocale } from '@/components/providers/LocaleProvider';

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  salary?: string;
  status: string;
  postedAt: string;
  views: number;
  applications: number;
}

const JOB_TEMPLATES = [
  {
    title: 'Senior Software Engineer',
    department: 'Engineering',
    description: `We're looking for a Senior Software Engineer to join our growing team. You'll work on cutting-edge products that impact millions of users.

**Requirements:**
• 5+ years of experience with React, Node.js, TypeScript
• Strong understanding of cloud architecture (AWS/GCP)
• Experience with microservices and distributed systems
• Excellent problem-solving and communication skills

**What we offer:**
• Competitive salary + equity
• Remote-first culture
• Flexible working hours
• Health & wellness benefits`,
    skills: ['React', 'Node.js', 'TypeScript', 'AWS', 'System Design'],
  },
  {
    title: 'Product Designer',
    department: 'Design',
    description: `Join our design team to create beautiful, intuitive user experiences. You'll collaborate closely with product and engineering teams.

**Requirements:**
• 3+ years of product design experience
• Proficiency in Figma and design systems
• Strong portfolio demonstrating UX/UI skills
• Experience with user research and testing

**What we offer:**
• Creative freedom and autonomy
• Latest design tools and software
• Conference and learning budget
• Collaborative, supportive team`,
    skills: ['Figma', 'UI/UX', 'Prototyping', 'User Research', 'Design Systems'],
  },
  {
    title: 'Marketing Manager',
    department: 'Marketing',
    description: `We're seeking a creative Marketing Manager to drive our brand growth and lead generation efforts across multiple channels.

**Requirements:**
• 4+ years of B2B marketing experience
• Proven track record of successful campaigns
• Experience with digital marketing tools (HubSpot, Google Analytics)
• Strong analytical and communication skills

**What we offer:**
• Competitive compensation package
• Opportunity to build marketing from ground up
• Data-driven decision making culture
• Cross-functional collaboration`,
    skills: ['Digital Marketing', 'SEO/SEM', 'Content Strategy', 'Analytics', 'Campaign Management'],
  },
];

const DEPARTMENTS = ['Engineering', 'Design', 'Marketing', 'Sales', 'Product', 'HR', 'Finance', 'Operations'];
const LOCATIONS = ['Remote', 'San Francisco, CA', 'New York, NY', 'London, UK', 'Berlin, Germany', 'Singapore', 'Sydney, Australia'];
const TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship'];

export default function JobPostingPage() {
  const { t } = useLocale();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; jobId: string; jobTitle: string } | null>(null);
  const toast = useToast();

  // Form state
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('Remote');
  const [type, setType] = useState('Full-time');
  const [salary, setSalary] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [benefits, setBenefits] = useState('');

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/jobs', { credentials: 'include' });
      const data = await res.json();
      // Use real applicant count from the DB response
      const enhanced = (data.jobs || []).map((j: any) => ({
        ...j,
        views: j.views ?? 0,
        applications: j.applicants ?? 0,
      }));
      setJobs(enhanced);
    } catch {
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const selectTemplate = (template: typeof JOB_TEMPLATES[0]) => {
    setTitle(template.title);
    setDepartment(template.department);
    setDescription(template.description);
    setRequirements(template.skills.join('\n'));
  };

  const createJob = async () => {
    if (!title || !department) {
      toast.error('Please fill in required fields');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title,
          department,
          location,
          type,
          salary,
          description,
          status: 'Active',
        }),
      });

      if (res.ok) {
        const newJob = await res.json();
        setJobs([{ ...newJob, views: 0, applications: 0 }, ...jobs]);
        setShowCreateModal(false);
        toast.success('Job posted successfully');
        resetForm();
      }
    } catch {
      toast.error('Failed to create job');
    } finally {
      setCreating(false);
    }
  };

  const [editingJob, setEditingJob] = useState<Job | null>(null);

  const resetForm = () => {
    setTitle('');
    setDepartment('');
    setLocation('Remote');
    setType('Full-time');
    setSalary('');
    setDescription('');
    setRequirements('');
    setBenefits('');
    setEditingJob(null);
  };

  const openEditModal = (job: Job) => {
    setEditingJob(job);
    setTitle(job.title);
    setDepartment(job.department);
    setLocation(job.location);
    setType(job.type);
    setSalary(job.salary || '');
    setShowCreateModal(true);
  };

  const updateJob = async () => {
    if (!editingJob || !title || !department) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/jobs/${editingJob.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title, department, location, type, status: editingJob.status, description }),
      });
      if (res.ok) {
        const updated = await res.json();
        setJobs(jobs.map(j => j.id === editingJob.id ? { ...j, ...updated } : j));
        setShowCreateModal(false);
        toast.success('Job updated successfully');
        resetForm();
      } else {
        toast.error('Failed to update job');
      }
    } catch {
      toast.error('Failed to update job');
    } finally {
      setCreating(false);
    }
  };

  const deleteJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setJobs(jobs.filter(j => j.id !== jobId));
        toast.success('Job deleted successfully');
      } else {
        toast.error('Failed to delete job');
      }
    } catch {
      toast.error('Failed to delete job');
    }
  };

  const toggleJobStatus = async (job: Job) => {
    const newStatus = job.status === 'Active' ? 'Paused' : 'Active';
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setJobs(jobs.map(j => j.id === job.id ? { ...j, status: newStatus } : j));
        toast.success(`Job ${newStatus === 'Active' ? 'activated' : 'paused'}`);
      }
    } catch {
      toast.error('Failed to update status');
    }
  };

  const totalViews = jobs.reduce((sum, j) => sum + j.views, 0);
  const totalApplications = jobs.reduce((sum, j) => sum + j.applications, 0);
  const avgConversion = totalViews > 0 ? ((totalApplications / totalViews) * 100).toFixed(1) : '0';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
    <PageShell>
      <PageHeader
        icon={Briefcase}
        title="Job Posting"
        subtitle="Create and manage job listings"
      >
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { resetForm(); setShowCreateModal(true); }}
            className="btn-primary !px-4 !py-2.5 !text-sm inline-flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Post New Job
          </motion.button>
        </div>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Active Jobs"
          value={jobs.length}
          icon={Briefcase}
          iconClassName="text-brand-600 bg-brand-50"
        />
        <StatCard
          label="Total Views"
          value={totalViews.toLocaleString()}
          icon={Eye}
          iconClassName="text-sky-600 bg-sky-50"
        />
        <StatCard
          label="Applications"
          value={totalApplications}
          icon={Users}
          iconClassName="text-emerald-600 bg-emerald-50"
        />
        <StatCard
          label="Conversion Rate"
          value={`${avgConversion}%`}
          icon={BarChart3}
          iconClassName="text-amber-600 bg-amber-50"
        />
      </div>

      {/* Quick Templates */}
      <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-sm">
        <h3 className="font-bold text-stone-900 mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          Quick Templates
        </h3>
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3">
          {JOB_TEMPLATES.map((template, idx) => {
            const gradients = [
              'from-brand-500 to-teal-500',
              'from-violet-500 to-purple-600',
              'from-rose-500 to-pink-500',
            ];
            const lightBgs = ['bg-brand-50', 'bg-violet-50', 'bg-rose-50'];
            const borderBgs = ['border-brand-200 hover:border-brand-400', 'border-violet-200 hover:border-violet-400', 'border-rose-200 hover:border-rose-400'];
            return (
              <motion.button
                key={template.title}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  selectTemplate(template);
                  setShowCreateModal(true);
                }}
                className={`p-4 rounded-xl border ${borderBgs[idx]} ${lightBgs[idx]} transition-all text-left group relative overflow-hidden`}
              >
                <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${gradients[idx]} opacity-10 rounded-full translate-x-6 -translate-y-6 pointer-events-none`} />
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradients[idx]} flex items-center justify-center mb-3`}>
                  <Award className="w-4 h-4 text-white" />
                </div>
                <p className="font-bold text-sm text-stone-900 mb-0.5">{template.title}</p>
                <p className="text-xs text-stone-500 mb-3">{template.department}</p>
                <div className="flex flex-wrap gap-1">
                  {template.skills.slice(0, 3).map((skill) => (
                    <span key={skill} className="px-2 py-0.5 bg-white/80 text-stone-600 rounded-md text-xs border border-white font-medium">
                      {skill}
                    </span>
                  ))}
                  {template.skills.length > 3 && (
                    <span className="px-2 py-0.5 bg-white/80 text-stone-400 rounded-md text-xs border border-white">+{template.skills.length - 3}</span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Jobs List */}
      <div className="rounded-2xl bg-white border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-stone-100">
          <h3 className="font-bold text-stone-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-600" />
            Posted Jobs ({jobs.length})
          </h3>
        </div>

        {loading ? (
          <div className="p-8 space-y-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-stone-100 rounded-xl" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center">
            <Briefcase className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-600 font-medium">No jobs posted yet</p>
            <p className="text-sm text-stone-500 mt-1">Create your first job listing</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {jobs.map((job) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-3 sm:p-4 hover:bg-stone-50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-stone-900">{job.title}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-stone-500">
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {job.department}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {job.location}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {job.type}
                          </span>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        job.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-600'
                      }`}>
                        {job.status}
                      </span>
                    </div>

                    {job.salary && (
                      <div className="flex items-center gap-1 mt-2 text-sm text-stone-600">
                        <DollarSign className="w-4 h-4" />
                        {job.salary}
                      </div>
                    )}

                    <div className="flex items-center gap-4 mt-3 text-xs text-stone-500">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {job.views} views
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {job.applications} applicants
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(job.postedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Toggle Active/Paused */}
                    <button
                      onClick={() => toggleJobStatus(job)}
                      className={`p-2 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1 ${
                        job.status === 'Active'
                          ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                      }`}
                      title={job.status === 'Active' ? 'Pause job' : 'Activate job'}
                    >
                      {job.status === 'Active' ? <Clock className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                    </button>
                    {/* Edit */}
                    <button
                      onClick={() => openEditModal(job)}
                      className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                      title="Edit job"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {/* Share to job boards */}
                    <Link
                      href={`/dashboard/premium/jobboards?jobId=${job.id}`}
                      className="p-2 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors"
                      title="Share to job boards"
                    >
                      <Share2 className="w-4 h-4" />
                    </Link>
                    {/* Delete */}
                    <button
                      onClick={() => setDeleteConfirm({ open: true, jobId: job.id, jobTitle: job.title })}
                      className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                      title="Delete job"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Create / Edit Job Modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {showCreateModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowCreateModal(false); resetForm(); }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />

            {/* Centered Dialog */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" onClick={() => { setShowCreateModal(false); resetForm(); }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              className="relative w-full max-w-2xl max-h-[calc(100dvh-24px)] sm:max-h-[calc(100dvh-48px)] bg-white rounded-2xl z-50 overflow-hidden flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Gradient Header ───────────────────────────────────────────── */}
              <div className="relative bg-gradient-to-r from-brand-600 via-brand-500 to-teal-500 px-5 py-5 sm:px-6 rounded-t-2xl flex-shrink-0">
                {/* Decorative circles */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="absolute bottom-0 right-16 w-16 h-16 bg-white/5 rounded-full translate-y-1/2 pointer-events-none" />

                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm border border-white/30">
                      {editingJob ? <Pencil className="w-5 h-5 text-white" /> : <Zap className="w-5 h-5 text-white" />}
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-white">
                        {editingJob ? 'Edit Job Listing' : 'Post New Job'}
                      </h2>
                      <p className="text-xs text-white/70 mt-0.5">
                        {editingJob ? `Editing: ${editingJob.title}` : 'Fill in the details below to publish'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowCreateModal(false); resetForm(); }}
                    className="p-2 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              {/* ── Scrollable Body ───────────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                <div className="p-5 sm:p-6 space-y-6">

                  {/* Section: Basic Info */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center">
                        <Briefcase className="w-3.5 h-3.5 text-brand-600" />
                      </div>
                      <h3 className="font-bold text-stone-900 text-sm">Basic Information</h3>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wide mb-1.5">
                          Job Title <span className="text-red-500 normal-case">*</span>
                        </label>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="e.g. Senior Software Engineer"
                          className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all text-stone-900 placeholder-stone-400"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wide mb-1.5">
                            Department <span className="text-red-500 normal-case">*</span>
                          </label>
                          <div className="relative">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                            <select
                              value={department}
                              onChange={(e) => setDepartment(e.target.value)}
                              className="w-full pl-9 pr-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all text-stone-900 appearance-none"
                            >
                              <option value="">Select department...</option>
                              {DEPARTMENTS.map((dept) => (
                                <option key={dept} value={dept}>{dept}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wide mb-1.5">Location</label>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                            <select
                              value={location}
                              onChange={(e) => setLocation(e.target.value)}
                              className="w-full pl-9 pr-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all text-stone-900 appearance-none"
                            >
                              {LOCATIONS.map((loc) => (
                                <option key={loc} value={loc}>{loc}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wide mb-1.5">
                            <Clock className="inline w-3.5 h-3.5 mr-1 text-stone-400" />Job Type
                          </label>
                          <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all text-stone-900"
                          >
                            {TYPES.map((tp) => (
                              <option key={tp} value={tp}>{tp}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wide mb-1.5">
                            <DollarSign className="inline w-3.5 h-3.5 mr-1 text-stone-400" />Salary Range
                          </label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                            <input
                              type="text"
                              value={salary}
                              onChange={(e) => setSalary(e.target.value)}
                              placeholder="e.g. $80k – $120k"
                              className="w-full pl-9 pr-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all text-stone-900 placeholder-stone-400"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-stone-100" />

                  {/* Section: Description */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                        <AlignLeft className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <h3 className="font-bold text-stone-900 text-sm">Job Description</h3>
                    </div>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={6}
                      placeholder="Describe the role, responsibilities, and what makes this opportunity exciting..."
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none resize-none transition-all text-stone-900 placeholder-stone-400"
                    />
                  </div>

                  <div className="border-t border-stone-100" />

                  {/* Section: Requirements */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                        <ListChecks className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                      <h3 className="font-bold text-stone-900 text-sm">Requirements</h3>
                    </div>
                    <textarea
                      value={requirements}
                      onChange={(e) => setRequirements(e.target.value)}
                      rows={4}
                      placeholder={"• 5+ years of experience\n• Proficiency in React\n• Strong communication skills"}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none resize-none transition-all text-stone-900 placeholder-stone-400"
                    />
                    <p className="text-xs text-stone-400 mt-1.5">One requirement per line</p>
                  </div>

                  <div className="border-t border-stone-100" />

                  {/* Section: Benefits */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <Gift className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      <h3 className="font-bold text-stone-900 text-sm">Benefits & Perks</h3>
                    </div>
                    <textarea
                      value={benefits}
                      onChange={(e) => setBenefits(e.target.value)}
                      rows={3}
                      placeholder="Health insurance, 401k, remote work, flexible hours..."
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none resize-none transition-all text-stone-900 placeholder-stone-400"
                    />
                  </div>

                </div>
              </div>

              {/* ── Sticky Footer ──────────────────────────────────────────────── */}
              <div className="flex-shrink-0 flex items-center justify-between gap-3 px-5 py-4 sm:px-6 border-t border-stone-100 bg-stone-50/80 backdrop-blur-sm rounded-b-2xl">
                <button
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
                  className="px-5 py-2.5 border border-stone-200 bg-white text-stone-700 rounded-xl font-semibold hover:bg-stone-100 transition-colors text-sm"
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={editingJob ? updateJob : createJob}
                  disabled={creating || !title.trim() || !department}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-600 to-teal-500 hover:from-brand-700 hover:to-teal-600 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-brand-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {editingJob ? 'Updating...' : 'Posting...'}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      {editingJob ? 'Save Changes' : 'Post Job'}
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* --- Section: Delete Job Confirm Modal --- */}
      <ConfirmModal
        open={!!deleteConfirm?.open}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm?.jobId) deleteJob(deleteConfirm.jobId);
          setDeleteConfirm(null);
        }}
        title="Delete Job Posting"
        description={`Are you sure you want to delete "${deleteConfirm?.jobTitle}"? This will permanently remove the job listing and all associated data.`}
        confirmLabel="Delete Job"
        cancelLabel="Cancel"
        variant="danger"
      />
    </PageShell>
    </motion.div>
  );
}
