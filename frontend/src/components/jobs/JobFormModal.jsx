import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2, BookOpen, Briefcase, UserCheck, Check, Plus, Users, Pencil, Eye,
  Settings2, Building2, IndianRupee, MapPin, Layers, Clock3, StickyNote, Search, Upload, Mail,
  AlertTriangle, ChevronLeft, ChevronRight, ClipboardPaste, Sparkles,
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
  initialForm,
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

function confTone(score) {
  const n = Number(score);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 0.8) return { label: `${Math.round(n * 100)}%`, className: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  if (n >= 0.55) return { label: `${Math.round(n * 100)}%`, className: 'bg-amber-50 text-amber-800 border-amber-200' };
  return { label: `${Math.round(n * 100)}%`, className: 'bg-stone-100 text-stone-600 border-stone-200' };
}

function ConfBadge({ score }) {
  const tone = confTone(score);
  if (!tone) return null;
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${tone.className}`} title="Extraction confidence">
      {tone.label}
    </span>
  );
}

function FieldLabel({ children, required, confidence }) {
  return (
    <div className="flex items-center gap-2 mb-1.5 min-w-0">
      <label className="block text-[12px] font-medium text-stone-700 min-w-0 truncate">
        {children}{required ? <span className="text-red-500"> *</span> : null}
      </label>
      <ConfBadge score={confidence} />
    </div>
  );
}

function PriorityControl({ value, onChange }) {
  const urgent = value === 'urgent';
  return (
    <div className="rounded-xl border border-stone-200/80 bg-white px-4 py-3.5 shadow-[0_1px_0_rgba(28,25,23,0.04)]">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-stone-900 tracking-tight">Priority</p>
          <p className="text-[12.5px] text-stone-500 mt-0.5 leading-relaxed">
            Urgent roles appear first on Open Mandates and are highlighted for freelance recruiters.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 shrink-0 self-start sm:self-center">
          <button
            type="button"
            onClick={() => onChange('medium')}
            className={`h-8 px-3.5 rounded-md text-[12px] font-semibold transition ${
              !urgent ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Standard
          </button>
          <button
            type="button"
            onClick={() => onChange('urgent')}
            className={`h-8 px-3.5 rounded-md text-[12px] font-semibold inline-flex items-center gap-1.5 transition ${
              urgent ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Urgent
          </button>
        </div>
      </div>
    </div>
  );
}
function ListField({ label, required, noun, listCfg, onManage, children, confidence }) {
  return (
    <div className="min-w-0 w-full">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <FieldLabel required={required} confidence={confidence}>{label}</FieldLabel>
        {listCfg && (
          <button
            type="button"
            onClick={() => onManage(listCfg)}
            className="inline-flex items-center justify-center h-6 w-6 rounded-md text-stone-400 hover:text-brand-700 hover:bg-brand-50 transition-colors flex-shrink-0 mb-1.5"
            title={`Manage ${noun}`}
            aria-label={`Manage ${noun}`}
          >
            <Settings2 size={13} />
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

const FORM_STEPS = [
  { id: 'basics', label: 'Role' },
  { id: 'description', label: 'Description' },
  { id: 'team', label: 'Hiring team' },
  { id: 'review', label: 'Review' },
];

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
  draftStorageKey = '',
}) {
  const toast = useToast();
  const [tab, setTab] = useState('edit');
  const [step, setStep] = useState(0);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [autosaveEnabled, setAutosaveEnabled] = useState(false);
  const [quickList, setQuickList] = useState(null);
  const [masterLoading, setMasterLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [staffQuery, setStaffQuery] = useState('');
  const [jdImporting, setJdImporting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [showPasteBox, setShowPasteBox] = useState(true);
  const [jdImport, setJdImport] = useState(null);
  const [showPreviewRail, setShowPreviewRail] = useState(true);
  const [entryMode, setEntryMode] = useState('choose');
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

  const readStoredDraft = useCallback(() => {
    if (!draftStorageKey) return null;
    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.formData || typeof parsed.formData !== 'object') return null;
      return parsed;
    } catch {
      return null;
    }
  }, [draftStorageKey]);

  const draftHasContent = useCallback((draft) => {
    const fd = draft?.formData || {};
    const skills = String(draft?.skillsInput || '').trim();
    return Boolean(
      String(fd.role || '').trim()
      || String(fd.clientName || '').trim()
      || String(fd.industry || '').trim()
      || String(fd.grade || '').trim()
      || String(fd.experience || '').trim()
      || String(fd.ctc || '').trim()
      || String(fd.summary || '').trim()
      || String(fd.responsibilitiesText || '').trim()
      || String(fd.requirementsText || '').trim()
      || (Array.isArray(fd.locations) && fd.locations.length)
      || String(fd.location || '').trim()
      || skills
    );
  }, []);

  const isFormDirty = useCallback(() => {
    if (editingJob) return false;
    return draftHasContent({ formData, skillsInput });
  }, [editingJob, formData, skillsInput, draftHasContent]);

  const clearLocalDraft = useCallback(() => {
    if (!draftStorageKey) return;
    try { localStorage.removeItem(draftStorageKey); } catch { /* ignore */ }
    setDraftSavedAt(null);
  }, [draftStorageKey]);

  const writeLocalDraft = useCallback(() => {
    if (!draftStorageKey || editingJob) return null;
    try {
      const savedAt = new Date().toISOString();
      localStorage.setItem(draftStorageKey, JSON.stringify({
        formData,
        skillsInput,
        savedAt,
      }));
      setDraftSavedAt(savedAt);
      return savedAt;
    } catch {
      return null;
    }
  }, [draftStorageKey, editingJob, formData, skillsInput]);

  const resetBlankForm = useCallback(() => {
    setFormData({ ...initialForm });
    setSkillsInput('');
    setPasteText('');
    setShowPasteBox(true);
    setJdImport(null);
    setEntryMode('choose');
    setStep(0);
    setTab('edit');
  }, [setFormData, setSkillsInput]);

  useEffect(() => {
    if (!open) {
      setResumePromptOpen(false);
      setCloseConfirmOpen(false);
      setAutosaveEnabled(false);
      return;
    }
    setStep(0);
    setTab('edit');
    setDraftSavedAt(null);
    setPasteText('');
    setShowPasteBox(!editingJob);
    setJdImport(null);
    setShowPreviewRail(true);
    setEntryMode(editingJob ? 'form' : 'choose');
    setCloseConfirmOpen(false);

    if (editingJob || !draftStorageKey) {
      setAutosaveEnabled(true);
      setResumePromptOpen(false);
      return;
    }

    const stored = readStoredDraft();
    if (draftHasContent(stored)) {
      // Keep parent blank until user chooses Continue / Start new.
      setAutosaveEnabled(false);
      setResumePromptOpen(true);
      setDraftSavedAt(stored.savedAt || null);
    } else {
      clearLocalDraft();
      setAutosaveEnabled(true);
      setResumePromptOpen(false);
    }
  }, [open, draftStorageKey, editingJob?._id, readStoredDraft, draftHasContent, clearLocalDraft]);

  useEffect(() => {
    if (!open || !draftStorageKey || saving || editingJob || !autosaveEnabled || resumePromptOpen) {
      return undefined;
    }
    const t = window.setTimeout(() => {
      if (!draftHasContent({ formData, skillsInput })) return;
      writeLocalDraft();
    }, 900);
    return () => window.clearTimeout(t);
  }, [
    open, draftStorageKey, formData, skillsInput, saving, editingJob,
    autosaveEnabled, resumePromptOpen, draftHasContent, writeLocalDraft,
  ]);

  const resumeDraft = () => {
    const stored = readStoredDraft();
    if (stored?.formData) {
      setFormData((prev) => ({ ...prev, ...stored.formData }));
      if (stored.skillsInput != null) setSkillsInput(String(stored.skillsInput));
      setDraftSavedAt(stored.savedAt || null);
    }
    setResumePromptOpen(false);
    setAutosaveEnabled(true);
    setEntryMode('form');
  };

  const startFreshDraft = () => {
    clearLocalDraft();
    resetBlankForm();
    setResumePromptOpen(false);
    setAutosaveEnabled(true);
  };

  const requestClose = () => {
    if (saving) return;
    if (resumePromptOpen) {
      setResumePromptOpen(false);
      onClose();
      return;
    }
    if (!editingJob && isFormDirty()) {
      setCloseConfirmOpen(true);
      return;
    }
    if (!editingJob && !isFormDirty()) clearLocalDraft();
    onClose();
  };

  const confirmSaveDraftAndClose = () => {
    writeLocalDraft();
    setCloseConfirmOpen(false);
    onClose();
    toast.success('Draft saved on this device');
  };

  const confirmDiscardAndClose = () => {
    clearLocalDraft();
    resetBlankForm();
    setCloseConfirmOpen(false);
    onClose();
  };

  const wrapSubmit = (e, opts) => {
    const result = onSubmit(e, opts);
    if (!opts?.asDraft) {
      window.setTimeout(() => clearLocalDraft(), 400);
    } else {
      writeLocalDraft();
    }
    return result;
  };

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

  const applyParsedJd = (data) => {
    const next = {};
    if (data.summary) next.summary = data.summary;
    if (data.responsibilities) next.responsibilitiesText = data.responsibilities;
    if (data.requirements) next.requirementsText = data.requirements;
    if (data.preferred) next.preferredProfile = data.preferred;
    if (data.department) next.department = block(data.department);
    if (data.reportingTo) next.reportingTo = block(data.reportingTo);
    if (data.languages) next.languages = String(data.languages).trim();
    if (data.kpis) next.kpisText = data.kpis;
    if (data.internalNotes) next.internalNotes = String(data.internalNotes).trim();
    if (data.employmentType) next.employmentType = data.employmentType;
    if (data.openings !== undefined && data.openings !== null && data.openings !== '') {
      const n = Number(data.openings);
      next.openings = Number.isFinite(n) && n > 0 ? n : data.openings;
    }
    const locs = (data.locations || []).map((v) => String(v).trim().toUpperCase()).filter(Boolean);
    const sk = (data.skills || []).map((v) => String(v).trim().toUpperCase()).filter(Boolean);
    const filled = [];
    if (data.role) filled.push('title');
    if (data.grade) filled.push('grade');
    if (data.clientName) filled.push('client');
    if (data.industry) filled.push('industry');
    if (data.department) filled.push('department');
    if (data.experience) filled.push('experience');
    if (data.ctc) filled.push('CTC');
    if (locs.length) filled.push('location');
    if (sk.length) filled.push('skills');
    if (data.summary || data.responsibilities || data.requirements) filled.push('description');

    setFormData((prev) => ({
      ...prev,
      ...next,
      role: data.role ? block(data.role) : prev.role,
      grade: data.grade ? block(data.grade) : prev.grade,
      clientName: data.clientName ? block(data.clientName) : (data.clientName === '' ? '' : prev.clientName),
      industry: data.industry ? block(data.industry) : prev.industry,
      ctc: data.ctc ? block(data.ctc) : (data.ctc === '' ? '' : prev.ctc),
      experience: data.experience ? block(data.experience) : prev.experience,
      locations: locs.length ? locs : prev.locations,
      location: locs.length ? locs.join(', ') : prev.location,
      skills: sk.length ? sk : prev.skills,
    }));
    if (sk.length) setSkillsInput(sk.join(', '));
    setLists((prev) => ({
      ...prev,
      location: toOptions(prev.location, locs),
      clients: toOptions(prev.clients, data.clientName ? [data.clientName] : []),
      grade: toOptions(prev.grade, data.grade ? [data.grade] : []),
      experience: toOptions(prev.experience, data.experience ? [data.experience] : []),
      industry: toOptions(prev.industry, data.industry ? [data.industry] : []),
      ctc: toOptions(prev.ctc, data.ctc ? [data.ctc] : []),
      positions: toOptions(prev.positions, data.role ? [data.role] : []),
      product: toOptions(prev.product, sk),
    }));
    setJdImport({
      method: data.meta?.method || 'regex',
      overall: data.meta?.overallConfidence ?? 0,
      filled: data.meta?.filled ?? filled.length,
      total: data.meta?.total ?? 15,
      skipped: data.meta?.skipped || [],
      confidence: data.confidence || {},
    });
    setAutosaveEnabled(true);
    const pct = Math.round(Number(data.meta?.overallConfidence || 0) * 100);
    toast.success(
      filled.length
        ? `Mapped ${data.meta?.filled || filled.length} of ${data.meta?.total || 15} fields${pct ? ` · ${pct}% confidence` : ''}. Review before publishing.`
        : 'Extraction complete. Review the requisition, then continue.'
    );
    setTab('edit');
    setStep(0);
    setShowPasteBox(false);
    setEntryMode('form');
    scrollPreview('summary');
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
        toast.error(payload.message || 'This file could not be read. Use a text-based PDF, Word, or TXT file.');
        return;
      }
      applyParsedJd(payload.data || payload);
    } catch {
      toast.error('The file could not be uploaded. Use a PDF, Word, or TXT job description.');
    } finally {
      setJdImporting(false);
      if (jdInputRef.current) jdInputRef.current.value = '';
    }
  };

  const importJdPaste = async () => {
    const text = String(pasteText || '').trim();
    if (text.length < 20) {
      toast.warning('Paste the complete job description (at least a few lines).');
      return;
    }
    if (jdImporting) return;
    setJdImporting(true);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}/api/jobs/parse-jd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.message || 'The job description could not be extracted.');
        return;
      }
      applyParsedJd(payload.data || payload);
      setShowPasteBox(false);
    } catch {
      toast.error('Extraction failed. You may enter the requisition details instead.');
    } finally {
      setJdImporting(false);
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
  const conf = jdImport?.confidence || {};
  const formHidden = tab === 'preview';
  const onStart = !editingJob && entryMode !== 'form';

  return (
    <>
    <Modal
      open={open}
      onClose={requestClose}
      title={editingJob ? 'Edit requisition' : 'New requisition'}
      description={
        editingJob
          ? (formData.jobCode ? `Job ID ${formData.jobCode}` : 'A job ID is assigned when you save.')
          : onStart
            ? (nextJobCode ? `Reserved ID ${nextJobCode}` : 'Select how this requisition should be created')
            : (nextJobCode
              ? `${nextJobCode}${draftSavedAt && autosaveEnabled ? ' · Draft saved' : ''}`
              : `Step ${step + 1} of ${FORM_STEPS.length}${draftSavedAt && autosaveEnabled ? ' · Draft saved' : ''}`)
      }
      size="workbench"
      icon={Briefcase}
      closeOnBackdrop={false}
      fillHeight
      disableFocusLock={!!quickList || resumePromptOpen || closeConfirmOpen}
      bodyClassName="flex-1 min-h-0 min-w-0 overflow-hidden p-0 flex flex-col bg-white"
      footer={
        <>
          <button type="button" onClick={requestClose} className="btn-secondary" disabled={saving}>
            Close
          </button>
          {onStart ? (
            entryMode === 'import' ? (
              <button
                type="button"
                className="btn-secondary"
                disabled={saving}
                onClick={() => { setEntryMode('form'); setShowPasteBox(false); setStep(0); }}
              >
                Enter details
              </button>
            ) : null
          ) : (
            <>
              {step > 0 ? (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={saving}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                >
                  <ChevronLeft size={15} /> Back
                </button>
              ) : null}
              <button
                type="button"
                className="btn-secondary"
                disabled={saving}
                onClick={() => wrapSubmit({ preventDefault() {} }, { asDraft: true })}
                    title="Save internally. Not published to careers until you publish."
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                Save draft
              </button>
              {step < FORM_STEPS.length - 1 ? (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={saving}
                  onClick={() => { setStep((s) => Math.min(FORM_STEPS.length - 1, s + 1)); setTab('edit'); }}
                >
                  Continue <ChevronRight size={15} />
                </button>
              ) : (
                <button
                  type="submit"
                  form="job-form"
                  className="btn-primary"
                  disabled={saving}
                  title="Publish this role to your careers page"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : editingJob ? <Check size={16} /> : <Plus size={16} />}
                  {saving
                    ? 'Saving…'
                    : editingJob
                      ? (String(formData.status || '').toLowerCase() === 'draft' ? 'Publish requisition' : 'Save changes')
                      : 'Publish requisition'}
                </button>
              )}
            </>
          )}
        </>
      }
    >
      {onStart ? (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-12 py-10 bg-gradient-to-b from-stone-50 via-[#f7f7f5] to-white">
          {entryMode === 'choose' ? (
            <div className="max-w-[760px] mx-auto">
              <p className="text-[11px] font-semibold tracking-[0.16em] uppercase text-stone-400">Requisition</p>
              <p className="text-[22px] font-semibold text-stone-900 tracking-tight mt-2">How should this role be created?</p>
              <p className="text-[14px] text-stone-500 mt-2 leading-relaxed max-w-xl">
                Import from a client brief, or enter details using your organisation lists. Every field remains editable before publishing.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                <button
                  type="button"
                  onClick={() => { setEntryMode('import'); setShowPasteBox(true); }}
                  className="text-left rounded-2xl border border-stone-200/90 bg-white p-6 shadow-[0_1px_2px_rgba(28,25,23,0.04)] hover:border-stone-300 hover:shadow-[0_8px_24px_rgba(28,25,23,0.06)] transition group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="h-10 w-10 rounded-xl bg-stone-900 text-white inline-flex items-center justify-center">
                      <Sparkles size={18} />
                    </span>
                    <span className="text-[10px] font-semibold tracking-wider uppercase text-stone-500 bg-stone-50 border border-stone-200 rounded-full px-2 py-0.5">Recommended</span>
                  </div>
                  <p className="text-[15px] font-semibold text-stone-900 mt-5 tracking-tight">Import from job description</p>
                  <p className="text-[13px] text-stone-500 mt-2 leading-relaxed">
                    Extract title, locations, compensation, skills, and description from a client brief. Review mapped fields and confidence before publishing.
                  </p>
                  <p className="text-[12px] font-semibold text-stone-900 mt-5">Continue</p>
                </button>
                <button
                  type="button"
                  onClick={() => { setEntryMode('form'); setShowPasteBox(false); setStep(0); setTab('edit'); }}
                  className="text-left rounded-2xl border border-stone-200/90 bg-white p-6 shadow-[0_1px_2px_rgba(28,25,23,0.04)] hover:border-stone-300 hover:shadow-[0_8px_24px_rgba(28,25,23,0.06)] transition"
                >
                  <span className="h-10 w-10 rounded-xl bg-stone-50 text-stone-800 border border-stone-200 inline-flex items-center justify-center">
                    <Pencil size={18} />
                  </span>
                  <p className="text-[15px] font-semibold text-stone-900 mt-5 tracking-tight">Enter details</p>
                  <p className="text-[13px] text-stone-500 mt-2 leading-relaxed">
                    Complete the requisition yourself. A job description can still be imported later if a brief is received.
                  </p>
                  <p className="text-[12px] font-semibold text-stone-900 mt-5">Continue</p>
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-[760px] mx-auto">
              <button
                type="button"
                className="text-[12px] font-semibold text-stone-500 hover:text-stone-800 mb-5 inline-flex items-center gap-1"
                onClick={() => setEntryMode('choose')}
              >
                <ChevronLeft size={14} /> Back
              </button>
              <section className="rounded-2xl border border-stone-200/90 bg-white p-6 sm:p-7 space-y-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.16em] uppercase text-stone-400">Import</p>
                  <p className="text-[18px] font-semibold text-stone-900 tracking-tight mt-1.5">Paste the job description</p>
                  <p className="text-[13px] text-stone-500 leading-relaxed mt-1.5">
                    Fields are mapped to this organisation’s lists. Review extraction confidence and any missing values before publishing.
                  </p>
                </div>
                <textarea
                  rows={12}
                  className="textarea-ats field-premium min-h-[240px] w-full normal-case text-sm leading-relaxed rounded-xl"
                  placeholder={'Paste the complete job description…\n\nRelationship Manager\nLocations: Delhi, Noida\nExperience: 2–5 years\nCTC: 6–10 LPA\n\nResponsibilities\n• Acquire and grow the portfolio'}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  disabled={jdImporting}
                />
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={jdImporting || String(pasteText || '').trim().length < 20}
                    onClick={importJdPaste}
                  >
                    {jdImporting ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    {jdImporting ? 'Extracting…' : 'Extract and continue'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={jdImporting}
                    onClick={() => { setEntryMode('form'); setShowPasteBox(false); }}
                  >
                    Enter details instead
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>
      ) : null}

      <div className={`flex-1 min-h-0 min-w-0 flex flex-col ${onStart ? 'hidden' : ''}`}>
      {/* Workspace chrome */}
      <div className="flex items-center gap-2 border-b border-stone-200 bg-white px-3 sm:px-4 h-12 flex-shrink-0">
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-0">
            {FORM_STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setStep(i); setTab('edit'); }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold whitespace-nowrap transition ${
                  i === step
                    ? 'bg-brand-50 text-brand-800'
                    : i < step
                      ? 'text-stone-700 hover:bg-stone-50'
                      : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                <span className={`h-5 w-5 rounded-full text-[10px] inline-flex items-center justify-center ${
                  i === step ? 'bg-brand-600 text-white' : i < step ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-500'
                }`}>
                  {i < step ? <Check size={11} /> : i + 1}
                </span>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="hidden sm:flex items-center rounded-lg border border-stone-200 bg-stone-50 p-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => { setTab('edit'); setShowPreviewRail(true); }}
            className={`h-7 px-2.5 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 ${
              tab === 'edit' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500'
            }`}
          >
            <Pencil size={12} /> Details
          </button>
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={`h-7 px-2.5 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 ${
              tab === 'preview' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500'
            }`}
          >
            <Eye size={12} /> Preview
          </button>
        </div>
        {tab === 'edit' ? (
          <button
            type="button"
            className="hidden lg:inline-flex h-7 px-2.5 rounded-md text-[11px] font-semibold text-stone-500 hover:bg-stone-50 border border-transparent hover:border-stone-200"
            onClick={() => setShowPreviewRail((v) => !v)}
          >
            {showPreviewRail ? 'Hide preview' : 'Show preview'}
          </button>
        ) : null}
      </div>

      <div className="flex sm:hidden h-[38px] items-center rounded-none border-b border-stone-200 bg-stone-50 p-1 gap-1 flex-shrink-0">
        {[
          { id: 'edit', label: 'Details', icon: Pencil },
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

      <div className={`flex-1 min-h-0 min-w-0 overflow-hidden grid grid-cols-1 ${
        tab === 'edit' && showPreviewRail ? 'lg:grid-cols-[minmax(0,1fr)_minmax(300px,400px)]' : ''
      }`}>
        <form
          id="job-form"
          ref={formRef}
          onSubmit={(e) => wrapSubmit(e, { asDraft: false })}
          className={`min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain px-5 sm:px-7 py-5 space-y-5 ${formHidden ? 'hidden' : ''}`}
        >
          {jdImport ? (
            <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-8 w-8 rounded-lg bg-teal-50 text-teal-800 border border-teal-100 inline-flex items-center justify-center flex-shrink-0">
                  <Sparkles size={15} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-900">
                    Mapped {jdImport.filled} of {jdImport.total} fields
                    {jdImport.overall ? ` · ${Math.round(jdImport.overall * 100)}% confidence` : ''}
                  </p>
                  <p className="text-[12px] text-stone-500">
                    {jdImport.method === 'ai'
                      ? 'Review mapped values against the source brief before publishing.'
                      : 'Extracted from the brief. Confirm fields before publishing.'}
                    {jdImport.skipped?.length ? ` Missing: ${jdImport.skipped.slice(0, 6).join(', ')}.` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="ml-auto text-[12px] font-semibold text-stone-700 hover:text-stone-900"
                onClick={() => setShowPasteBox(true)}
              >
                Import again
              </button>
            </div>
          ) : null}

          <div className={step === 0 ? 'space-y-5' : 'hidden'}>
          {!editingJob && showPasteBox ? (
            <section className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
              <p className="text-sm font-semibold text-stone-900">Import an updated brief</p>
              <textarea
                rows={5}
                className="textarea-ats field-premium min-h-[120px] w-full normal-case text-sm leading-relaxed"
                placeholder="Paste the job description to remap fields…"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                disabled={jdImporting}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={jdImporting || String(pasteText || '').trim().length < 20}
                  onClick={importJdPaste}
                >
                  {jdImporting ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  {jdImporting ? 'Extracting…' : 'Remap fields'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowPasteBox(false)}>
                  Dismiss
                </button>
              </div>
            </section>
          ) : null}
          {!editingJob && !showPasteBox && !jdImport ? (
            <button
              type="button"
              onClick={() => setShowPasteBox(true)}
              className="text-[13px] font-medium text-stone-600 hover:text-stone-900 inline-flex items-center gap-2"
            >
              <ClipboardPaste size={14} className="text-stone-500" />
              Import from job description
            </button>
          ) : null}
          <section className="rounded-xl border border-stone-200 bg-white p-5 sm:p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-stone-900 tracking-tight">Requisition details</p>
                <p className="text-[13px] text-stone-500 mt-0.5">Required fields are marked. All values can be edited.</p>
              </div>
              <span className="text-[11px] font-semibold tracking-wide text-stone-600 bg-stone-50 border border-stone-200 rounded-md px-2.5 py-1 tabular-nums">
                {loadingNextCode && !editingJob ? (
                  <Loader2 size={12} className="animate-spin inline" />
                ) : (
                  displayJobCode || 'Assigned on save'
                )}
              </span>
            </div>
            <PriorityControl
              value={formData.priority}
              onChange={(next) => patch({ priority: next })}
            />
            <div className="min-w-0">
              <FieldLabel>Job ID</FieldLabel>
              {editingJob && !formData.customJobCode ? (
                <div className={`${fieldClass} bg-stone-50 text-stone-700 cursor-default`}>
                  {formData.jobCode || '—'}
                </div>
              ) : !editingJob && !formData.customJobCode ? (
                <div className={`${fieldClass} bg-stone-50 text-stone-700 cursor-default flex items-center gap-2`}>
                  {loadingNextCode ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-stone-400" />
                      <span className="text-stone-400 font-normal normal-case">Preparing identifier…</span>
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
              <label className="mt-2 inline-flex items-center gap-2 cursor-pointer text-[12px] text-stone-600">
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
                Use a custom job ID
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 min-w-0 [&>*]:min-w-0">
              <div className="min-w-0" onFocus={() => scrollPreview('header')}>
                <ListField label="Job title" required noun="positions" listCfg={LIST.positions} onManage={setQuickList} confidence={conf.role}>
                  <PremiumSelect
                    variant="list"
                    searchable
                    creatable
                    allowClear
                    className="w-full min-w-0"
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

              <ListField label="Grade" noun="grades" listCfg={LIST.grade} onManage={setQuickList} confidence={conf.grade}>
                <PremiumSelect
                  variant="list"
                  searchable
                  creatable
                  allowClear
                  className="w-full min-w-0"
                  value={formData.grade}
                  onChange={(v) => patch({ grade: block(v) })}
                  options={toOptions(lists.grade, formData.grade ? [formData.grade] : [])}
                  placeholder="SELECT GRADE"
                  searchPlaceholder="Search grades…"
                  emptyLabel="No grades — type to add"
                />
              </ListField>

              <ListField label="Client name" noun="clients" listCfg={LIST.clients} onManage={setQuickList} confidence={conf.clientName}>
                <PremiumSelect
                  variant="list"
                  searchable
                  creatable
                  allowClear
                  className="w-full min-w-0"
                  value={formData.clientName}
                  onChange={(v) => patch({ clientName: block(v) })}
                  options={toOptions(lists.clients, formData.clientName ? [formData.clientName] : [])}
                  placeholder="SELECT CLIENT"
                  searchPlaceholder="Type at least 2 characters to search…"
                  emptyLabel="No clients — type to add"
                  minSearchChars={PICKLIST_MIN_SEARCH}
                  onSearch={(q) => searchPicklistOptions('/api/clients', q)}
                />
              </ListField>

              <ListField label="Industry" required noun="industries" listCfg={LIST.industry} onManage={setQuickList} confidence={conf.industry}>
                <PremiumSelect
                  variant="list"
                  searchable
                  creatable
                  allowClear
                  className="w-full min-w-0"
                  value={formData.industry}
                  onChange={(v) => patch({ industry: block(v) })}
                  options={toOptions(lists.industry, formData.industry ? [formData.industry] : [])}
                  placeholder="SELECT INDUSTRY"
                  searchPlaceholder="Search industries…"
                  emptyLabel="No industries — type to add"
                />
              </ListField>

              <div className="min-w-0">
                <FieldLabel confidence={conf.department}>Department</FieldLabel>
                <input
                  type="text"
                  className={fieldClass}
                  placeholder="E.G. BRANCH BANKING"
                  value={formData.department || ''}
                  onChange={(e) => patch({ department: block(e.target.value) })}
                />
              </div>

              <div className="min-w-0">
                <FieldLabel confidence={conf.reportingTo}>Reports to</FieldLabel>
                <input
                  type="text"
                  className={fieldClass}
                  placeholder="E.G. BRANCH MANAGER"
                  value={formData.reportingTo || ''}
                  onChange={(e) => patch({ reportingTo: block(e.target.value) })}
                />
              </div>

              <div className="min-w-0">
                <FieldLabel confidence={conf.employmentType}>Employment type</FieldLabel>
                <PremiumSelect
                  variant="list"
                  className="w-full min-w-0"
                  value={formData.employmentType}
                  onChange={(v) => patch({ employmentType: v || 'full_time' })}
                  options={EMPLOYMENT_OPTIONS}
                  placeholder="FULL-TIME"
                />
              </div>

              <div className="md:col-span-2 min-w-0">
              <ListField
                label="Locations"
                required
                noun="locations"
                listCfg={LIST.location}
                onManage={setQuickList}
                confidence={conf.locations}
              >
                <PremiumSelect
                  variant="list"
                  searchable
                  multiple
                  creatable
                  allowClear
                  className="w-full min-w-0"
                  value={formData.locations || []}
                  onChange={persistLocation}
                  options={toOptions(lists.location, formData.locations)}
                  placeholder="SELECT LOCATIONS"
                  searchPlaceholder="Type at least 2 characters to search…"
                  emptyLabel="No locations — type to add"
                  minSearchChars={PICKLIST_MIN_SEARCH}
                  onSearch={(q) => searchPicklistOptions('/api/org-lists/location', q)}
                />
              </ListField>
              </div>

              <ListField label="Experience" noun="experience" listCfg={LIST.experience} onManage={setQuickList} confidence={conf.experience}>
                <PremiumSelect
                  variant="list"
                  searchable
                  creatable
                  allowClear
                  className="w-full min-w-0"
                  value={formData.experience}
                  onChange={(v) => patch({ experience: block(v) })}
                  options={toOptions(lists.experience, formData.experience ? [formData.experience] : [])}
                  placeholder="SELECT EXPERIENCE"
                  searchPlaceholder="Search experience…"
                  emptyLabel="No bands — type to add"
                />
              </ListField>

              <ListField label="CTC" noun="CTC bands" listCfg={LIST.ctc} onManage={setQuickList} confidence={conf.ctc}>
                <PremiumSelect
                  variant="list"
                  searchable
                  creatable
                  allowClear
                  className="w-full min-w-0"
                  value={formData.ctc}
                  onChange={(v) => patch({ ctc: block(v) })}
                  options={toOptions(lists.ctc, formData.ctc ? [formData.ctc] : [])}
                  placeholder="SELECT CTC"
                  searchPlaceholder="Search CTC bands…"
                  emptyLabel="No CTC bands — type to add"
                />
              </ListField>

              <div className="min-w-0">
                <FieldLabel confidence={conf.openings}>Openings</FieldLabel>
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
                <FieldLabel>Status</FieldLabel>
                <PremiumSelect
                  variant="list"
                  value={formData.status}
                  onChange={(v) => patch({ status: v })}
                  options={STATUS_OPTIONS}
                  placeholder="OPEN"
                />
              </div>
              <div className="md:col-span-2">
                <ListField label="Skills" noun="skills" listCfg={LIST.product} onManage={setQuickList} confidence={conf.skills}>
                  <PremiumSelect
                    variant="list"
                    searchable
                    multiple
                    creatable
                    allowClear
                    value={skills}
                    onChange={(next) => {
                      patch({ skills: next });
                      setSkillsInput(next.join(', '));
                    }}
                    options={toOptions(lists.product, skills)}
                    placeholder="SELECT SKILLS"
                    searchPlaceholder="Type at least 2 characters to search…"
                    emptyLabel="No skills — type to add"
                    minSearchChars={PICKLIST_MIN_SEARCH}
                    onSearch={(q) => searchPicklistOptions('/api/org-lists/product', q)}
                  />
                </ListField>
              </div>
              <div className="md:col-span-2 min-w-0">
                <FieldLabel confidence={conf.languages}>Languages</FieldLabel>
                <input
                  type="text"
                  className={`${fieldClass} normal-case`}
                  placeholder="English and regional language of the state"
                  value={formData.languages || ''}
                  onChange={(e) => patch({ languages: e.target.value })}
                />
              </div>
            </div>
          </section>
          </div>

          <div className={step === 1 ? '' : 'hidden'}>
          <section className="rounded-xl border border-stone-200/90 bg-white p-4 space-y-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-7 w-7 rounded-lg bg-sky-50 text-sky-700 border border-sky-100 inline-flex items-center justify-center">
                  <BookOpen size={13} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-900 tracking-tight">Job description</p>
                  <p className="text-[13px] text-stone-500">Upload a document or compose in the editors. The candidate-facing preview is on the right.</p>
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
                  {jdImporting ? 'Extracting…' : 'Upload brief'}
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
              Drop a PDF, Word, or TXT job description here. Summary, responsibilities, and requirements are populated automatically. Review before publishing.
            </div>
            <div onFocusCapture={() => scrollPreview('summary')}>
              <FieldLabel confidence={conf.summary}>Job summary</FieldLabel>
              <EmailBodyEditor
                key={`${editorKey}-summary`}
                compact
                value={formData.summary}
                onChange={(html) => patch({ summary: html })}
                placeholder="WE ARE LOOKING FOR AN EXPERIENCED ASSISTANT BRANCH HEAD…"
              />
            </div>
            <div onFocusCapture={() => scrollPreview('responsibilities')}>
              <FieldLabel confidence={conf.responsibilities}>Key responsibilities</FieldLabel>
              <EmailBodyEditor
                key={`${editorKey}-resp`}
                compact
                value={formData.responsibilitiesText}
                onChange={(html) => patch({ responsibilitiesText: html })}
                placeholder="DRIVE BUSINESS GROWTH AND ACHIEVE BRANCH SALES TARGETS."
              />
            </div>
            <div onFocusCapture={() => scrollPreview('requirements')}>
              <FieldLabel confidence={conf.requirements}>Candidate requirements</FieldLabel>
              <EmailBodyEditor
                key={`${editorKey}-req`}
                compact
                value={formData.requirementsText}
                onChange={(html) => patch({ requirementsText: html })}
                placeholder="MINIMUM 2 YEARS OF EXPERIENCE IN DIRECT CHANNEL – LIFE INSURANCE."
              />
            </div>
            <div onFocusCapture={() => scrollPreview('kpis')}>
              <FieldLabel confidence={conf.kpis}>Key results / KPIs</FieldLabel>
              <EmailBodyEditor
                key={`${editorKey}-kpis`}
                compact
                value={formData.kpisText}
                onChange={(html) => patch({ kpisText: html })}
                placeholder="AUDIT RATINGS, CASA NTB, AMB GROWTH…"
              />
            </div>
            <div onFocusCapture={() => scrollPreview('preferred')}>
              <FieldLabel confidence={conf.preferred}>Preferred candidate profile</FieldLabel>
              <EmailBodyEditor
                key={`${editorKey}-pref`}
                compact
                value={formData.preferredProfile}
                onChange={(html) => patch({ preferredProfile: html })}
                placeholder="CANDIDATES WITH CONSISTENT PERFORMANCE…"
              />
            </div>
          </section>
          </div>

          <div className={step === 2 ? '' : 'hidden'}>
          <section className="rounded-xl border border-stone-200/90 bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-7 w-7 rounded-lg bg-teal-50 text-teal-700 border border-teal-100 inline-flex items-center justify-center">
                <UserCheck size={13} />
              </span>
              <div>
                <p className="text-sm font-semibold text-stone-900 tracking-tight">Hiring team</p>
                <p className="text-[13px] text-stone-500">The first person selected is the hiring manager. Freelance submissions are routed to that manager.</p>
              </div>
            </div>
            {loadingMembers ? (
              <div className="flex items-center justify-center py-6 gap-2 text-sm text-stone-500">
                <Loader2 size={18} className="animate-spin text-stone-400" />
                Loading team…
              </div>
            ) : managerOptions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/80 px-4 py-5 text-center">
                <Users size={18} className="mx-auto text-stone-400 mb-2" />
                <p className="text-sm font-semibold text-stone-800">No team members found</p>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed max-w-sm mx-auto">
                  Invite colleagues from Team Directory. Freelance recruiters are not listed here.
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
                    <p className="text-center text-xs text-stone-400 py-4">No matching team members</p>
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
          </div>

          <div className={step === 3 ? 'space-y-4' : 'hidden'}>
          <section className="rounded-xl border border-stone-200/90 bg-white p-4 space-y-3.5">
            <div className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 inline-flex items-center justify-center">
                <StickyNote size={13} />
              </span>
              <div>
                <p className="text-sm font-semibold text-stone-900 tracking-tight">Internal notes</p>
                <p className="text-[13px] text-stone-500">Client contact and interview guidance. Not visible to candidates.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 min-w-0">
              <div className="min-w-0">
                <FieldLabel>Client contact</FieldLabel>
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
                <FieldLabel>Phone number</FieldLabel>
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
                <FieldLabel>Email</FieldLabel>
                <input
                  type="email"
                  placeholder="spoc@company.com"
                  className={`${fieldClass} normal-case`}
                  value={formData.spocEmail || ''}
                  onFocus={() => scrollPreview('notes')}
                  onChange={(e) => patch({ spocEmail: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 min-w-0">
                <FieldLabel>Interview process & additional notes</FieldLabel>
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
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-stone-800">
                    <Mail size={13} className="text-stone-500" />
                    Notify hiring team
                  </span>
                  <span className="block text-[12px] text-stone-500 mt-1 leading-relaxed">
                    Send email and in-app notification when this requisition is published. Drafts are not announced.
                  </span>
                </span>
              </label>
            </section>
          ) : null}
          </div>
        </form>

        <div
          ref={previewRef}
          className={`${
            tab === 'preview' ? 'block' : showPreviewRail ? 'hidden lg:block' : 'hidden'
          } min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-5 border-t lg:border-t-0 lg:border-l border-stone-200 bg-[#f7f7f5]`}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-stone-400">Preview</p>
            <span className="text-[11px] font-medium text-stone-400">Candidate-facing view</span>
          </div>
          <JobJdPreview form={{ ...formData, skills }} activeSection={activeSection} />
        </div>
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

      <Modal
        open={open && resumePromptOpen}
        onClose={() => {
          setResumePromptOpen(false);
          onClose();
        }}
        title="Resume draft?"
        description="An unfinished requisition is saved on this device."
        size="sm"
        icon={StickyNote}
        zClass="z-[120]"
        closeOnBackdrop={false}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={startFreshDraft}>
              Start new
            </button>
            <button type="button" className="btn-primary" onClick={resumeDraft}>
              Resume
            </button>
          </>
        }
      >
        <p className="text-sm text-stone-600 leading-relaxed">
          Resume to keep the saved fields, or start a new requisition.
        </p>
        {draftSavedAt ? (
          <p className="text-xs text-stone-400 mt-3">
            Last saved {new Date(draftSavedAt).toLocaleString()}
          </p>
        ) : null}
      </Modal>

      <Modal
        open={closeConfirmOpen}
        onClose={() => setCloseConfirmOpen(false)}
        title="Save as draft?"
        description="This requisition has unsaved details."
        size="sm"
        icon={AlertTriangle}
        zClass="z-[120]"
        closeOnBackdrop={false}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setCloseConfirmOpen(false)}>
              Continue editing
            </button>
            <button type="button" className="btn-secondary" onClick={confirmDiscardAndClose}>
              Discard
            </button>
            <button type="button" className="btn-primary" onClick={confirmSaveDraftAndClose}>
              Save draft
            </button>
          </>
        }
      >
        <p className="text-sm text-stone-600 leading-relaxed">
          Saving keeps this requisition on this device so you can resume later. Discard removes it.
        </p>
      </Modal>
    </>
  );
}
