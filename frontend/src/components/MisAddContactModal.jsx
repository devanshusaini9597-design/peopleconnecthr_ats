import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import FocusLock from 'react-focus-lock';
import {
  X, User, IndianRupee, Building2, Settings2, Megaphone,
  ChevronLeft, ChevronRight, Briefcase, Share2, Clock3, Layers, Loader2,
} from 'lucide-react';
import PremiumSelect from './ui/PremiumSelect';
import QuickListManager from './QuickListManager';
import { authenticatedFetch } from '../utils/fetchUtils';
import { fetchPicklist, PICKLIST_DROPDOWN_LIMIT, PICKLIST_MIN_SEARCH, searchPicklistOptions } from '../utils/orgListFetch';
import { dedupeByName } from '../utils/dedupeMasterData';
import { DEFAULT_CTC_BANDS, DEFAULT_NOTICE_PERIODS } from '../utils/ctcRanges';
import useCountries from '../utils/useCountries';
import useModalLayer from '../hooks/useModalLayer';
import { resolveFormDeskDefaults } from '../utils/deskDefaults';
import { useAuth } from '../context/AuthContext';

const LIST_META = {
  positions: { title: 'Positions', singular: 'position', apiEndpoint: '/api/positions', seedable: true, icon: Briefcase },
  clients: { title: 'Clients', singular: 'client', apiEndpoint: '/api/clients', icon: Building2 },
  sources: { title: 'CV Sources', singular: 'source', apiEndpoint: '/api/sources', seedable: true, icon: Share2 },
  ctc: { title: 'CTC Bands', singular: 'CTC band', apiEndpoint: '/api/org-lists/ctc', seedable: true, icon: IndianRupee },
  notice: { title: 'Notice Periods', singular: 'notice period', apiEndpoint: '/api/org-lists/notice', seedable: true, icon: Clock3 },
  product: { title: 'Product / Skill', singular: 'product / skill', apiEndpoint: '/api/org-lists/product', seedable: true, icon: Layers },
  /** MIS-only statuses — separate from Candidate pipeline /api/statuses */
  misStatus: { title: 'MIS Statuses', singular: 'MIS status', apiEndpoint: '/api/org-lists/misStatus', seedable: true, icon: Megaphone },
};

const EMPTY = {
  name: '',
  email: '',
  contact: '',
  position: '',
  companyName: '',
  location: '',
  experience: '',
  ctc: '',
  expectedCtc: '',
  noticePeriod: '',
  fls: '',
  status: 'NEW',
  client: '',
  source: 'MIS Manual',
  product: '',
  skills: '',
  remark: '',
  marketingConsent: true,
};

function ListField({ label, required, children, onManage, listCfg }) {
  return (
    <div className="min-w-0 w-full">
      <div className="flex items-center justify-between gap-2 mb-1.5 min-w-0">
        <label className="block text-[11px] font-semibold text-stone-600 min-w-0 truncate">
          {label}{required ? <span className="text-red-500"> *</span> : null}
        </label>
        {listCfg ? (
          <button
            type="button"
            onClick={() => onManage?.(listCfg)}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-stone-500 hover:text-brand-700 transition-colors flex-shrink-0"
          >
            <Settings2 size={11} />
            Manage
          </button>
        ) : null}
      </div>
      <div className="min-w-0 w-full">{children}</div>
    </div>
  );
}

function fieldClass(err) {
  return `w-full min-w-0 h-11 max-w-full px-3 py-2.5 rounded-xl border bg-white text-sm font-medium outline-none uppercase box-border ${
    err ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200' : 'border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15'
  }`;
}

function emailFieldClass(err) {
  return `w-full min-w-0 h-11 max-w-full px-3 py-2.5 rounded-xl border bg-white text-sm font-medium outline-none normal-case box-border ${
    err ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200' : 'border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15'
  }`;
}

const toBlock = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

/**
 * Candidates-style multi-step form that saves to MIS only (never Candidate table).
 */
export default function MisAddContactModal({ open, onClose, onCreated, toast }) {
  const { user } = useAuth();
  const countryCodes = useCountries();
  const { isTop } = useModalLayer(open);
  const formScrollRef = useRef(null);
  const fieldRefs = {
    name: useRef(null),
    email: useRef(null),
    contact: useRef(null),
    ctc: useRef(null),
  };

  const [formData, setFormData] = useState(EMPTY);
  const [formSection, setFormSection] = useState('basic');
  const [stepDirection, setStepDirection] = useState('forward');
  const [formErrors, setFormErrors] = useState({});
  const [stepBanner, setStepBanner] = useState('');
  const [saving, setSaving] = useState(false);
  const [quickList, setQuickList] = useState(null);
  const [countryIso, setCountryIso] = useState('IN');
  const [countryCode, setCountryCode] = useState('+91');

  const [masterPositions, setMasterPositions] = useState([]);
  const [masterClients, setMasterClients] = useState([]);
  const [masterSources, setMasterSources] = useState([]);
  const [masterCtcBands, setMasterCtcBands] = useState([]);
  const [masterNoticePeriods, setMasterNoticePeriods] = useState([]);
  const [masterProducts, setMasterProducts] = useState([]);
  const [masterMisStatuses, setMasterMisStatuses] = useState([]);

  const deskDefaults = resolveFormDeskDefaults(user);
  const flsLocked = Boolean(deskDefaults?.locked?.fls && deskDefaults?.fls);

  const reset = useCallback(() => {
    const next = { ...EMPTY };
    if (deskDefaults?.fls) next.fls = deskDefaults.fls;
    if (deskDefaults?.client) next.client = deskDefaults.client;
    if (deskDefaults?.source) next.source = deskDefaults.source;
    if (deskDefaults?.product) next.product = deskDefaults.product;
    if (deskDefaults?.location) next.location = deskDefaults.location;
    setFormData(next);
    setFormSection('basic');
    setStepDirection('forward');
    setFormErrors({});
    setStepBanner('');
    setSaving(false);
    setCountryIso('IN');
    setCountryCode('+91');
  }, [deskDefaults]);

  useEffect(() => {
    if (open) reset();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMasterData = useCallback(async () => {
    try {
      const [positions, clients, sources, ctc, notice, product, misStatus] = await Promise.all([
        fetchPicklist('/api/positions', { limit: PICKLIST_DROPDOWN_LIMIT }).catch(() => []),
        fetchPicklist('/api/clients', { limit: PICKLIST_DROPDOWN_LIMIT }).catch(() => []),
        fetchPicklist('/api/sources', { limit: PICKLIST_DROPDOWN_LIMIT }).catch(() => []),
        fetchPicklist('/api/org-lists/ctc').catch(() => []),
        fetchPicklist('/api/org-lists/notice').catch(() => []),
        fetchPicklist('/api/org-lists/product', { limit: PICKLIST_DROPDOWN_LIMIT }).catch(() => []),
        fetchPicklist('/api/org-lists/misStatus', { limit: PICKLIST_DROPDOWN_LIMIT }).catch(() => []),
      ]);
      setMasterPositions(dedupeByName(positions));
      setMasterClients(dedupeByName(clients));
      setMasterSources(dedupeByName(sources));
      setMasterCtcBands(dedupeByName(ctc));
      setMasterNoticePeriods(dedupeByName(notice));
      setMasterProducts(dedupeByName(product));
      setMasterMisStatuses(dedupeByName(misStatus));
    } catch {
      /* keep empty lists */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchMasterData();
  }, [open, fetchMasterData]);

  useEffect(() => {
    if (!open) return;
    formScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [formSection, open]);

  const setFormField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let next = type === 'checkbox' ? checked : value;
    if (name === 'contact') {
      next = String(value || '').replace(/\D/g, '').slice(0, countryCode === '+91' || countryCode === '+1' ? 10 : 15);
    } else if (name === 'email') {
      next = String(value || '').toLowerCase();
    } else if (
      name === 'name' || name === 'location' || name === 'companyName' || name === 'remark'
      || name === 'position' || name === 'client' || name === 'source' || name === 'ctc'
      || name === 'expectedCtc' || name === 'noticePeriod' || name === 'experience'
      || name === 'fls' || name === 'skills' || name === 'product'
    ) {
      next = String(value || '').toUpperCase();
    }
    setFormField(name, next);
  };

  const formCountryOptions = useMemo(() => (countryCodes || []).map((c) => {
    const iso = (c.iso || '').toUpperCase();
    return {
      value: iso || c.code,
      label: c.code,
      description: c.name || '',
      flagIso: iso || undefined,
      searchText: `${c.name || ''} ${iso} ${c.code || ''}`,
    };
  }), [countryCodes]);

  const formPositionOptions = useMemo(() => {
    const names = masterPositions.map((p) => toBlock(p.name)).filter(Boolean);
    const current = toBlock(formData.position);
    if (current && !names.includes(current)) names.unshift(current);
    return names.map((v) => ({ value: v, label: v }));
  }, [masterPositions, formData.position]);

  const formExperienceOptions = useMemo(() => [
    { value: '', label: 'SELECT' },
    { value: 'FRESHER', label: 'FRESHER' },
    ...[...Array(31).keys()].slice(1).map((n) => ({ value: String(n), label: String(n) })),
  ], []);

  const formCtcOptions = useMemo(() => {
    const names = masterCtcBands.length
      ? masterCtcBands.map((x) => x.name).filter(Boolean)
      : DEFAULT_CTC_BANDS;
    return names.map((r) => ({ value: toBlock(r), label: toBlock(r) }));
  }, [masterCtcBands]);

  const formExpectedCtcOptions = useMemo(() => {
    const bands = (masterCtcBands.length
      ? masterCtcBands.map((x) => x.name).filter(Boolean)
      : DEFAULT_CTC_BANDS
    ).map(toBlock);
    const withNorms = bands.includes('AS PER COMPANY NORMS') ? bands : ['AS PER COMPANY NORMS', ...bands];
    return withNorms.map((r) => ({ value: r, label: r }));
  }, [masterCtcBands]);

  const formNoticeOptions = useMemo(() => {
    const names = masterNoticePeriods.length
      ? masterNoticePeriods.map((x) => x.name).filter(Boolean)
      : DEFAULT_NOTICE_PERIODS;
    return names.map((opt) => ({ value: toBlock(opt), label: toBlock(opt) }));
  }, [masterNoticePeriods]);

  const formFlsOptions = useMemo(() => [
    { value: 'FLS', label: 'FLS' },
    { value: 'NON-FLS', label: 'NON-FLS' },
  ], []);

  const formClientOptions = useMemo(() => {
    const opts = masterClients.map((c) => ({ value: toBlock(c.name), label: toBlock(c.name) }));
    const cur = toBlock(formData.client);
    if (cur && !opts.some((o) => o.value === cur)) opts.unshift({ value: cur, label: cur });
    return opts;
  }, [masterClients, formData.client]);

  const formSourceOptions = useMemo(() => {
    const opts = masterSources.map((s) => ({ value: toBlock(s.name), label: toBlock(s.name) }));
    const cur = toBlock(formData.source);
    if (cur && !opts.some((o) => o.value === cur)) opts.unshift({ value: cur, label: cur });
    return opts;
  }, [masterSources, formData.source]);

  const formProductOptions = useMemo(() => {
    const opts = masterProducts.map((p) => ({ value: toBlock(p.name), label: toBlock(p.name) }));
    const cur = toBlock(formData.product);
    if (cur && !opts.some((o) => o.value === cur)) opts.unshift({ value: cur, label: cur });
    return opts;
  }, [masterProducts, formData.product]);

  const formMisStatusOptions = useMemo(() => {
    const defaults = ['NEW', 'CONTACTED', 'INTERESTED', 'FOLLOW UP', 'NOT INTERESTED', 'QUALIFIED', 'CONVERTED'];
    const fromApi = masterMisStatuses.map((s) => toBlock(s.name)).filter(Boolean);
    // Prefer live org list only — hard-merging starters undoes Manage rename/delete.
    const source = fromApi.length ? fromApi : defaults;
    const seen = new Set();
    const names = [];
    for (const name of source) {
      if (!name || seen.has(name)) continue;
      seen.add(name);
      names.push(name);
    }
    const opts = names.map((name) => ({ value: name, label: name }));
    const cur = toBlock(formData.status) || 'NEW';
    if (cur && !opts.some((o) => o.value === cur)) opts.unshift({ value: cur, label: cur });
    return opts;
  }, [masterMisStatuses, formData.status]);

  const stepDone = {
    basic: !!(formData.name?.trim() && formData.email?.trim() && formData.contact?.trim()),
    experience: !!formData.ctc,
    placement: !!(formData.client || formData.source),
  };

  const steps = [
    { id: 'basic', n: '01', label: 'Profile', hint: 'Contact & employment', icon: User, done: stepDone.basic },
    { id: 'experience', n: '02', label: 'Compensation', hint: 'CTC, notice & status', icon: IndianRupee, done: stepDone.experience },
    { id: 'placement', n: '03', label: 'Placement', hint: 'Client & source', icon: Building2, done: stepDone.placement },
  ];
  const stepIdx = Math.max(0, steps.findIndex((s) => s.id === formSection));
  const stepProgress = ((stepIdx + 1) / steps.length) * 100;

  const validateStep = (step, data = formData) => {
    const errors = {};
    const t = { ...data };
    Object.keys(t).forEach((k) => { if (typeof t[k] === 'string') t[k] = t[k].trim(); });

    if (step === 'basic') {
      if (!t.name) errors.name = 'Name is required';
      else if (t.name.length < 2) errors.name = 'Name must be at least 2 characters';
      else if (!/^[a-zA-Z\s.''-]+$/.test(t.name)) {
        errors.name = 'Name can only contain letters, spaces, and hyphens';
      }
      if (!t.email) errors.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t.email)) errors.email = 'Enter a valid email address';
      if (!t.contact) errors.contact = 'Contact number is required';
      else {
        const digits = t.contact.replace(/\D/g, '');
        if (countryCode === '+91' && digits.length !== 10) {
          errors.contact = 'Enter a valid 10-digit mobile number';
        } else if (countryCode === '+1' && digits.length !== 10) {
          errors.contact = 'Enter a valid 10-digit phone number';
        } else if (digits.length < 7 || digits.length > 15) {
          errors.contact = 'Enter a valid phone number';
        }
      }
    }
    if (step === 'experience') {
      if (!t.ctc) errors.ctc = 'Current CTC is required';
    }
    return errors;
  };

  const applyStepErrors = (errors) => {
    setFormErrors(errors);
    const first = Object.keys(errors)[0];
    if (first) {
      setStepBanner(errors[first]);
      toast?.warning?.(errors[first]);
      requestAnimationFrame(() => {
        fieldRefs[first]?.current?.focus?.();
        fieldRefs[first]?.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      });
    } else {
      setStepBanner('');
    }
    return Object.keys(errors).length === 0;
  };

  const goStep = (id) => {
    const targetIdx = steps.findIndex((s) => s.id === id);
    if (targetIdx > stepIdx) {
      for (let i = stepIdx; i < targetIdx; i += 1) {
        const errors = validateStep(steps[i].id);
        if (!applyStepErrors(errors)) return;
      }
    }
    setStepBanner('');
    setStepDirection(targetIdx < stepIdx ? 'back' : 'forward');
    setFormSection(id);
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose?.();
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    // Never save until the user reaches the final Placement step.
    if (formSection !== 'placement') {
      const errors = validateStep(formSection);
      if (!applyStepErrors(errors)) return;
      const order = ['basic', 'experience', 'placement'];
      const idx = order.indexOf(formSection);
      const next = order[Math.min(idx + 1, order.length - 1)];
      setStepBanner('');
      setStepDirection('forward');
      setFormSection(next);
      return;
    }
    const basicErrors = validateStep('basic');
    const expErrors = validateStep('experience');
    const merged = { ...basicErrors, ...expErrors };
    if (!applyStepErrors(merged)) {
      if (Object.keys(basicErrors).length) setFormSection('basic');
      else if (Object.keys(expErrors).length) setFormSection('experience');
      return;
    }
    setSaving(true);
    try {
      const digits = String(formData.contact || '').replace(/\D/g, '');
      const res = await authenticatedFetch('/api/mis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: digits,
          contact: digits,
          position: formData.position,
          companyName: formData.companyName,
          location: formData.location,
          experience: formData.experience,
          ctc: formData.ctc,
          expectedCtc: formData.expectedCtc,
          noticePeriod: formData.noticePeriod,
          fls: formData.fls,
          status: toBlock(formData.status) || 'NEW',
          client: formData.client,
          source: formData.source || 'MIS Manual',
          product: formData.product,
          skills: formData.skills,
          remark: formData.remark,
          marketingConsent: Boolean(formData.marketingConsent),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'DUPLICATE_EMAIL' || (res.status === 409 && /email/i.test(data.message || ''))) {
          setFormErrors({ email: 'Email already exists' });
          setFormSection('basic');
          setStepBanner('This email already exists in MIS');
        } else if (data.code === 'DUPLICATE_PHONE' || (res.status === 409 && /phone/i.test(data.message || ''))) {
          setFormErrors({ contact: 'Phone already exists' });
          setFormSection('basic');
          setStepBanner('This phone number already exists in MIS');
        }
        throw new Error(data.message || 'Could not add contact');
      }
      toast?.success?.('Contact saved to MIS');
      onCreated?.(data.data);
      handleClose();
    } catch (err) {
      toast?.error?.(err.message || 'Could not add contact');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-3 overflow-x-hidden overflow-y-auto overscroll-contain"
        inert={!isTop ? '' : undefined}
        aria-hidden={!isTop || undefined}
      >
        <div className="absolute inset-0 bg-stone-900/55 backdrop-blur-sm" aria-hidden="true" onClick={handleClose} />
        <FocusLock
          returnFocus={isTop && !quickList}
          disabled={!isTop || !!quickList}
          className="relative w-full min-w-0 max-w-full sm:max-w-[min(96vw,72rem)] lg:max-w-[min(96vw,80rem)] my-auto h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[min(96vh,920px)] flex flex-col"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mis-form-title"
            className="relative w-full min-w-0 min-h-0 flex-1 rounded-none sm:rounded-2xl border-0 sm:border border-stone-200/70 bg-white shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 bg-stone-100 flex-shrink-0 relative overflow-hidden" aria-hidden="true">
              <div
                className="candidate-step-progress absolute inset-y-0 left-0 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600"
                style={{ width: `${stepProgress}%` }}
              />
            </div>

            <div className="flex items-start justify-between gap-2 sm:gap-3 px-3.5 sm:px-6 py-3 sm:py-3.5 border-b border-stone-100 flex-shrink-0 bg-gradient-to-r from-stone-50/80 via-white to-teal-50/30">
              <div className="min-w-0 flex items-start gap-2.5 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-brand-600 to-teal-600 flex items-center justify-center shadow-md shadow-brand-500/25 flex-shrink-0">
                  <Megaphone size={18} className="text-white" />
                </div>
                <div className="min-w-0">
                  <h2 id="mis-form-title" className="text-base sm:text-lg font-bold text-stone-900 tracking-tight truncate">
                    Add contact
                  </h2>
                  <p className="text-[11px] sm:text-xs text-stone-500 mt-0.5 truncate">
                    Step {stepIdx + 1} of 3 · {steps[stepIdx]?.label}
                    <span className="hidden sm:inline"> — same layout as Add Candidate · saved to MIS</span>
                  </p>
                </div>
              </div>
              <button type="button" onClick={handleClose} className="p-2 sm:p-2.5 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-600 flex-shrink-0" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden">
              <aside className="hidden md:flex w-56 lg:w-64 flex-col border-r border-stone-100 bg-stone-50/50 py-4 px-3 flex-shrink-0">
                <p className="px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">Record steps</p>
                {steps.map((s, i) => {
                  const Icon = s.icon;
                  const active = s.id === formSection;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => goStep(s.id)}
                      className={`w-full flex items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors mb-1 ${
                        active ? 'bg-white shadow-sm border border-brand-100' : 'hover:bg-white/80 border border-transparent'
                      }`}
                    >
                      <span className={`mt-0.5 h-8 w-8 rounded-lg inline-flex items-center justify-center flex-shrink-0 ${
                        s.done ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : active ? 'bg-brand-50 text-brand-700 border border-brand-100' : 'bg-stone-100 text-stone-500'
                      }`}>
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-400">{s.n}</span>
                        <span className={`block text-sm font-semibold ${active ? 'text-stone-900' : 'text-stone-700'}`}>{s.label}</span>
                        <span className="block text-[11px] text-stone-400 truncate">{s.hint}</span>
                      </span>
                      {i < steps.length - 1 ? null : null}
                    </button>
                  );
                })}
              </aside>

              <div className="flex-1 min-w-0 overflow-y-auto" ref={formScrollRef}>
                <form
                  id="mis-contact-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    // Block implicit Enter submits on early steps.
                    if (formSection === 'placement') submit(e);
                    else {
                      const errors = validateStep(formSection);
                      if (!applyStepErrors(errors)) return;
                      goStep(steps[Math.min(stepIdx + 1, steps.length - 1)].id);
                    }
                  }}
                  className="p-3.5 sm:p-6"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && formSection !== 'placement') {
                      e.preventDefault();
                    }
                  }}
                >
                  <div className={`md:hidden grid grid-cols-3 gap-1.5 w-full min-w-0 mb-4`}>
                    {steps.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => goStep(s.id)}
                        className={`rounded-lg px-2 py-2 text-[11px] font-semibold border ${
                          s.id === formSection ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-stone-200 bg-white text-stone-600'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>

                  {stepBanner ? (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm font-medium text-amber-900">
                      {stepBanner}
                    </div>
                  ) : null}

                  <div className={`candidate-step-panel space-y-4 ${stepDirection === 'back' ? 'candidate-step-back' : 'candidate-step-forward'}`}>
                    {formSection === 'basic' && (
                      <section>
                        <div className="mb-4 pb-3 border-b border-stone-100">
                          <h3 className="text-sm font-bold text-stone-900">Profile</h3>
                          <p className="text-[12px] text-stone-500 mt-0.5">Identity, contact details, and current employment.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3.5 w-full min-w-0">
                          <div className="min-w-0">
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Full name <span className="text-red-500">*</span></label>
                            <input ref={fieldRefs.name} type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="Full name" className={fieldClass(formErrors.name)} autoFocus />
                            {formErrors.name ? <p className="text-xs text-red-500 mt-1 font-medium">{formErrors.name}</p> : null}
                          </div>
                          <div className="min-w-0">
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Email <span className="text-red-500">*</span></label>
                            <input ref={fieldRefs.email} type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="name@company.com" className={emailFieldClass(formErrors.email)} />
                            {formErrors.email ? <p className="text-xs text-red-500 mt-1 font-medium">{formErrors.email}</p> : null}
                          </div>
                          <div className="md:col-span-2 min-w-0">
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Phone <span className="text-red-500">*</span></label>
                            <div className="flex items-stretch gap-2 w-full min-w-0">
                              <div className="w-[7.25rem] sm:w-[8.25rem] flex-shrink-0 min-w-0">
                                <PremiumSelect
                                  value={countryIso}
                                  onChange={(iso) => {
                                    const match = (countryCodes || []).find((c) => c.iso === iso);
                                    const dial = match?.code || '+91';
                                    setCountryIso(iso);
                                    setCountryCode(dial);
                                  }}
                                  options={formCountryOptions}
                                  placeholder="Code"
                                  searchable
                                  searchPlaceholder="Search…"
                                  error={!!formErrors.contact}
                                  compact
                                />
                              </div>
                              <input
                                ref={fieldRefs.contact}
                                type="tel"
                                name="contact"
                                value={formData.contact || ''}
                                placeholder="Phone number"
                                onChange={(e) => {
                                  let digitsOnly = e.target.value.replace(/\D/g, '');
                                  if (digitsOnly.length > 10) digitsOnly = digitsOnly.slice(0, 10);
                                  setFormField('contact', digitsOnly);
                                }}
                                className={`flex-1 min-w-0 ${emailFieldClass(formErrors.contact)}`}
                                maxLength="10"
                              />
                            </div>
                            {formErrors.contact ? <p className="text-xs text-red-500 mt-1 font-medium break-words">{formErrors.contact}</p> : null}
                          </div>
                          <ListField onManage={setQuickList} label="Position" listCfg={LIST_META.positions}>
                            <PremiumSelect
                              variant="list"
                              value={formData.position || ''}
                              onChange={(v) => setFormField('position', v)}
                              options={formPositionOptions}
                              placeholder="Select or add position"
                              allowClear
                              searchable
                              creatable
                              searchPlaceholder="Search positions…"
                              emptyLabel="No positions found"
                              minSearchChars={PICKLIST_MIN_SEARCH}
                              onSearch={(q) => searchPicklistOptions('/api/positions', q)}
                              onCreate={async (raw) => {
                                const name = toBlock(raw);
                                if (!name) return;
                                try {
                                  const res = await authenticatedFetch('/api/positions', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ name }),
                                  });
                                  const data = await res.json().catch(() => ({}));
                                  if (res.ok) {
                                    setMasterPositions((prev) => dedupeByName([...prev, { name }]));
                                  } else if (!/exist/i.test(data.message || '')) {
                                    toast?.warning?.(data.message || 'Could not save position to master list');
                                  }
                                } catch { /* still allow local value */ }
                                setFormField('position', name);
                              }}
                            />
                          </ListField>
                          <div className="min-w-0">
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Current company</label>
                            <input type="text" name="companyName" value={formData.companyName} onChange={handleInputChange} placeholder="Current company" className={fieldClass(false)} />
                          </div>
                          <div className="min-w-0">
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Location</label>
                            <input type="text" name="location" value={formData.location || ''} onChange={handleInputChange} placeholder="City / region" className={fieldClass(false)} />
                          </div>
                        </div>
                      </section>
                    )}

                    {formSection === 'experience' && (
                      <section>
                        <div className="mb-4 pb-3 border-b border-stone-100">
                          <h3 className="text-sm font-bold text-stone-900">Compensation</h3>
                          <p className="text-[12px] text-stone-500 mt-0.5">Experience, pay band, notice, and MIS status.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3.5 w-full min-w-0">
                          <div className="min-w-0">
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Experience (years)</label>
                            <PremiumSelect variant="list" value={formData.experience != null ? String(formData.experience) : ''} onChange={(v) => setFormField('experience', v)} options={formExperienceOptions} placeholder="Select" allowClear searchable searchPlaceholder="Filter…" />
                          </div>
                          <ListField onManage={setQuickList} label="Current CTC (LPA)" listCfg={LIST_META.ctc} required>
                            <div ref={fieldRefs.ctc}>
                              <PremiumSelect variant="list" value={formData.ctc || ''} onChange={(v) => setFormField('ctc', v)} options={formCtcOptions} placeholder="Select current CTC" allowClear error={!!formErrors.ctc} searchable searchPlaceholder="Search CTC bands…" />
                            </div>
                            {formErrors.ctc ? <p className="text-xs text-red-500 mt-1 font-medium">{formErrors.ctc}</p> : null}
                          </ListField>
                          <ListField onManage={setQuickList} label="Expected CTC (LPA)" listCfg={LIST_META.ctc}>
                            <PremiumSelect variant="list" value={formData.expectedCtc || ''} onChange={(v) => setFormField('expectedCtc', v)} options={formExpectedCtcOptions} placeholder="Select expected CTC" allowClear searchable searchPlaceholder="Search CTC bands…" />
                          </ListField>
                          <ListField onManage={setQuickList} label="Notice period" listCfg={LIST_META.notice}>
                            <PremiumSelect variant="list" value={formData.noticePeriod || ''} onChange={(v) => setFormField('noticePeriod', v)} options={formNoticeOptions} placeholder="Select notice period" allowClear searchable searchPlaceholder="Search notice periods…" />
                          </ListField>
                          <div className="min-w-0">
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">FLS / Non-FLS</label>
                            {flsLocked ? (
                              <>
                                <div className="h-11 px-3 rounded-xl border border-stone-200 bg-stone-50 text-sm font-semibold text-stone-700 flex items-center">
                                  {String(formData.fls || '').replace(/[_-]+/g, ' ') || '—'}
                                </div>
                                <p className="text-[11px] text-stone-400 mt-1">Fixed from your desk defaults (set by admin).</p>
                              </>
                            ) : (
                              <PremiumSelect variant="list" value={formData.fls || ''} onChange={(v) => setFormField('fls', v)} options={formFlsOptions} placeholder="Select" allowClear />
                            )}
                          </div>
                          <ListField onManage={setQuickList} label="Status" listCfg={LIST_META.misStatus}>
                            <PremiumSelect
                              variant="list"
                              value={formData.status || 'NEW'}
                              onChange={(v) => setFormField('status', toBlock(v) || 'NEW')}
                              options={formMisStatusOptions}
                              placeholder="Select status"
                              searchable
                              searchPlaceholder="Search MIS statuses…"
                              emptyLabel="No statuses — use Manage to add"
                              minSearchChars={PICKLIST_MIN_SEARCH}
                              onSearch={(q) => searchPicklistOptions('/api/org-lists/misStatus', q)}
                              onCreate={async (raw) => {
                                const name = toBlock(raw);
                                if (!name) return;
                                try {
                                  const res = await authenticatedFetch('/api/org-lists/misStatus', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ name }),
                                  });
                                  const data = await res.json().catch(() => ({}));
                                  if (res.ok) {
                                    setMasterMisStatuses((prev) => dedupeByName([...prev, { name }]));
                                  } else if (!/exist/i.test(data.message || '')) {
                                    toast?.warning?.(data.message || 'Could not save status');
                                  }
                                } catch { /* allow local value */ }
                                setFormField('status', name);
                              }}
                              creatable
                            />
                            <p className="text-[11px] text-stone-400 mt-1">MIS-only — not linked to Candidates pipeline stages.</p>
                          </ListField>
                        </div>
                      </section>
                    )}

                    {formSection === 'placement' && (
                      <section>
                        <div className="mb-4 pb-3 border-b border-stone-100">
                          <h3 className="text-sm font-bold text-stone-900">Placement</h3>
                          <p className="text-[12px] text-stone-500 mt-0.5">
                            Client is who you hire for. Source is where the CV came from.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3.5 w-full min-w-0">
                          <ListField onManage={setQuickList} label="Client name" listCfg={LIST_META.clients}>
                            <PremiumSelect
                              variant="list"
                              value={formData.client || ''}
                              onChange={(v) => setFormField('client', v)}
                              options={formClientOptions}
                              placeholder="Select client"
                              searchable
                              searchPlaceholder="Search clients…"
                              allowClear
                              emptyLabel="No clients found"
                              minSearchChars={PICKLIST_MIN_SEARCH}
                              onSearch={(q) => searchPicklistOptions('/api/clients', q)}
                            />
                          </ListField>
                          <ListField onManage={setQuickList} label="Product / Skill" listCfg={LIST_META.product}>
                            <PremiumSelect
                              variant="list"
                              value={formData.product || ''}
                              onChange={(v) => setFormField('product', v)}
                              options={formProductOptions}
                              placeholder="Select product / skill"
                              searchable
                              searchPlaceholder="Search…"
                              allowClear
                              emptyLabel="No options"
                              minSearchChars={PICKLIST_MIN_SEARCH}
                              onSearch={(q) => searchPicklistOptions('/api/org-lists/product', q)}
                            />
                          </ListField>
                          <ListField onManage={setQuickList} label="Source" listCfg={LIST_META.sources}>
                            <PremiumSelect
                              variant="list"
                              value={formData.source || ''}
                              onChange={(v) => setFormField('source', v)}
                              options={formSourceOptions}
                              placeholder="Select source"
                              searchable
                              searchPlaceholder="Search…"
                              allowClear
                              emptyLabel="No options"
                              minSearchChars={PICKLIST_MIN_SEARCH}
                              onSearch={(q) => searchPicklistOptions('/api/sources', q)}
                            />
                          </ListField>
                          <div className="min-w-0">
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Skills</label>
                            <input type="text" name="skills" value={formData.skills || ''} onChange={handleInputChange} placeholder="Skills (optional)" className={fieldClass(false)} />
                          </div>
                          <div className="md:col-span-2 min-w-0">
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Remark</label>
                            <textarea
                              name="remark"
                              value={formData.remark || ''}
                              onChange={handleInputChange}
                              placeholder="Optional notes for the hiring team…"
                              rows="3"
                              className={`${fieldClass(false)} !h-auto min-h-[5.5rem] max-h-48 resize-y overflow-y-auto leading-relaxed`}
                            />
                          </div>
                          <label className="md:col-span-2 flex items-start gap-2.5 rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-3 cursor-pointer">
                            <input
                              type="checkbox"
                              name="marketingConsent"
                              className="mt-0.5 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                              checked={formData.marketingConsent}
                              onChange={handleInputChange}
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-stone-700">Marketing consent</span>
                              <span className="block text-[11px] text-stone-400 mt-0.5">Allow email / WhatsApp outreach for this contact.</span>
                            </span>
                          </label>
                        </div>
                      </section>
                    )}
                  </div>
                </form>
              </div>
            </div>

            <div className="px-3.5 sm:px-6 py-3 sm:py-3.5 border-t border-stone-100 bg-stone-50/90 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 flex-shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3.5">
              <button type="button" onClick={handleClose} disabled={saving} className="btn-secondary w-full sm:w-auto sm:min-w-[100px]">
                Cancel
              </button>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:items-center w-full sm:w-auto min-w-0">
                {stepIdx > 0 && (
                  <button type="button" onClick={() => goStep(steps[stepIdx - 1].id)} disabled={saving} className="btn-secondary inline-flex items-center justify-center gap-1 w-full sm:w-auto">
                    <ChevronLeft size={15} /> Back
                  </button>
                )}
                {stepIdx < steps.length - 1 ? (
                  <button type="button" onClick={() => goStep(steps[stepIdx + 1].id)} disabled={saving} className="btn-primary inline-flex items-center justify-center gap-1 w-full sm:w-auto sm:min-w-[140px]">
                    Continue <ChevronRight size={15} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={saving}
                    className="btn-primary w-full sm:w-auto sm:min-w-[160px] inline-flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Megaphone size={16} />}
                    Save contact
                  </button>
                )}
              </div>
            </div>
          </div>
        </FocusLock>
      </div>

      {quickList && (
        <QuickListManager
          open={!!quickList}
          onClose={() => setQuickList(null)}
          title={quickList.title}
          singular={quickList.singular}
          apiEndpoint={quickList.apiEndpoint}
          seedable={!!quickList.seedable}
          icon={quickList.icon}
          supportsRequiresPan={quickList.apiEndpoint === '/api/clients'}
          onChanged={fetchMasterData}
        />
      )}
    </>,
    document.body
  );
}
