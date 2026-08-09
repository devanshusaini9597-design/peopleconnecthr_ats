import React from 'react';
import { createPortal } from 'react-dom';
import FocusLock from 'react-focus-lock';
import {
  X, User, IndianRupee, Building2, Settings2, Sparkles, RefreshCw,
  ChevronLeft, ChevronRight, Upload, FileText, Check, AlertCircle,
} from 'lucide-react';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import PremiumSelect from '../ui/PremiumSelect';
import PremiumDatePicker from '../ui/PremiumDatePicker';
import QuickListManager from '../QuickListManager';
import { planHasFeature } from '../../config/planFeatures';
import { REVIEW_STATUS_OPTIONS } from './atsConstants';

export default function CandidateFormModal(props) {
  const {
    showModal, formData, formSection, editId, orgPlan, jdForScore, setJdForScore,
    handleAiScore, aiScoreLoading, aiScoreResult, setShowModal, goCandidateStep,
    stepBanner, formErrors, fieldRefs, setFormField, countryIso, setCountryIso,
    setCountryCode, formCountryOptions, resolveCountryFromDial, countryCode,
    handleInputChange, formPositionOptions, masterPositions, setQuickList,
    formFlsOptions, formExperienceOptions, formCtcOptions, formExpectedCtcOptions,
    formNoticeOptions, formStatusOptions, formClientOptions, masterClients,
    formSourceOptions, masterSources, orgCandidateFields, handleAddCandidate,
    quickList, fetchMasterData, isAutoParsing, countryCodes,
    masterCtcBands = [], masterNoticePeriods = [], setFormData,
    recentStepChangeRef,
  } = props;
  if (!showModal) return null;
  return createPortal((() => {
        const stepDone = {
          basic: !!(formData.name?.trim() && formData.email?.trim() && formData.contact?.trim()),
          experience: !!formData.ctc,
          placement: !!(formData.client || formData.source),
        };
        const steps = [
          { id: 'basic', n: '01', label: 'Profile', hint: 'Identity & role', icon: User, done: stepDone.basic },
          { id: 'experience', n: '02', label: 'Compensation', hint: 'CTC & status', icon: IndianRupee, done: stepDone.experience },
          { id: 'placement', n: '03', label: 'Placement', hint: 'Client & source', icon: Building2, done: stepDone.placement },
        ];
        const stepIdx = Math.max(0, steps.findIndex((s) => s.id === formSection));
        const openQuickList = (cfg) => setQuickList(cfg);
        const LIST = {
          positions: { title: 'Positions', singular: 'position', apiEndpoint: '/api/positions' },
          clients: { title: 'Clients', singular: 'client', apiEndpoint: '/api/clients' },
          sources: { title: 'CV Sources', singular: 'source', apiEndpoint: '/api/sources' },
          ctc: { title: 'CTC Bands', singular: 'CTC band', apiEndpoint: '/api/org-lists/ctc', seedable: true },
          notice: { title: 'Notice Periods', singular: 'notice period', apiEndpoint: '/api/org-lists/notice', seedable: true },
        };
        const ListField = ({ label, count, noun, listCfg, required, children }) => (
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="block text-[11px] font-semibold text-stone-600">
                {label}{required ? <span className="text-red-500"> *</span> : null}
              </label>
              <button
                type="button"
                onClick={() => openQuickList(listCfg)}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-stone-500 hover:text-brand-700 transition-colors"
                title={`Manage ${noun}`}
              >
                <Settings2 size={11} />
                Manage
              </button>
            </div>
            {children}
            {count === 0 && !listCfg?.seedable && (
              <button
                type="button"
                onClick={() => openQuickList(listCfg)}
                className="mt-1.5 w-full text-left rounded-lg border border-dashed border-stone-300 bg-stone-50/80 px-2.5 py-2 text-[11px] text-stone-600 hover:border-brand-300 hover:bg-brand-50/40 transition-colors"
              >
                No {noun} yet — <span className="font-bold text-brand-700">click to add</span>
              </button>
            )}
          </div>
        );
        const fieldClass = (err) =>
          `w-full px-3 py-2.5 rounded-lg border bg-white text-sm font-medium outline-none transition-all focus:ring-2 uppercase ${
            err ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-stone-200 focus:border-brand-500 focus:ring-brand-500/15'
          }`;
        const emailFieldClass = (err) =>
          `w-full px-3 py-2.5 rounded-lg border bg-white text-sm font-medium outline-none transition-all focus:ring-2 normal-case ${
            err ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-stone-200 focus:border-brand-500 focus:ring-brand-500/15'
          }`;

        return (
        <>
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="absolute inset-0 bg-stone-900/55 backdrop-blur-sm" aria-hidden="true" />
          <FocusLock returnFocus>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="candidate-form-title"
            className="relative w-full max-w-5xl my-auto rounded-t-2xl sm:rounded-2xl border border-stone-200/70 bg-white shadow-2xl max-h-[94dvh] sm:max-h-[90vh] flex flex-col overflow-hidden modal-panel-ats"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 flex-shrink-0" aria-hidden="true" />

            <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-3.5 border-b border-stone-100 flex-shrink-0 bg-gradient-to-r from-stone-50/80 via-white to-teal-50/30">
              <div className="min-w-0 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-teal-600 flex items-center justify-center shadow-md shadow-brand-500/25 flex-shrink-0" aria-hidden="true">
                  <User size={18} className="text-white" />
                </div>
                <div>
                  <h2 id="candidate-form-title" className="text-lg font-bold text-stone-900 tracking-tight">
                    {editId ? 'Edit Candidate' : 'Add Candidate'}
                  </h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Step {stepIdx + 1} of 3 · {steps[stepIdx]?.label}
                    {!editId && ' — resume upload can auto-fill fields'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-2.5 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-all hover:rotate-90 flex-shrink-0"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {editId && planHasFeature(orgPlan, 'integrations.aiScoring') && (
              <div className="mx-5 sm:mx-6 mt-3 rounded-xl border border-violet-200 bg-violet-50/50 p-3 flex-shrink-0">
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

            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* Left step rail — enterprise wizard */}
              <aside className="hidden md:flex w-[232px] flex-shrink-0 flex-col border-r border-stone-100 bg-stone-50/90 py-4 px-3 gap-1 min-h-0 overflow-y-auto overscroll-contain">
                <p className="px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">Record steps</p>
                {steps.map((s, i) => {
                  const active = formSection === s.id;
                  const StepIcon = s.icon;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => goCandidateStep(s.id)}
                      className={`w-full text-left rounded-xl px-2.5 py-2.5 transition-all flex items-start gap-2.5 ${
                        active
                          ? 'bg-white shadow-sm ring-1 ring-brand-200/80'
                          : 'hover:bg-white/70'
                      }`}
                    >
                      <span className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${
                        s.done
                          ? 'bg-emerald-500 text-white'
                          : active
                            ? 'bg-gradient-to-br from-brand-600 to-teal-600 text-white'
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
                  Use <span className="font-semibold text-stone-500">Manage</span> beside any list field to add or edit values without leaving this form.
                </p>
              </aside>

              <form id="candidate-form" onSubmit={(e) => {
                if (formSection !== 'placement') {
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
                if (e.key === 'Enter' && formSection !== 'placement') {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }} className="overflow-y-auto flex-1 min-h-0 px-4 sm:px-6 py-4 pb-24 space-y-4">
                {/* Mobile step strip */}
                <div className="md:hidden flex gap-1.5">
                  {steps.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => goCandidateStep(s.id)}
                      className={`flex-1 rounded-lg border px-2 py-2 text-center transition-all ${
                        formSection === s.id
                          ? 'border-brand-400 bg-brand-50 text-brand-800'
                          : 'border-stone-200 bg-white text-stone-500'
                      }`}
                    >
                      <span className="block text-[10px] font-bold">{s.done ? '✓' : s.n}</span>
                      <span className="block text-[11px] font-semibold truncate">{s.label}</span>
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

                <div className="relative rounded-xl border border-dashed border-brand-300/70 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/30 px-4 py-3 hover:border-brand-400 transition-colors">
                  <input type="file" name="resume" accept=".pdf,.doc,.docx" onChange={handleInputChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                  <div className="flex items-center gap-3 pointer-events-none">
                    <div className="w-9 h-9 rounded-lg bg-white border border-brand-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Upload size={16} className="text-brand-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-stone-800">Upload resume</p>
                      <p className="text-[11px] text-stone-500">PDF, DOC, DOCX — auto-fills when possible</p>
                      {isAutoParsing && (
                        <p className="text-[11px] text-brand-600 font-semibold mt-0.5 flex items-center gap-1.5">
                          <span className="w-3 h-3 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /> Parsing…
                        </p>
                      )}
                      {formData.resume && !isAutoParsing && (
                        <p className="text-[11px] text-emerald-600 font-semibold mt-0.5 truncate">{formData.resume.name || 'File selected'}</p>
                      )}
                    </div>
                  </div>
                </div>

                {formSection === 'basic' && (
                  <section>
                    <div className="mb-4 pb-3 border-b border-stone-100">
                      <h3 className="text-sm font-bold text-stone-900">Profile</h3>
                      <p className="text-[12px] text-stone-500 mt-0.5">Identity, contact, and current employment.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Name <span className="text-red-500">*</span></label>
                        <input ref={fieldRefs.name} type="text" name="name" value={formData.name || ''} onChange={handleInputChange} placeholder="Full name" className={fieldClass(formErrors.name)} />
                        {formErrors.name && <p className="text-xs text-red-500 mt-1 font-medium">{formErrors.name}</p>}
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Email <span className="text-red-500">*</span></label>
                        <input ref={fieldRefs.email} type="email" name="email" value={formData.email || ''} onChange={handleInputChange} placeholder="email@example.com" className={emailFieldClass(formErrors.email)} />
                        {formErrors.email && <p className="text-xs text-red-500 mt-1 font-medium">{formErrors.email}</p>}
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Contact <span className="text-red-500">*</span></label>
                        <div className="flex items-center gap-2 max-w-md">
                          <div className="w-[7.75rem] flex-shrink-0">
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
                        {formErrors.contact && <p className="text-xs text-red-500 mt-1 font-medium">{formErrors.contact}</p>}
                      </div>
                      <ListField label="Position" count={masterPositions.length} noun="positions" listCfg={LIST.positions}>
                        <PremiumSelect
                          variant="list"
                          value={formData.position || ''}
                          onChange={(v) => setFormField('position', v)}
                          options={formPositionOptions}
                          placeholder={masterPositions.length ? 'Select position' : 'No positions yet'}
                          searchable
                          searchPlaceholder="Type to filter…"
                          allowClear
                          emptyLabel="No positions — use Manage"
                        />
                      </ListField>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Current company</label>
                        <input type="text" name="companyName" value={formData.companyName || ''} onChange={handleInputChange} placeholder="Where they work now" className={fieldClass(false)} />
                      </div>
                      <div className="sm:col-span-2">
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
                      <p className="text-[12px] text-stone-500 mt-0.5">Experience, pay band, notice, and pipeline status.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Experience (years)</label>
                        <PremiumSelect variant="list" value={formData.experience != null ? String(formData.experience) : ''} onChange={(v) => setFormField('experience', v)} options={formExperienceOptions} placeholder="Select" allowClear searchable searchPlaceholder="Type to filter…" />
                      </div>
                      <ListField label="Current CTC (LPA)" count={masterCtcBands.length} noun="CTC bands" listCfg={LIST.ctc} required>
                        <div ref={fieldRefs.ctc}>
                          <PremiumSelect variant="list" value={formData.ctc || ''} onChange={(v) => setFormField('ctc', v)} options={formCtcOptions} placeholder="Select CTC" allowClear error={!!formErrors.ctc} searchable searchPlaceholder="Type to filter…" />
                        </div>
                        {formErrors.ctc && <p className="text-xs text-red-500 mt-1 font-medium">{formErrors.ctc}</p>}
                      </ListField>
                      <ListField label="Expected CTC (LPA)" count={masterCtcBands.length} noun="CTC bands" listCfg={LIST.ctc}>
                        <PremiumSelect variant="list" value={formData.expectedCtc || ''} onChange={(v) => setFormField('expectedCtc', v)} options={formExpectedCtcOptions} placeholder="Select expected CTC" allowClear searchable searchPlaceholder="Type to filter…" />
                      </ListField>
                      <ListField label="Notice period" count={masterNoticePeriods.length} noun="notice periods" listCfg={LIST.notice}>
                        <PremiumSelect variant="list" value={formData.noticePeriod || ''} onChange={(v) => setFormField('noticePeriod', v)} options={formNoticeOptions} placeholder="Select notice period" allowClear searchable searchPlaceholder="Type to filter…" />
                      </ListField>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">FLS / Non-FLS</label>
                        <PremiumSelect variant="list" value={formData.fls || ''} onChange={(v) => setFormField('fls', v)} options={formFlsOptions} placeholder="Select" allowClear />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Status</label>
                        <PremiumSelect variant="list" value={formData.status || 'Applied'} onChange={(v) => setFormField('status', v)} options={formStatusOptions} placeholder="Status" searchable searchPlaceholder="Type to filter…" />
                      </div>
                    </div>
                  </section>
                )}

                {formSection === 'placement' && (
                  <section>
                    <div className="mb-4 pb-3 border-b border-stone-100">
                      <h3 className="text-sm font-bold text-stone-900">Placement</h3>
                      <p className="text-[12px] text-stone-500 mt-0.5">
                        Client = company you hire for. Source = where this CV came from.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
                      <ListField label="Client name" count={masterClients.length} noun="clients" listCfg={LIST.clients}>
                        <PremiumSelect
                          variant="list"
                          value={formData.client || ''}
                          onChange={(v) => setFormField('client', v)}
                          options={formClientOptions}
                          placeholder={masterClients.length ? 'Select client' : 'No clients yet'}
                          searchable
                          searchPlaceholder="Type to filter…"
                          allowClear
                          emptyLabel="No clients — use Manage"
                        />
                      </ListField>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">SPOC</label>
                        <input ref={fieldRefs.spoc} type="text" name="spoc" value={formData.spoc || ''} onChange={handleInputChange} placeholder="Contact person at client" className={fieldClass(false)} />
                      </div>
                      <ListField label="Source of CV" count={masterSources.length} noun="CV sources" listCfg={LIST.sources}>
                        <PremiumSelect
                          variant="list"
                          value={formData.source || ''}
                          onChange={(v) => setFormField('source', v)}
                          options={formSourceOptions}
                          placeholder={masterSources.length ? 'Select source' : 'No sources yet'}
                          searchable
                          searchPlaceholder="Type to filter…"
                          allowClear
                          emptyLabel="No CV sources — use Manage"
                        />
                      </ListField>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Date</label>
                        <PremiumDatePicker
                          value={formData.date || new Date().toISOString().split('T')[0]}
                          onChange={(v) => setFormField('date', v)}
                          placeholder="Select date"
                          allowClear
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Call back date</label>
                        <PremiumDatePicker
                          value={formData.callBackDate || ''}
                          onChange={(v) => setFormField('callBackDate', v)}
                          placeholder="Select call back date"
                          allowClear
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Remark</label>
                        <textarea name="remark" value={formData.remark || ''} onChange={handleInputChange} placeholder="e.g. Salary mismatch, not reachable…" rows="2" className={`${fieldClass(false)} resize-none`} />
                      </div>
                    </div>
                    {orgCandidateFields.filter((f) => !f.isCore && f.showInForm !== false).length > 0 && (
                      <div className="mt-5 pt-4 border-t border-stone-100">
                        <h4 className="text-sm font-bold text-stone-900 mb-1">Custom fields</h4>
                        <p className="text-[12px] text-stone-500 mb-3">Organization-specific fields for this candidate.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
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
                                <div key={f.key} className={f.type === 'text' ? 'sm:col-span-1' : ''}>
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
              </form>
            </div>

            <div className="px-4 sm:px-6 py-3.5 border-t border-stone-100 bg-stone-50/90 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 flex-shrink-0">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary sm:min-w-[100px]">
                Cancel
              </button>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:items-center">
                {stepIdx > 0 && (
                  <button
                    type="button"
                    onClick={() => goCandidateStep(steps[stepIdx - 1].id)}
                    className="btn-secondary inline-flex items-center justify-center gap-1"
                  >
                    <ChevronLeft size={15} /> Back
                  </button>
                )}
                {stepIdx < steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => goCandidateStep(steps[stepIdx + 1].id)}
                    className="btn-primary inline-flex items-center justify-center gap-1 min-w-[140px]"
                  >
                    Continue <ChevronRight size={15} />
                  </button>
                ) : (
                  <button type="submit" form="candidate-form" className="btn-primary min-w-[160px]">
                    {editId ? 'Save Changes' : 'Add Candidate'}
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
            onChanged={fetchMasterData}
          />
        )}
        </>
        );
  })(), document.body);
}
