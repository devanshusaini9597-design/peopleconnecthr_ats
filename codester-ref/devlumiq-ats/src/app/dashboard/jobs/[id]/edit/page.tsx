'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Briefcase, Building2, MapPin, Save, X, 
  CheckCircle2, Globe, Clock, DollarSign, FileText, Pencil
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { JobSkillEditor } from '@/components/dashboard/JobSkillEditor';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';

interface JobData {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  status: string;
  description: string;
  requirements: string;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
}

export default function EditJobPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const id = typeof params.id === 'string' ? params.id : '';
  
  const [job, setJob] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<JobData>>({});

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    
    fetch(`/api/jobs/${id}`, { credentials: 'include', cache: 'no-store' })
      .then((res) => res.ok ? res.json() : null)
      .then((data: JobData | null) => {
        if (data) {
          setJob(data);
          setFormData(data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });
      
      if (res.ok) {
        toast.success('Job updated successfully');
        router.push(`/dashboard/jobs/${id}`);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update job');
      }
    } catch {
      toast.error('Failed to update job');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageShell className="animate-pulse">
        <div className="h-8 w-48 bg-stone-200 rounded-lg" />
        <div className="h-96 bg-stone-100 rounded-xl" />
      </PageShell>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <p className="text-stone-600">Job not found</p>
        <Link 
          href="/dashboard/jobs" 
          className="text-brand-600 hover:underline mt-2 inline-block"
        >
          Back to Jobs
        </Link>
      </div>
    );
  }

  return (
    <PageShell className="max-w-4xl mx-auto">
      <PageHeader
        icon={Pencil}
        title="Edit Job"
        subtitle={
          <span className="inline-flex items-center gap-2">
            <Briefcase className="w-3.5 h-3.5" />
            {job.title}
          </span>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href={`/dashboard/jobs/${id}`}
            className="btn-secondary !px-4 !py-2.5 !text-sm"
          >
            Cancel
          </Link>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary !px-5 !py-2.5 !text-sm disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </motion.button>
        </div>
      </PageHeader>

      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/jobs/${id}`}
          className="inline-flex items-center gap-2 text-stone-600 hover:text-brand-600 font-semibold transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to job
        </Link>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 sm:p-6">
          <h2 className="text-lg font-bold text-stone-900 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-brand-600" />
            </div>
            Basic Information
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Job Title
              </label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                placeholder="e.g., Senior Software Engineer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Department
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  value={formData.department || ''}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                  placeholder="e.g., Engineering"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  value={formData.location || ''}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                  placeholder="e.g., San Francisco, CA or Remote"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Employment Type
              </label>
              <select
                value={formData.type || ''}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Internship">Internship</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Status
              </label>
              <select
                value={formData.status || ''}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
              >
                <option value="Active">Active</option>
                <option value="Closed">Closed</option>
                <option value="Draft">Draft</option>
              </select>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 sm:p-6">
          <h2 className="text-lg font-bold text-stone-900 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            Job Description
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={6}
                className="w-full px-3 py-2.5 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
                placeholder="Describe the role, responsibilities, and what the candidate will be working on..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Requirements
              </label>
              <textarea
                value={formData.requirements || ''}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                rows={4}
                className="w-full px-3 py-2.5 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
                placeholder="List the required skills, experience, and qualifications..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Taxonomy skills
              </label>
              <JobSkillEditor jobId={id} />
            </div>
          </div>
        </div>

        {/* Salary */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 sm:p-6">
          <h2 className="text-lg font-bold text-stone-900 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            Salary Range (Optional)
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Minimum
              </label>
              <input
                type="number"
                value={formData.salaryMin || ''}
                onChange={(e) => setFormData({ ...formData, salaryMin: parseInt(e.target.value) || undefined })}
                className="w-full px-3 py-2.5 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                placeholder="e.g., 80000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Maximum
              </label>
              <input
                type="number"
                value={formData.salaryMax || ''}
                onChange={(e) => setFormData({ ...formData, salaryMax: parseInt(e.target.value) || undefined })}
                className="w-full px-3 py-2.5 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                placeholder="e.g., 120000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Currency
              </label>
              <select
                value={formData.currency || 'USD'}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Link
              href={`/dashboard/jobs/${id}`}
              className="px-5 py-2.5 border border-stone-200 text-stone-700 rounded-xl font-medium hover:bg-stone-50 transition-all shadow-sm"
            >
              Cancel
            </Link>
          </motion.div>
          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl font-semibold hover:from-brand-700 hover:to-brand-600 disabled:opacity-50 transition-all shadow-lg shadow-brand-500/25"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Save Changes
              </>
            )}
          </motion.button>
        </div>
      </form>
    </PageShell>
  );
}
