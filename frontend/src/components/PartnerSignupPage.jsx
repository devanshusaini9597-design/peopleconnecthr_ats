import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle, ArrowDown, Briefcase, Building2, CalendarClock, Check,
  CheckCircle2, ChevronLeft, ChevronRight, Cloud, Copy, Eye, FileText, Globe2,
  Handshake, Headset, IndianRupee, LayoutDashboard, Loader2, Mail, MapPin, Pencil,
  Phone, Search, Send, ShieldCheck, Sparkles, UploadCloud, User,
} from 'lucide-react';
import API_URL from '../config';
import PublicAnnouncementBanner from './PublicAnnouncementBanner';
import PremiumSelect from './ui/PremiumSelect';
import Modal from './ui/Modal';
import { resolveOrgLogoSrc } from '../utils/orgLogo';

const STEPS = [
  { id: 'contact', label: 'Contact', caption: 'Contact details', icon: User },
  { id: 'practice', label: 'Experience', caption: 'Professional experience', icon: Briefcase },
  { id: 'profile', label: 'Profile', caption: 'Organisation & documents', icon: FileText },
  { id: 'review', label: 'Review', caption: 'Review and submit', icon: ShieldCheck },
];

const EMPTY = {
  name: '',
  email: '',
  phone: '',
  location: '',
  currentCompany: '',
  yearsExperience: '',
  specializations: '',
  rolesHired: '',
  availability: '',
  commercialNote: '',
  coverNote: '',
  agreed: false,
};

const PARTNER_BENEFITS = [
  { icon: IndianRupee, title: 'Transparent payouts', text: 'Timely fee settlements credited directly to your bank account.' },
  { icon: LayoutDashboard, title: 'Recruitment tools', text: 'Complimentary access to our hiring workspace and pipeline tools.' },
  { icon: Briefcase, title: 'Active mandates', text: 'Live requirements across IT, Banking, Insurance and NBFC.' },
  { icon: Globe2, title: 'PAN India coverage', text: 'Source for roles across major cities and regions in India.' },
  { icon: Headset, title: 'Dedicated support', text: 'Guidance from our recruitment team throughout the engagement.' },
  { icon: CalendarClock, title: 'Flexible working', text: 'Recruit on your own schedule, without a fixed desk commitment.' },
];

const EXPERIENCE_OPTIONS = [
  { value: 'Less than 1 year', label: 'Less than 1 year' },
  ...Array.from({ length: 20 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} year${i === 0 ? '' : 's'}` })),
  { value: '20+', label: '20+ years' },
];

const AVAILABILITY_OPTIONS = [
  { value: 'Immediate', label: 'Immediate' },
  { value: 'Part-time / evenings', label: 'Part-time / evenings' },
  { value: 'Weekends', label: 'Weekends' },
  { value: '15 days', label: 'Within 15 days' },
  { value: '30 days', label: 'Within 30 days' },
  { value: 'Full-time desk', label: 'Full-time' },
];

const ALLOWED_RESUME = ['.pdf', '.doc', '.docx'];
const MAX_RESUME_BYTES = 10 * 1024 * 1024;

function legacyDraftKey(slug) {
  return `skillnix-partner-draft:${slug || 'default'}`;
}

function legacyReceiptKey(slug) {
  return `skillnix-partner-receipt:${slug || 'default'}`;
}

function formIsDirty(form, resume) {
  if (resume) return true;
  return Object.entries(form || {}).some(([key, value]) => key !== 'agreed' && String(value || '').trim());
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || '').trim());
}

function isValidPersonName(name) {
  const t = String(name || '').trim();
  if (t.length < 2) return false;
  if (/^\d+$/.test(t)) return false;
  if ((t.match(/\d/g) || []).length > 2) return false;
  return /^[\p{L}\s.'’-]+$/u.test(t);
}

function contactErrors(form) {
  const errs = {};
  const name = String(form.name || '').trim();
  if (!name) errs.name = 'Full name is required.';
  else if (!isValidPersonName(name)) errs.name = 'Enter a valid full name using letters only.';
  if (!String(form.email || '').trim()) errs.email = 'Email address is required.';
  else if (!isValidEmail(form.email)) errs.email = 'Enter a valid email address.';
  const digits = String(form.phone || '').replace(/\D/g, '');
  if (!digits) errs.phone = 'Mobile number is required.';
  else if (digits.length !== 10) errs.phone = 'Enter a valid 10-digit mobile number.';
  return errs;
}

function mergeFieldError(prev, form, field) {
  const next = { ...prev };
  const msg = contactErrors(form)[field];
  if (msg) next[field] = msg;
  else delete next[field];
  return next;
}

function fieldClass(err) {
  return `w-full h-12 rounded-2xl border px-4 text-[15px] font-medium text-stone-900 bg-white outline-none transition placeholder:font-normal placeholder:text-stone-400 ${
    err
      ? 'border-rose-400 ring-4 ring-rose-100'
      : 'border-stone-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-stone-300 focus:border-[color:var(--careers-brand)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--careers-brand)_14%,transparent)]'
  }`;
}

function FieldLabel({ children, required, hint }) {
  return (
    <label className="flex items-baseline gap-2 text-[13px] font-semibold tracking-tight text-stone-800 mb-2">
      <span>{children}</span>
      {required ? <span className="text-rose-500" aria-hidden="true">*</span> : null}
      {hint ? <span className="ml-auto text-[11px] font-medium text-stone-400">{hint}</span> : null}
    </label>
  );
}

function FieldError({ message }) {
  if (!message) return null;
  return <p className="text-[11px] text-rose-600 mt-1">{message}</p>;
}

function IconField({ icon: Icon, error, children }) {
  return (
    <div
      className={`flex items-stretch h-12 rounded-2xl border overflow-hidden bg-white transition shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
        error
          ? 'border-rose-400 ring-4 ring-rose-100'
          : 'border-stone-200/90 focus-within:border-[color:var(--careers-brand)] focus-within:ring-4 focus-within:ring-[color-mix(in_srgb,var(--careers-brand)_14%,transparent)]'
      }`}
    >
      <span className="w-12 shrink-0 grid place-items-center text-stone-400">
        <Icon size={16} strokeWidth={2} />
      </span>
      {children}
    </div>
  );
}

const innerInputClass = 'w-full min-w-0 h-full pr-4 text-[15px] font-medium bg-transparent outline-none placeholder:text-stone-400 placeholder:font-normal';

function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function displayOrDash(value) {
  const t = String(value || '').trim();
  return t || 'Not provided';
}

function ReviewBlock({ title, onEdit, children }) {
  return (
    <div className="rounded-2xl border border-stone-200/70 bg-gradient-to-b from-white to-stone-50/80 overflow-hidden shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-stone-100">
        <p className="text-[12px] font-semibold tracking-tight text-stone-700">{title}</p>
        <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 text-[12px] font-semibold text-stone-600 hover:text-stone-900">
          <Pencil size={12} /> Edit
        </button>
      </div>
      <div className="px-4 py-3 space-y-2">{children}</div>
    </div>
  );
}

function ReviewLine({ label, value }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] sm:grid-cols-[9rem_1fr] gap-3 text-[13px]">
      <span className="text-stone-500">{label}</span>
      <span className="text-stone-900 font-semibold break-words">{displayOrDash(value)}</span>
    </div>
  );
}

export default function PartnerSignupPage() {
  const { orgSlug } = useParams();
  const [orgData, setOrgData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [resume, setResume] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [copiedRef, setCopiedRef] = useState(false);
  const [step, setStep] = useState(0);
  const [draftStatus, setDraftStatus] = useState('');
  const [dupNotice, setDupNotice] = useState(null);
  const [notice, setNotice] = useState(null);
  const [checkingDup, setCheckingDup] = useState(false);
  const [leaveWarn, setLeaveWarn] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);
  const [trackForm, setTrackForm] = useState({ reference: '', email: '' });
  const [trackResult, setTrackResult] = useState(null);
  const [trackError, setTrackError] = useState('');
  const [tracking, setTracking] = useState(false);
  const formBodyRef = useRef(null);
  const wizardRef = useRef(null);
  const resumeInputRef = useRef(null);
  const skipUnloadRef = useRef(false);

  const resumePreviewUrl = useMemo(() => (resume ? URL.createObjectURL(resume) : ''), [resume]);
  useEffect(() => () => {
    if (resumePreviewUrl) URL.revokeObjectURL(resumePreviewUrl);
  }, [resumePreviewUrl]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/partners/${orgSlug}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'This partnership page could not be found.');
        setOrgData((data.data || data).organization || {});
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [orgSlug]);

  useEffect(() => {
    try {
      localStorage.removeItem(legacyDraftKey(orgSlug));
      sessionStorage.removeItem(legacyReceiptKey(orgSlug));
    } catch { /* ignore */ }
  }, [orgSlug]);

  const formDirty = formIsDirty(form, resume) && !receipt;

  useEffect(() => {
    if (!formDirty) {
      setDraftStatus('');
      return undefined;
    }
    const timer = window.setTimeout(() => setDraftStatus('Saved on this page'), 350);
    return () => window.clearTimeout(timer);
  }, [form, step, formDirty]);

  useEffect(() => {
    if (!formDirty) return undefined;
    const onBeforeUnload = (event) => {
      if (skipUnloadRef.current) return;
      event.preventDefault();
      event.returnValue = 'Your application details will be erased if you leave this page.';
    };
    const onKeyDown = (event) => {
      const refresh = event.key === 'F5' || ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'r');
      if (!refresh) return;
      event.preventDefault();
      setLeaveWarn(true);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [formDirty]);

  const brand = orgData?.brandColor || '#0d9488';
  const logoSrc = resolveOrgLogoSrc(orgData?.logo);
  const orgName = 'Skillnix Recruitment Services';
  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);
  const contactReady = useMemo(() => Object.keys(contactErrors(form)).length === 0, [form]);
  const canSubmit = step === STEPS.length - 1 && contactReady && form.agreed && !submitting;

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    setSubmitError('');
  };

  const pickResume = (file) => {
    if (!file) return;
    const ext = `.${String(file.name || '').split('.').pop() || ''}`.toLowerCase();
    if (!ALLOWED_RESUME.includes(ext)) {
      setFieldErrors((prev) => ({ ...prev, resume: 'Please attach a PDF, DOC, or DOCX file.' }));
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      setFieldErrors((prev) => ({ ...prev, resume: 'The file must not exceed 10 MB.' }));
      return;
    }
    setResume(file);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.resume;
      return next;
    });
    setSubmitError('');
  };

  const validateStep = (idx) => {
    const errs = idx === 0 ? contactErrors(form) : {};
    setFieldErrors(errs);
    if (Object.keys(errs).length) {
      window.requestAnimationFrame(() => {
        const first = formBodyRef.current?.querySelector('[aria-invalid="true"], [data-invalid="true"]');
        first?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      });
      return false;
    }
    return true;
  };

  const showNotice = (type, message) => {
    setNotice({ type, message });
    window.setTimeout(() => setNotice(null), 5200);
  };

  const lookupDuplicate = async () => {
    const email = String(form.email || '').trim();
    const phone = String(form.phone || '').replace(/\D/g, '');
    if (!isValidEmail(email) && phone.length !== 10) return null;
    const params = new URLSearchParams();
    if (isValidEmail(email)) params.set('email', email);
    if (phone.length === 10) params.set('phone', phone);
    const res = await fetch(`${API_URL}/api/partners/${orgSlug}/check?${params.toString()}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return null;
    return data.data || data;
  };

  const blockIfDuplicate = async () => {
    setCheckingDup(true);
    try {
      const result = await lookupDuplicate();
      if (result?.duplicate) {
        setDupNotice(result);
        return true;
      }
    } catch {
      /* submit path still enforces */
    } finally {
      setCheckingDup(false);
    }
    return false;
  };

  const goNext = async () => {
    if (!validateStep(step)) return;
    if (step === 0 && await blockIfDuplicate()) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    wizardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  const resetApplyForm = () => {
    setForm(EMPTY);
    setResume(null);
    setStep(0);
    setFieldErrors({});
    setSubmitError('');
    setDupNotice(null);
    setNotice(null);
    try {
      localStorage.removeItem(legacyDraftKey(orgSlug));
      sessionStorage.removeItem(legacyReceiptKey(orgSlug));
    } catch { /* ignore */ }
    setDraftStatus('');
  };

  const openTracker = (reference = '', email = '') => {
    setTrackForm({
      reference: reference || trackForm.reference,
      email: email || trackForm.email,
    });
    setTrackResult(null);
    setTrackError('');
    setTrackOpen(true);
  };

  const runTrack = async (event, silent = false) => {
    event?.preventDefault?.();
    const reference = String(trackForm.reference || '').trim();
    const email = String(trackForm.email || '').trim();
    if (!reference || !isValidEmail(email)) {
      if (!silent) {
        setTrackError('Enter the application reference and the email used on the application.');
        setTrackResult(null);
      }
      return;
    }
    if (!silent) setTracking(true);
    if (!silent) setTrackError('');
    try {
      const params = new URLSearchParams({ reference, email });
      const res = await fetch(`${API_URL}/api/partners/${orgSlug}/track?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Status could not be checked.');
      const payload = data.data || data;
      if (!payload.found) {
        if (!silent) {
          setTrackResult(null);
          setTrackError(payload.message || 'No application matches that reference and email.');
        }
        return;
      }
      setTrackResult(payload);
    } catch (err) {
      if (!silent) {
        setTrackResult(null);
        setTrackError(err.message);
      }
    } finally {
      if (!silent) setTracking(false);
    }
  };

  useEffect(() => {
    if (!trackOpen || !trackResult) return undefined;
    const timer = window.setInterval(() => { runTrack(null, true); }, 12000);
    return () => window.clearInterval(timer);
  }, [trackOpen, trackResult?.status, trackForm.reference, trackForm.email]);

  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step !== STEPS.length - 1 || !contactReady || !form.agreed) return;
    for (let i = 0; i < STEPS.length - 1; i += 1) {
      if (!validateStep(i)) {
        setStep(i);
        return;
      }
    }
    if (!form.agreed) {
      setFieldErrors({ agreed: 'Please confirm the declaration to submit your application.' });
      return;
    }
    if (await blockIfDuplicate()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = new FormData();
      payload.append('name', String(form.name || '').trim());
      payload.append('email', String(form.email || '').trim());
      payload.append('phone', String(form.phone || '').replace(/\D/g, ''));
      payload.append('location', form.location || '');
      payload.append('currentCompany', form.currentCompany || '');
      payload.append('yearsExperience', form.yearsExperience || '');
      payload.append('specializations', form.specializations || '');
      payload.append('rolesHired', form.rolesHired || '');
      payload.append('availability', form.availability || '');
      payload.append('commercialNote', form.commercialNote || '');
      payload.append('coverNote', form.coverNote || '');
      if (resume) payload.append('resume', resume);
      const res = await fetch(`${API_URL}/api/partners/${orgSlug}/apply`, {
        method: 'POST',
        body: payload,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          setDupNotice({
            duplicate: true,
            code: data.code,
            message: data.message,
            referenceCode: data.referenceCode || '',
            statusLabel: data.statusLabel || '',
          });
          return;
        }
        throw new Error(data.message || 'Your application could not be submitted. Please try again.');
      }
      const submittedEmail = String(form.email || '').trim();
      const submittedName = String(form.name || '').trim();
      const nextReceipt = {
        referenceCode: data.referenceCode || '',
        email: data.email || submittedEmail,
        name: submittedName,
        message: data.message || 'Your partnership application has been received.',
        confirmationSent: data.confirmationSent !== false,
      };
      setReceipt(nextReceipt);
      resetApplyForm();
      try {
        const refresh = await fetch(`${API_URL}/api/partners/${orgSlug}`);
        const fresh = await refresh.json().catch(() => ({}));
        if (refresh.ok) setOrgData((fresh.data || fresh).organization || {});
      } catch { /* page data already on screen */ }
      wizardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      setSubmitError(err.message);
      showNotice('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onFormKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      if (step < STEPS.length - 1) goNext();
    }
  }, [step, form, resume]);

  const brandStyle = { ['--careers-brand']: brand };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f5f7]" style={brandStyle}>
        <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-4">
          <div className="h-16 rounded-2xl skeleton-ats" />
          <div className="h-56 rounded-3xl skeleton-ats" />
          <div className="grid lg:grid-cols-2 gap-5">
            <div className="h-80 rounded-2xl skeleton-ats" />
            <div className="h-80 rounded-2xl skeleton-ats" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f5f7] px-4" style={brandStyle}>
        <div className="card-ats-bordered p-8 text-center max-w-md w-full relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: brand }} />
          <Building2 className="h-12 w-12 text-stone-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-stone-900 mb-2">Page unavailable</h2>
          <p className="text-stone-600 mb-6">This partnership page is not available at this time.</p>
          <Link to="/" className="font-semibold" style={{ color: brand }}>Return to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-stone-900 flex flex-col" style={{ ...brandStyle, background: `linear-gradient(180deg, ${brand}12 0%, #f4f5f7 280px, #f4f5f7 100%)` }}>
      <PublicAnnouncementBanner orgSlug={orgSlug} />
      <div className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-stone-200/80">
        <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${brand}, #14b8a6, ${brand})` }} />
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {logoSrc ? (
              <img src={logoSrc} alt={orgName} className="h-9 w-auto object-contain max-w-[10rem]" />
            ) : (
              <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: brand }}>
                <Handshake size={16} />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">Freelance partnership</p>
              <p className="text-sm font-bold text-stone-900 truncate">{orgName}</p>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-grow w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-10">
        <section className="relative overflow-hidden rounded-[1.85rem] mb-7 sm:mb-9 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]" style={{ background: `linear-gradient(135deg, #0f172a 0%, #111827 42%, ${brand} 160%)` }}>
          <div className="absolute inset-0 opacity-40" style={{ background: `radial-gradient(720px 280px at 88% -10%, ${brand}, transparent 60%)` }} />
          <div className="absolute -right-10 top-10 h-48 w-48 rounded-full border border-white/10" />
          <div className="absolute right-16 -bottom-16 h-40 w-40 rounded-full bg-white/5" />
          <div className="relative px-6 sm:px-10 py-9 sm:py-11">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
              <Sparkles size={13} strokeWidth={2.25} /> Partner programme
            </p>
            <h1 className="mt-4 max-w-3xl text-[1.85rem] sm:text-[2.35rem] font-bold tracking-tight leading-[1.12]" style={{ letterSpacing: '-0.045em' }}>
              Become a Skillnix Freelance Recruitment Partner
            </h1>
            <p className="mt-4 max-w-2xl text-sm sm:text-[15px] text-white/75 leading-relaxed">
              Earn up to <span className="font-semibold text-white">50% of the applicable recruitment fee</span> on eligible successful closures. Collaborate with Skillnix Recruitment Services and work live hiring mandates across India.
            </p>
            <p className="mt-4 text-sm font-semibold text-white/90">
              Use your network. Work your way. Earn through successful closures.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              {[
                { k: '50%', v: 'Fee share on eligible closures' },
                { k: 'PAN', v: 'India hiring coverage' },
                { k: 'Flex', v: 'Recruit on your schedule' },
              ].map((stat) => (
                <div key={stat.k} className="rounded-2xl border border-white/15 bg-white/8 backdrop-blur-md px-4 py-3 min-w-[9.5rem]">
                  <p className="text-lg font-bold tracking-tight">{stat.k}</p>
                  <p className="text-[11px] text-white/65 mt-0.5">{stat.v}</p>
                </div>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => wizardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-stone-900 shadow-sm hover:bg-stone-100 transition"
              >
                Apply now <ArrowDown size={15} />
              </button>
              <button
                type="button"
                onClick={() => openTracker()}
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15 transition"
              >
                <Search size={15} /> Track application
              </button>
            </div>
          </div>
        </section>

        <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          <section className="lg:col-span-5 space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">What you receive</p>
              <p className="mt-1 text-lg font-bold text-stone-900 tracking-tight">Collaborate with Skillnix and gain access to</p>
            </div>
            <div className="grid gap-3">
              {PARTNER_BENEFITS.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="group relative overflow-hidden rounded-2xl border border-stone-200/70 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)] hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,23,42,0.10)] transition-all duration-200"
                  >
                    <div className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: brand }} />
                    <div className="flex gap-3.5 pl-1.5">
                      <span
                        className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white shrink-0 shadow-sm"
                        style={{ background: `linear-gradient(160deg, ${brand}, #0f172a)` }}
                      >
                        <Icon size={18} strokeWidth={2.05} />
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">0{index + 1}</p>
                        <p className="mt-0.5 text-sm font-bold text-stone-900">{item.title}</p>
                        <p className="mt-1 text-[13px] text-stone-500 leading-relaxed">{item.text}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section ref={wizardRef} className="lg:col-span-7 lg:sticky lg:top-24">
            <div className="rounded-[1.75rem] border border-white/70 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.14)] overflow-hidden ring-1 ring-black/[0.04]">
              <div className="relative px-5 sm:px-7 py-5 text-white" style={{ background: `linear-gradient(135deg, #0f172a 0%, #1e293b 55%, ${brand} 180%)` }}>
                <div className="absolute inset-0 opacity-50 pointer-events-none" style={{ background: `radial-gradient(420px 140px at 100% 0%, ${brand}, transparent 70%)` }} />
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Partner application</p>
                    <h2 className="mt-1 text-lg sm:text-xl font-semibold tracking-tight">{STEPS[step].caption}</h2>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-semibold tabular-nums leading-none">{step + 1}<span className="text-sm text-white/40">/{STEPS.length}</span></p>
                    {draftStatus ? (
                      <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-white/60">
                        <Cloud size={11} /> {draftStatus}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="h-1 bg-stone-100">
                <div className="h-full transition-all duration-300 ease-out" style={{ width: `${progress}%`, backgroundColor: brand }} />
              </div>
              <div className="p-5 sm:p-7">
                  <form onSubmit={handleSubmit} onKeyDown={onFormKeyDown} className="space-y-5" noValidate>
                    <ol className="grid grid-cols-4 gap-2">
                      {STEPS.map((s, i) => {
                        const active = i === step;
                        const done = i < step;
                        const Icon = s.icon;
                        return (
                          <li key={s.id} className="min-w-0">
                            <button
                              type="button"
                              onClick={async () => {
                                if (i < step) setStep(i);
                                else if (i > step) {
                                  for (let j = step; j < i; j += 1) {
                                    if (!validateStep(j)) return;
                                  }
                                  if (step === 0 && await blockIfDuplicate()) return;
                                  setStep(i);
                                }
                              }}
                              className={`w-full rounded-2xl border px-2 py-2.5 text-left transition ${
                                active ? 'border-transparent shadow-[0_8px_20px_rgba(15,23,42,0.08)]' : 'border-transparent hover:bg-stone-50'
                              }`}
                              style={active ? { background: `linear-gradient(180deg, ${brand}14, white)`, borderColor: `${brand}33` } : undefined}
                            >
                              <span
                                className="mb-1.5 grid h-7 w-7 place-items-center rounded-xl"
                                style={{
                                  backgroundColor: active || done ? brand : '#f5f5f4',
                                  color: active || done ? '#fff' : '#a8a29e',
                                }}
                              >
                                {done ? <Check size={13} /> : <Icon size={13} />}
                              </span>
                              <span className={`block truncate text-[11px] font-semibold ${active ? 'text-stone-900' : 'text-stone-400'}`}>
                                {s.label}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>

                    {notice ? (
                      <div className={`p-3 rounded-xl text-sm border flex items-start ${
                        notice.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                          : notice.type === 'warning'
                            ? 'bg-amber-50 text-amber-800 border-amber-100'
                            : 'bg-rose-50 text-rose-700 border-rose-100'
                      }`}>
                        <AlertCircle className="h-4 w-4 mr-2 shrink-0 mt-0.5" />
                        {notice.message}
                      </div>
                    ) : null}

                    <div ref={formBodyRef}>
                      {step === 0 ? (
                        <div className="grid sm:grid-cols-2 gap-3.5 animate-fade-in">
                          <div className="sm:col-span-2">
                            <FieldLabel required>Full name</FieldLabel>
                            <input
                              aria-invalid={!!fieldErrors.name}
                              className={fieldClass(fieldErrors.name)}
                              value={form.name}
                              onChange={(e) => setField('name', e.target.value.toUpperCase())}
                              onBlur={() => setFieldErrors((prev) => mergeFieldError(prev, form, 'name'))}
                              placeholder="As it should appear on records"
                              autoComplete="name"
                              autoFocus
                              required
                            />
                            <FieldError message={fieldErrors.name} />
                          </div>
                          <div>
                            <FieldLabel required>Email address</FieldLabel>
                            <IconField icon={Mail} error={!!fieldErrors.email}>
                              <input
                                type="email"
                                aria-invalid={!!fieldErrors.email}
                                className={innerInputClass}
                                value={form.email}
                                onChange={(e) => setField('email', e.target.value)}
                                onBlur={() => setFieldErrors((prev) => mergeFieldError(prev, form, 'email'))}
                                placeholder="name@company.com"
                                autoComplete="email"
                                required
                              />
                            </IconField>
                            <FieldError message={fieldErrors.email} />
                          </div>
                          <div>
                            <FieldLabel required>Mobile number</FieldLabel>
                            <IconField icon={Phone} error={!!fieldErrors.phone}>
                              <input
                                type="tel"
                                inputMode="numeric"
                                maxLength={10}
                                aria-invalid={!!fieldErrors.phone}
                                className={innerInputClass}
                                value={form.phone}
                                onChange={(e) => setField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                                onBlur={() => setFieldErrors((prev) => mergeFieldError(prev, form, 'phone'))}
                                placeholder="10-digit mobile"
                                autoComplete="tel"
                                required
                              />
                            </IconField>
                            <FieldError message={fieldErrors.phone} />
                          </div>
                          <div className="sm:col-span-2">
                            <FieldLabel hint="Optional">City</FieldLabel>
                            <IconField icon={MapPin}>
                              <input
                                className={innerInputClass}
                                value={form.location}
                                onChange={(e) => setField('location', e.target.value)}
                                placeholder="Primary city of work"
                              />
                            </IconField>
                          </div>
                        </div>
                      ) : null}

                      {step === 1 ? (
                        <div className="grid sm:grid-cols-2 gap-3.5 animate-fade-in">
                          <div>
                            <FieldLabel hint="Optional">Years in recruitment</FieldLabel>
                            <PremiumSelect
                              variant="list"
                              searchable
                              value={form.yearsExperience}
                              onChange={(v) => setField('yearsExperience', v)}
                              options={EXPERIENCE_OPTIONS}
                              placeholder="Select experience"
                            />
                          </div>
                          <div>
                            <FieldLabel hint="Optional">Availability</FieldLabel>
                            <PremiumSelect
                              variant="list"
                              value={form.availability}
                              onChange={(v) => setField('availability', v)}
                              options={AVAILABILITY_OPTIONS}
                              placeholder="Select availability"
                            />
                          </div>
                          <div>
                            <FieldLabel hint="Optional">Industry focus</FieldLabel>
                            <input
                              className={fieldClass()}
                              value={form.specializations}
                              onChange={(e) => setField('specializations', e.target.value)}
                              placeholder="IT, Banking, Insurance, NBFC"
                            />
                          </div>
                          <div>
                            <FieldLabel hint="Optional">Roles typically sourced</FieldLabel>
                            <input
                              className={fieldClass()}
                              value={form.rolesHired}
                              onChange={(e) => setField('rolesHired', e.target.value)}
                              placeholder="Relationship Manager, Engineer"
                            />
                          </div>
                        </div>
                      ) : null}

                      {step === 2 ? (
                        <div className="grid sm:grid-cols-2 gap-3.5 animate-fade-in">
                          <div>
                            <FieldLabel hint="Optional">Current organisation</FieldLabel>
                            <input
                              className={fieldClass()}
                              value={form.currentCompany}
                              onChange={(e) => setField('currentCompany', e.target.value)}
                              placeholder="Independent practice or firm"
                            />
                          </div>
                          <div>
                            <FieldLabel hint="Optional">Commercial preference</FieldLabel>
                            <input
                              className={fieldClass()}
                              value={form.commercialNote}
                              onChange={(e) => setField('commercialNote', e.target.value)}
                              placeholder="Preferred engagement terms"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <FieldLabel hint="Optional">Professional profile</FieldLabel>
                            <div
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                pickResume(e.dataTransfer.files?.[0]);
                              }}
                              className={`flex items-center gap-4 px-4 py-5 border border-dashed rounded-2xl transition-colors ${
                                resume
                                  ? 'border-[color:var(--careers-brand)] bg-[color-mix(in_srgb,var(--careers-brand)_7%,white)] shadow-[0_8px_24px_rgba(15,23,42,0.04)]'
                                  : fieldErrors.resume
                                    ? 'border-rose-300 bg-rose-50/40'
                                    : 'border-stone-200 bg-gradient-to-b from-stone-50 to-white hover:border-stone-300'
                              }`}
                            >
                              {resume
                                ? <FileText className="h-8 w-8 shrink-0" style={{ color: brand }} />
                                : <UploadCloud className="h-8 w-8 text-stone-400 shrink-0" />}
                              <div className="min-w-0 flex-1">
                                <label className="relative cursor-pointer text-sm font-semibold" style={{ color: brand }}>
                                  <span>{resume ? 'Replace document' : 'Upload CV or professional profile'}</span>
                                  <input
                                    ref={resumeInputRef}
                                    type="file"
                                    className="sr-only"
                                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                    onChange={(e) => pickResume(e.target.files?.[0])}
                                  />
                                </label>
                                <p className="text-[11px] text-stone-500 mt-0.5 truncate">
                                  {resume ? `${resume.name} · ${formatFileSize(resume.size)}` : 'PDF, DOC or DOCX · maximum 10 MB'}
                                </p>
                                {resume && resumePreviewUrl ? (
                                  <a
                                    href={resumePreviewUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold"
                                    style={{ color: brand }}
                                  >
                                    <Eye size={13} /> View document
                                  </a>
                                ) : null}
                              </div>
                            </div>
                            <FieldError message={fieldErrors.resume} />
                          </div>
                          <div className="sm:col-span-2">
                            <FieldLabel hint="Optional">Brief note</FieldLabel>
                            <textarea
                              rows={4}
                              className={`${fieldClass()} !h-auto min-h-[7.5rem] py-3 leading-relaxed`}
                              value={form.coverNote}
                              onChange={(e) => setField('coverNote', e.target.value)}
                              placeholder="Summarise your recruiting practice and the mandates you typically close."
                            />
                          </div>
                        </div>
                      ) : null}

                      {step === 3 ? (
                        <div className="space-y-3.5 animate-fade-in">
                          <ReviewBlock title="Contact details" onEdit={() => setStep(0)}>
                            <ReviewLine label="Full name" value={form.name} />
                            <ReviewLine label="Email" value={form.email} />
                            <ReviewLine label="Mobile" value={form.phone} />
                            <ReviewLine label="City" value={form.location} />
                          </ReviewBlock>
                          <ReviewBlock title="Professional experience" onEdit={() => setStep(1)}>
                            <ReviewLine label="Experience" value={form.yearsExperience} />
                            <ReviewLine label="Availability" value={form.availability} />
                            <ReviewLine label="Industry" value={form.specializations} />
                            <ReviewLine label="Roles sourced" value={form.rolesHired} />
                          </ReviewBlock>
                          <ReviewBlock title="Organisation" onEdit={() => setStep(2)}>
                            <ReviewLine label="Organisation" value={form.currentCompany} />
                            <ReviewLine label="Commercial" value={form.commercialNote} />
                            {form.coverNote ? (
                              <p className="text-[13px] text-stone-600 leading-relaxed pt-1">{form.coverNote}</p>
                            ) : null}
                          </ReviewBlock>
                          <ReviewBlock title="Supporting document" onEdit={() => setStep(2)}>
                            {resume ? (
                              <div className="flex items-center gap-3">
                                <span className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${brand}14`, color: brand }}>
                                  <FileText size={18} />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-stone-900 truncate">{resume.name}</p>
                                  <p className="text-[12px] text-stone-500">{formatFileSize(resume.size)}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {resumePreviewUrl ? (
                                    <a
                                      href={resumePreviewUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-[12px] font-semibold text-stone-700 hover:bg-white"
                                    >
                                      <Eye size={13} /> View
                                    </a>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => resumeInputRef.current?.click()}
                                    className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-[12px] font-semibold text-stone-700 hover:bg-white"
                                  >
                                    <Pencil size={13} /> Replace
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[13px] text-stone-500">No document attached. You may add one from Profile, or continue without it.</p>
                            )}
                          </ReviewBlock>
                          <label className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-[13px] leading-relaxed ${fieldErrors.agreed ? 'border-rose-300 bg-rose-50/50 text-stone-700' : 'border-stone-200 bg-stone-50/70 text-stone-600'}`} data-invalid={!!fieldErrors.agreed || undefined}>
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 rounded border-stone-300"
                              aria-invalid={!!fieldErrors.agreed}
                              checked={form.agreed}
                              onChange={(e) => setField('agreed', e.target.checked)}
                            />
                            <span>
                              <span className="text-rose-500 mr-0.5">*</span>
                              I confirm that the information provided is accurate. {orgName} may contact me regarding this application. Platform access is granted only by formal invitation. Submitting this form does not create an account.
                            </span>
                          </label>
                          <FieldError message={fieldErrors.agreed} />
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
                        <button type="button" onClick={goBack} className="inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:bg-stone-50">
                          <ChevronLeft size={15} /> Back
                        </button>
                      ) : null}
                      {step < STEPS.length - 1 ? (
                        <button type="button" onClick={goNext} disabled={checkingDup || (step === 0 && !contactReady)} className="inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] disabled:opacity-40 disabled:cursor-not-allowed" style={{ backgroundColor: brand }}>
                          {checkingDup ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          {step === 2 ? 'Continue to review' : 'Continue'}
                          {checkingDup ? null : <ChevronRight size={15} />}
                        </button>
                      ) : (
                        <button
                          type="submit"
                          disabled={!canSubmit}
                          className="inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ backgroundColor: brand }}
                        >
                          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={15} />}
                          {submitting ? 'Submitting…' : 'Submit application'}
                        </button>
                      )}
                    </div>
                    {step === 0 && !contactReady ? (
                      <p className="text-[12px] text-stone-400">Enter your name, email, and 10-digit mobile number to continue.</p>
                    ) : null}
                    {step === STEPS.length - 1 && !canSubmit ? (
                      <p className="text-[12px] text-stone-400">Confirm the declaration to enable submit. The button stays off until the required details are complete.</p>
                    ) : null}
                  </form>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="mt-auto py-6">
        {!orgData?.hidePoweredBy ? (
          <p className="text-center text-[12px] text-stone-400">
            Powered by <a href="/" className="font-semibold text-stone-600 hover:opacity-80">People Connect HR</a>
          </p>
        ) : null}
      </footer>

      <Modal
        open={!!dupNotice}
        onClose={() => setDupNotice(null)}
        title="You have already applied"
        description="This email or mobile number already has a partnership application."
        icon={ShieldCheck}
        size="sm"
        closeOnBackdrop={false}
        footer={(
          <div className="flex flex-col gap-2">
            {dupNotice?.referenceCode ? (
              <button
                type="button"
                className="btn-secondary w-full justify-center"
                onClick={() => {
                  const email = String(form.email || '').trim();
                  const reference = dupNotice.referenceCode;
                  setDupNotice(null);
                  openTracker(reference, email);
                }}
              >
                Track this application
              </button>
            ) : null}
            <button type="button" className="btn-primary w-full justify-center" onClick={resetApplyForm} style={{ backgroundColor: brand }}>
              Understood
            </button>
          </div>
        )}
      >
        <p className="text-sm text-stone-700 leading-relaxed">{dupNotice?.message}</p>
        {dupNotice?.referenceCode ? (
          <p className="mt-3 text-sm text-stone-600">Reference <span className="font-mono font-semibold text-stone-900">{dupNotice.referenceCode}</span>{dupNotice.statusLabel ? ` · ${dupNotice.statusLabel}` : ''}</p>
        ) : null}
      </Modal>

      <Modal
        open={!!receipt}
        onClose={() => setReceipt(null)}
        title="Applied successfully"
        description="Your partnership application is with our team."
        icon={CheckCircle2}
        size="sm"
        closeOnBackdrop={false}
        footer={(
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="btn-primary w-full justify-center"
              style={{ backgroundColor: brand }}
              onClick={() => {
                const reference = receipt?.referenceCode || '';
                const email = receipt?.email || '';
                setReceipt(null);
                openTracker(reference, email);
              }}
            >
              Track this application
            </button>
            <button type="button" className="btn-secondary w-full justify-center" onClick={() => setReceipt(null)}>
              Close
            </button>
          </div>
        )}
      >
        <p className="text-sm text-stone-700 leading-relaxed">
          You have applied successfully. A second application cannot be submitted with the same email or mobile number.
        </p>
        {receipt?.referenceCode ? (
          <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400">Application reference</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-sm font-semibold text-stone-900">{receipt.referenceCode}</span>
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-stone-600"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(receipt.referenceCode);
                    setCopiedRef(true);
                    window.setTimeout(() => setCopiedRef(false), 1600);
                  } catch { setCopiedRef(false); }
                }}
              >
                <Copy size={12} /> {copiedRef ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        ) : null}
        <p className="mt-3 text-sm text-stone-500 leading-relaxed">
          {receipt?.confirmationSent
            ? `A confirmation has been sent to ${receipt.email}. Keep the reference to track the status.`
            : `Keep this reference. We could not send the confirmation email just now.`}
        </p>
      </Modal>

      <Modal
        open={trackOpen}
        onClose={() => setTrackOpen(false)}
        title="Track application"
        description="Use the reference from your confirmation and the email on the application."
        icon={Search}
        size="sm"
        footer={(
          <button type="button" className="btn-primary w-full justify-center" disabled={tracking} onClick={runTrack} style={{ backgroundColor: brand }}>
            {tracking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search size={15} />}
            Check status
          </button>
        )}
      >
        <form className="space-y-3" onSubmit={runTrack}>
          <div>
            <FieldLabel required>Application reference</FieldLabel>
            <input className={fieldClass()} value={trackForm.reference} onChange={(e) => setTrackForm((prev) => ({ ...prev, reference: e.target.value.toUpperCase() }))} placeholder="SKILLNIX-PART-000001" autoComplete="off" />
          </div>
          <div>
            <FieldLabel required>Email on the application</FieldLabel>
            <input type="email" className={fieldClass()} value={trackForm.email} onChange={(e) => setTrackForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="name@company.com" autoComplete="email" />
          </div>
          {trackError ? <p className="text-sm text-rose-600">{trackError}</p> : null}
          {trackResult ? (
            <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400">Live status</p>
              <p className="mt-1 text-sm font-semibold text-stone-900">{trackResult.statusLabel}</p>
              <p className="mt-1 font-mono text-[12px] text-stone-500">{trackResult.referenceCode}</p>
              {Array.isArray(trackResult.steps) ? (
                <ol className="mt-3 space-y-2">
                  {trackResult.steps.map((step) => (
                    <li key={step.id} className="flex items-center gap-2 text-[13px]">
                      <span className={`h-2 w-2 rounded-full ${step.state === 'current' ? 'bg-teal-600' : step.state === 'done' ? 'bg-emerald-500' : 'bg-stone-300'}`} />
                      <span className={step.state === 'upcoming' ? 'text-stone-400' : 'font-semibold text-stone-800'}>{step.label}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
              <p className="mt-2 text-[11px] text-stone-400">This status updates as the company reviews, invites, or you join.</p>
            </div>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={leaveWarn}
        onClose={() => setLeaveWarn(false)}
        title="Details will be erased"
        description="Refreshing this page clears the application you are filling in."
        icon={AlertCircle}
        size="sm"
        closeOnBackdrop={false}
        footer={(
          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex-1 justify-center" onClick={() => setLeaveWarn(false)}>Stay on this page</button>
            <button
              type="button"
              className="btn-primary flex-1 justify-center"
              style={{ backgroundColor: brand }}
              onClick={() => {
                skipUnloadRef.current = true;
                setLeaveWarn(false);
                resetApplyForm();
                window.location.reload();
              }}
            >
              Erase and refresh
            </button>
          </div>
        )}
      >
        <p className="text-sm text-stone-600 leading-relaxed">
          Your entries are saved only while you stay on this page. If you refresh, close the tab, or open this link again, those details are erased. They are not kept in this browser.
        </p>
      </Modal>
    </div>
  );
}
