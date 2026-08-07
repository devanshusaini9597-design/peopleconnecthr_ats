import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Type, Code2, ListChecks, Shield, Loader2, ClipboardList } from 'lucide-react';
import Modal from '../ui/Modal';
import PremiumSelect from '../ui/PremiumSelect';
import {
  emptyQuestion, QUESTION_TYPE_OPTIONS, STRICTNESS_OPTIONS, actionBtn,
} from './assessmentsConstants';

export const BuilderModal = ({ open, onClose, onSave, saving, canProctor }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [proctoringEnabled, setProctoringEnabled] = useState(false);
  const [strictness, setStrictness] = useState('standard');

  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setDurationMinutes(45);
      setQuestions([emptyQuestion()]);
      setProctoringEnabled(false);
      setStrictness('standard');
    }
  }, [open]);

  const updateQuestion = (idx, patch) => {
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };
  const updateOption = (qIdx, oIdx, value) => {
    setQuestions((qs) => qs.map((q, i) => {
      if (i !== qIdx) return q;
      const options = [...q.options];
      options[oIdx] = value;
      return { ...q, options };
    }));
  };
  const addOption = (qIdx) => updateQuestion(qIdx, { options: [...questions[qIdx].options, ''] });
  const removeOption = (qIdx, oIdx) => {
    const q = questions[qIdx];
    if (!q || q.options.length <= 2) return;
    const options = q.options.filter((_, i) => i !== oIdx);
    const correctOptionIndex = Math.min(q.correctOptionIndex, options.length - 1);
    updateQuestion(qIdx, { options, correctOptionIndex });
  };
  const removeQuestion = (idx) => setQuestions((qs) => qs.filter((_, i) => i !== idx));

  const valid = title.trim() && questions.length > 0 && questions.every((q) => q.prompt.trim());

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Assessment"
      description="Build a skills test — code answers are graded by your team."
      size="xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancel</button>
          <button
            type="button"
            onClick={() => onSave({
              title,
              description,
              durationMinutes,
              questions,
              proctoring: canProctor ? { enabled: proctoringEnabled, strictness } : { enabled: false }
            })}
            disabled={saving || !valid}
            className="btn-primary"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : <><Plus size={16} /> Create Assessment</>}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <section className="space-y-4">
          <h3 className="section-title-ats !mb-0">
            <ClipboardList className="w-4 h-4 text-brand-600" />
            Basics
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label-ats">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-ats"
                placeholder="e.g. React Fundamentals"
                autoFocus
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label-ats">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="textarea-ats !min-h-[72px]"
                placeholder="Optional — what this test covers"
                rows={2}
              />
            </div>
            <div className="sm:max-w-xs">
              <label className="label-ats">Duration (minutes)</label>
              <input
                type="number"
                min="5"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="input-ats"
              />
            </div>
          </div>
        </section>

        {canProctor && (
          <section className="rounded-xl border border-stone-200/90 bg-white shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <div className="p-4 sm:p-5 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={proctoringEnabled}
                  onChange={(e) => setProctoringEnabled(e.target.checked)}
                  className="mt-1 rounded border-stone-300 text-brand-600 focus:ring-brand-500/30"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
                    <Shield className="w-4 h-4 text-brand-600" /> Enable proctoring
                  </span>
                  <span className="block text-xs text-stone-500 mt-0.5 leading-relaxed">
                    Track tab switches, copy/paste, and window blur. Risk score shown after submit.
                  </span>
                </span>
              </label>
              {proctoringEnabled && (
                <div>
                  <label className="label-ats">Strictness</label>
                  <PremiumSelect
                    variant="list"
                    value={strictness}
                    onChange={(v) => setStrictness(v || 'standard')}
                    options={STRICTNESS_OPTIONS}
                    placeholder="Strictness"
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="section-title-ats !mb-0">
              <ListChecks className="w-4 h-4 text-brand-600" />
              Questions
              <span className="ml-1.5 text-xs font-bold text-stone-400 normal-case tracking-normal">
                {questions.length}
              </span>
            </h3>
            <button
              type="button"
              onClick={() => setQuestions((qs) => [...qs, emptyQuestion()])}
              className="btn-secondary !text-xs !px-3 !py-2"
            >
              <Plus size={14} /> Add question
            </button>
          </div>

          <div className="space-y-3">
            {questions.map((q, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-stone-200/90 bg-white shadow-sm overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-stone-100 bg-stone-50/80">
                  <span className="inline-flex items-center gap-2 text-xs font-bold text-stone-700">
                    <span className="w-6 h-6 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 inline-flex items-center justify-center tabular-nums">
                      {idx + 1}
                    </span>
                    Question {idx + 1}
                  </span>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(idx)}
                      className={`${actionBtn} text-stone-400 hover:text-red-600 hover:border-red-200`}
                      aria-label={`Remove question ${idx + 1}`}
                      title="Remove question"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="label-ats">Type</label>
                      <PremiumSelect
                        variant="list"
                        compact
                        value={q.type}
                        onChange={(v) => updateQuestion(idx, { type: v })}
                        options={QUESTION_TYPE_OPTIONS}
                        placeholder="Question type"
                        className="w-full"
                      />
                    </div>
                    {q.type === 'code' && (
                      <div>
                        <label className="label-ats">Language</label>
                        <input
                          value={q.language}
                          onChange={(e) => updateQuestion(idx, { language: e.target.value })}
                          placeholder="e.g. javascript"
                          className="input-ats"
                        />
                      </div>
                    )}
                    <div className={q.type === 'code' ? '' : 'sm:col-start-3'}>
                      <label className="label-ats">Points</label>
                      <input
                        type="number"
                        min="0"
                        value={q.points}
                        onChange={(e) => updateQuestion(idx, { points: Number(e.target.value) })}
                        placeholder="10"
                        className="input-ats"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label-ats">Prompt</label>
                    <textarea
                      value={q.prompt}
                      onChange={(e) => updateQuestion(idx, { prompt: e.target.value })}
                      placeholder="Write the question candidates will see…"
                      rows={2}
                      className="textarea-ats !min-h-[72px]"
                    />
                  </div>

                  {q.type === 'multiple_choice' && (
                    <div className="space-y-2">
                      <label className="label-ats !mb-1">
                        Options
                        <span className="text-[11px] font-medium text-stone-400 ml-1.5">
                          Select the correct answer
                        </span>
                      </label>
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`q-${idx}-correct`}
                            checked={q.correctOptionIndex === oIdx}
                            onChange={() => updateQuestion(idx, { correctOptionIndex: oIdx })}
                            className="text-brand-600 focus:ring-brand-500/30 flex-shrink-0"
                            title="Mark as correct"
                            aria-label={`Mark option ${oIdx + 1} as correct`}
                          />
                          <input
                            value={opt}
                            onChange={(e) => updateOption(idx, oIdx, e.target.value)}
                            placeholder={`Option ${oIdx + 1}`}
                            className="flex-1 input-ats"
                          />
                          {q.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeOption(idx, oIdx)}
                              className={`${actionBtn} text-stone-400 hover:text-red-600 hover:border-red-200 flex-shrink-0`}
                              aria-label={`Remove option ${oIdx + 1}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addOption(idx)}
                        className="text-xs text-brand-600 font-semibold hover:text-brand-700 inline-flex items-center gap-1"
                      >
                        <Plus size={12} /> Add option
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  );
};
