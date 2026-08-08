'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { 
  ArrowLeft, MapPin, Building2, Clock, Briefcase, 
  CheckCircle2, Upload, Loader2, FileText, Globe, Linkedin,
  User, Mail, Phone, FileUp, Sparkles, Send
} from 'lucide-react';

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  postedAt: string;
  applicants: number;
  companyId?: string | null;
}

interface JobDetailClientProps {
  job: Job;
}

export default function JobDetailClient({ job }: JobDetailClientProps) {
  const [isApplying, setIsApplying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    linkedin: '',
    portfolio: '',
    coverLetter: '',
    gender: '',
    ethnicity: '',
    veteranStatus: '',
    disability: '',
    declinedToSelfId: false,
  });
  const [resume, setResume] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        setResume(file);
      }
    }
  }, []);

  const validateFile = (file: File): boolean => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a PDF or Word document');
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return false;
    }
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setResume(file);
        setError(null);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('email', formData.email);
      data.append('phone', formData.phone);
      data.append('jobId', job.id);
      data.append('linkedin', formData.linkedin);
      data.append('portfolio', formData.portfolio);
      data.append('coverLetter', formData.coverLetter);
      data.append('gender', formData.gender);
      data.append('ethnicity', formData.ethnicity);
      data.append('veteranStatus', formData.veteranStatus);
      data.append('disability', formData.disability);
      data.append('declinedToSelfId', formData.declinedToSelfId ? 'true' : 'false');
      if (resume) {
        data.append('resume', resume);
      }

      const res = await fetch('/api/careers/apply', {
        method: 'POST',
        body: data,
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to submit application');
      }

      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-4">
            Application Submitted!
          </h1>
          <p className="text-stone-600 mb-8">
            Thank you for applying for the <span className="font-semibold">{job.title}</span> position. 
            We&apos;ve received your application and will review it shortly.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/careers"
              className="flex-1 px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 transition-colors"
            >
              View More Jobs
            </Link>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-6 py-3 rounded-xl border-2 border-stone-200 text-stone-700 font-semibold hover:border-brand-300 hover:bg-brand-50/50 transition-colors"
            >
              Apply for Another
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-stone-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <Link
            href="/careers"
            className="inline-flex items-center gap-2 text-stone-500 hover:text-brand-600 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to all jobs
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-sm font-medium">
                  <Sparkles className="w-3.5 h-3.5" />
                  {job.department}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-stone-100 text-stone-600 text-sm font-medium">
                  {job.type}
                </span>
              </div>
              
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-stone-900 mb-4">
                {job.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-4 text-stone-500 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  {job.location}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" />
                  {job.department}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  Posted {formatTimeAgo(job.postedAt)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4" />
                  {job.applicants} applicant{job.applicants !== 1 ? 's' : ''}
                </span>
              </div>
            </motion.div>

            {/* Job Description Placeholder */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8"
            >
              <h2 className="text-xl font-bold text-stone-900 mb-4">About the Role</h2>
              <p className="text-stone-600 leading-relaxed mb-6">
                We&apos;re looking for a talented {job.title} to join our {job.department} team. 
                This is an exciting opportunity to work on challenging projects and make a real impact.
              </p>
              
              <h3 className="text-lg font-bold text-stone-900 mb-3">Responsibilities</h3>
              <ul className="space-y-2 text-stone-600 mb-6">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-brand-500 flex-shrink-0 mt-0.5" />
                  Collaborate with cross-functional teams to deliver high-quality results
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-brand-500 flex-shrink-0 mt-0.5" />
                  Contribute to the growth and success of our {job.department} initiatives
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-brand-500 flex-shrink-0 mt-0.5" />
                  Drive innovation and bring new ideas to the table
                </li>
              </ul>

              <h3 className="text-lg font-bold text-stone-900 mb-3">Requirements</h3>
              <ul className="space-y-2 text-stone-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-brand-500 flex-shrink-0 mt-0.5" />
                  Relevant experience in {job.department}
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-brand-500 flex-shrink-0 mt-0.5" />
                  Strong communication and collaboration skills
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-brand-500 flex-shrink-0 mt-0.5" />
                  Passion for excellence and continuous improvement
                </li>
              </ul>
            </motion.div>

            {/* Application Form */}
            <AnimatePresence>
              {isApplying && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white rounded-2xl border border-stone-200 overflow-hidden"
                >
                  <div className="p-6 sm:p-8">
                    <h2 className="text-xl font-bold text-stone-900 mb-6">Apply for this Position</h2>
                    
                    {error && (
                      <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
                        {error}
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Name & Email */}
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-stone-700 mb-2">
                            <span className="inline-flex items-center gap-2">
                              <User className="w-4 h-4" />
                              Full Name *
                            </span>
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 outline-none transition-all"
                            placeholder="John Doe"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-stone-700 mb-2">
                            <span className="inline-flex items-center gap-2">
                              <Mail className="w-4 h-4" />
                              Email Address *
                            </span>
                          </label>
                          <input
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 outline-none transition-all"
                            placeholder="john@example.com"
                          />
                        </div>
                      </div>

                      {/* Phone & LinkedIn */}
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-stone-700 mb-2">
                            <span className="inline-flex items-center gap-2">
                              <Phone className="w-4 h-4" />
                              Phone Number
                            </span>
                          </label>
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 outline-none transition-all"
                            placeholder="+1 (555) 123-4567"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-stone-700 mb-2">
                            <span className="inline-flex items-center gap-2">
                              <Linkedin className="w-4 h-4" />
                              LinkedIn Profile
                            </span>
                          </label>
                          <input
                            type="url"
                            value={formData.linkedin}
                            onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 outline-none transition-all"
                            placeholder="https://linkedin.com/in/username"
                          />
                        </div>
                      </div>

                      {/* Portfolio */}
                      <div>
                        <label className="block text-sm font-semibold text-stone-700 mb-2">
                          <span className="inline-flex items-center gap-2">
                            <Globe className="w-4 h-4" />
                            Portfolio / Website
                          </span>
                        </label>
                        <input
                          type="url"
                          value={formData.portfolio}
                          onChange={(e) => setFormData({ ...formData, portfolio: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 outline-none transition-all"
                          placeholder="https://yourportfolio.com"
                        />
                      </div>

                      {/* Resume Upload */}
                      <div>
                        <label className="block text-sm font-semibold text-stone-700 mb-2">
                          <span className="inline-flex items-center gap-2">
                            <FileUp className="w-4 h-4" />
                            Resume / CV
                          </span>
                        </label>
                        <div
                          onDragEnter={handleDrag}
                          onDragLeave={handleDrag}
                          onDragOver={handleDrag}
                          onDrop={handleDrop}
                          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                            dragActive
                              ? 'border-brand-500 bg-brand-50'
                              : resume
                              ? 'border-emerald-500 bg-emerald-50'
                              : 'border-stone-300 hover:border-stone-400'
                          }`}
                        >
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <div className="space-y-2">
                            {resume ? (
                              <>
                                <FileText className="w-10 h-10 text-emerald-500 mx-auto" />
                                <p className="font-semibold text-emerald-700">{resume.name}</p>
                                <p className="text-sm text-emerald-600">
                                  {(resume.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setResume(null);
                                  }}
                                  className="text-sm text-red-500 hover:text-red-700 underline"
                                >
                                  Remove file
                                </button>
                              </>
                            ) : (
                              <>
                                <Upload className="w-10 h-10 text-stone-400 mx-auto" />
                                <p className="font-semibold text-stone-700">
                                  Drop your resume here, or click to browse
                                </p>
                                <p className="text-sm text-stone-500">
                                  PDF or Word up to 5MB
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Cover Letter */}
                      <div>
                        <label className="block text-sm font-semibold text-stone-700 mb-2">
                          <span className="inline-flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Cover Letter
                          </span>
                        </label>
                        <textarea
                          rows={5}
                          value={formData.coverLetter}
                          onChange={(e) => setFormData({ ...formData, coverLetter: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 outline-none transition-all resize-none"
                          placeholder="Tell us why you're a great fit for this role..."
                        />
                      </div>

                      {/* Voluntary EEO self-ID — optional, stored separately from hiring decisions */}
                      <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-4 space-y-3">
                        <p className="text-sm font-semibold text-stone-800">Voluntary self-identification (optional)</p>
                        <p className="text-xs text-stone-500">
                          This information is voluntary, kept separate from hiring decisions, and used only for aggregated equal-opportunity reporting.
                        </p>
                        <label className="flex items-center gap-2 text-sm text-stone-700">
                          <input
                            type="checkbox"
                            checked={formData.declinedToSelfId}
                            onChange={(e) => setFormData({ ...formData, declinedToSelfId: e.target.checked, gender: '', ethnicity: '', veteranStatus: '', disability: '' })}
                          />
                          I prefer not to self-identify
                        </label>
                        {!formData.declinedToSelfId && (
                          <div className="grid sm:grid-cols-2 gap-3">
                            <select
                              value={formData.gender}
                              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-sm"
                            >
                              <option value="">Gender (optional)</option>
                              <option value="female">Female</option>
                              <option value="male">Male</option>
                              <option value="non_binary">Non-binary</option>
                              <option value="prefer_not">Prefer not to say</option>
                            </select>
                            <select
                              value={formData.ethnicity}
                              onChange={(e) => setFormData({ ...formData, ethnicity: e.target.value })}
                              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-sm"
                            >
                              <option value="">Ethnicity (optional)</option>
                              <option value="asian">Asian</option>
                              <option value="black">Black / African American</option>
                              <option value="hispanic">Hispanic / Latino</option>
                              <option value="white">White</option>
                              <option value="two_or_more">Two or more</option>
                              <option value="prefer_not">Prefer not to say</option>
                            </select>
                            <select
                              value={formData.veteranStatus}
                              onChange={(e) => setFormData({ ...formData, veteranStatus: e.target.value })}
                              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-sm"
                            >
                              <option value="">Veteran status (optional)</option>
                              <option value="protected_veteran">Protected veteran</option>
                              <option value="not_veteran">Not a veteran</option>
                              <option value="prefer_not">Prefer not to say</option>
                            </select>
                            <select
                              value={formData.disability}
                              onChange={(e) => setFormData({ ...formData, disability: e.target.value })}
                              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-sm"
                            >
                              <option value="">Disability (optional)</option>
                              <option value="yes">Yes, I have a disability</option>
                              <option value="no">No</option>
                              <option value="prefer_not">Prefer not to say</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Submit */}
                      <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex-1 flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            <>
                              <Send className="w-5 h-5" />
                              Submit Application
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsApplying(false)}
                          disabled={isSubmitting}
                          className="px-8 py-4 rounded-xl border-2 border-stone-200 text-stone-700 font-semibold hover:border-stone-300 transition-colors disabled:opacity-70"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-2xl border border-stone-200 p-6"
              >
                <h3 className="font-bold text-stone-900 mb-4">Ready to apply?</h3>
                <p className="text-stone-600 text-sm mb-6">
                  Join our team and help us build something amazing. We review every application carefully.
                </p>
                <button
                  onClick={() => setIsApplying(true)}
                  disabled={isApplying}
                  className="w-full px-6 py-4 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 transition-colors disabled:opacity-70"
                >
                  {isApplying ? 'Application in Progress...' : 'Apply Now'}
                </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-to-br from-brand-50 to-stone-50 rounded-2xl border border-brand-100 p-6"
              >
                <h3 className="font-bold text-stone-900 mb-3">What happens next?</h3>
                <ul className="space-y-3 text-sm text-stone-600">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                    We review your application within 5 business days
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                    If selected, we&apos;ll schedule a phone screening
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                    Followed by interviews with the team
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                    Final decision and offer within 2 weeks
                  </li>
                </ul>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
