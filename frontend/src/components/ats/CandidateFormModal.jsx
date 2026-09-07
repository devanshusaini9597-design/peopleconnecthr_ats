import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import FocusLock from 'react-focus-lock';
import {
  X, User, IndianRupee, Building2, Settings2, Sparkles, RefreshCw,
  ChevronLeft, ChevronRight, Upload, Check, AlertCircle,
  Briefcase, Share2, Clock3, Info, Layers,
} from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import PremiumDatePicker from '../ui/PremiumDatePicker';
import QuickListManager from '../QuickListManager';
import { planHasFeature } from '../../config/planFeatures';
import { REVIEW_STATUS_OPTIONS } from './atsConstants';
import { clientRequiresPan, PAN_INFO_TITLE, PAN_INFO_MESSAGE } from '../../utils/panClientRules';
import { todayLocalISO } from './atsConstants';
import { useAuth } from '../../context/AuthContext';
import { authenticatedFetch } from '../../utils/fetchUtils';
import { searchPicklistOptions, PICKLIST_MIN_SEARCH } from '../../utils/orgListFetch';
import useModalLayer from '../../hooks/useModalLayer';
import { canEditCandidateSpoc } from '../../utils/spocIdentity';

const LIST_META = {
  positions: { title: 'Positions', singular: 'position', apiEndpoint: '/api/positions', seedable: true, icon: Briefcase },
  clients: { title: 'Clients', singular: 'client', apiEndpoint: '/api/clients', icon: Building2 },
  sources: { title: 'CV Sources', singular: 'source', apiEndpoint: '/api/sources', seedable: true, icon: Share2 },
  ctc: { title: 'CTC Bands', singular: 'CTC band', apiEndpoint: '/api/org-lists/ctc', seedable: true, icon: IndianRupee },
  notice: { title: 'Notice Periods', singular: 'notice period', apiEndpoint: '/api/org-lists/notice', seedable: true, icon: Clock3 },
  product: { title: 'Product / Skill', singular: 'product / skill', apiEndpoint: '/api/org-lists/product', seedable: true, icon: Layers },
};

function ListField({ label, count, noun, listCfg, required, children, onManage, manageHint }) {
  return (
    <div className="min-w-0 w-full">
      <div className="flex items-center justify-between gap-2 mb-1.5 min-w-0">
        <label className="block text-[11px] font-semibold text-stone-600 min-w-0 truncate">
          {label}{required ? <span className="text-red-500"> *</span> : null}
        </label>
        <button
          type="button"
          onClick={() => onManage?.(listCfg)}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-stone-500 hover:text-brand-700 transition-colors flex-shrink-0 whitespace-nowrap"
          title={manageHint || `Manage ${noun}`}
        >
          <Settings2 size={11} />
          Manage
        </button>
      </div>
      <div className="min-w-0 w-full">
        {children}
      </div>
    </div>
  );
}

function fieldClass(err) {
  return `w-full min-w-0 max-w-full px-3 py-2.5 rounded-lg border bg-white text-sm font-medium outline-none uppercase box-border ${
    err ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200' : 'border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15'
  }`;
}

function emailFieldClass(err) {
  return `w-full min-w-0 max-w-full px-3 py-2.5 rounded-lg border bg-white text-sm font-medium outline-none normal-case box-border ${
    err ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200' : 'border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15'
  }`;
}

export default function CandidateFormModal(props) {
  const {
    showModal, formData, formSection, stepDirection = 'forward', editId, orgPlan, jdForScore, setJdForScore,
    handleAiScore, aiScoreLoading, aiScoreResult, setShowModal, goCandidateStep,
    stepBanner, formErrors, fieldRefs, setFormField, countryIso, setCountryIso,
    setCountryCode, formCountryOptions, resolveCountryFromDial, countryCode,
    handleInputChange, formPositionOptions, masterPositions, setQuickList,
    formFlsOptions, formExperienceOptions, formCtcOptions, formExpectedCtcOptions,
    formNoticeOptions, formStatusOptions, formClientOptions, masterClients,
    formSourceOptions, masterSources, orgCandidateFields, handleAddCandidate,
    quickList, fetchMasterData, isAutoParsing, countryCodes,
    masterCtcBands = [], masterNoticePeriods = [], masterProducts = [],
    formProductOptions = [], setFormData,
    recentStepChangeRef, showPanRequiredModal, setShowPanRequiredModal, onClientChange,
  } = props;
  const { user } = useAuth();
  const isFreelancer = user?.role === 'freelancer';
  const canEditSpoc = canEditCandidateSpoc(user?.role);
  const formScrollRef = useRef(null);
  const { isTop } = useModalLayer(showModal);

  useEffect(() => {
    if (!showModal) return;
    const el = formScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: 'smooth' });
  }, [formSection, showModal]);

  if (!showModal) return null;

  const hasResume = formData.resume instanceof File
    || (typeof formData.resume === 'string' && formData.resume.trim());
  const stepDone = {
    basic: !!(formData.name?.trim() && formData.email?.trim() && formData.contact?.trim()
      && (!isFreelancer || editId || hasResume)),
    experience: !!formData.ctc,
    placement: !!(formData.client || formData.source),
  };
  const manageHint = isFreelancer
    ? 'Add personal list values. Organization library entries remain available and cannot be modified.'
    : undefined;
  const steps = [
    { id: 'basic', n: '01', label: 'Profile', hint: 'Contact & employment', icon: User, done: stepDone.basic },
    { id: 'experience', n: '02', label: 'Compensation', hint: isFreelancer ? 'Pay & notice' : 'CTC & status', icon: IndianRupee, done: stepDone.experience },
    { id: 'placement', n: '03', label: 'Placement', hint: 'Client & source', icon: Building2, done: stepDone.placement },
  ];
  const lastStepId = steps[steps.length - 1]?.id || 'experience';
  const stepIdx = Math.max(0, steps.findIndex((s) => s.id === formSection));
  const stepProgress = ((stepIdx + 1) / steps.length) * 100;
  const LIST = LIST_META;

  return createPortal(
        <>
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-3 overflow-x-hidden overflow-y-auto overscroll-contain"
          inert={!isTop ? '' : undefined}
          aria-hidden={!isTop || undefined}
        >
          <div className="absolute inset-0 bg-stone-900/55 backdrop-blur-sm" aria-hidden="true" />
          <FocusLock
            returnFocus={isTop && !quickList}
            disabled={!isTop || !!quickList}
            className="relative w-full min-w-0 max-w-full sm:max-w-[min(96vw,72rem)] lg:max-w-[min(96vw,80rem)] my-auto h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[min(96vh,920px)] flex flex-col"
          >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="candidate-form-title"
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
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-brand-600 to-teal-600 flex items-center justify-center shadow-md shadow-brand-500/25 flex-shrink-0" aria-hidden="true">
                  <User size={16} className="text-white sm:hidden" />
                  <User size={18} className="text-white hidden sm:block" />
                </div>
                <div className="min-w-0">
                  <h2 id="candidate-form-title" className="text-base sm:text-lg font-bold text-stone-900 tracking-tight truncate">
                    {editId ? 'Edit Candidate' : 'Add Candidate'}
                  </h2>
                  <p className="text-[11px] sm:text-xs text-stone-500 mt-0.5 truncate">
                    Step {stepIdx + 1} of 3 · {steps[stepIdx]?.label}
                    <span className="hidden sm:inline">
                      {!editId && ' — resume upload can auto-fill available fields'}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-2 sm:p-2.5 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-600 flex-shrink-0"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {editId && planHasFeature(orgPlan, 'integrations.aiScoring') && (
              <div className="mx-3.5 sm:mx-6 mt-3 rounded-xl border border-violet-200 bg-violet-50/50 p-3 flex-shrink-0 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-violet-600" />
                  <h3 className="text-sm font-bold text-violet-900">Score with AI</h3>
                </div>
                <textarea
                  className="w-full input-ats min-h-[64px] text-sm mb-2 bg-white"
                  placeholder="Paste job description to score this resume…"
                  value={jdForScore}
                  onChange={(e) => setJdForScore(e.target.value)}
                />
                <button type="button" onClick={handleAiScore} disabled={aiScoreLoading || !jdForScore.trim()} className="btn-primary text-sm py-2">
                  {aiScoreLoading ? <><RefreshCw size={14} className="animate-spin" /> Scoring…</> : 'Score with AI'}
                </button>
                {aiScoreResult && (
                  <div className="mt-2 p-2.5 rounded-lg bg-white border border-violet-100 text-sm">
                    {aiScoreResult.score != null && <p className="font-bold text-violet-900">Score: {aiScoreResult.score}/100</p>}
                    {aiScoreResult.summary && <p className="text-stone-700 text-xs mt-1">{aiScoreResult.summary}</p>}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
              {/* Left step rail — enterprise wizard */}
              <aside className="hidden md:flex w-[200px] lg:w-[232px] flex-shrink-0 flex-col border-r border-stone-100 bg-stone-50/90 py-4 px-3 gap-1 min-h-0 overflow-y-auto overscroll-contain">
                <p className="px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">Record steps</p>
                {steps.map((s, i) => {
                  const active = formSection === s.id;
                  const StepIcon = s.icon;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => goCandidateStep(s.id)}
                      className={`candidate-step-rail-btn w-full text-left rounded-xl px-2.5 py-2.5 flex items-start gap-2.5 ${
                        active
                          ? 'bg-white shadow-sm ring-1 ring-brand-200/80'
                          : 'hover:bg-white/70'
                      }`}
                    >
                      <span className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${
                        s.done
                          ? 'bg-emerald-500 text-white'
                          : active
                            ? 'bg-gradient-to-br from-brand-600 to-teal-600 text-white shadow-sm shadow-brand-500/30'
                            : 'bg-stone-200/80 text-stone-600'
                      }`}>
                        {s.done ? <Check size={14} strokeWidth={2.5} /> : s.n}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm font-semibold ${active ? 'text-stone-900' : 'text-stone-700'}`}>{s.label}</span>
                        <span className="block text-[11px] text-stone-500 mt-0.5">{s.hint}</span>
                      </span>
                      {active && <StepIcon size={14} className="text-brand-600 mt-1 flex-shrink-0 opacity-70" />}
                    </button>
                  );
                })}
                <p className="mt-auto pt-4 px-1 text-[10px] text-stone-400 leading-relaxed">
                  {isFreelancer ? (
                    <>
                      Use <span className="font-semibold text-stone-500">Manage</span> to maintain personal list values.
                      Organization library entries remain available for selection and cannot be modified.
                    </>
                  ) : (
                    <>
                      Use <span className="font-semibold text-stone-500">Manage</span> beside any list field to add or edit values without leaving this form.
                    </>
                  )}
                </p>
              </aside>

              <form id="candidate-form" onSubmit={(e) => {
                if (formSection !== lastStepId) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                // Guard: ignore ghost click from step transition
                if (recentStepChangeRef?.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                handleAddCandidate(e);
              }} onKeyDown={(e) => {
                if (e.key === 'Enter' && formSection !== lastStepId) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }} ref={formScrollRef} className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 min-w-0 px-3.5 sm:px-6 py-3.5 sm:py-4 pb-6 space-y-3.5 sm:space-y-4">
                {/* Mobile step strip */}
                <div className={`md:hidden grid gap-1.5 w-full min-w-0 ${steps.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {steps.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => goCandidateStep(s.id)}
                      className={`min-w-0 rounded-lg border px-1.5 py-2 text-center ${
                        formSection === s.id
                          ? 'border-brand-400 bg-brand-50 text-brand-800 shadow-sm'
                          : 'border-stone-200 bg-white text-stone-500'
                      }`}
                    >
                      <span className="block text-[10px] font-bold">{s.done ? '✓' : s.n}</span>
                      <span className="block text-[10px] sm:text-[11px] font-semibold truncate">{s.label}</span>
                    </button>
                  ))}
                </div>

                {stepBanner && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                    <AlertCircle size={15} className="text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-red-800">Complete required fields</p>
                      <p className="text-[11px] text-red-700 mt-0.5 leading-snug">{stepBanner}</p>
                    </div>
                  </div>
                )}

                <div
                  ref={fieldRefs.resume}
                  className={`relative rounded-xl border border-dashed px-3 sm:px-4 py-3 hover:border-brand-400 transition-colors min-w-0 ${
                  formErrors.resume
                    ? 'border-red-300 bg-red-50/40'
                    : 'border-brand-300/70 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/30'
                }`}>
                  <input type="file" name="resume" accept=".pdf,.doc,.docx,image/*" onChange={handleInputChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                  <div className="flex items-center gap-2.5 sm:gap-3 pointer-events-none min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-white border border-brand-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Upload size={16} className="text-brand-600" />
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="text-sm font-semibold text-stone-800">
                        {isFreelancer && !editId ? 'Resume (required)' : 'Upload resume'}
                      </p>
                      <p className="text-[11px] text-stone-500 leading-snug">
                        {isFreelancer && !editId
                          ? 'PDF, DOC, or DOCX. Required before the candidate can be submitted to a mandate.'
                          : 'PDF, DOC, DOCX, or scan — auto-fills when possible'}
                      </p>
                      {isAutoParsing && (
                        <p className="text-[11px] text-brand-600 font-semibold mt-0.5 flex items-center gap-1.5">
                          <span className="w-3 h-3 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /> Parsing resume…
                        </p>
                      )}
                      {formData.resume && !isAutoParsing && (
                        <p className="text-[11px] text-emerald-600 font-semibold mt-0.5 truncate">{formData.resume.name || 'File selected'}</p>
                      )}
                      {formErrors.resume && (
                        <p className="text-[11px] text-red-600 font-semibold mt-0.5">{formErrors.resume}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  className={`candidate-step-panel space-y-4 ${
                    stepDirection === 'back' ? 'candidate-step-back' : 'candidate-step-forward'
                  }`}
                >
                {formSection === 'basic' && (
                  <section>
                    <div className="mb-4 pb-3 border-b border-stone-100">
                      <h3 className="text-sm font-bold text-stone-900">Profile</h3>
                      <p className="text-[12px] text-stone-500 mt-0.5">
                        Identity, contact details, and current employment.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3.5 w-full min-w-0">
                      <div className="min-w-0">
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Full name <span className="text-red-500">*</span></label>
                        <input ref={fieldRefs.name} type="text" name="name" value={formData.name || ''} onChange={handleInputChange} placeholder="Full name" className={fieldClass(formErrors.name)} />
                        {formErrors.name && <p className="text-xs text-red-500 mt-1 font-medium break-words">{formErrors.name}</p>}
                      </div>
                      <div className="min-w-0">
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Email <span className="text-red-500">*</span></label>
                        <input ref={fieldRefs.email} type="email" name="email" value={formData.email || ''} onChange={handleInputChange} placeholder="name@company.com" className={emailFieldClass(formErrors.email)} />
                        {formErrors.email && <p className="text-xs text-red-500 mt-1 font-medium break-words">{formErrors.email}</p>}
                      </div>
                      <div className="md:col-span-2 min-w-0">
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Phone <span className="text-red-500">*</span></label>
                        <div className="flex items-stretch gap-2 w-full min-w-0">
                          <div className="w-[6.75rem] sm:w-[7.75rem] flex-shrink-0 min-w-0">
                            <PremiumSelect
                              value={countryIso}
                              onChange={(iso) => {
                                const match = (countryCodes || []).find((c) => c.iso === iso);
                                const dial = match?.code || '+91';
                                setCountryIso(iso);
                                setCountryCode(dial);
                                setFormField('countryCode', dial);
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
                        {formErrors.contact && <p className="text-xs text-red-500 mt-1 font-medium break-words">{formErrors.contact}</p>}
                      </div>
                      <ListField onManage={setQuickList} label="Position" count={masterPositions.length} noun="positions" listCfg={LIST.positions} manageHint={manageHint}>
                        <PremiumSelect
                          variant="list"
                          value={formData.position || ''}
                          onChange={(v) => setFormField('position', v)}
                          options={formPositionOptions}
                          placeholder="Select or add position"
                          searchable
                          creatable
                          searchPlaceholder="Search positions…"
                          allowClear
                          emptyLabel="No positions found"
                          minSearchChars={PICKLIST_MIN_SEARCH}
                          onSearch={(q) => searchPicklistOptions('/api/positions', q)}
                          onCreate={async (name) => {
                            const n = String(name || '').trim().toUpperCase();
                            if (!n) return;
                            try {
                              await authenticatedFetch('/api/positions', {
                                method: 'POST',
                                body: JSON.stringify({ name: n }),
                              });
                            } catch {
                              /* save still promotes the catalog */
                            }
                            await fetchMasterData();
                          }}
                        />
                      </ListField>
                      <div className="min-w-0">
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Current company</label>
                        <input type="text" name="companyName" value={formData.companyName || ''} onChange={handleInputChange} placeholder="Current company" className={fieldClass(false)} />
                      </div>
                      <div className="md:col-span-2 min-w-0">
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Location</label>
                        <input ref={fieldRefs.location} type="text" name="location" value={formData.location || ''} onChange={handleInputChange} placeholder="City / region" className={fieldClass(false)} />
                      </div>
                    </div>
                  </section>
                )}

                {formSection === 'experience' && (
                  <section>
                    <div className="mb-4 pb-3 border-b border-stone-100">
                      <h3 className="text-sm font-bold text-stone-900">Compensation</h3>
                      <p className="text-[12px] text-stone-500 mt-0.5">
                        {isFreelancer
                          ? 'Experience, current and expected compensation, and notice period.'
                          : 'Experience, pay band, notice, and pipeline status.'}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3.5 w-full min-w-0">
                      <div className="min-w-0">
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Experience (years)</label>
                        <PremiumSelect variant="list" value={formData.experience != null ? String(formData.experience) : ''} onChange={(v) => setFormField('experience', v)} options={formExperienceOptions} placeholder="Select" allowClear searchable searchPlaceholder="Filter…" />
                      </div>
                      <ListField onManage={setQuickList} label="Current CTC (LPA)" count={masterCtcBands.length} noun="CTC bands" listCfg={LIST.ctc} required manageHint={manageHint}>
                        <div ref={fieldRefs.ctc}>
                          <PremiumSelect variant="list" value={formData.ctc || ''} onChange={(v) => setFormField('ctc', v)} options={formCtcOptions} placeholder="Select current CTC" allowClear error={!!formErrors.ctc} searchable searchPlaceholder="Search CTC bands…" />
                        </div>
                        {formErrors.ctc && <p className="text-xs text-red-500 mt-1 font-medium">{formErrors.ctc}</p>}
                      </ListField>
                      <ListField onManage={setQuickList} label="Expected CTC (LPA)" count={masterCtcBands.length} noun="CTC bands" listCfg={LIST.ctc} manageHint={manageHint}>
                        <PremiumSelect variant="list" value={formData.expectedCtc || ''} onChange={(v) => setFormField('expectedCtc', v)} options={formExpectedCtcOptions} placeholder="Select expected CTC" allowClear searchable searchPlaceholder="Search CTC bands…" />
                      </ListField>
                      <ListField onManage={setQuickList} label="Notice period" count={masterNoticePeriods.length} noun="notice periods" listCfg={LIST.notice} manageHint={manageHint}>
                        <PremiumSelect variant="list" value={formData.noticePeriod || ''} onChange={(v) => setFormField('noticePeriod', v)} options={formNoticeOptions} placeholder="Select notice period" allowClear searchable searchPlaceholder="Search notice periods…" />
                      </ListField>
                      <div className="min-w-0">
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">FLS / Non-FLS</label>
                        <PremiumSelect variant="list" value={formData.fls || ''} onChange={(v) => setFormField('fls', v)} options={formFlsOptions} placeholder="Select" allowClear />
                      </div>
                      {isFreelancer ? (
                        editId ? (
                          <div className="min-w-0">
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Status</label>
                            <div className="h-11 px-3 rounded-xl border border-stone-200 bg-stone-50 text-sm font-semibold text-stone-700 flex items-center">
                              {String(formData.status || 'APPLIED').replace(/[_-]+/g, ' ')}
                            </div>
                            <p className="text-[11px] text-stone-400 mt-1">Updated by the company when they review your submissions.</p>
                          </div>
                        ) : null
                      ) : (
                        <div className="min-w-0">
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Status</label>
                          <PremiumSelect variant="list" value={formData.status || 'APPLIED'} onChange={(v) => setFormField('status', v)} options={formStatusOptions} placeholder="Status" searchable searchPlaceholder="Type to filter…" />
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {formSection === 'placement' && (
                  <section>
                    <div className="mb-4 pb-3 border-b border-stone-100">
                      <h3 className="text-sm font-bold text-stone-900">Placement</h3>
                      <p className="text-[12px] text-stone-500 mt-0.5">
                        {isFreelancer
                          ? 'Client assignment, skill focus, and resume source.'
                          : 'Client is the company you hire for. Source is where this CV came from.'}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3.5 w-full min-w-0">
                      <ListField onManage={setQuickList} label="Client name" count={masterClients.length} noun="clients" listCfg={LIST.clients} manageHint={manageHint}>
                        <PremiumSelect
                          variant="list"
                          value={formData.client || ''}
                          onChange={(v) => (onClientChange ? onClientChange(v) : setFormField('client', v))}
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
                        <div className="min-w-0">
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">SPOC</label>
                        <input
                          ref={fieldRefs.spoc}
                          type="text"
                          name="spoc"
                          value={formData.spoc || ''}
                          onChange={handleInputChange}
                          placeholder={canEditSpoc ? 'SPOC' : ''}
                          disabled={!canEditSpoc}
                          readOnly={!canEditSpoc}
                          className={
                            canEditSpoc
                              ? fieldClass(false)
                              : 'w-full min-w-0 max-w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-stone-200 text-sm font-medium text-stone-600 outline-none uppercase box-border cursor-not-allowed opacity-90'
                          }
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">
                          PAN No.{clientRequiresPan(formData.client, masterClients) ? <span className="text-red-500"> *</span> : null}
                        </label>
                        <input
                          ref={fieldRefs.pan}
                          type="text"
                          name="pan"
                          value={formData.pan || ''}
                          onChange={handleInputChange}
                          placeholder="ABCDE1234F"
                          maxLength={10}
                          className={`${emailFieldClass(!!formErrors.pan)} tracking-wider`}
                          autoComplete="off"
                        />
                        {formErrors.pan ? (
                          <p className="text-xs text-red-500 mt-1 font-medium">{formErrors.pan}</p>
                        ) : clientRequiresPan(formData.client, masterClients) ? (
                          <p className="text-[11px] text-amber-700 mt-1 font-medium">Required for this client</p>
                        ) : (
                          <p className="text-[11px] text-stone-400 mt-1">Required only for clients marked PAN required</p>
                        )}
                      </div>
                      <ListField onManage={setQuickList} label="Product / Skill" count={masterProducts.length} noun="products / skills" listCfg={LIST.product} manageHint={manageHint}>
                        <div ref={fieldRefs.product}>
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
                        </div>
                      </ListField>
                      <ListField onManage={setQuickList} label="Source" count={masterSources.length} noun="sources" listCfg={LIST.sources} manageHint={manageHint}>
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
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Date</label>
                        <PremiumDatePicker
                          value={formData.date || todayLocalISO()}
                          onChange={(v) => setFormField('date', v)}
                          placeholder="Select date"
                          allowClear
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Call back date</label>
                        <PremiumDatePicker
                          value={formData.callBackDate || ''}
                          onChange={(v) => setFormField('callBackDate', v)}
                          placeholder="Select call back date"
                          allowClear
                        />
                      </div>
                      <div className="md:col-span-2 min-w-0">
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Remark</label>
                        <textarea name="remark" value={formData.remark || ''} onChange={handleInputChange} placeholder="Optional notes for the hiring team…" rows="2" className={`${fieldClass(false)} resize-none`} />
                      </div>
                    </div>
                    {orgCandidateFields.filter((f) => !f.isCore && f.showInForm !== false).length > 0 && (
                      <div className="mt-5 pt-4 border-t border-stone-100">
                        <h4 className="text-sm font-bold text-stone-900 mb-1">Custom fields</h4>
                        <p className="text-[12px] text-stone-500 mb-3">Organization-specific fields for this candidate.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3.5 w-full min-w-0">
                          {orgCandidateFields
                            .filter((f) => !f.isCore && f.showInForm !== false)
                            .sort((a, b) => (a.order || 0) - (b.order || 0))
                            .map((f) => {
                              const val = formData.customFields?.[f.key] ?? '';
                              const setCf = (v) => setFormData((prev) => ({
                                ...prev,
                                customFields: { ...(prev.customFields || {}), [f.key]: v },
                              }));
                              return (
                                <div key={f.key} className="min-w-0">
                                  <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">
                                    {f.label}{f.required ? <span className="text-red-500"> *</span> : null}
                                  </label>
                                  {f.type === 'select' ? (
                                    <PremiumSelect
                                      variant="list"
                                      value={String(val)}
                                      onChange={setCf}
                                      options={(f.options || []).map((o) => ({ value: o, label: o }))}
                                      placeholder={`Select ${f.label}`}
                                      allowClear
                                    />
                                  ) : f.type === 'boolean' ? (
                                    <PremiumSelect
                                      variant="list"
                                      value={val === true || val === 'true' || val === 'Yes' ? 'Yes' : val === false || val === 'false' || val === 'No' ? 'No' : ''}
                                      onChange={(v) => setCf(v === 'Yes' ? 'Yes' : v === 'No' ? 'No' : '')}
                                      options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]}
                                      placeholder="Select"
                                      allowClear
                                    />
                                  ) : (
                                    <input
                                      type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                                      value={val}
                                      onChange={(e) => setCf(e.target.value)}
                                      className={fieldClass(false)}
                                      placeholder={f.label}
                                    />
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </section>
                )}
                </div>
              </form>
            </div>

            <div className="px-3.5 sm:px-6 py-3 sm:py-3.5 border-t border-stone-100 bg-stone-50/90 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 flex-shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3.5">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary w-full sm:w-auto sm:min-w-[100px]">
                Cancel
              </button>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:items-center w-full sm:w-auto min-w-0">
                {stepIdx > 0 && (
                  <button
                    type="button"
                    onClick={() => goCandidateStep(steps[stepIdx - 1].id)}
                    className="btn-secondary inline-flex items-center justify-center gap-1 w-full sm:w-auto"
                  >
                    <ChevronLeft size={15} /> Back
                  </button>
                )}
                {stepIdx < steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => goCandidateStep(steps[stepIdx + 1].id)}
                    className="btn-primary inline-flex items-center justify-center gap-1 w-full sm:w-auto sm:min-w-[140px]"
                  >
                    Continue <ChevronRight size={15} />
                  </button>
                ) : (
                  <button type="submit" form="candidate-form" className="btn-primary w-full sm:w-auto sm:min-w-[160px]">
                    {editId ? 'Save Changes' : 'Save Candidate'}
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
        {showPanRequiredModal && (
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-900/55 backdrop-blur-sm animate-fade-in p-4"
            onClick={() => setShowPanRequiredModal?.(false)}
            role="presentation"
          >
            <div
              className="bg-white rounded-2xl border border-stone-200/60 shadow-2xl w-full max-w-md p-5 sm:p-6"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="pan-required-title"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center flex-shrink-0">
                  <Info size={20} />
                </div>
                <div>
                  <h3 id="pan-required-title" className="text-base font-bold text-stone-900 tracking-tight">
                    {PAN_INFO_TITLE}
                  </h3>
                  <p className="text-sm text-stone-600 mt-1.5 leading-relaxed">
                    {PAN_INFO_MESSAGE}
                  </p>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  className="btn-primary min-w-[100px]"
                  onClick={() => {
                    setShowPanRequiredModal?.(false);
                    setTimeout(() => {
                      const el = fieldRefs.pan?.current;
                      if (el && typeof el.focus === 'function') {
                        try { el.focus(); } catch { /* ignore */ }
                      }
                    }, 40);
                  }}
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}
        </>
  , document.body);
}
