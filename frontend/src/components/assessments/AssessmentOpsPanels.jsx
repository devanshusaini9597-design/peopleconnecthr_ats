import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../../utils/fetchUtils';
import { useToast } from '../Toast';
import { emptyQuestion } from './assessmentsConstants';

export function EvaluationQueuePanel({ onOpen }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const res = await authenticatedFetch('/api/assessments/queue');
      const data = await res.json();
      setRows(data.data || []);
      setLoading(false);
    })();
  }, []);
  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-brand-600" /></div>;
  if (!rows.length) return <p className="text-sm text-stone-500">No subjective evaluations waiting.</p>;
  return (
    <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
      {rows.map((row) => (
        <button key={row._id} type="button" onClick={() => onOpen?.(row)} className="w-full text-left p-4 hover:bg-stone-50">
          <p className="font-semibold text-stone-900">{row.candidateId?.name}</p>
          <p className="text-xs text-stone-500">{row.assessmentId?.title} · pending review — not marked as fail</p>
        </button>
      ))}
    </div>
  );
}

export function QuestionBankPanel() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyQuestion());
  const load = useCallback(async () => {
    const res = await authenticatedFetch('/api/assessments/bank');
    const data = await res.json();
    setRows(data.data || []);
  }, []);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    const res = await authenticatedFetch('/api/assessments/bank', { method: 'POST', body: JSON.stringify(form) });
    const data = await readApiJson(res);
    if (!res.ok) return toast?.error?.(data.message || 'Could not save');
    toast?.success?.('Saved to question bank');
    setForm(emptyQuestion());
    load();
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
        <h3 className="font-bold text-stone-900">Add question</h3>
        <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="input-ats">
          <option value="multiple_choice">Multiple choice</option>
          <option value="text">Written</option>
          <option value="code">Coding</option>
          <option value="communication">Communication</option>
        </select>
        <textarea value={form.prompt} onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))} className="textarea-ats" placeholder="Prompt" rows={3} />
        {form.type === 'multiple_choice' && (
          <div className="space-y-2">
            {form.options.map((opt, i) => (
              <input key={i} value={opt} onChange={(e) => setForm((f) => ({ ...f, options: f.options.map((o, idx) => (idx === i ? e.target.value : o)) }))} className="input-ats" placeholder={`Option ${i + 1}`} />
            ))}
          </div>
        )}
        <button type="button" className="btn-primary" onClick={save}>Save to bank</button>
      </div>
      <div className="rounded-xl border border-stone-200 bg-white divide-y divide-stone-100 max-h-[480px] overflow-auto">
        {rows.map((row) => (
          <div key={row._id} className="p-3 text-sm">
            <p className="font-semibold text-stone-900">{row.prompt}</p>
            <p className="text-xs text-stone-500">{row.type} · {row.points} pts {row.skillTag ? `· ${row.skillTag}` : ''}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AssessmentSettingsPanel() {
  const toast = useToast();
  const [form, setForm] = useState(null);
  useEffect(() => {
    (async () => {
      const res = await authenticatedFetch('/api/assessments/settings');
      const data = await res.json();
      setForm(data.data || {});
    })();
  }, []);
  if (!form) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-brand-600" /></div>;
  const save = async () => {
    const res = await authenticatedFetch('/api/assessments/settings', { method: 'PUT', body: JSON.stringify(form) });
    const data = await readApiJson(res);
    if (!res.ok) return toast?.error?.(data.message || 'Could not save');
    toast?.success?.('Assessment policies saved');
    setForm(data.data);
  };
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-3 max-w-xl">
      <h3 className="font-bold text-stone-900">Company assessment policies</h3>
      <label className="label-ats">Default invite window (hours)</label>
      <input type="number" className="input-ats" value={form.defaultInviteHours || 72} onChange={(e) => setForm((f) => ({ ...f, defaultInviteHours: Number(e.target.value) }))} />
      <label className="label-ats">Default result visibility</label>
      <select className="input-ats" value={form.defaultResultVisibility || 'hidden'} onChange={(e) => setForm((f) => ({ ...f, defaultResultVisibility: e.target.value }))}>
        <option value="hidden">Hidden</option>
        <option value="score">Score</option>
        <option value="detailed">Detailed</option>
      </select>
      <label className="label-ats">Retention (days)</label>
      <input type="number" className="input-ats" value={form.retentionDays || 730} onChange={(e) => setForm((f) => ({ ...f, retentionDays: Number(e.target.value) }))} />
      <label className="label-ats">Privacy notice</label>
      <textarea className="textarea-ats" rows={3} value={form.privacyNotice || ''} onChange={(e) => setForm((f) => ({ ...f, privacyNotice: e.target.value }))} />
      <button type="button" className="btn-primary" onClick={save}>Save policies</button>
    </div>
  );
}
