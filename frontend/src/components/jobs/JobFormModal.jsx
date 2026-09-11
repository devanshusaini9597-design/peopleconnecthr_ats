import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2, BookOpen, Briefcase, UserCheck, Check, Plus, Users, Pencil, Eye,
  Settings2, Building2, IndianRupee, MapPin, Layers, Clock3, StickyNote, Search, Upload, Mail,
  AlertTriangle,
} from 'lucide-react';
import Modal from '../ui/Modal';
import PremiumSelect from '../ui/PremiumSelect';
import EmailBodyEditor from '../ui/EmailBodyEditor';
import QuickListManager from '../QuickListManager';
import { useToast } from '../Toast';
import BASE_API_URL from '../../config';
import { authenticatedFetch } from '../../utils/fetchUtils';
import { fetchPicklist, searchPicklistOptions, PICKLIST_DROPDOWN_LIMIT, PICKLIST_MIN_SEARCH } from '../../utils/orgListFetch';
import { DEFAULT_CTC_BANDS } from '../../utils/ctcRanges';
import {
  STATUS_OPTIONS, EMPLOYMENT_OPTIONS,
  GRADE_STARTERS, INDUSTRY_STARTERS, LOCATION_STARTERS, EXPERIENCE_STARTERS,
} from './jobsConstants';
import JobJdPreview from './JobJdPreview';

function formatRole(role) {
  if (!role) return '';
  return String(role)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function toOptions(items, extras = []) {
  const names = [...(items || []), ...(extras || [])]
    .map((item) => String(item?.name || item?.label || item?.value || item || '').trim().toUpperCase())
    .filter(Boolean);
  const seen = new Set();
  return names.filter((n) => {
    if (seen.has(n)) return false;
    seen.add(n);
    return true;
  }).map((name) => ({ value: name, label: name }));
}

function ListField({ label, required, noun, listCfg, onManage, loading, children }) {
  return (
    <div className="min-w-0 w-full">
      <div className="flex items-center justify-between gap-2 mb-1.5 min-w-0">
        <label className="block text-[11px] font-semibold text-stone-600 min-w-0 truncate uppercase tracking-wide">
          {label}{required ? <span className="text-red-500"> *</span> : null}
        </label>
        {listCfg && (
          <button
            type="button"
            onClick={() => onManage(listCfg)}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-stone-500 hover:text-brand-700 transition-colors flex-shrink-0 whitespace-nowrap"
            title={`Manage ${noun}`}
          >
            <Settings2 size={11} />
            Manage
          </button>
        )}
      </div>
      <div className="min-w-0 w-full">
        {children}
      </div>
    </div>
  );
}

const LIST = {
  positions: { title: 'Positions', singular: 'position', apiEndpoint: '/api/positions', seedable: true, icon: Briefcase },
  clients: { title: 'Clients', singular: 'client', apiEndpoint: '/api/clients', icon: Building2 },
  grade: { title: 'Grades', singular: 'grade', apiEndpoint: '/api/org-lists/grade', seedable: true, icon: Layers },
  industry: { title: 'Industries', singular: 'industry', apiEndpoint: '/api/org-lists/industry', seedable: true, icon: Briefcase },
  location: { title: 'Locations', singular: 'location', apiEndpoint: '/api/org-lists/location', seedable: true, icon: MapPin, extraNames: LOCATION_STARTERS },
  ctc: { title: 'CTC Bands', singular: 'CTC band', apiEndpoint: '/api/org-lists/ctc', seedable: true, icon: IndianRupee },
  experience: { title: 'Experience', singular: 'experience band', apiEndpoint: '/api/org-lists/experience', seedable: true, icon: Clock3 },
  product: { title: 'Product / Skill', singular: 'skill', apiEndpoint: '/api/org-lists/product', seedable: true, icon: Layers },
};

const fieldClass =
  'w-full min-w-0 max-w-full px-3 py-2.5 rounded-lg border border-stone-200 bg-white text-sm font-medium outline-none uppercase box-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15';

export default function JobFormModal({
  open,
  onClose,
  editingJob,
  formData,
  setFormData,
  skillsInput,
  setSkillsInput,
  saving,
  onSubmit,
  toggleManager,
  managerOptions = [],
  loadingMembers = false,
}) {
  const toast = useToast();
  const [tab, setTab] = useState('edit');
  const [quickList, setQuickList] = useState(null);
  const [masterLoading, setMasterLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [staffQuery, setStaffQuery] = useState('');
  const [jdImporting, setJdImporting] = useState(false);
  const [nextJobCode, setNextJobCode] = useState('');
  const [loadingNextCode, setLoadingNextCode] = useState(false);
  const previewRef = useRef(null);
  const formRef = useRef(null);
  const jdInputRef = useRef(null);
  const [lists, setLists] = useState({
    positions: [],
    clients: [],
    grade: [],
    industry: [],
    location: [],
    ctc: [],
    experience: [],
    product: [],
  });

  const patch = (partial) => setFormData((prev) => ({ ...prev, ...partial }));
  const block = (value) => String(value || '').toUpperCase();

  const loadList = useCallback(async (key, starters) => {
    let items = [];
    try {
      const large = key === 'location' || key === 'product';
      items = await fetchPicklist(`/api/org-lists/${key}`, large ? { limit: PICKLIST_DROPDOWN_LIMIT } : {});
    } catch {
      items = [];
    }
    if (!items.length) {
      try {
        const res = await authenticatedFetch(`${BASE_API_URL}/api/org-lists/${key}/seed`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
        if (res.ok) {
          items = await fetchPicklist(
            `/api/org-lists/${key}`,
            key === 'location' || key === 'product' ? { limit: PICKLIST_DROPDOWN_LIMIT } : {}
          );
        }
      } catch {
        items = [];
      }
    }
    return toOptions(items, key === 'location' ? LOCATION_STARTERS.slice(0, PICKLIST_DROPDOWN_LIMIT) : (items.length ? [] : starters));
  }, []);

  const fetchMasterData = useCallback(async () => {
    try {
      const positionsRes = await fetchPicklist('/api/positions', { limit: PICKLIST_DROPDOWN_LIMIT }).catch(() => []);
      setLists((prev) => ({ ...prev, positions: toOptions(positionsRes, prev.positions) }));

      const [clients, grade, industry, location, ctc, experience, product] = await Promise.all([
        fetchPicklist('/api/clients', { limit: PICKLIST_DROPDOWN_LIMIT }).catch(() => []),
        loadList('grade', GRADE_STARTERS),
        loadList('industry', INDUSTRY_STARTERS),
        loadList('location', LOCATION_STARTERS),
        loadList('ctc', DEFAULT_CTC_BANDS),
        loadList('experience', EXPERIENCE_STARTERS),
        loadList('product', [
          'HOME LOAN', 'PERSONAL LOAN', 'CREDIT CARDS', 'AUTO LOAN', 'BUSINESS LOAN',
          'SAVINGS ACCOUNT', 'CURRENT ACCOUNT', 'INSURANCE', 'WEALTH / INVESTMENT',
          'COLLECTIONS', 'SALES', 'OPERATIONS', 'CUSTOMER SERVICE',
        ]),
      ]);
      setLists({
        positions: toOptions(positionsRes),
        clients: toOptions(clients),
        grade,
        industry,
        location: toOptions(location, LOCATION_STARTERS.slice(0, PICKLIST_DROPDOWN_LIMIT)),
        ctc,
        experience,
        product,
      });
    } catch {
      setLists((prev) => ({
        ...prev,
        grade: prev.grade.length ? prev.grade : toOptions([], GRADE_STARTERS),
        industry: prev.industry.length ? prev.industry : toOptions([], INDUSTRY_STARTERS),
        location: prev.location.length ? prev.location : toOptions([], LOCATION_STARTERS.slice(0, PICKLIST_DROPDOWN_LIMIT)),
        experience: prev.experience.length ? prev.experience : toOptions([], EXPERIENCE_STARTERS),
      }));
    } finally {
      setMasterLoading(false);
    }
  }, [loadList]);

  useEffect(() => {
    if (open) {
      setTab('edit');
      setStaffQuery('');
      fetchMasterData();
      if (!editingJob) {
        setLoadingNextCode(true);
        authenticatedFetch(`${BASE_API_URL}/api/jobs/next-code`)
          .then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.jobCode) setNextJobCode(data.jobCode);
            else setNextJobCode('');
          })
          .catch(() => setNextJobCode(''))
          .finally(() => setLoadingNextCode(false));
      } else {
        setNextJobCode('');
      }
    } else {
      setQuickList(null);
      setNextJobCode('');
    }
  }, [open, editingJob, fetchMasterData]);

  const scrollPreview = (section) => {
    setActiveSection(section);
    const el = previewRef.current?.querySelector(`[data-preview="${section}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const persistLocation = (next) => {
    patch({ locations: next, location: next.join(', ') });
  };

  const importJdFile = async (file) => {
    if (!file || jdImporting) return;
    setJdImporting(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await authenticatedFetch(`${BASE_API_URL}/api/jobs/parse-jd`, {
        method: 'POST',
        body,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.message || 'Could not read this JD file');
        return;
      }
      const data = payload.data || payload;
      const next = {};
      if (data.summary) next.summary = data.summary;
      if (data.responsibilities) next.responsibilitiesText = data.responsibilities;
      if (data.requirements) next.requirementsText = data.requirements;
      if (data.preferred) next.preferredProfile = data.preferred;
      setFormData((prev) => {
        const locs = (data.locations || []).map((v) => String(v).trim().toUpperCase()).filter(Boolean);
        const sk = (data.skills || []).map((v) => String(v).trim().toUpperCase()).filter(Boolean);
        return {
          ...prev,
          ...next,
          role: prev.role || block(data.role),
          grade: prev.grade || block(data.grade),
          clientName: prev.clientName || block(data.clientName),
          industry: prev.industry || block(data.industry),
          ctc: prev.ctc || block(data.ctc),
          experience: prev.experience || block(data.experience),
          locations: prev.locations?.length ? prev.locations : locs,
          location: prev.locations?.length ? prev.location : locs.join(', '),
          skills: prev.skills?.length ? prev.skills : sk,
        };
      });
      if (data.skills?.length && !(formData.skills || []).length) {
        setSkillsInput(data.skills.map((v) => String(v).trim().toUpperCase()).join(', '));
      }
      toast.success('JD uploaded — review the fields, then save');
      setTab('edit');
      scrollPreview('summary');
    } catch {
      toast.error('Could not upload this JD. Try PDF or TXT.');
    } finally {
      setJdImporting(false);
      if (jdInputRef.current) jdInputRef.current.value = '';
    }
  };

  const skills = useMemo(
    () => (formData.skills?.length ? formData.skills : String(skillsInput || '').split(',').map((s) => s.trim()).filter(Boolean)),
    [formData.skills, skillsInput]
  );

  const displayJobCode = formData.customJobCode
    ? (formData.jobCode || '')
    : (editingJob ? (formData.jobCode || '') : (nextJobCode || ''));

  const editorKey = `${editingJob?._id || 'new'}-${open ? '1' : '0'}`;

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={editingJob ? 'EDIT JOB REQUISITION' : 'CREATE JOB REQUISITION'}
      description={
        editingJob
          ? (formData.jobCode ? `JOB ID ${formData.jobCode}` : 'JOB ID is assigned when you save.')
          : (nextJobCode ? `Next ID: ${nextJobCode}` : 'Job ID is assigned automatically when you save.')
      }
      size="full"
      icon={Briefcase}
      closeOnBackdrop={false}
      fillHeight
      disableFocusLock={!!quickList}
      bodyClassName="flex-1 min-h-0 min-w-0 overflow-hidden p-0 flex flex-col bg-white"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={saving}
            onClick={() => onSubmit({ preventDefault() {} }, { asDraft: true })}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            Save as draft
          </button>
          <button type="submit" form="job-form" className="btn-primary" disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : editingJob ? <Check size={16} /> : <Plus size={16} />}
            {saving ? 'Saving…' : editingJob ? 'Save changes' : 'Create & post job'}
          </button>
        </>
      }
    >
      <div className="flex lg:hidden h-[38px] items-center rounded-none border-b border-stone-200 bg-stone-50 p-1 gap-1 flex-shrink-0">
        {[
          { id: 'edit', label: 'Edit', icon: Pencil },
          { id: 'preview', label: 'Preview', icon: Eye },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 h-full inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold ${
              tab === id ? 'bg-white text-brand-700 shadow-sm border border-stone-200/80' : 'text-stone-500'
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 flex-1 min-h-0 min-w-0 overflow-hidden">
        <form
          id="job-form"
          ref={formRef}
          onSubmit={(e) => onSubmit(e, { asDraft: false })}
          className={`min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 sm:px-5 py-4 space-y-4 ${tab === 'preview' ? 'hidden lg:block' : ''}`}
        >
          <section className="rounded-xl border border-stone-200/90 bg-white p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-7 w-7 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 inline-flex items-center justify-center">
                  <Briefcase size={13} />
                </span>
                <div>
                  <p className="text-xs font-bold text-stone-800 uppercase tracking-wide">Role header</p>
                  <p className="text-[11px] text-stone-400">Same picklists as Candidates · use Manage to add or edit values</p>
                </div>
              </div>
              <span className="text-[10px] font-bold tracking-widest text-brand-700 bg-brand-50 border border-brand-100 rounded-md px-2 py-1 tabular-nums">
                {loadingNextCode && !editingJob ? (
                  <Loader2 size={12} className="animate-spin inline" />
                ) : (
                  displayJobCode || 'AUTO ON SAVE'
                )}
              </span>
            </div>
            <div className="min-w-0">
              <label className="block text-[11px] font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">
                Job ID
                <span className="text-stone-400 font-normal normal-case tracking-normal ml-1">· unique in your org</span>
              </label>
              {editingJob && !formData.customJobCode ? (
                <div className={`${fieldClass} bg-stone-50 text-stone-700 cursor-default`}>
                  {formData.jobCode || '—'}
                </div>
              ) : !editingJob && !formData.customJobCode ? (
                <div className={`${fieldClass} bg-stone-50 text-stone-700 cursor-default flex items-center gap-2`}>
                  {loadingNextCode ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-stone-400" />
                      <span className="text-stone-400">Generating preview…</span>
                    </>
                  ) : (
                    displayJobCode || 'Assigned when you save'
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  className={fieldClass}
                  placeholder="E.G. SKILLNIX-2026-0001"
                  value={formData.jobCode || ''}
                  onChange={(e) => patch({ jobCode: String(e.target.value || '').toUpperCase().replace(/\s+/g, '-') })}
                  maxLength={40}
                />
              )}
              <p className="text-[10px] text-stone-400 mt-1 leading-relaxed">
                {formData.customJobCode
                  ? 'Custom IDs must be unique in your organization.'
                  : 'Auto-generated from your company name (e.g. SKILLNIX-2026-0004). You do not need to type this.'}
              </p>
              <label className="mt-2 inline-flex items-center gap-2 cursor-pointer text-[11px] text-stone-600">
                <input
                  type="checkbox"
                  className="rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                  checked={!!formData.customJobCode}
                  onChange={(e) => {
                    const on = e.target.checked;
                    patch({
                      customJobCode: on,
                      jobCode: on
                        ? (formData.jobCode || nextJobCode || editingJob?.jobCode || '')
                        : (editingJob?.jobCode || formData.jobCode || ''),
                    });
                  }}
                />
                Use a custom Job ID instead
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 min-w-0">
              <div className="sm:col-span-2" onFocus={() => scrollPreview('header')}>
                <ListField label="Job title" required noun="positions" listCfg={LIST.positions} onManage={setQuickList} loading={masterLoading}>
                  <PremiumSelect
                    variant="list"
                    searchable
                    creatable
                    allowClear
                    value={formData.role}
                    onChange={(v) => patch({ role: block(v) })}
                    onCreate={async (name) => {
                      const n = block(name);
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
                    options={toOptions(lists.positions, formData.role ? [formData.role] : [])}
                    placeholder="SELECT OR ADD POSITION"
                    searchPlaceholder="Type at least 2 characters to search…"
                    emptyLabel="No positions — type to add"
                    minSearchChars={PICKLIST_MIN_SEARCH}
                    onSearch={(q) => searchPicklistOptions('/api/positions', q)}
                  />
                </ListField>
              </div>

              <ListField label="Grade" noun="grades" listCfg={LIST.grade} onManage={setQuickList} loading={masterLoading}>
                <PremiumSelect
                  variant="list"
                  searchable
                  allowClear
                  value={formData.grade}
                  onChange={(v) => patch({ grade: block(v) })}
                  options={lists.grade}
                  placeholder="SELECT GRADE"
                  searchPlaceholder="Search grades…"
                  emptyLabel="No grades — use Manage to add"
                />
              </ListField>

              <ListField label="Client name" noun="clients" listCfg={LIST.clients} onManage={setQuickList} loading={masterLoading}>
                <PremiumSelect
                  variant="list"
                  searchable
                  allowClear
                  value={formData.clientName}
                  onChange={(v) => patch({ clientName: block(v) })}
                  options={lists.clients}
                  placeholder="SELECT CLIENT"
                  searchPlaceholder="Type at least 2 characters to search…"
                  emptyLabel="No clients — use Manage to add"
                  minSearchChars={PICKLIST_MIN_SEARCH}
                  onSearch={(q) => searchPicklistOptions('/api/clients', q)}
                />
              </ListField>

              <ListField label="Industry" required noun="industries" listCfg={LIST.industry} onManage={setQuickList} loading={masterLoading}>
                <PremiumSelect
                  variant="list"
                  searchable
                  allowClear
                  value={formData.industry}
                  onChange={(v) => patch({ industry: block(v) })}
                  options={lists.industry}
                  placeholder="SELECT INDUSTRY"
                  searchPlaceholder="Search industries…"
                  emptyLabel="No industries — use Manage to add"
                />
              </ListField>

              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Employment type</label>
                <PremiumSelect
                  variant="list"
                  value={formData.employmentType}
                  onChange={(v) => patch({ employmentType: v || 'full_time' })}
                  options={EMPLOYMENT_OPTIONS}
                  placeholder="FULL-TIME"
                />
              </div>

              <div className="sm:col-span-2">
              <ListField
                label="Locations"
                required
                noun="locations"
                listCfg={LIST.location}
                onManage={setQuickList}
                loading={masterLoading}
              >
                <PremiumSelect
                  variant="list"
                  searchable
                  multiple
                  allowClear
                  value={formData.locations || []}
                  onChange={persistLocation}
                  options={toOptions(lists.location, formData.locations)}
                  placeholder="SELECT LOCATIONS"
                  searchPlaceholder="Type at least 2 characters to search…"
                  emptyLabel="No locations — use Manage to add"
                  minSearchChars={PICKLIST_MIN_SEARCH}
                  onSearch={(q) => searchPicklistOptions('/api/org-lists/location', q)}
                />
              </ListField>
              </div>

              <ListField label="Experience" noun="experience" listCfg={LIST.experience} onManage={setQuickList} loading={masterLoading}>
                <PremiumSelect
                  variant="list"
                  searchable
                  allowClear
                  value={formData.experience}
                  onChange={(v) => patch({ experience: block(v) })}
                  options={lists.experience}
                  placeholder="SELECT EXPERIENCE"
                  searchPlaceholder="Search experience…"
                  emptyLabel="No bands — use Manage to add"
                />
              </ListField>

              <ListField label="CTC" noun="CTC bands" listCfg={LIST.ctc} onManage={setQuickList} loading={masterLoading}>
                <PremiumSelect
                  variant="list"
                  searchable
                  allowClear
                  value={formData.ctc}
                  onChange={(v) => patch({ ctc: block(v) })}
                  options={lists.ctc}
                  placeholder="SELECT CTC"
                  searchPlaceholder="Search CTC bands…"
                  emptyLabel="No CTC bands — use Manage to add"
                />
              </ListField>

              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Openings</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 3"
                  className={fieldClass}
                  value={formData.openings === 0 || formData.openings ? String(formData.openings) : ''}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, '');
                    patch({ openings: raw === '' ? '' : Number(raw) });
                  }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Status</label>
                <PremiumSelect
                  variant="list"
                  value={formData.status}
                  onChange={(v) => patch({ status: v })}
                  options={STATUS_OPTIONS}
                  placeholder="OPEN"
                />
              </div>
              <div className="sm:col-span-2">
                <div className={`rounded-xl border px-3.5 py-3 flex flex-col sm:flex-row sm:items-center gap-3 transition-colors ${
                  formData.priority === 'urgent'
                    ? 'border-red-200 bg-red-50/70'
                    : 'border-stone-200 bg-stone-50/60'
                }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-stone-800 inline-flex items-center gap-1.5">
                      <AlertTriangle size={13} className={formData.priority === 'urgent' ? 'text-red-600' : 'text-stone-400'} />
                      Urgent hiring
                    </p>
                    <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">
                      Marks this requisition as top priority. Freelancers see a red tag and it sorts first on Open Mandates.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 shrink-0 cursor-pointer select-none">
                    <span className={`text-[11px] font-semibold ${formData.priority === 'urgent' ? 'text-red-700' : 'text-stone-500'}`}>
                      {formData.priority === 'urgent' ? 'On' : 'Off'}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formData.priority === 'urgent'}
                      onClick={() => patch({ priority: formData.priority === 'urgent' ? 'medium' : 'urgent' })}
                      className={`relative h-7 w-12 rounded-full border transition-colors ${
                        formData.priority === 'urgent'
                          ? 'bg-red-600 border-red-700'
                          : 'bg-stone-200 border-stone-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          formData.priority === 'urgent' ? 'left-6' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </label>
                </div>
              </div>
              <div className="sm:col-span-2">
                <ListField label="Skills" noun="skills" listCfg={LIST.product} onManage={setQuickList} loading={masterLoading}>
                  <PremiumSelect
                    variant="list"
                    searchable
                    multiple
                    allowClear
                    value={skills}
                    onChange={(next) => {
                      patch({ skills: next });
                      setSkillsInput(next.join(', '));
                    }}
                    options={toOptions(lists.product, skills)}
                    placeholder="SELECT SKILLS"
                    searchPlaceholder="Type at least 2 characters to search…"
                    emptyLabel="No skills — use Manage to add"
                    minSearchChars={PICKLIST_MIN_SEARCH}
                    onSearch={(q) => searchPicklistOptions('/api/org-lists/product', q)}
                  />
                </ListField>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-stone-200/90 bg-white p-4 space-y-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-7 w-7 rounded-lg bg-sky-50 text-sky-700 border border-sky-100 inline-flex items-center justify-center">
                  <BookOpen size={13} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-stone-800 uppercase tracking-wide">Job description</p>
                  <p className="text-[11px] text-stone-400">Upload a JD or write in the editor · live preview</p>
                </div>
              </div>
              <div className="flex-shrink-0">
                <input
                  ref={jdInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  className="hidden"
                  onChange={(e) => importJdFile(e.target.files?.[0])}
                />
                <button
                  type="button"
                  disabled={jdImporting}
                  onClick={() => jdInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-stone-700 hover:border-brand-300 hover:text-brand-800 hover:bg-brand-50/60 disabled:opacity-50 transition-colors"
                >
                  {jdImporting ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  {jdImporting ? 'Reading JD…' : 'Upload JD'}
                </button>
              </div>
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
              onDrop={(e) => {
                e.preventDefault();
                importJdFile(e.dataTransfer.files?.[0]);
              }}
              className="rounded-lg border border-dashed border-stone-200 bg-stone-50/70 px-3 py-2.5 text-[11px] text-stone-500"
            >
              Drop a PDF, Word, or TXT job description here. Summary, responsibilities, and requirements fill automatically — then review before save.
            </div>
            <div onFocusCapture={() => scrollPreview('summary')}>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Job summary</label>
              <EmailBodyEditor
                key={`${editorKey}-summary`}
                compact
                value={formData.summary}
                onChange={(html) => patch({ summary: html })}
                placeholder="WE ARE LOOKING FOR AN EXPERIENCED ASSISTANT BRANCH HEAD…"
              />
            </div>
            <div onFocusCapture={() => scrollPreview('responsibilities')}>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Key responsibilities</label>
              <EmailBodyEditor
                key={`${editorKey}-resp`}
                compact
                value={formData.responsibilitiesText}
                onChange={(html) => patch({ responsibilitiesText: html })}
                placeholder="DRIVE BUSINESS GROWTH AND ACHIEVE BRANCH SALES TARGETS."
              />
            </div>
            <div onFocusCapture={() => scrollPreview('requirements')}>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Candidate requirements</label>
              <EmailBodyEditor
                key={`${editorKey}-req`}
                compact
                value={formData.requirementsText}
                onChange={(html) => patch({ requirementsText: html })}
                placeholder="MINIMUM 2 YEARS OF EXPERIENCE IN DIRECT CHANNEL – LIFE INSURANCE."
              />
            </div>
            <div onFocusCapture={() => scrollPreview('preferred')}>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Preferred candidate profile</label>
              <EmailBodyEditor
                key={`${editorKey}-pref`}
                compact
                value={formData.preferredProfile}
                onChange={(html) => patch({ preferredProfile: html })}
                placeholder="CANDIDATES WITH CONSISTENT PERFORMANCE…"
              />
            </div>
          </section>

          <section className="rounded-xl border border-stone-200/90 bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-7 w-7 rounded-lg bg-teal-50 text-teal-700 border border-teal-100 inline-flex items-center justify-center">
                <UserCheck size={13} />
              </span>
              <div>
                <p className="text-xs font-bold text-stone-800 uppercase tracking-wide">Hiring team</p>
                <p className="text-[11px] text-stone-400">First selected person is the hiring manager. Freelance submissions go to them, not the person who posted the job.</p>
              </div>
            </div>
            {loadingMembers ? (
              <div className="flex items-center justify-center py-6 gap-2 text-sm text-stone-500">
                <Loader2 size={18} className="animate-spin text-stone-400" />
                Loading staff…
              </div>
            ) : managerOptions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/80 px-4 py-5 text-center">
                <Users size={18} className="mx-auto text-stone-400 mb-2" />
                <p className="text-sm font-semibold text-stone-800">No company staff found</p>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed max-w-sm mx-auto">
                  Invite teammates from Team Directory. Freelance recruiters are not listed here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
                  <input
                    type="search"
                    value={staffQuery}
                    onChange={(e) => setStaffQuery(e.target.value)}
                    placeholder="Search name, email, or role…"
                    className="input-ats !pl-9 h-9 text-sm w-full normal-case"
                  />
                </div>
                <div className="space-y-1 max-h-44 overflow-y-auto border border-stone-200 rounded-xl p-1.5 bg-stone-50/50">
                  {managerOptions
                    .filter((m) => {
                      const q = staffQuery.trim().toLowerCase();
                      if (!q) return true;
                      return [m.name, m.email, m.role].filter(Boolean).join(' ').toLowerCase().includes(q);
                    })
                    .map((m) => {
                      const checked = (formData.hiringManagers || []).some(
                        (e) => String(e || '').toLowerCase() === String(m.email || '').toLowerCase()
                      );
                      return (
                        <label
                          key={m.email}
                          className={`flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                            checked ? 'bg-brand-50 border border-brand-200' : 'hover:bg-white border border-transparent'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleManager(m.email)}
                            className="w-4 h-4 text-brand-600 rounded focus:ring-2 focus:ring-brand-500"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-stone-900 truncate uppercase">{m.name}</p>
                            <p className="text-xs text-stone-500 truncate">
                              {m.email}
                              {m.role ? ` · ${formatRole(m.role)}` : ''}
                            </p>
                          </div>
                          {checked && <Check size={14} className="text-brand-600 flex-shrink-0" />}
                        </label>
                      );
                    })}
                  {managerOptions.filter((m) => {
                    const q = staffQuery.trim().toLowerCase();
                    if (!q) return true;
                    return [m.name, m.email, m.role].filter(Boolean).join(' ').toLowerCase().includes(q);
                  }).length === 0 && (
                    <p className="text-center text-xs text-stone-400 py-4">No staff match that search</p>
                  )}
                </div>
              </div>
            )}
            {(formData.hiringManagers || []).length > 0 && (
              <p className="text-[11px] font-semibold text-brand-700 mt-2">
                {formData.hiringManagers.length} selected · first is the hiring manager
              </p>
            )}
          </section>

          <section className="rounded-xl border border-stone-200/90 bg-white p-4 space-y-3.5">
            <div className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 inline-flex items-center justify-center">
                <StickyNote size={13} />
              </span>
              <div>
                <p className="text-xs font-bold text-stone-800 uppercase tracking-wide">Mandate contact</p>
                <p className="text-[11px] text-stone-400">Client SPOC, phone, and interview notes — not shown to candidates</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 min-w-0">
              <div className="sm:col-span-2 min-w-0">
                <label className="block text-[11px] font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">SPOC / hiring manager</label>
                <input
                  type="text"
                  placeholder="CLIENT HIRING MANAGER NAME"
                  className={fieldClass}
                  value={formData.spocName || ''}
                  onFocus={() => scrollPreview('notes')}
                  onChange={(e) => patch({ spocName: block(e.target.value) })}
                />
              </div>
              <div className="min-w-0">
                <label className="block text-[11px] font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Phone number</label>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="+91 98765 43210"
                  className={`${fieldClass} normal-case`}
                  value={formData.spocContact || ''}
                  onFocus={() => scrollPreview('notes')}
                  onChange={(e) => patch({ spocContact: e.target.value })}
                />
              </div>
              <div className="min-w-0">
                <label className="block text-[11px] font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Email</label>
                <input
                  type="email"
                  placeholder="spoc@company.com"
                  className={`${fieldClass} normal-case`}
                  value={formData.spocEmail || ''}
                  onFocus={() => scrollPreview('notes')}
                  onChange={(e) => patch({ spocEmail: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2 min-w-0">
                <label className="block text-[11px] font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Interview process & additional notes</label>
                <textarea
                  className="textarea-ats field-premium min-h-[88px] min-w-0 w-full uppercase"
                  placeholder="ROUNDS, PANEL, NOTICE PERIOD, OTHER MANDATE INSTRUCTIONS…"
                  value={formData.internalNotes || ''}
                  onFocus={() => scrollPreview('notes')}
                  onChange={(e) => patch({ internalNotes: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
          </section>

          {!editingJob ? (
            <section className="rounded-xl border border-stone-200/90 bg-stone-50/80 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                  checked={formData.notifyEmail !== false}
                  onChange={(e) => patch({ notifyEmail: e.target.checked })}
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-stone-800 uppercase tracking-wide">
                    <Mail size={13} className="text-brand-600" />
                    Email hiring team
                  </span>
                  <span className="block text-[11px] text-stone-500 mt-1 leading-relaxed">
                    Notify recruiters by email and in-app alert when this job is posted (not for drafts).
                  </span>
                </span>
              </label>
            </section>
          ) : null}
        </form>

        <div
          ref={previewRef}
          className={`${tab === 'edit' ? 'hidden lg:block' : ''} min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 sm:px-5 py-4 border-t lg:border-t-0 lg:border-l border-stone-200 bg-stone-50/60`}
        >
          <JobJdPreview form={{ ...formData, skills }} activeSection={activeSection} />
        </div>
      </div>
    </Modal>
      {quickList && (
        <QuickListManager
          open={!!quickList}
          onClose={() => setQuickList(null)}
          title={quickList.title}
          singular={quickList.singular}
          apiEndpoint={quickList.apiEndpoint}
          seedable={!!quickList.seedable}
          icon={quickList.icon}
          extraNames={quickList.extraNames}
          supportsRequiresPan={quickList.apiEndpoint === '/api/clients'}
          onChanged={fetchMasterData}
        />
      )}
    </>
  );
}
