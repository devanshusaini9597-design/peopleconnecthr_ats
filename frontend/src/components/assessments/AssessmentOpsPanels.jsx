import React, { useCallback, useEffect, useState } from 'react';
import {
  Loader2, Search, FileEdit, ClipboardList, Plus, Trash2, Shield, Inbox, SlidersHorizontal, Clock,
} from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../../utils/fetchUtils';
import { useToast } from '../Toast';
import EmptyState from '../ui/EmptyState';
import PremiumSelect from '../ui/PremiumSelect';
import PresenceAvatar from '../ui/PresenceAvatar';
import { emptyQuestion, QUESTION_TYPE_OPTIONS, actionBtn } from './assessmentsConstants';

export function EvaluationQueuePanel({ onGrade, canGrade = true, searchQuery = '', embedded = false }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localQuery, setLocalQuery] = useState('');
  const [error, setError] = useState('');
  const query = embedded ? searchQuery : localQuery;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authenticatedFetch('/api/assessments/queue');
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Could not load the evaluation queue');
        setRows([]);
        return;
      }
      setRows(data.data || []);
    } catch (err) {
      setError(err?.message || 'Could not load the evaluation queue');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((row) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (row.candidateId?.name || '').toLowerCase().includes(q)
      || (row.candidateId?.email || '').toLowerCase().includes(q)
      || (row.assessmentId?.title || '').toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="min-h-[36vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
        <p className="text-sm font-medium text-stone-500">Loading evaluations…</p>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState icon={Inbox} tone="amber" message="Couldn’t load the queue" subMessage={error} action={(
        <button type="button" className="btn-secondary" onClick={load}>Retry</button>
      )} />
    );
  }

  if (!rows.length) {
    return (
      <EmptyState
        icon={FileEdit}
        tone="sky"
        message="Nothing waiting for review"
        subMessage="Written and coding answers land here after a candidate submits. Objective questions are scored automatically."
      />
    );
  }

  return (
    <div className="space-y-4">
      {!embedded ? (
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-brand-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input value={localQuery} onChange={(e) => setLocalQuery(e.target.value)} placeholder="Search candidate or test…" className="input-ats input-ats-icon" />
        </div>
      ) : null}
      {filtered.length === 0 ? (
        <EmptyState compact icon={Search} tone="amber" message="No matching submissions" subMessage="Try another name or assessment title." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch stagger-children">
          {filtered.map((row) => (
            <article key={row._id} className="relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:shadow-md hover:border-brand-200">
              <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
              <div className="flex min-w-0 flex-1 flex-col px-4 pt-4 pb-3">
                <div className="flex items-start gap-3">
                  <PresenceAvatar name={row.candidateId?.name} email={row.candidateId?.email} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-stone-900 tracking-tight truncate">{row.candidateId?.name || 'Candidate'}</h4>
                      <span className="badge-warning flex-shrink-0">Review</span>
                    </div>
                    <p className="text-xs text-stone-500 truncate">{row.candidateId?.email || '—'}</p>
                  </div>
                </div>
                <div className="mt-3 rounded-xl bg-stone-50/90 border border-stone-100 p-3.5 text-sm text-stone-600 space-y-1.5">
                  <p className="inline-flex items-center gap-1.5 font-semibold text-stone-800">
                    <ClipboardList className="w-3.5 h-3.5 text-brand-600" />
                    {row.assessmentId?.title || 'Assessment'}
                  </p>
                  <p className="inline-flex items-center gap-1.5 text-xs">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    Submitted {row.submittedAt ? new Date(row.submittedAt).toLocaleString() : '—'}
                  </p>
                  <p className="text-xs text-stone-500">Pending human review — not marked as fail.</p>
                </div>
              </div>
              {canGrade ? (
                <div className="border-t border-stone-100 bg-stone-50/70 px-4 py-3">
                  <button type="button" className="btn-primary w-full" onClick={() => onGrade?.(row)}>
                    <FileEdit className="w-4 h-4" /> Grade submission
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function QuestionBankPanel() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyQuestion());
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`/api/assessments/bank${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`);
      const data = await res.json();
      setRows(data.data || []);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const t = setTimeout(load, query ? 280 : 0);
    return () => clearTimeout(t);
  }, [load, query]);

  const save = async () => {
    if (!form.prompt.trim()) {
      toast?.error?.('Write a prompt first');
      return;
    }
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/assessments/bank', { method: 'POST', body: JSON.stringify(form) });
      const data = await readApiJson(res);
      if (!res.ok) return toast?.error?.(data.message || 'Could not save');
      toast?.success?.('Saved to the question bank');
      setForm(emptyQuestion());
      load();
    } finally {
      setSaving(false);
    }
  };

  const archive = async (id) => {
    const res = await authenticatedFetch(`/api/assessments/bank/${id}`, { method: 'DELETE' });
    const data = await readApiJson(res);
    if (!res.ok) return toast?.error?.(data.message || 'Could not remove');
    toast?.success?.('Removed from the bank');
    load();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <section className="rounded-xl border border-stone-200/90 bg-white shadow-sm relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 pointer-events-none" />
        <div className="p-4 sm:p-5 space-y-4">
          <h3 className="section-title-ats !mb-0">
            <Plus className="w-4 h-4 text-brand-600" />
            Add to question bank
          </h3>
          <div>
            <label className="label-ats">Type</label>
            <PremiumSelect
              variant="list"
              compact
              value={form.type}
              onChange={(v) => setForm((f) => ({ ...f, type: v || 'text' }))}
              options={QUESTION_TYPE_OPTIONS}
              placeholder="Question type"
              className="w-full"
            />
          </div>
          <div>
            <label className="label-ats">Prompt</label>
            <textarea value={form.prompt} onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))} className="textarea-ats" placeholder="Question candidates will see" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-ats">Points</label>
              <input type="number" min="0" className="input-ats" value={form.points} onChange={(e) => setForm((f) => ({ ...f, points: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label-ats">Skill tag</label>
              <input className="input-ats" value={form.skillTag} onChange={(e) => setForm((f) => ({ ...f, skillTag: e.target.value }))} placeholder="e.g. React" />
            </div>
          </div>
          {form.type === 'multiple_choice' && (
            <div className="space-y-2">
              <label className="label-ats">Options — select the correct answer</label>
              {form.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="bank-correct"
                    checked={form.correctOptionIndex === i}
                    onChange={() => setForm((f) => ({ ...f, correctOptionIndex: i }))}
                    className="text-brand-600"
                  />
                  <input className="input-ats flex-1" value={opt} onChange={(e) => setForm((f) => ({ ...f, options: f.options.map((o, idx) => (idx === i ? e.target.value : o)) }))} placeholder={`Option ${i + 1}`} />
                </div>
              ))}
              <button
                type="button"
                className="text-xs font-bold text-brand-700"
                onClick={() => setForm((f) => ({ ...f, options: [...f.options, ''] }))}
              >
                + Add option
              </button>
            </div>
          )}
          {form.type === 'code' && (
            <div>
              <label className="label-ats">Language</label>
              <input className="input-ats" value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))} placeholder="javascript" />
            </div>
          )}
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Plus size={16} /> Save to bank</>}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200/90 bg-white shadow-sm relative overflow-hidden flex flex-col min-h-[420px]">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 pointer-events-none" />
        <div className="p-4 sm:p-5 border-b border-stone-100 space-y-3">
          <h3 className="section-title-ats !mb-0 !pb-0 !border-0">
            <ClipboardList className="w-4 h-4 text-brand-600" />
            Library
            <span className="ml-auto text-xs font-bold text-stone-400">{rows.length}</span>
          </h3>
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search bank…" className="input-ats input-ats-icon" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-10 flex justify-center"><Loader2 className="w-7 h-7 text-brand-600 animate-spin" /></div>
          ) : rows.length === 0 ? (
            <EmptyState compact icon={Inbox} tone="violet" message="No questions in the bank yet" subMessage="Save reusable MCQs, written items, and coding prompts on the left." />
          ) : (
            <div className="divide-y divide-stone-100">
              {rows.map((row) => (
                <div key={row._id} className="p-4 flex items-start gap-3 hover:bg-brand-50/20">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-stone-900 leading-snug">{row.prompt}</p>
                    <p className="text-xs text-stone-500 mt-1">
                      {(QUESTION_TYPE_OPTIONS.find((o) => o.value === row.type)?.label || row.type)} · {row.points} pts
                      {row.skillTag ? ` · ${row.skillTag}` : ''}
                    </p>
                  </div>
                  <button type="button" className={`${actionBtn} text-stone-400 hover:text-red-600 hover:border-red-200`} onClick={() => archive(row._id)} title="Remove" aria-label="Remove">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

const VISIBILITY_OPTIONS = [
  { value: 'hidden', label: 'Hidden', description: 'Candidates only see a confirmation' },
  { value: 'score', label: 'Score only', description: 'Show marks after scoring is complete' },
  { value: 'detailed', label: 'Score and feedback', description: 'Show marks and reviewer comments' },
];

export function AssessmentSettingsPanel() {
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await authenticatedFetch('/api/assessments/settings');
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.message || 'Could not load policies');
          setForm({});
          return;
        }
        setForm(data.data || {});
      } catch (err) {
        setError(err?.message || 'Could not load policies');
        setForm({});
      }
    })();
  }, []);

  if (!form) {
    return (
      <div className="card-ats-bordered min-h-[40vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
        <p className="text-sm font-medium text-stone-500">Loading policies…</p>
      </div>
    );
  }

  const save = async () => {
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/assessments/settings', { method: 'PUT', body: JSON.stringify(form) });
      const data = await readApiJson(res);
      if (!res.ok) return toast?.error?.(data.message || 'Could not save');
      toast?.success?.('Assessment policies saved');
      setForm(data.data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-stone-200/90 bg-white shadow-sm relative overflow-hidden max-w-3xl">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 pointer-events-none" />
      <div className="p-4 sm:p-6 space-y-5">
        <h3 className="section-title-ats !mb-0">
          <SlidersHorizontal className="w-4 h-4 text-brand-600" />
          Company assessment policies
        </h3>
        {error ? <p className="text-sm text-amber-700">{error}</p> : null}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-ats">Default invite window (hours)</label>
            <input type="number" min="1" max="720" className="input-ats" value={form.defaultInviteHours || 72} onChange={(e) => setForm((f) => ({ ...f, defaultInviteHours: Number(e.target.value) }))} />
            <p className="text-xs text-stone-400 mt-1">How long a new invite stays valid.</p>
          </div>
          <div>
            <label className="label-ats">Retention (days)</label>
            <input type="number" min="30" max="3650" className="input-ats" value={form.retentionDays || 730} onChange={(e) => setForm((f) => ({ ...f, retentionDays: Number(e.target.value) }))} />
            <p className="text-xs text-stone-400 mt-1">How long attempts are kept for audit.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="label-ats">Default result visibility</label>
            <PremiumSelect
              variant="list"
              value={form.defaultResultVisibility || 'hidden'}
              onChange={(v) => setForm((f) => ({ ...f, defaultResultVisibility: v || 'hidden' }))}
              options={VISIBILITY_OPTIONS}
              placeholder="Visibility"
              className="w-full"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label-ats">Privacy notice</label>
            <textarea className="textarea-ats" rows={4} value={form.privacyNotice || ''} onChange={(e) => setForm((f) => ({ ...f, privacyNotice: e.target.value }))} placeholder="Shown on the candidate instructions screen before they start." />
          </div>
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 rounded border-stone-300 text-brand-600"
            checked={!!form.allowCandidateRetakes}
            onChange={(e) => setForm((f) => ({ ...f, allowCandidateRetakes: e.target.checked }))}
          />
          <span>
            <span className="block text-sm font-semibold text-stone-800">Allow candidate retakes</span>
            <span className="block text-xs text-stone-500 mt-0.5">When on, new invites can reuse a candidate who already completed this company’s tests.</span>
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save policies'}
          </button>
        </div>
      </div>
    </section>
  );
}

export const LIBRARY_TABS = [
  { id: 'library', label: 'Assessments', icon: ClipboardList },
  { id: 'queue', label: 'Evaluation queue', icon: FileEdit },
  { id: 'bank', label: 'Question bank', icon: Inbox },
  { id: 'settings', label: 'Policies', icon: Shield },
];
