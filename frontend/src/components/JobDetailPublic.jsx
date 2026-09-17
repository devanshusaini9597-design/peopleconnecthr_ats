import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Briefcase, Clock, UploadCloud, CheckCircle, AlertCircle,
  Building, FileText, ChevronRight, ChevronLeft, User, IndianRupee, Send,
} from 'lucide-react';
import API_URL from '../config';
import { employmentLabel } from './jobs/jobsConstants';
import PublicAnnouncementBanner from './PublicAnnouncementBanner';
import { resolveOrgLogoSrc } from '../utils/orgLogo';
import { sanitizeHtml } from '../utils/sanitizeHtml';

const STEPS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'experience', label: 'Experience', icon: IndianRupee },
  { id: 'application', label: 'Application', icon: Send },
];

const SOURCE_OPTIONS = [
  { value: 'LinkedIn', label: 'LinkedIn' },
  { value: 'Indeed', label: 'Indeed' },
  { value: 'Company Website', label: 'Company website' },
  { value: 'Referral', label: 'Referral' },
  { value: 'Careers Page', label: 'Careers page' },
  { value: 'Other', label: 'Other' },
];

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  position: '',
  companyName: '',
  location: '',
  experience: '',
  ctc: '',
  expectedCtc: '',
  noticePeriod: '',
  source: '',
  coverLetter: '',
};

function fieldClass(err) {
  return `w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm font-medium outline-none transition ${
    err
      ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
      : 'border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15'
  }`;
}

const JobDetailPublic = () => {
  const { orgSlug, jobId } = useParams();
  const [searchParams] = useSearchParams();
  const [job, setJob] = useState(null);
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const formRef = useRef(null);

  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [customResponses, setCustomResponses] = useState({});
  const [applicationForm, setApplicationForm] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const brand = org?.brandColor || '#0d9488';

  useEffect(() => {
    const src = String(searchParams.get('src') || searchParams.get('source') || '').trim();
    if (!src) return;
    const mapped = SOURCE_OPTIONS.find(
      (o) => o.value.toLowerCase() === src.toLowerCase() || o.label.toLowerCase() === src.toLowerCase(),
    );
    setFormData((prev) => ({
      ...prev,
      source: mapped?.value || (src.toLowerCase() === 'linkedin' ? 'LinkedIn' : prev.source),
    }));
  }, [searchParams]);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/careers/${orgSlug}/jobs/${jobId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Job not found or no longer available');
        setJob(data.job || data.data);
        setOrg(data.organization);
        setApplicationForm(data.applicationForm || null);
        const title = data.job?.title || data.data?.title || '';
        if (title) {
          setFormData((prev) => (prev.position ? prev : { ...prev, position: title }));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
  }, [orgSlug, jobId]);

  const setField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const visibleCustomFields = useMemo(() => {
    const fields = applicationForm?.fields || [];
    return fields.filter((field) => {
      const rule = field.showWhen;
      if (!rule?.fieldKey) return true;
      return String(customResponses[rule.fieldKey] ?? '') === String(rule.equals ?? '');
    });
  }, [applicationForm, customResponses]);

  const validateStep = (idx) => {
    const errs = {};
    if (idx === 0) {
      if (!formData.name.trim()) errs.name = 'Full name is required';
      if (!formData.email.trim()) errs.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) errs.email = 'Enter a valid email';
      if (!formData.phone.trim()) errs.phone = 'Phone number is required';
    }
    if (idx === 1) {
      if (!resumeFile) errs.resume = 'Resume / CV is required';
    }
    if (idx === 2) {
      for (const field of visibleCustomFields) {
        if (!field.required) continue;
        const val = customResponses[field.key];
        if (val == null || String(val).trim() === '') {
          errs[`custom_${field.key}`] = `${field.label} is required`;
        }
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const pickResume = (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setFieldErrors((prev) => ({ ...prev, resume: 'File size exceeds 10MB limit.' }));
      return;
    }
    setResumeFile(file);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.resume;
      return next;
    });
    setSubmitError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep(0) || !validateStep(1) || !validateStep(2)) {
      if (!validateStep(0)) setStep(0);
      else if (!validateStep(1)) setStep(1);
      else setStep(2);
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const fd = new FormData();
      fd.append('name', formData.name.trim());
      fd.append('email', formData.email.trim());
      fd.append('phone', formData.phone.trim());
      fd.append('position', formData.position.trim());
      fd.append('companyName', formData.companyName.trim());
      fd.append('location', formData.location.trim());
      fd.append('experience', formData.experience.trim());
      fd.append('ctc', formData.ctc.trim());
      fd.append('expectedCtc', formData.expectedCtc.trim());
      fd.append('noticePeriod', formData.noticePeriod.trim());
      fd.append('source', formData.source || 'Careers Page');
      fd.append('coverLetter', formData.coverLetter.trim());
      fd.append('remark', formData.coverLetter.trim());
      fd.append('customResponses', JSON.stringify(customResponses || {}));
      if (resumeFile) fd.append('resume', resumeFile);

      const res = await fetch(`${API_URL}/api/careers/${orgSlug}/jobs/${jobId}/apply`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Application submission failed');
      setSubmitSuccess(true);
    } catch (err) {
      setSubmitError(err.message || 'Could not submit application');
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex justify-center pt-24">
        <div className="h-11 w-11 rounded-full border-2 border-stone-200 border-t-brand-600 animate-spin" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
        <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-stone-200 max-w-md w-full">
          <AlertCircle className="h-12 w-12 text-rose-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-stone-900 mb-2">Job not found</h2>
          <p className="text-stone-600 mb-6">{error || 'This position may have been filled or removed.'}</p>
          <Link to={`/careers/${orgSlug}`} className="text-brand-700 hover:text-brand-900 font-semibold">
            ← Back to all jobs
          </Link>
        </div>
      </div>
    );
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col">
      <PublicAnnouncementBanner orgSlug={orgSlug} />
      <header className="bg-white/90 backdrop-blur border-b border-stone-200 py-4 px-4 sm:px-6 shrink-0 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <Link to={`/careers/${orgSlug}`} className="inline-flex items-center text-stone-600 hover:text-brand-700 transition-colors font-semibold text-sm">
            <ArrowLeft className="h-4 w-4 mr-2" /> Careers
          </Link>
          <div className="flex items-center gap-2.5 min-w-0">
            {org?.logo ? (
              <img src={resolveOrgLogoSrc(org.logo)} alt={org.name || ''} className="h-8 w-auto object-contain" />
            ) : (
              <span className="font-bold text-lg text-stone-800 truncate">{org?.name}</span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-10">
          <div className="lg:col-span-3 space-y-6">
            <div
              className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 shadow-sm"
              style={{ borderTopColor: brand, borderTopWidth: 3 }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2">Open role</p>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 mb-4">{job.title}</h1>
              <div className="flex flex-wrap gap-2 text-sm text-stone-600 mb-6">
                {job.clientName ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1"><Building className="h-3.5 w-3.5" />{job.clientName}</span>
                ) : null}
                {job.department ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1"><Briefcase className="h-3.5 w-3.5" />{job.department}</span>
                ) : null}
                {job.location ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>
                ) : null}
                {job.employmentType ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1"><Clock className="h-3.5 w-3.5" />{employmentLabel(job.employmentType)}</span>
                ) : null}
              </div>
              <div className="prose prose-stone max-w-none text-stone-700">
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.description) }} />
              </div>
            </div>

            {Array.isArray(job.skills) && job.skills.length > 0 ? (
              <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-stone-900 mb-3">Required skills</h3>
                <div className="flex flex-wrap gap-2">
                  {job.skills.map((skill) => (
                    <span key={skill} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-brand-50 text-brand-800 border border-brand-100">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="lg:hidden sticky bottom-4 z-10">
              <button
                type="button"
                onClick={scrollToForm}
                className="w-full text-white font-bold py-3.5 px-8 rounded-xl shadow-lg"
                style={{ backgroundColor: brand }}
              >
                Apply for this position
              </button>
            </div>
          </div>

          <div className="lg:col-span-2" ref={formRef}>
            <div className="rounded-2xl border border-stone-200 bg-white shadow-lg shadow-stone-900/5 overflow-hidden lg:sticky lg:top-24">
              <div className="h-1 bg-stone-100">
                <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: brand }} />
              </div>
              <div className="p-5 sm:p-6">
                <h3 className="text-xl font-bold text-stone-900 mb-1">Apply now</h3>
                <p className="text-xs text-stone-500 mb-5">Complete each step. Your details are sent to the hiring team.</p>

                {submitSuccess ? (
                  <div className="text-center py-6">
                    <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-emerald-50 border border-emerald-100 mb-4">
                      <CheckCircle className="h-8 w-8 text-emerald-600" />
                    </div>
                    <h4 className="text-lg font-bold text-stone-900 mb-2">Application submitted</h4>
                    <p className="text-sm text-stone-600 mb-5 leading-relaxed">
                      Thank you. Your application for <span className="font-semibold">{job.title}</span> has been received and added to our ATS.
                    </p>
                    <Link to={`/careers/${orgSlug}`} className="text-brand-700 font-semibold hover:underline text-sm">
                      Explore other roles
                    </Link>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex gap-1.5 mb-2">
                      {STEPS.map((s, i) => {
                        const Icon = s.icon;
                        const active = i === step;
                        const done = i < step;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              if (i < step) setStep(i);
                              else if (i > step) {
                                let ok = true;
                                for (let j = step; j < i; j += 1) {
                                  if (!validateStep(j)) { ok = false; break; }
                                }
                                if (ok) setStep(i);
                              }
                            }}
                            className={`flex-1 rounded-lg px-2 py-2 text-[10px] font-bold uppercase tracking-wide flex flex-col items-center gap-1 border transition ${
                              active
                                ? 'border-brand-500 bg-brand-50 text-brand-800'
                                : done
                                  ? 'border-stone-200 bg-stone-50 text-stone-700'
                                  : 'border-stone-100 text-stone-400'
                            }`}
                          >
                            <Icon size={14} />
                            {s.label}
                          </button>
                        );
                      })}
                    </div>

                    {step === 0 ? (
                      <div className="space-y-3.5 animate-fade-in">
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Full name *</label>
                          <input className={fieldClass(fieldErrors.name)} value={formData.name} onChange={(e) => setField('name', e.target.value)} autoComplete="name" />
                          {fieldErrors.name ? <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.name}</p> : null}
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Email *</label>
                          <input type="email" className={fieldClass(fieldErrors.email)} value={formData.email} onChange={(e) => setField('email', e.target.value)} autoComplete="email" />
                          {fieldErrors.email ? <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.email}</p> : null}
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Phone *</label>
                          <input type="tel" className={fieldClass(fieldErrors.phone)} value={formData.phone} onChange={(e) => setField('phone', e.target.value)} autoComplete="tel" />
                          {fieldErrors.phone ? <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.phone}</p> : null}
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Current / target position</label>
                          <input className={fieldClass()} value={formData.position} onChange={(e) => setField('position', e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Current company</label>
                          <input className={fieldClass()} value={formData.companyName} onChange={(e) => setField('companyName', e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Location</label>
                          <input className={fieldClass()} value={formData.location} onChange={(e) => setField('location', e.target.value)} placeholder="City / region" />
                        </div>
                      </div>
                    ) : null}

                    {step === 1 ? (
                      <div className="space-y-3.5 animate-fade-in">
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Experience (years)</label>
                          <input className={fieldClass()} value={formData.experience} onChange={(e) => setField('experience', e.target.value)} placeholder="e.g. 5" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Current CTC</label>
                            <input className={fieldClass()} value={formData.ctc} onChange={(e) => setField('ctc', e.target.value)} placeholder="e.g. 12 LPA" />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Expected CTC</label>
                            <input className={fieldClass()} value={formData.expectedCtc} onChange={(e) => setField('expectedCtc', e.target.value)} placeholder="e.g. 15 LPA" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Notice period</label>
                          <input className={fieldClass()} value={formData.noticePeriod} onChange={(e) => setField('noticePeriod', e.target.value)} placeholder="e.g. 30 days / Immediate" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Resume / CV *</label>
                          <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              pickResume(e.dataTransfer.files?.[0]);
                            }}
                            className={`mt-1 flex justify-center px-4 py-6 border-2 border-dashed rounded-xl transition-colors ${
                              resumeFile ? 'border-brand-500 bg-brand-50/60' : fieldErrors.resume ? 'border-rose-300 bg-rose-50/40' : 'border-stone-200 bg-stone-50 hover:border-brand-400'
                            }`}
                          >
                            <div className="space-y-1 text-center">
                              {resumeFile ? <FileText className="mx-auto h-9 w-9 text-brand-600" /> : <UploadCloud className="mx-auto h-9 w-9 text-stone-400" />}
                              <label className="relative cursor-pointer text-sm font-semibold text-brand-700">
                                <span>{resumeFile ? 'Change file' : 'Upload a file'}</span>
                                <input type="file" className="sr-only" accept=".pdf,.doc,.docx" onChange={(e) => pickResume(e.target.files?.[0])} />
                              </label>
                              <p className="text-[11px] text-stone-500">{resumeFile ? resumeFile.name : 'PDF, DOC, DOCX up to 10MB'}</p>
                            </div>
                          </div>
                          {fieldErrors.resume ? <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.resume}</p> : null}
                        </div>
                      </div>
                    ) : null}

                    {step === 2 ? (
                      <div className="space-y-3.5 animate-fade-in">
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">How did you hear about us?</label>
                          <select className={fieldClass()} value={formData.source} onChange={(e) => setField('source', e.target.value)}>
                            <option value="">Select an option</option>
                            {SOURCE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Cover note / remark</label>
                          <textarea
                            rows={4}
                            className={fieldClass()}
                            value={formData.coverLetter}
                            onChange={(e) => setField('coverLetter', e.target.value)}
                            placeholder="Optional message to the hiring team"
                          />
                        </div>

                        {visibleCustomFields.length > 0 ? (
                          <div className="space-y-3 pt-2 border-t border-stone-100">
                            <h4 className="text-sm font-semibold text-stone-900">{applicationForm?.title || 'Additional questions'}</h4>
                            {visibleCustomFields.map((field) => (
                              <div key={field.key}>
                                <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">
                                  {field.label}{field.required ? ' *' : ''}
                                </label>
                                {field.type === 'textarea' ? (
                                  <textarea
                                    rows={3}
                                    placeholder={field.placeholder}
                                    value={customResponses[field.key] || ''}
                                    onChange={(e) => setCustomResponses((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                    className={fieldClass(fieldErrors[`custom_${field.key}`])}
                                  />
                                ) : field.type === 'select' || field.type === 'yes_no' ? (
                                  <select
                                    value={customResponses[field.key] || ''}
                                    onChange={(e) => setCustomResponses((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                    className={fieldClass(fieldErrors[`custom_${field.key}`])}
                                  >
                                    <option value="">Select…</option>
                                    {(field.type === 'yes_no' ? ['Yes', 'No'] : (field.options || [])).map((opt) => (
                                      <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                  </select>
                                ) : field.type === 'checkbox' ? (
                                  <label className="flex items-center gap-2 text-sm text-stone-700">
                                    <input
                                      type="checkbox"
                                      checked={!!customResponses[field.key]}
                                      onChange={(e) => setCustomResponses((prev) => ({ ...prev, [field.key]: e.target.checked ? 'Yes' : '' }))}
                                    />
                                    {field.placeholder || 'Yes'}
                                  </label>
                                ) : (
                                  <input
                                    type={field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
                                    placeholder={field.placeholder}
                                    value={customResponses[field.key] || ''}
                                    onChange={(e) => setCustomResponses((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                    className={fieldClass(fieldErrors[`custom_${field.key}`])}
                                  />
                                )}
                                {fieldErrors[`custom_${field.key}`] ? (
                                  <p className="text-[11px] text-rose-600 mt-1">{fieldErrors[`custom_${field.key}`]}</p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {submitError ? (
                      <div className="p-3 bg-rose-50 text-rose-700 text-sm rounded-xl flex items-start border border-rose-100">
                        <AlertCircle className="h-4 w-4 mr-2 shrink-0 mt-0.5" />
                        {submitError}
                      </div>
                    ) : null}

                    <div className="flex gap-2 pt-1">
                      {step > 0 ? (
                        <button type="button" onClick={goBack} className="btn-secondary flex-1 justify-center">
                          <ChevronLeft size={15} /> Back
                        </button>
                      ) : null}
                      {step < STEPS.length - 1 ? (
                        <button
                          type="button"
                          onClick={goNext}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                          style={{ backgroundColor: brand }}
                        >
                          Continue <ChevronRight size={15} />
                        </button>
                      ) : (
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
                          style={{ backgroundColor: brand }}
                        >
                          {isSubmitting ? 'Submitting…' : 'Submit application'}
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-stone-200 py-5 mt-auto">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-stone-500">
          {org?.hidePoweredBy ? (
            <span>{org?.name}</span>
          ) : (
            <>Powered by <a href="/" className="font-semibold text-stone-800 hover:text-brand-700">People Connect HR</a></>
          )}
        </div>
      </footer>
    </div>
  );
};

export default JobDetailPublic;
