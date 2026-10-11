import React, { useCallback, useEffect, useState } from 'react';
import {
  Loader2, Search, FileEdit, ClipboardList, Shield, Inbox, Clock, Archive, EyeOff, RefreshCw, FileText,
} from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../../utils/fetchUtils';
import { useToast } from '../Toast';
import EmptyState from '../ui/EmptyState';
import PremiumSelect from '../ui/PremiumSelect';
import AssessmentQueueCard from './AssessmentQueueCard';
export { default as QuestionBankPanel } from './QuestionBankPanel';

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
            <AssessmentQueueCard key={row._id} row={row} onGrade={onGrade} canGrade={canGrade} />
          ))}
        </div>
      )}
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
    <div className="space-y-4">
      {error ? <p className="text-sm text-amber-700">{error}</p> : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <article className="relative overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="flex items-start gap-3">
            <div className="icon-box-ats !w-10 !h-10 !rounded-xl"><Clock strokeWidth={2.25} /></div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-stone-900 tracking-tight">Invite window</h3>
              <p className="text-xs text-stone-500 mt-0.5">How long a new invite stays valid.</p>
              <div className="mt-3">
                <label className="label-ats">Hours</label>
                <input type="number" min="1" max="720" className="input-ats" value={form.defaultInviteHours || 72} onChange={(e) => setForm((f) => ({ ...f, defaultInviteHours: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
        </article>
        <article className="relative overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="flex items-start gap-3">
            <div className="icon-box-ats !w-10 !h-10 !rounded-xl"><Archive strokeWidth={2.25} /></div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-stone-900 tracking-tight">Retention</h3>
              <p className="text-xs text-stone-500 mt-0.5">How long attempts are kept for audit.</p>
              <div className="mt-3">
                <label className="label-ats">Days</label>
                <input type="number" min="30" max="3650" className="input-ats" value={form.retentionDays || 730} onChange={(e) => setForm((f) => ({ ...f, retentionDays: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
        </article>
        <article className="relative overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="flex items-start gap-3">
            <div className="icon-box-ats !w-10 !h-10 !rounded-xl"><EyeOff strokeWidth={2.25} /></div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-stone-900 tracking-tight">Result visibility</h3>
              <p className="text-xs text-stone-500 mt-0.5">Default for new assessments. Each test can override this.</p>
              <div className="mt-3">
                <PremiumSelect
                  variant="list"
                  value={form.defaultResultVisibility || 'hidden'}
                  onChange={(v) => setForm((f) => ({ ...f, defaultResultVisibility: v || 'hidden' }))}
                  options={VISIBILITY_OPTIONS}
                  placeholder="Visibility"
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </article>
        <article className="relative overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="icon-box-ats !w-10 !h-10 !rounded-xl"><RefreshCw strokeWidth={2.25} /></div>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-stone-900 tracking-tight">Candidate retakes</span>
                <input
                  type="checkbox"
                  className="rounded border-stone-300 text-brand-600"
                  checked={!!form.allowCandidateRetakes}
                  onChange={(e) => setForm((f) => ({ ...f, allowCandidateRetakes: e.target.checked }))}
                />
              </span>
              <span className="block text-xs text-stone-500 mt-1">When on, you can send a new invite after someone already completed a test.</span>
            </span>
          </label>
        </article>
      </div>
      <article className="relative overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="flex items-start gap-3">
          <div className="icon-box-ats !w-10 !h-10 !rounded-xl"><FileText strokeWidth={2.25} /></div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-stone-900 tracking-tight">Privacy notice</h3>
            <p className="text-xs text-stone-500 mt-0.5">Shown on the candidate instructions screen before they start.</p>
            <textarea className="textarea-ats mt-3" rows={4} value={form.privacyNotice || ''} onChange={(e) => setForm((f) => ({ ...f, privacyNotice: e.target.value }))} placeholder="How you use assessment data, recording, and retention." />
          </div>
        </div>
      </article>
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200/90 bg-stone-50/80 px-4 py-3">
        <p className="text-xs text-stone-500">Applies to new invites. Published tests keep their own freeze.</p>
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save policies'}
        </button>
      </div>
    </div>
  );
}

export const LIBRARY_TABS = [
  { id: 'library', label: 'Assessments', icon: ClipboardList },
  { id: 'queue', label: 'Evaluation queue', icon: FileEdit },
  { id: 'bank', label: 'Question bank', icon: Inbox },
  { id: 'settings', label: 'Policies', icon: Shield },
];
