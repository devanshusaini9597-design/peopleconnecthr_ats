import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Briefcase, Clock, UploadCloud, CheckCircle, AlertCircle,
  Building, FileText, ChevronRight, ChevronLeft, User, IndianRupee, Send, Lock,
} from 'lucide-react';
import API_URL from '../config';
import { employmentLabel } from './jobs/jobsConstants';
import PublicAnnouncementBanner from './PublicAnnouncementBanner';
import PremiumSelect from './ui/PremiumSelect';
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

function splitJobLocations(job) {
  const fromArr = Array.isArray(job?.locations)
    ? job.locations.map((l) => String(l || '').trim()).filter(Boolean)
    : [];
  if (fromArr.length) return [...new Set(fromArr)];
  const raw = String(job?.location || '').trim();
  if (!raw) return [];
  return [...new Set(raw.split(/[,|/]/).map((s) => s.trim()).filter(Boolean))];
}

function fieldClass(err, locked = false) {
  return `w-full rounded-xl border px-3.5 py-2.5 text-sm font-medium outline-none transition ${
    locked
      ? 'border-stone-200 bg-stone-50 text-stone-700 cursor-not-allowed'
      : err
        ? 'border-rose-400 bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
        : 'border-stone-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15'
  }`;
}

function FieldLabel({ children, required, hint }) {
  return (
    <label className="block text-[11px] font-semibold text-stone-600 mb-1.5 tracking-wide">
      {children}
      {required ? <span className="text-rose-500 ml-0.5" aria-hidden="true">*</span> : null}
      {hint ? <span className="ml-1.5 font-medium text-stone-400 normal-case tracking-normal">{hint}</span> : null}
    </label>
  );
}

const JobDetailPublic = () => {
  const { orgSlug, jobId } = useParams();
  const [searchParams] = useSearchParams();
  const [job, setJob] = useState(null);
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const formRef = useRef(null);
  const formBodyRef = useRef(null);

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
  const jobLocations = useMemo(() => splitJobLocations(job), [job]);
  const multiLocation = jobLocations.length > 1;

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
        const nextJob = data.job || data.data;
        setJob(nextJob);
        setOrg(data.organization);
        setApplicationForm(data.applicationForm || null);
        const title = nextJob?.title || '';
        const locs = splitJobLocations(nextJob);
        setFormData((prev) => ({
          ...prev,
          position: title || prev.position,
          location: locs.length === 1 ? locs[0] : (locs.includes(prev.location) ? prev.location : ''),
        }));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
  }, [orgSlug, jobId]);

  const focusFirstError = useCallback((errs) => {
    requestAnimationFrame(() => {
      const root = formBodyRef.current;
      if (!root) return;
      const firstKey = Object.keys(errs || {})[0];
      if (!firstKey) return;
      const el = root.querySelector(`[data-field="${firstKey}"]`)
        || root.querySelector('[aria-invalid="true"]')
        || root.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button[data-field]');
      if (el && typeof el.focus === 'function') {
        el.focus({ preventScroll: false });
        el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      }
    });
  }, []);

  const setField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    setSubmitError('');
  };

  const visibleCustomFields = useMemo(() => {
    const fields = applicationForm?.fields || [];
    return fields.filter((field) => {
      const rule = field.showWhen;
      if (!rule?.fieldKey) return true;
      return String(customResponses[rule.fieldKey] ?? '') === String(rule.equals ?? '');
    });
  }, [applicationForm, customResponses]);

  const validateStep = (idx, { silent = false } = {}) => {
    const errs = {};
    if (idx === 0) {
      if (!formData.name.trim()) errs.name = 'Full name is required';
      if (!formData.email.trim()) errs.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) errs.email = 'Enter a valid email';
      if (!formData.phone.trim()) errs.phone = 'Phone number is required';
      if (multiLocation && !formData.location.trim()) errs.location = 'Select a location';
    }
    if (idx === 1) {
      if (!formData.experience.trim()) errs.experience = 'Experience is required';
      if (!formData.ctc.trim()) errs.ctc = 'Current CTC is required';
      if (!formData.expectedCtc.trim()) errs.expectedCtc = 'Expected CTC is required';
      if (!formData.noticePeriod.trim()) errs.noticePeriod = 'Notice period is required';
      if (!resumeFile) errs.resume = 'Resume / CV is required';
    }
    if (idx === 2) {
      if (!formData.source.trim()) errs.source = 'Please tell us how you heard about us';
      for (const field of visibleCustomFields) {
        if (!field.required) continue;
        const val = customResponses[field.key];
        if (val == null || String(val).trim() === '') {
          errs[`custom_${field.key}`] = `${field.label} is required`;
        }
      }
    }
    if (!silent) {
      setFieldErrors(errs);
      if (Object.keys(errs).length) focusFirstError(errs);
    }
    return Object.keys(errs).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setSubmitError('');
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setSubmitError('');
    setStep((s) => Math.max(s - 1, 0));
  };

  const pickResume = (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      const errs = { resume: 'File size exceeds 10MB limit.' };
      setFieldErrors((prev) => ({ ...prev, ...errs }));
      focusFirstError(errs);
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
    // Never submit from earlier steps (Enter / accidental submit)
    if (step !== STEPS.length - 1) {
      goNext();
      return;
    }
    if (!validateStep(0, { silent: true })) {
      setStep(0);
      validateStep(0);
      return;
    }
    if (!validateStep(1, { silent: true })) {
      setStep(1);
      validateStep(1);
      return;
    }
    if (!validateStep(2)) return;

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const fd = new FormData();
      fd.append('name', formData.name.trim());
      fd.append('email', formData.email.trim());
      fd.append('phone', formData.phone.trim());
      fd.append('position', (formData.position || job?.title || '').trim());
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

  const onFormKeyDown = (e) => {
    if (e.key !== 'Enter' || e.target?.tagName === 'TEXTAREA') return;
    e.preventDefault();
    if (step < STEPS.length - 1) goNext();
  };

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f7f9] flex flex-col items-center justify-center gap-3 px-4">
        <div className="h-11 w-11 rounded-full border-2 border-stone-200 border-t-brand-600 animate-spin" />
        <p className="text-sm font-semibold text-stone-500">Loading role…</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f7f9] px-4">
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
  const locationOptions = jobLocations.map((loc) => ({ value: loc, label: loc }));

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-stone-900 flex flex-col">
      <PublicAnnouncementBanner orgSlug={orgSlug} />
      <header className="bg-white/95 backdrop-blur border-b border-stone-200/80 py-3.5 px-4 sm:px-6 shrink-0 sticky top-0 z-20">
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          <div className="lg:col-span-7 space-y-5">
            <div
              className="rounded-2xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              style={{ borderTopColor: brand, borderTopWidth: 3 }}
            >
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="inline-flex items-center rounded-md bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  Open role
                </span>
                {job.industry ? (
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide">{job.industry}</span>
                ) : null}
              </div>
              <h1 className="text-3xl sm:text-[2.15rem] font-bold tracking-tight text-stone-900 mb-4 leading-tight">{job.title}</h1>
              <div className="flex flex-wrap gap-2 text-sm text-stone-600 mb-6">
                {job.clientName ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-stone-50 border border-stone-200/80 px-2.5 py-1 text-[13px] font-medium">
                    <Building className="h-3.5 w-3.5 text-stone-400" />{job.clientName}
                  </span>
                ) : null}
                {job.location ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-stone-50 border border-stone-200/80 px-2.5 py-1 text-[13px] font-medium">
                    <MapPin className="h-3.5 w-3.5 text-stone-400" />{job.location}
                  </span>
                ) : null}
                {job.employmentType ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-stone-50 border border-stone-200/80 px-2.5 py-1 text-[13px] font-medium">
                    <Clock className="h-3.5 w-3.5 text-stone-400" />{employmentLabel(job.employmentType)}
                  </span>
                ) : null}
                {job.experience ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-stone-50 border border-stone-200/80 px-2.5 py-1 text-[13px] font-medium">
                    <Briefcase className="h-3.5 w-3.5 text-stone-400" />{job.experience}
                  </span>
                ) : null}
              </div>
              <div className="prose prose-stone max-w-none text-stone-700 prose-p:leading-relaxed prose-headings:text-stone-900">
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.description) }} />
              </div>
            </div>

            {Array.isArray(job.skills) && job.skills.length > 0 ? (
              <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <h3 className="text-sm font-bold uppercase tracking-wide text-stone-500 mb-3">Required skills</h3>
                <div className="flex flex-wrap gap-2">
                  {job.skills.map((skill) => (
                    <span key={skill} className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-brand-50 text-brand-800 border border-brand-100">
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
                className="w-full text-white font-bold py-3.5 px-8 rounded-xl shadow-lg shadow-stone-900/15"
                style={{ backgroundColor: brand }}
              >
                Apply for this position
              </button>
            </div>
          </div>

          <div className="lg:col-span-5" ref={formRef}>
            <div className="rounded-2xl border border-stone-200/90 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)] overflow-hidden lg:sticky lg:top-24">
              <div className="h-1 bg-stone-100">
                <div className="h-full transition-all duration-300 ease-out" style={{ width: `${progress}%`, backgroundColor: brand }} />
              </div>
              <div className="p-5 sm:p-6">
                <div className="mb-5">
                  <h3 className="text-xl font-bold text-stone-900 tracking-tight">Apply now</h3>
                  <p className="text-[13px] text-stone-500 mt-1 leading-relaxed">
                    Step {step + 1} of {STEPS.length} — your application goes straight to the hiring team.
                  </p>
                </div>

                {submitSuccess ? (
                  <div className="text-center py-8">
                    <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-emerald-50 border border-emerald-100 mb-4">
                      <CheckCircle className="h-8 w-8 text-emerald-600" />
                    </div>
                    <h4 className="text-lg font-bold text-stone-900 mb-2">Application submitted</h4>
                    <p className="text-sm text-stone-600 mb-5 leading-relaxed">
                      Thank you. Your application for <span className="font-semibold">{job.title}</span> has been received.
                    </p>
                    <Link to={`/careers/${orgSlug}`} className="text-brand-700 font-semibold hover:underline text-sm">
                      Explore other roles
                    </Link>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} onKeyDown={onFormKeyDown} className="space-y-4" noValidate>
                    <div className="grid grid-cols-3 gap-1.5 mb-1">
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
                            className={`rounded-xl px-2 py-2.5 text-[10px] font-bold uppercase tracking-wide flex flex-col items-center gap-1 border transition ${
                              active
                                ? 'border-brand-500 bg-brand-50 text-brand-800 shadow-sm'
                                : done
                                  ? 'border-stone-200 bg-stone-50 text-stone-700'
                                  : 'border-stone-100 text-stone-400'
                            }`}
                          >
                            <Icon size={14} strokeWidth={2.25} />
                            {s.label}
                          </button>
                        );
                      })}
                    </div>

                    <div ref={formBodyRef} className="min-h-[280px]">
                      {step === 0 ? (
                        <div className="space-y-3.5 animate-fade-in">
                          <div>
                            <FieldLabel required>Full name</FieldLabel>
                            <input
                              data-field="name"
                              aria-invalid={!!fieldErrors.name}
                              className={fieldClass(fieldErrors.name)}
                              value={formData.name}
                              onChange={(e) => setField('name', e.target.value)}
                              autoComplete="name"
                              autoFocus
                            />
                            {fieldErrors.name ? <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.name}</p> : null}
                          </div>
                          <div>
                            <FieldLabel required>Email</FieldLabel>
                            <input
                              data-field="email"
                              type="email"
                              aria-invalid={!!fieldErrors.email}
                              className={fieldClass(fieldErrors.email)}
                              value={formData.email}
                              onChange={(e) => setField('email', e.target.value)}
                              autoComplete="email"
                            />
                            {fieldErrors.email ? <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.email}</p> : null}
                          </div>
                          <div>
                            <FieldLabel required>Phone</FieldLabel>
                            <input
                              data-field="phone"
                              type="tel"
                              aria-invalid={!!fieldErrors.phone}
                              className={fieldClass(fieldErrors.phone)}
                              value={formData.phone}
                              onChange={(e) => setField('phone', e.target.value)}
                              autoComplete="tel"
                            />
                            {fieldErrors.phone ? <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.phone}</p> : null}
                          </div>
                          <div>
                            <FieldLabel hint="(from job)">Job title</FieldLabel>
                            <div className="relative">
                              <input
                                className={fieldClass(false, true)}
                                value={formData.position || job.title}
                                disabled
                                readOnly
                              />
                              <Lock size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" />
                            </div>
                          </div>
                          <div>
                            <FieldLabel>Current company</FieldLabel>
                            <input
                              className={fieldClass()}
                              value={formData.companyName}
                              onChange={(e) => setField('companyName', e.target.value)}
                              placeholder="Where you work now (optional)"
                            />
                          </div>
                          <div>
                            <FieldLabel required={multiLocation} hint={multiLocation ? '' : '(from job)'}>
                              Location
                            </FieldLabel>
                            {multiLocation ? (
                              <div data-field="location">
                                <PremiumSelect
                                  variant="list"
                                  searchable={jobLocations.length > 6}
                                  icon={MapPin}
                                  value={formData.location}
                                  onChange={(v) => setField('location', v)}
                                  options={locationOptions}
                                  placeholder="Select location"
                                  error={!!fieldErrors.location}
                                />
                              </div>
                            ) : (
                              <div className="relative">
                                <input
                                  className={fieldClass(false, true)}
                                  value={formData.location || job.location || ''}
                                  disabled
                                  readOnly
                                />
                                <Lock size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" />
                              </div>
                            )}
                            {fieldErrors.location ? <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.location}</p> : null}
                          </div>
                        </div>
                      ) : null}

                      {step === 1 ? (
                        <div className="space-y-3.5 animate-fade-in">
                          <div>
                            <FieldLabel required>Experience (years)</FieldLabel>
                            <input
                              data-field="experience"
                              aria-invalid={!!fieldErrors.experience}
                              className={fieldClass(fieldErrors.experience)}
                              value={formData.experience}
                              onChange={(e) => setField('experience', e.target.value)}
                              placeholder="e.g. 5"
                              autoFocus
                            />
                            {fieldErrors.experience ? <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.experience}</p> : null}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <FieldLabel required>Current CTC</FieldLabel>
                              <input
                                data-field="ctc"
                                aria-invalid={!!fieldErrors.ctc}
                                className={fieldClass(fieldErrors.ctc)}
                                value={formData.ctc}
                                onChange={(e) => setField('ctc', e.target.value)}
                                placeholder="e.g. 12 LPA"
                              />
                              {fieldErrors.ctc ? <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.ctc}</p> : null}
                            </div>
                            <div>
                              <FieldLabel required>Expected CTC</FieldLabel>
                              <input
                                data-field="expectedCtc"
                                aria-invalid={!!fieldErrors.expectedCtc}
                                className={fieldClass(fieldErrors.expectedCtc)}
                                value={formData.expectedCtc}
                                onChange={(e) => setField('expectedCtc', e.target.value)}
                                placeholder="e.g. 15 LPA"
                              />
                              {fieldErrors.expectedCtc ? <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.expectedCtc}</p> : null}
                            </div>
                          </div>
                          <div>
                            <FieldLabel required>Notice period</FieldLabel>
                            <input
                              data-field="noticePeriod"
                              aria-invalid={!!fieldErrors.noticePeriod}
                              className={fieldClass(fieldErrors.noticePeriod)}
                              value={formData.noticePeriod}
                              onChange={(e) => setField('noticePeriod', e.target.value)}
                              placeholder="e.g. 30 days / Immediate"
                            />
                            {fieldErrors.noticePeriod ? <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.noticePeriod}</p> : null}
                          </div>
                          <div>
                            <FieldLabel required>Resume / CV</FieldLabel>
                            <div
                              data-field="resume"
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                pickResume(e.dataTransfer.files?.[0]);
                              }}
                              className={`mt-1 flex justify-center px-4 py-7 border-2 border-dashed rounded-xl transition-colors ${
                                resumeFile
                                  ? 'border-brand-500 bg-brand-50/60'
                                  : fieldErrors.resume
                                    ? 'border-rose-300 bg-rose-50/40'
                                    : 'border-stone-200 bg-stone-50 hover:border-brand-400'
                              }`}
                            >
                              <div className="space-y-1.5 text-center">
                                {resumeFile ? <FileText className="mx-auto h-9 w-9 text-brand-600" /> : <UploadCloud className="mx-auto h-9 w-9 text-stone-400" />}
                                <label className="relative cursor-pointer text-sm font-semibold text-brand-700">
                                  <span>{resumeFile ? 'Change file' : 'Upload resume'}</span>
                                  <input type="file" className="sr-only" accept=".pdf,.doc,.docx" onChange={(e) => pickResume(e.target.files?.[0])} />
                                </label>
                                <p className="text-[11px] text-stone-500">{resumeFile ? resumeFile.name : 'PDF, DOC, DOCX · max 10MB'}</p>
                              </div>
                            </div>
                            {fieldErrors.resume ? <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.resume}</p> : null}
                          </div>
                        </div>
                      ) : null}

                      {step === 2 ? (
                        <div className="space-y-3.5 animate-fade-in">
                          <div data-field="source">
                            <FieldLabel required>How did you hear about us?</FieldLabel>
                            <PremiumSelect
                              variant="list"
                              value={formData.source}
                              onChange={(v) => setField('source', v)}
                              options={SOURCE_OPTIONS}
                              placeholder="Select an option"
                              error={!!fieldErrors.source}
                              allowClear
                            />
                            {fieldErrors.source ? <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.source}</p> : null}
                          </div>
                          <div>
                            <FieldLabel>Cover note</FieldLabel>
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
                                  <FieldLabel required={!!field.required}>{field.label}</FieldLabel>
                                  {field.type === 'textarea' ? (
                                    <textarea
                                      data-field={`custom_${field.key}`}
                                      rows={3}
                                      placeholder={field.placeholder}
                                      value={customResponses[field.key] || ''}
                                      onChange={(e) => setCustomResponses((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                      className={fieldClass(fieldErrors[`custom_${field.key}`])}
                                      aria-invalid={!!fieldErrors[`custom_${field.key}`]}
                                    />
                                  ) : field.type === 'select' || field.type === 'yes_no' ? (
                                    <div data-field={`custom_${field.key}`}>
                                      <PremiumSelect
                                        variant="list"
                                        value={customResponses[field.key] || ''}
                                        onChange={(v) => setCustomResponses((prev) => ({ ...prev, [field.key]: v }))}
                                        options={(field.type === 'yes_no' ? ['Yes', 'No'] : (field.options || [])).map((opt) => ({ value: opt, label: opt }))}
                                        placeholder="Select…"
                                        error={!!fieldErrors[`custom_${field.key}`]}
                                      />
                                    </div>
                                  ) : field.type === 'checkbox' ? (
                                    <label className="flex items-center gap-2 text-sm text-stone-700">
                                      <input
                                        type="checkbox"
                                        data-field={`custom_${field.key}`}
                                        checked={!!customResponses[field.key]}
                                        onChange={(e) => setCustomResponses((prev) => ({ ...prev, [field.key]: e.target.checked ? 'Yes' : '' }))}
                                      />
                                      {field.placeholder || 'Yes'}
                                    </label>
                                  ) : (
                                    <input
                                      data-field={`custom_${field.key}`}
                                      type={field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
                                      placeholder={field.placeholder}
                                      value={customResponses[field.key] || ''}
                                      onChange={(e) => setCustomResponses((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                      className={fieldClass(fieldErrors[`custom_${field.key}`])}
                                      aria-invalid={!!fieldErrors[`custom_${field.key}`]}
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
                    </div>

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
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
                          style={{ backgroundColor: brand }}
                        >
                          Continue <ChevronRight size={15} />
                        </button>
                      ) : (
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70 shadow-sm"
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
