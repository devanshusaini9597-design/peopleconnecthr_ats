import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Briefcase, Clock, UploadCloud, CheckCircle, AlertCircle,
  Building, FileText, ChevronRight, ChevronLeft, User, IndianRupee, Send, Lock, X,
} from 'lucide-react';
import API_URL from '../config';
import { employmentLabel } from './jobs/jobsConstants';
import PublicAnnouncementBanner from './PublicAnnouncementBanner';
import PremiumSelect from './ui/PremiumSelect';
import { resolveOrgLogoSrc } from '../utils/orgLogo';
import { sanitizeHtml } from '../utils/sanitizeHtml';
import { toast } from './Toast';
import { getTurnstileToken } from '../utils/turnstile';
import {
  DEFAULT_CTC_BANDS, DEFAULT_EXPECTED_CTC, DEFAULT_NOTICE_PERIODS,
} from '../utils/ctcRanges';

const STEPS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'experience', label: 'Experience', icon: IndianRupee },
  { id: 'application', label: 'Application', icon: Send },
];

const FALLBACK_EXPERIENCE = [
  'FRESHER',
  ...Array.from({ length: 30 }, (_, i) => String(i + 1)),
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
  coverLetter: '',
};

function appliedStorageKey(orgSlug, jobId) {
  return `pch_careers_applied_${orgSlug}_${jobId}`;
}

function splitJobLocations(job) {
  const tokens = [];
  const push = (raw) => {
    String(raw || '')
      .split(/[,|/·•;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((t) => tokens.push(t));
  };
  if (Array.isArray(job?.locations) && job.locations.length) {
    job.locations.forEach(push);
  } else {
    push(job?.location);
  }
  return [...new Set(tokens)];
}

function toOptions(list) {
  return (list || []).filter(Boolean).map((v) => ({ value: String(v), label: String(v) }));
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

function isValidPersonName(name) {
  const t = String(name || '').trim();
  if (t.length < 2) return false;
  if (/^\d+$/.test(t)) return false;
  if ((t.match(/\d/g) || []).length > 2) return false;
  // Letters (incl. unicode), spaces, apostrophe, hyphen, period
  return /^[\p{L}\s.'’-]+$/u.test(t);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || '').trim());
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

function SuccessPanel({ jobTitle, brand, orgSlug }) {
  return (
    <div className="text-center py-5 px-1">
      <div
        className="mx-auto flex items-center justify-center h-16 w-16 rounded-2xl mb-4 shadow-sm"
        style={{ backgroundColor: `${brand}14`, border: `1px solid ${brand}30` }}
      >
        <CheckCircle className="h-8 w-8" style={{ color: brand }} strokeWidth={2} />
      </div>
      <h4 className="text-lg font-bold text-stone-900 mb-1.5 tracking-tight">Application received</h4>
      <p className="text-sm text-stone-600 mb-5 leading-relaxed max-w-[22rem] mx-auto">
        Thank you for applying to{' '}
        <span className="font-semibold text-stone-800">{jobTitle}</span>. Our recruiting team will review
        your profile and contact you if there is a match.
      </p>
      <Link
        to={`/careers/${orgSlug}`}
        className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
        style={{ backgroundColor: brand }}
      >
        Browse other openings
      </Link>
    </div>
  );
}

function AlreadyAppliedPanel({ jobTitle, brand, orgSlug, onCloseModal }) {
  return (
    <div className="text-center py-5 px-1">
      <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-2xl bg-amber-50 border border-amber-100 mb-4 shadow-sm">
        <AlertCircle className="h-8 w-8 text-amber-600" strokeWidth={2} />
      </div>
      <h4 className="text-lg font-bold text-stone-900 mb-1.5 tracking-tight">Application already received</h4>
      <p className="text-sm text-stone-600 mb-5 leading-relaxed max-w-[22rem] mx-auto">
        We already have an application on file for{' '}
        <span className="font-semibold text-stone-800">{jobTitle}</span> with this email or mobile.
        You can still apply to other roles with the same details — you just cannot apply twice to the same job.
      </p>
      <div className="flex flex-col gap-2">
        <Link
          to={`/careers/${orgSlug}`}
          className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
          style={{ backgroundColor: brand }}
        >
          Browse other openings
        </Link>
        {onCloseModal ? (
          <button type="button" onClick={onCloseModal} className="btn-secondary justify-center">
            Close
          </button>
        ) : null}
      </div>
    </div>
  );
}

const JobDetailPublic = () => {
  const { orgSlug, jobId } = useParams();
  const navigate = useNavigate();
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
  const [fieldOptions, setFieldOptions] = useState({
    experience: FALLBACK_EXPERIENCE,
    ctc: DEFAULT_CTC_BANDS,
    expectedCtc: DEFAULT_EXPECTED_CTC,
    noticePeriod: DEFAULT_NOTICE_PERIODS,
  });
  const [resumeFile, setResumeFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [alreadyModalOpen, setAlreadyModalOpen] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const navLockRef = useRef(false);
  const [applyOtpToken, setApplyOtpToken] = useState('');
  const [emailVerifiedToken, setEmailVerifiedToken] = useState('');
  const [emailVerifiedFor, setEmailVerifiedFor] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpResendAt, setOtpResendAt] = useState(0);
  const [otpTick, setOtpTick] = useState(0);

  const brand = org?.brandColor || '#0d9488';
  const jobLocations = useMemo(() => splitJobLocations(job), [job]);
  const multiLocation = jobLocations.length > 1;
  const displayJobCode = job?.jobCode || '';
  const emailVerified = Boolean(
    emailVerifiedToken
    && emailVerifiedFor
    && emailVerifiedFor === formData.email.trim().toLowerCase(),
  );
  const otpResendWaitSec = Math.max(0, Math.ceil((otpResendAt - Date.now()) / 1000));
  void otpTick;

  useEffect(() => {
    if (!otpResendAt) return undefined;
    const id = window.setInterval(() => {
      if (Date.now() >= otpResendAt) {
        setOtpResendAt(0);
        window.clearInterval(id);
      } else {
        setOtpTick((n) => n + 1);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [otpResendAt]);

  const experienceOptions = useMemo(() => toOptions(fieldOptions.experience), [fieldOptions.experience]);
  const ctcOptions = useMemo(() => toOptions(fieldOptions.ctc), [fieldOptions.ctc]);
  const expectedCtcOptions = useMemo(() => toOptions(fieldOptions.expectedCtc), [fieldOptions.expectedCtc]);
  const noticeOptions = useMemo(() => toOptions(fieldOptions.noticePeriod), [fieldOptions.noticePeriod]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(appliedStorageKey(orgSlug, jobId));
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed?.email) return;
      // Re-verify against ATS (not trust localStorage alone)
      (async () => {
        try {
          const res = await fetch(
            `${API_URL}/api/careers/${orgSlug}/jobs/${jobId}/application-status?email=${encodeURIComponent(parsed.email)}`,
          );
          const data = await res.json().catch(() => ({}));
          if (data.alreadyApplied) {
            setAlreadyApplied(true);
            setFormData((prev) => (prev.email ? prev : { ...prev, email: parsed.email }));
          } else {
            localStorage.removeItem(appliedStorageKey(orgSlug, jobId));
          }
        } catch {
          setAlreadyApplied(true);
        }
      })();
    } catch {
      /* ignore */
    }
  }, [orgSlug, jobId]);

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
        if (data.fieldOptions) {
          setFieldOptions({
            experience: data.fieldOptions.experience?.length ? data.fieldOptions.experience : FALLBACK_EXPERIENCE,
            ctc: data.fieldOptions.ctc?.length ? data.fieldOptions.ctc : DEFAULT_CTC_BANDS,
            expectedCtc: data.fieldOptions.expectedCtc?.length ? data.fieldOptions.expectedCtc : DEFAULT_EXPECTED_CTC,
            noticePeriod: data.fieldOptions.noticePeriod?.length ? data.fieldOptions.noticePeriod : DEFAULT_NOTICE_PERIODS,
          });
        }
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

  const markAlreadyApplied = useCallback((email) => {
    setAlreadyApplied(true);
    try {
      localStorage.setItem(
        appliedStorageKey(orgSlug, jobId),
        JSON.stringify({ email: String(email || '').toLowerCase(), at: Date.now() }),
      );
    } catch {
      /* ignore */
    }
  }, [orgSlug, jobId]);

  const checkAlreadyApplied = useCallback(async (email, phone) => {
    const normalized = String(email || '').trim().toLowerCase();
    const phoneDigits = String(phone || '').replace(/\D/g, '');
    const hasEmail = normalized && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized);
    const hasPhone = phoneDigits.length === 10;
    if (!hasEmail && !hasPhone) return false;
    setCheckingEmail(true);
    try {
      const params = new URLSearchParams();
      if (hasEmail) params.set('email', normalized);
      if (hasPhone) params.set('phone', phoneDigits);
      const res = await fetch(
        `${API_URL}/api/careers/${orgSlug}/jobs/${jobId}/application-status?${params.toString()}`,
      );
      const data = await res.json().catch(() => ({}));
      if (data.alreadyApplied) {
        markAlreadyApplied(normalized || phoneDigits);
        toast.warning('You have already applied for this job');
        setAlreadyModalOpen(true);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setCheckingEmail(false);
    }
  }, [orgSlug, jobId, markAlreadyApplied]);

  const clearEmailVerification = useCallback(() => {
    setApplyOtpToken('');
    setEmailVerifiedToken('');
    setEmailVerifiedFor('');
    setOtpCode('');
    setOtpSent(false);
    setOtpError('');
  }, []);

  const sendEmailOtp = useCallback(async () => {
    const email = formData.email.trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      setFieldErrors((prev) => ({ ...prev, email: 'Enter a valid email address' }));
      toast.warning('Enter a valid email address');
      return false;
    }
    const dup = await checkAlreadyApplied(email, formData.phone);
    if (dup) return false;
    setOtpSending(true);
    setOtpError('');
    try {
      let turnstileToken = '';
      try {
        turnstileToken = await getTurnstileToken(API_URL);
      } catch (captchaErr) {
        throw new Error(captchaErr.message || 'Security check failed. Please try again.');
      }
      const res = await fetch(`${API_URL}/api/careers/${orgSlug}/jobs/${jobId}/apply/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: formData.name.trim(),
          applyOtpToken: applyOtpToken || undefined,
          turnstileToken: turnstileToken || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'ALREADY_APPLIED') {
          markAlreadyApplied(email);
          setAlreadyModalOpen(true);
        }
        throw new Error(data.message || 'Could not send verification code');
      }
      setApplyOtpToken(data.applyOtpToken || '');
      setOtpSent(true);
      setEmailVerifiedToken('');
      setEmailVerifiedFor('');
      setOtpCode('');
      setOtpResendAt(Date.now() + ((data.resendInSec || 45) * 1000));
      toast.success('Verification code sent to your email');
      return true;
    } catch (err) {
      setOtpError(err.message || 'Could not send verification code');
      toast.error(err.message || 'Could not send verification code');
      return false;
    } finally {
      setOtpSending(false);
    }
  }, [formData.email, formData.phone, formData.name, orgSlug, jobId, applyOtpToken, checkAlreadyApplied, markAlreadyApplied]);

  const verifyEmailOtp = useCallback(async () => {
    const email = formData.email.trim().toLowerCase();
    const code = String(otpCode || '').trim();
    if (!applyOtpToken) {
      setOtpError('Send a verification code first');
      return false;
    }
    if (!/^\d{6}$/.test(code)) {
      setOtpError('Enter the 6-digit code from your email');
      return false;
    }
    setOtpVerifying(true);
    setOtpError('');
    try {
      const res = await fetch(`${API_URL}/api/careers/${orgSlug}/jobs/${jobId}/apply/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applyOtpToken, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.applyOtpToken) setApplyOtpToken(data.applyOtpToken);
        throw new Error(data.message || 'Incorrect code');
      }
      setEmailVerifiedToken(data.emailVerifiedToken || '');
      setEmailVerifiedFor(data.email || email);
      setOtpError('');
      toast.success('Email verified');
      return true;
    } catch (err) {
      setOtpError(err.message || 'Incorrect code');
      return false;
    } finally {
      setOtpVerifying(false);
    }
  }, [formData.email, otpCode, applyOtpToken, orgSlug, jobId]);

  const focusFirstError = useCallback((errs) => {
    requestAnimationFrame(() => {
      const root = formBodyRef.current;
      if (!root) return;
      const firstKey = Object.keys(errs || {})[0];
      if (!firstKey) return;
      const el = root.querySelector(`[data-field="${firstKey}"]`)
        || root.querySelector('[aria-invalid="true"]')
        || root.querySelector('input:not([disabled]), textarea:not([disabled]), button[data-field]');
      if (el && typeof el.focus === 'function') {
        el.focus({ preventScroll: false });
        el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      }
    });
  }, []);

  const validateFieldLive = (name, value) => {
    let msg = '';
    if (name === 'name') {
      const v = String(value || '').trim();
      if (v && !isValidPersonName(v)) msg = 'Enter a valid name using letters only';
    }
    if (name === 'email') {
      const v = String(value || '').trim();
      if (v && !isValidEmail(v)) msg = 'Enter a valid email address';
    }
    if (name === 'phone') {
      const digits = String(value || '').replace(/\D/g, '');
      // Only flag incomplete numbers once the field has a full attempt (10) or is empty after typing
      if (digits.length > 0 && digits.length !== 10) msg = 'Enter a valid 10-digit mobile number';
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (msg) next[name] = msg;
      else delete next[name];
      return next;
    });
  };

  const setField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'email') {
      const nextEmail = String(value || '').trim().toLowerCase();
      if (emailVerifiedFor && nextEmail !== emailVerifiedFor) {
        clearEmailVerification();
      }
      validateFieldLive(name, value);
    } else if (name === 'name') {
      validateFieldLive(name, value);
    } else if (name === 'phone') {
      // Clear error once a complete number is entered; otherwise wait for blur
      const digits = String(value || '').replace(/\D/g, '');
      if (digits.length === 10 || !digits) {
        setFieldErrors((prev) => {
          if (!prev.phone) return prev;
          const next = { ...prev };
          delete next.phone;
          return next;
        });
      }
    } else if (fieldErrors[name]) {
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
      const name = formData.name.trim();
      if (!name) errs.name = 'Full name is required';
      else if (!isValidPersonName(name)) errs.name = 'Enter a valid name using letters only';
      const email = formData.email.trim().toLowerCase();
      if (!email) errs.email = 'Email is required';
      else if (!isValidEmail(email)) errs.email = 'Enter a valid email address';
      const digits = String(formData.phone || '').replace(/\D/g, '');
      if (!digits) errs.phone = 'Mobile number is required';
      else if (digits.length !== 10) errs.phone = 'Enter a valid 10-digit mobile number';
      if (multiLocation && !formData.location.trim()) errs.location = 'Select a location';
      if (!emailVerified) errs.otp = 'Verify your email with the code we send before continuing';
    }
    if (idx === 1) {
      if (!formData.experience.trim()) errs.experience = 'Experience is required';
      if (!formData.ctc.trim()) errs.ctc = 'Current CTC is required';
      if (!formData.expectedCtc.trim()) errs.expectedCtc = 'Expected CTC is required';
      if (!formData.noticePeriod.trim()) errs.noticePeriod = 'Notice period is required';
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
    if (!silent) {
      setFieldErrors(errs);
      if (Object.keys(errs).length) {
        focusFirstError(errs);
        const firstMsg = errs[Object.keys(errs)[0]];
        if (firstMsg) toast.warning(firstMsg);
      }
    }
    return Object.keys(errs).length === 0;
  };

  const formIsDirty = useMemo(() => {
    if (submitSuccess || alreadyApplied) return false;
    if (step > 0 || resumeFile) return true;
    return Object.entries(formData).some(([k, v]) => {
      if (k === 'position' || k === 'location') return false;
      return String(v || '').trim().length > 0;
    });
  }, [formData, step, resumeFile, submitSuccess, alreadyApplied]);

  const step0Ready = useMemo(() => {
    const name = formData.name.trim();
    const email = formData.email.trim().toLowerCase();
    const digits = String(formData.phone || '').replace(/\D/g, '');
    if (!name || !isValidPersonName(name)) return false;
    if (!email || !isValidEmail(email)) return false;
    if (digits.length !== 10) return false;
    if (multiLocation && !formData.location.trim()) return false;
    if (!emailVerified) return false;
    return true;
  }, [formData, multiLocation, emailVerified]);

  const step1Ready = useMemo(() => (
    Boolean(
      formData.experience.trim()
      && formData.ctc.trim()
      && formData.expectedCtc.trim()
      && formData.noticePeriod.trim()
      && resumeFile,
    )
  ), [formData.experience, formData.ctc, formData.expectedCtc, formData.noticePeriod, resumeFile]);

  const step2Ready = useMemo(() => {
    for (const field of visibleCustomFields) {
      if (!field.required) continue;
      const val = customResponses[field.key];
      if (val == null || String(val).trim() === '') return false;
    }
    return true;
  }, [visibleCustomFields, customResponses]);

  const canAdvance = step === 0 ? step0Ready : step === 1 ? step1Ready : step2Ready;

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!formIsDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [formIsDirty]);

  const requestLeaveCareers = (e) => {
    if (!formIsDirty) return;
    e.preventDefault();
    setLeaveModalOpen(true);
  };

  const confirmLeaveCareers = () => {
    setLeaveModalOpen(false);
    navigate(`/careers/${orgSlug}`);
  };

  const goNext = async () => {
    if (navLockRef.current) return;
    if (!validateStep(step)) return;
    if (step === 0) {
      if (!emailVerified) {
        toast.warning('Verify your email before continuing');
        return;
      }
      const dup = await checkAlreadyApplied(formData.email, formData.phone);
      if (dup) return;
    }
    setSubmitError('');
    navLockRef.current = true;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    // Prevent the same click / Enter from hitting Submit on the next step
    window.setTimeout(() => { navLockRef.current = false; }, 500);
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
      toast.warning(errs.resume);
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
    // Ignore accidental submit while advancing steps (button swap / Enter)
    if (navLockRef.current) return;
    if (alreadyApplied) {
      setAlreadyModalOpen(true);
      toast.warning('You have already applied for this role');
      return;
    }
    // Only the final step may submit — never auto-advance via form submit
    if (step !== STEPS.length - 1) return;

    if (!validateStep(0, { silent: true })) {
      setStep(0);
      validateStep(0);
      return;
    }
    if (!emailVerifiedToken) {
      setStep(0);
      setOtpError('Verify your email before submitting');
      toast.warning('Verify your email before submitting');
      return;
    }
    if (!validateStep(1, { silent: true })) {
      setStep(1);
      validateStep(1);
      return;
    }
    if (!validateStep(2)) return;

    const dup = await checkAlreadyApplied(formData.email, formData.phone);
    if (dup) return;

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const phoneDigits = String(formData.phone || '').replace(/\D/g, '');
      const fd = new FormData();
      fd.append('name', formData.name.trim());
      fd.append('email', formData.email.trim().toLowerCase());
      fd.append('emailVerifiedToken', emailVerifiedToken);
      if (displayJobCode) fd.append('jobCode', displayJobCode);
      fd.append('phone', phoneDigits);
      fd.append('position', (formData.position || job?.title || '').trim());
      fd.append('companyName', formData.companyName.trim());
      fd.append('location', formData.location.trim());
      fd.append('experience', formData.experience.trim());
      fd.append('ctc', formData.ctc.trim());
      fd.append('expectedCtc', formData.expectedCtc.trim());
      fd.append('noticePeriod', formData.noticePeriod.trim());
      fd.append('source', 'Careers Page');
      fd.append('coverLetter', formData.coverLetter.trim());
      fd.append('remark', formData.coverLetter.trim());
      fd.append('customResponses', JSON.stringify(customResponses || {}));
      if (resumeFile) fd.append('resume', resumeFile);

      const res = await fetch(`${API_URL}/api/careers/${orgSlug}/jobs/${jobId}/apply`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'ALREADY_APPLIED' || /already applied/i.test(String(data.message || ''))) {
          markAlreadyApplied(formData.email);
          toast.warning('You have already applied for this role');
          setAlreadyModalOpen(true);
          return;
        }
        if (data.code === 'email_not_verified') {
          setStep(0);
          clearEmailVerification();
          setOtpError(data.message || 'Verify your email before submitting');
          toast.warning(data.message || 'Verify your email before submitting');
          return;
        }
        throw new Error(data.message || 'Application could not be submitted');
      }
      markAlreadyApplied(formData.email);
      setSubmitSuccess(true);
      toast.success('Application submitted successfully');
    } catch (err) {
      setSubmitError(err.message || 'Could not submit application');
      toast.error(err.message || 'Could not submit application');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onFormKeyDown = (e) => {
    if (e.key !== 'Enter' || e.target?.tagName === 'TEXTAREA') return;
    e.preventDefault();
    // Enter never submits — only advances until the final step
    if (step < STEPS.length - 1) goNext();
  };

  const scrollToForm = () => {
    if (alreadyApplied) {
      setAlreadyModalOpen(true);
      toast.warning('You have already applied for this job');
      return;
    }
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
          <Link
            to={`/careers/${orgSlug}`}
            onClick={requestLeaveCareers}
            className="inline-flex items-center text-stone-600 hover:text-brand-700 transition-colors font-semibold text-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to careers
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
                  Now hiring
                </span>
                {displayJobCode ? (
                  <span
                    className="inline-flex items-center rounded-md border border-stone-200 bg-stone-50 text-stone-700 px-2 py-0.5 text-[10px] font-bold tracking-wide"
                    title="Job ID"
                  >
                    <span className="text-stone-400 font-semibold mr-1 normal-case tracking-normal">Job ID</span>
                    <span className="tabular-nums font-mono">{displayJobCode}</span>
                  </span>
                ) : null}
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
                style={{ backgroundColor: alreadyApplied ? '#b45309' : brand }}
              >
                {alreadyApplied ? 'Already applied' : 'Apply for this role'}
              </button>
            </div>
          </div>

          <div className="lg:col-span-5" ref={formRef}>
            <div className="rounded-2xl border border-stone-200/90 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)] overflow-hidden lg:sticky lg:top-24">
              <div className="h-1 bg-stone-100">
                <div className="h-full transition-all duration-300 ease-out" style={{ width: `${alreadyApplied || submitSuccess ? 100 : progress}%`, backgroundColor: brand }} />
              </div>
              <div className="p-5 sm:p-6">
                <div className="mb-5">
                  <h3 className="text-xl font-bold text-stone-900 tracking-tight">
                    {submitSuccess ? 'Application received' : alreadyApplied ? 'Already applied' : 'Submit application'}
                  </h3>
                  <p className="text-[13px] text-stone-500 mt-1 leading-relaxed">
                    {submitSuccess
                      ? 'Your details have been shared with the recruiting team.'
                      : alreadyApplied
                        ? 'An application for this role is already on file for this email.'
                        : `Section ${step + 1} of ${STEPS.length}. Complete each section to finish your application.`}
                  </p>
                </div>

                {submitSuccess ? (
                  <SuccessPanel jobTitle={job.title} brand={brand} orgSlug={orgSlug} />
                ) : alreadyApplied ? (
                  <AlreadyAppliedPanel jobTitle={job.title} brand={brand} orgSlug={orgSlug} />
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
                            onClick={async () => {
                              if (i < step) setStep(i);
                              else if (i > step) {
                                for (let j = step; j < i; j += 1) {
                                  if (!validateStep(j)) return;
                                  if (j === 0) {
                                    if (!emailVerified) {
                                      toast.warning('Verify your email before continuing');
                                      return;
                                    }
                                    const dup = await checkAlreadyApplied(formData.email, formData.phone);
                                    if (dup) return;
                                  }
                                }
                                setStep(i);
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
                          {displayJobCode ? (
                            <div>
                              <FieldLabel hint="(from job)">Job ID</FieldLabel>
                              <div className="relative">
                                <input
                                  className={`${fieldClass(false, true)} font-mono tracking-wide`}
                                  value={displayJobCode}
                                  disabled
                                  readOnly
                                />
                                <Lock size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" />
                              </div>
                            </div>
                          ) : null}
                          <div>
                            <FieldLabel hint="(from job)">Job title</FieldLabel>
                            <div className="relative">
                              <input className={fieldClass(false, true)} value={formData.position || job.title} disabled readOnly />
                              <Lock size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" />
                            </div>
                          </div>
                          <div>
                            <FieldLabel required>Full name</FieldLabel>
                            <input
                              data-field="name"
                              aria-invalid={!!fieldErrors.name}
                              className={fieldClass(fieldErrors.name)}
                              value={formData.name}
                              onChange={(e) => setField('name', e.target.value)}
                              onBlur={(e) => validateFieldLive('name', e.target.value)}
                              autoComplete="name"
                              autoFocus
                            />
                            {fieldErrors.name ? <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.name}</p> : null}
                          </div>
                          <div>
                            <FieldLabel required>Email</FieldLabel>
                            <div className="relative">
                              <input
                                data-field="email"
                                type="email"
                                aria-invalid={!!fieldErrors.email}
                                className={`${fieldClass(fieldErrors.email)} ${emailVerified ? 'pr-28' : 'pr-[5.25rem]'}`}
                                value={formData.email}
                                onChange={(e) => setField('email', e.target.value)}
                                onBlur={() => {
                                  const email = formData.email.trim();
                                  if (email && isValidEmail(email)) {
                                    checkAlreadyApplied(email, formData.phone);
                                  } else if (email) {
                                    validateFieldLive('email', email);
                                  }
                                }}
                                autoComplete="email"
                                disabled={emailVerified}
                              />
                              {emailVerified ? (
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 pointer-events-none">
                                  <CheckCircle size={14} strokeWidth={2.25} />
                                  Verified
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const ok = await sendEmailOtp();
                                    if (ok) setOtpSent(true);
                                  }}
                                  disabled={otpSending || checkingEmail || !isValidEmail(formData.email.trim())}
                                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                                  style={{ backgroundColor: brand }}
                                >
                                  {otpSending ? '…' : otpSent ? 'Resend' : 'Verify'}
                                </button>
                              )}
                            </div>
                            {fieldErrors.email ? <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.email}</p> : null}
                            {checkingEmail ? <p className="text-[11px] text-stone-400 mt-1">Checking application status…</p> : null}
                            {emailVerified ? (
                              <button
                                type="button"
                                className="mt-1 text-[11px] font-semibold text-stone-500 hover:text-stone-800"
                                onClick={clearEmailVerification}
                              >
                                Change email
                              </button>
                            ) : null}
                            {otpSent && !emailVerified ? (
                              <div data-field="otp" className="mt-2 space-y-1.5">
                                <FieldLabel required>Verification code</FieldLabel>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="6-digit code"
                                    aria-invalid={!!otpError || !!fieldErrors.otp}
                                    className={`${fieldClass(otpError || fieldErrors.otp)} font-mono tracking-[0.2em] text-center`}
                                    value={otpCode}
                                    onChange={(e) => {
                                      setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                                      setOtpError('');
                                    }}
                                    autoComplete="one-time-code"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={verifyEmailOtp}
                                    disabled={otpVerifying || otpCode.length !== 6}
                                    className="shrink-0 inline-flex items-center justify-center rounded-xl px-3.5 py-2.5 text-xs font-semibold text-white disabled:opacity-60"
                                    style={{ backgroundColor: brand }}
                                  >
                                    {otpVerifying ? '…' : 'Confirm'}
                                  </button>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[11px] text-stone-400">Code sent to your email · expires in 10 min</p>
                                  {otpResendWaitSec > 0 ? (
                                    <span className="text-[11px] text-stone-400">Resend in {otpResendWaitSec}s</span>
                                  ) : null}
                                </div>
                                {otpError || fieldErrors.otp ? (
                                  <p className="text-[11px] text-rose-600">{otpError || fieldErrors.otp}</p>
                                ) : null}
                              </div>
                            ) : null}
                            {!otpSent && !emailVerified && fieldErrors.otp ? (
                              <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.otp}</p>
                            ) : null}
                          </div>
                          <div>
                            <FieldLabel required>Phone</FieldLabel>
                            <input
                              data-field="phone"
                              type="tel"
                              inputMode="numeric"
                              maxLength={10}
                              aria-invalid={!!fieldErrors.phone}
                              className={fieldClass(fieldErrors.phone)}
                              value={formData.phone}
                              onChange={(e) => setField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                              onBlur={(e) => {
                                validateFieldLive('phone', e.target.value);
                                const digits = String(e.target.value || '').replace(/\D/g, '');
                                if (digits.length === 10) {
                                  checkAlreadyApplied(formData.email, digits);
                                }
                              }}
                              placeholder="10-digit mobile"
                              autoComplete="tel"
                            />
                            {fieldErrors.phone ? <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.phone}</p> : null}
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
                                <input className={fieldClass(false, true)} value={formData.location || job.location || ''} disabled readOnly />
                                <Lock size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" />
                              </div>
                            )}
                            {fieldErrors.location ? <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.location}</p> : null}
                          </div>
                        </div>
                      ) : null}

                      {step === 1 ? (
                        <div className="space-y-3.5 animate-fade-in">
                          <div data-field="experience">
                            <FieldLabel required>Experience</FieldLabel>
                            <PremiumSelect
                              variant="list"
                              searchable
                              searchPlaceholder="Filter…"
                              value={formData.experience}
                              onChange={(v) => setField('experience', v)}
                              options={experienceOptions}
                              placeholder="Select experience"
                              error={!!fieldErrors.experience}
                            />
                            {fieldErrors.experience ? <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.experience}</p> : null}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                            <div data-field="ctc" className="min-w-0">
                              <FieldLabel required>Current CTC</FieldLabel>
                              <PremiumSelect
                                variant="list"
                                searchable
                                searchPlaceholder="Search CTC…"
                                value={formData.ctc}
                                onChange={(v) => setField('ctc', v)}
                                options={ctcOptions}
                                placeholder="Select current CTC"
                                error={!!fieldErrors.ctc}
                              />
                              {fieldErrors.ctc ? <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.ctc}</p> : null}
                            </div>
                            <div data-field="expectedCtc" className="min-w-0">
                              <FieldLabel required>Expected CTC</FieldLabel>
                              <PremiumSelect
                                variant="list"
                                searchable
                                searchPlaceholder="Search CTC…"
                                value={formData.expectedCtc}
                                onChange={(v) => setField('expectedCtc', v)}
                                options={expectedCtcOptions}
                                placeholder="Select expected CTC"
                                error={!!fieldErrors.expectedCtc}
                              />
                              {fieldErrors.expectedCtc ? <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.expectedCtc}</p> : null}
                            </div>
                          </div>
                          <div data-field="noticePeriod">
                            <FieldLabel required>Notice period</FieldLabel>
                            <PremiumSelect
                              variant="list"
                              searchable
                              searchPlaceholder="Search…"
                              value={formData.noticePeriod}
                              onChange={(v) => setField('noticePeriod', v)}
                              options={noticeOptions}
                              placeholder="Select notice period"
                              error={!!fieldErrors.noticePeriod}
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
                          <div>
                            <FieldLabel>Cover note</FieldLabel>
                            <textarea
                              rows={5}
                              className={fieldClass()}
                              value={formData.coverLetter}
                              onChange={(e) => setField('coverLetter', e.target.value)}
                              placeholder="Optional note for the recruiting team"
                              autoFocus
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
                          disabled={!canAdvance}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
                          style={{ backgroundColor: brand }}
                        >
                          Continue <ChevronRight size={15} />
                        </button>
                      ) : (
                        <button
                          type="submit"
                          disabled={isSubmitting || !step2Ready || !emailVerified}
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

      {alreadyModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-[2px]" role="dialog" aria-modal="true">
          <div className="relative w-full max-w-md rounded-2xl border border-stone-200 bg-white shadow-2xl shadow-stone-900/20 p-6">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setAlreadyModalOpen(false)}
              className="absolute right-3 top-3 h-8 w-8 inline-flex items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            >
              <X size={16} />
            </button>
            <AlreadyAppliedPanel
              jobTitle={job.title}
              brand={brand}
              orgSlug={orgSlug}
              onCloseModal={() => setAlreadyModalOpen(false)}
            />
          </div>
        </div>
      ) : null}

      {leaveModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-[2px]" role="dialog" aria-modal="true">
          <div className="relative w-full max-w-md rounded-2xl border border-stone-200 bg-white shadow-2xl shadow-stone-900/20 p-6">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setLeaveModalOpen(false)}
              className="absolute right-3 top-3 h-8 w-8 inline-flex items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            >
              <X size={16} />
            </button>
            <div className="pr-6">
              <h4 className="text-lg font-bold text-stone-900 mb-2">Leave this application?</h4>
              <p className="text-sm text-stone-600 leading-relaxed mb-5">
                You have unsaved information on this form. If you return to the careers page now,
                your progress will be discarded and you will need to start again.
              </p>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setLeaveModalOpen(false)}
                  className="btn-secondary justify-center"
                >
                  Continue applying
                </button>
                <button
                  type="button"
                  onClick={confirmLeaveCareers}
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-stone-800 hover:bg-stone-900"
                >
                  Leave and discard
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default JobDetailPublic;
