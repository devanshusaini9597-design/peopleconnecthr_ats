import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, Search, ClipboardList, Plus, Trash2, Sparkles, ListChecks, Code2, Type, Inbox,
} from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../../utils/fetchUtils';
import { useToast } from '../Toast';
import EmptyState from '../ui/EmptyState';
import PremiumSelect from '../ui/PremiumSelect';
import { emptyQuestion, QUESTION_TYPE_OPTIONS } from './assessmentsConstants';
import { SUGGESTED_TOPICS, synthesizeQuestions } from './questionTemplates';

const chip = 'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap';
const TYPE_ICON = {
  multiple_choice: ListChecks,
  text: Type,
  code: Code2,
  communication: Type,
};

export default function QuestionBankPanel() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyQuestion());
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [query, setQuery] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [topic, setTopic] = useState('');
  const [aiType, setAiType] = useState('');

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

  const skills = useMemo(() => {
    const set = new Set(rows.map((row) => row.skillTag).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const visible = skillFilter ? rows.filter((row) => row.skillTag === skillFilter) : rows;

  const persist = async (payload) => {
    const res = await authenticatedFetch('/api/assessments/bank', { method: 'POST', body: JSON.stringify(payload) });
    const data = await readApiJson(res);
    if (!res.ok) throw new Error(data.message || 'Could not save');
    return data;
  };

  const save = async () => {
    if (!form.prompt.trim()) {
      toast?.error?.('Enter the question text');
      return;
    }
    setSaving(true);
    try {
      await persist(form);
      toast?.success?.('Question saved');
      setForm(emptyQuestion());
      load();
    } catch (err) {
      toast?.error?.(err.message);
    } finally {
      setSaving(false);
    }
  };

  const archive = async (id) => {
    const res = await authenticatedFetch(`/api/assessments/bank/${id}`, { method: 'DELETE' });
    const data = await readApiJson(res);
    if (!res.ok) return toast?.error?.(data.message || 'Could not remove');
    toast?.success?.('Question removed');
    load();
  };

  const applyGenerated = (items) => {
    const list = Array.isArray(items) ? items.filter((q) => q?.prompt) : [];
    if (!list.length) {
      toast?.error?.('No questions were generated. Try a different topic.');
      return;
    }
    setSuggestions(list);
    toast?.success?.('Review the questions, then add them to the library.');
  };

  const generate = async () => {
    const skill = topic.trim();
    if (!skill) {
      toast?.error?.('Enter a topic, for example Logical reasoning or React.js');
      return;
    }
    setGenerating(true);
    try {
      const res = await authenticatedFetch('/api/assessments/bank/ai-generate', {
        method: 'POST',
        body: JSON.stringify({ skill, topic: skill, type: aiType || undefined, count: 5 }),
      });
      const data = await readApiJson(res);
      if (res.ok && data.data?.items?.length) {
        applyGenerated(data.data.items);
        return;
      }
      applyGenerated(synthesizeQuestions(skill, aiType, 5));
    } catch {
      applyGenerated(synthesizeQuestions(skill, aiType, 5));
    } finally {
      setGenerating(false);
    }
  };

  const addSuggestion = async (item, index) => {
    try {
      await persist(item);
      setSuggestions((list) => list.filter((_, i) => i !== index));
      toast?.success?.('Question added');
      load();
    } catch (err) {
      toast?.error?.(err.message);
    }
  };

  const addAllSuggestions = async () => {
    if (!suggestions.length) return;
    setSavingAll(true);
    try {
      const res = await authenticatedFetch('/api/assessments/bank/seed', { method: 'POST', body: JSON.stringify({ items: suggestions }) });
      const data = await readApiJson(res);
      if (!res.ok) {
        for (const item of suggestions) {
          await persist(item);
        }
        toast?.success?.('Questions added');
        setSuggestions([]);
        load();
        return;
      }
      toast?.success?.(`${data.data?.inserted || suggestions.length} questions added`);
      setSuggestions([]);
      load();
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-stone-200/90 bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="h-[3px] bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="px-4 sm:px-5 py-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="icon-box-ats !w-10 !h-10 !rounded-xl">
              <Sparkles strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-stone-900 tracking-tight">Generate questions</h3>
              <p className="text-xs text-stone-500 mt-0.5">Enter any skill or test area used in hiring. Suggested questions are reviewed before they are saved.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_12rem_auto] gap-2.5">
            <input
              className="input-ats !h-10"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Topic — Logical reasoning, React.js, Java, SQL…"
            />
            <PremiumSelect
              variant="list"
              compact
              allowClear
              value={aiType}
              onChange={(v) => setAiType(v || '')}
              options={QUESTION_TYPE_OPTIONS}
              placeholder="All types"
              className="w-full"
            />
            <button type="button" className="btn-primary !h-10" onClick={generate} disabled={generating}>
              {generating ? <><Loader2 size={16} className="animate-spin" /> Generating…</> : <><Sparkles size={16} /> Generate</>}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_TOPICS.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setTopic(label)}
                className={`${chip} ${topic === label ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-stone-200 bg-stone-50 text-stone-600 hover:border-brand-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {suggestions.length ? (
        <div className="rounded-2xl border border-brand-200/80 bg-brand-50/30 overflow-hidden">
          <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2 border-b border-brand-100">
            <p className="text-sm font-bold text-stone-900">
              Review {suggestions.length} question{suggestions.length === 1 ? '' : 's'}
            </p>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" className="btn-secondary !text-xs !px-3 !py-1.5" onClick={() => setSuggestions([])}>Discard</button>
              <button type="button" className="btn-primary !text-xs !px-3 !py-1.5" onClick={addAllSuggestions} disabled={savingAll}>
                {savingAll ? 'Saving…' : 'Add to library'}
              </button>
            </div>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {suggestions.map((item, index) => {
              const Icon = TYPE_ICON[item.type] || ClipboardList;
              return (
                <article key={`${item.prompt}-${index}`} className="rounded-2xl border border-stone-200/90 bg-white p-4">
                  <div className="flex items-start gap-2">
                    <span className={`${chip} border-teal-200 bg-teal-50 text-teal-800`}>
                      <Icon size={11} strokeWidth={2.25} />
                      {QUESTION_TYPE_OPTIONS.find((o) => o.value === item.type)?.label || item.type}
                    </span>
                    {item.skillTag ? <span className={`${chip} border-stone-200 bg-stone-50 text-stone-700`}>{item.skillTag}</span> : null}
                    <span className={`${chip} ml-auto border-stone-200 bg-stone-50 text-stone-600`}>{item.points} pts</span>
                  </div>
                  <p className="text-sm font-semibold text-stone-900 mt-2 leading-snug">{item.prompt}</p>
                  {item.type === 'multiple_choice' ? (
                    <ul className="mt-2 space-y-1">
                      {(item.options || []).map((opt, i) => (
                        <li key={i} className={`text-xs ${i === item.correctOptionIndex ? 'font-semibold text-emerald-800' : 'text-stone-600'}`}>
                          {i === item.correctOptionIndex ? '✓ ' : ''}{opt}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <button type="button" className="btn-secondary mt-3 !text-xs !px-3 !py-1.5" onClick={() => addSuggestion(item, index)}>
                    <Plus size={12} /> Add to library
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <section className="rounded-2xl border border-stone-200/90 bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="h-[3px] bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="p-4 sm:p-5 space-y-4">
            <h3 className="text-sm font-bold text-stone-900 tracking-tight inline-flex items-center gap-2">
              <Plus className="w-4 h-4 text-brand-600" /> Create question
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
                <button type="button" className="text-xs font-bold text-brand-700" onClick={() => setForm((f) => ({ ...f, options: [...f.options, ''] }))}>+ Add option</button>
              </div>
            )}
            {form.type === 'code' && (
              <div>
                <label className="label-ats">Language</label>
                <input className="input-ats" value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))} placeholder="javascript" />
              </div>
            )}
            <button type="button" className="btn-primary" onClick={save} disabled={saving}>
              {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Plus size={16} /> Save question</>}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200/90 bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col min-h-[420px]">
          <div className="h-[3px] bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="p-4 sm:p-5 border-b border-stone-100 space-y-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-brand-600" />
              <h3 className="text-sm font-bold text-stone-900 tracking-tight">Question library</h3>
              <span className="ml-auto text-xs font-bold text-stone-400 tabular-nums">{visible.length}</span>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-brand-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search questions" className="input-ats input-ats-icon" />
            </div>
            {skills.length ? (
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setSkillFilter('')} className={`${chip} ${!skillFilter ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-stone-200 bg-stone-50 text-stone-600'}`}>All</button>
                {skills.map((skill) => (
                  <button key={skill} type="button" onClick={() => setSkillFilter(skill)} className={`${chip} ${skillFilter === skill ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-stone-200 bg-stone-50 text-stone-600'}`}>
                    {skill}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-10 flex justify-center"><Loader2 className="w-7 h-7 text-brand-600 animate-spin" /></div>
            ) : visible.length === 0 ? (
              <EmptyState compact icon={Inbox} tone="violet" message="No questions in the library" subMessage="Generate questions for a topic, or create one manually." />
            ) : (
              <div className="divide-y divide-stone-100">
                {visible.map((row) => {
                  const Icon = TYPE_ICON[row.type] || ClipboardList;
                  return (
                    <div key={row._id} className="p-4 flex items-start gap-3 hover:bg-brand-50/20">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          <span className={`${chip} border-teal-200 bg-teal-50 text-teal-800`}>
                            <Icon size={11} strokeWidth={2.25} />
                            {QUESTION_TYPE_OPTIONS.find((o) => o.value === row.type)?.label || row.type}
                          </span>
                          {row.skillTag ? <span className={`${chip} border-stone-200 bg-stone-50 text-stone-700`}>{row.skillTag}</span> : null}
                          <span className={`${chip} border-stone-200 bg-stone-50 text-stone-600`}>{row.points} pts</span>
                        </div>
                        <p className="text-sm font-semibold text-stone-900 leading-snug">{row.prompt}</p>
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-400 shadow-sm hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        onClick={() => archive(row._id)}
                        title="Remove"
                        aria-label="Remove"
                      >
                        <Trash2 size={14} strokeWidth={2.25} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
