import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, ListChecks, Shield, Loader2, ClipboardList, Briefcase } from 'lucide-react';
import Modal from '../ui/Modal';
import PremiumSelect from '../ui/PremiumSelect';
import { authenticatedFetch } from '../../utils/fetchUtils';
import { useAuth } from '../../context/AuthContext';
import {
  emptyQuestion, QUESTION_TYPE_OPTIONS, STRICTNESS_OPTIONS, actionBtn, defaultRules,
} from './assessmentsConstants';

const FALLBACK_STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];

function parseJobsPayload(payload) {
  if (Array.isArray(payload)) return { jobs: payload, pipelineStages: [] };
  if (payload && Array.isArray(payload.jobs)) {
    return { jobs: payload.jobs, pipelineStages: payload.pipelineStages || [] };
  }
  return { jobs: [], pipelineStages: [] };
}

function pickInviteStage(stages, preferred) {
  const list = stages.filter(Boolean);
  if (preferred && list.includes(preferred)) return preferred;
  const match = list.find((stage) => /assess|test|screen|technical|shortlist/i.test(stage));
  return match || list[0] || preferred || '';
}

function pickAdvanceStage(stages, from, preferred) {
  const list = stages.filter(Boolean);
  if (preferred && preferred !== from && (list.includes(preferred) || !list.length)) return preferred;
  const skip = /reject|hired|joined|dropped|withdraw/i;
  const idx = list.findIndex((stage) => stage === from);
  const next = list.slice(Math.max(idx, 0) + 1).find((stage) => !skip.test(stage));
  const interview = list.find((stage) => /interview/i.test(stage) && stage !== from);
  return next || interview || list.find((stage) => !skip.test(stage) && stage !== from) || preferred || '';
}

export const BuilderModal = ({ open, onClose, onSave, saving, canProctor, initial }) => {
  const { organization } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [proctoringEnabled, setProctoringEnabled] = useState(false);
  const [strictness, setStrictness] = useState('standard');
  const [instructions, setInstructions] = useState('');
  const [rules, setRules] = useState(defaultRules());
  const [jobId, setJobId] = useState('');
  const [pipelineStage, setPipelineStage] = useState('');
  const [advanceStage, setAdvanceStage] = useState('');
  const [jobs, setJobs] = useState([]);
  const [orgStages, setOrgStages] = useState(FALLBACK_STAGES);
  const [jobsLoading, setJobsLoading] = useState(false);
  const editing = Boolean(initial?._id);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title || '');
    setDescription(initial?.description || '');
    setInstructions(initial?.candidateInstructions || '');
    setDurationMinutes(initial?.durationMinutes || 45);
    setRules(defaultRules(initial));
    const loaded = (initial?.questions || []).map((question) => ({
      _id: question._id,
      type: question.type || 'text',
      prompt: question.prompt || '',
      options: question.options?.length ? question.options : ['', ''],
      correctOptionIndex: question.correctOptionIndex || 0,
      points: question.points ?? 10,
      language: question.language || '',
      required: question.required !== false,
      skillTag: question.skillTag || '',
      section: question.section || '',
      rubric: question.rubric || '',
      hiddenTests: question.hiddenTests?.length ? question.hiddenTests : [{ name: '', input: '', expected: '' }],
      visibleTests: question.visibleTests?.length ? question.visibleTests : [{ name: 'Sample', input: '', expected: '' }],
    }));
    setQuestions(loaded.length ? loaded : [emptyQuestion()]);
    setProctoringEnabled(Boolean(initial?.proctoring?.enabled));
    setStrictness(initial?.proctoring?.strictness || 'standard');
    setJobId(initial?.jobId?._id || initial?.jobId || '');
    setPipelineStage(initial?.pipelineStage || '');
    setAdvanceStage(initial?.advanceStage || '');
    setJobsLoading(true);
    authenticatedFetch('/api/assessments/jobs')
      .then((res) => res.json())
      .then((data) => {
        const parsed = parseJobsPayload(data.success ? data.data : null);
        setJobs(parsed.jobs);
        const fromOrg = organization?.atsSettings?.pipelineStages;
        const stages = parsed.pipelineStages.length
          ? parsed.pipelineStages
          : (Array.isArray(fromOrg) && fromOrg.length ? fromOrg : FALLBACK_STAGES);
        setOrgStages(stages);
      })
      .catch(() => {
        const fromOrg = organization?.atsSettings?.pipelineStages;
        setOrgStages(Array.isArray(fromOrg) && fromOrg.length ? fromOrg : FALLBACK_STAGES);
      })
      .finally(() => setJobsLoading(false));
  }, [open, initial, organization?.atsSettings?.pipelineStages]);

  const selectedJob = useMemo(
    () => jobs.find((job) => String(job._id) === String(jobId)),
    [jobs, jobId]
  );

  const stages = useMemo(() => {
    const jobStages = selectedJob?.pipelineStages;
    const list = Array.isArray(jobStages) && jobStages.length ? jobStages : orgStages;
    return list.map((stage) => String(stage || '').trim()).filter(Boolean);
  }, [selectedJob, orgStages]);

  const stageSelectOptions = useMemo(() => {
    const values = [...stages];
    [pipelineStage, advanceStage].forEach((stage) => {
      if (stage && !values.includes(stage)) values.push(stage);
    });
    return values.map((stage) => ({ value: stage, label: stage }));
  }, [stages, pipelineStage, advanceStage]);

  useEffect(() => {
    if (!open || !stages.length) return;
    setPipelineStage((current) => {
      const from = pickInviteStage(stages, current);
      setAdvanceStage((adv) => pickAdvanceStage(stages, from, adv));
      return from;
    });
  }, [open, stages, jobId]);

  const applyJob = (nextId) => {
    const id = nextId || '';
    setJobId(id);
    const job = jobs.find((row) => String(row._id) === String(id));
    const list = (Array.isArray(job?.pipelineStages) && job.pipelineStages.length ? job.pipelineStages : orgStages)
      .map((stage) => String(stage || '').trim())
      .filter(Boolean);
    const from = pickInviteStage(list, '');
    setPipelineStage(from);
    setAdvanceStage(pickAdvanceStage(list, from, ''));
  };

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

  const valid = title.trim() && questions.length > 0 && questions.every((q) => {
    if (!q.prompt.trim()) return false;
    if (q.type !== 'multiple_choice') return true;
    return q.options.filter((option) => String(option || '').trim()).length >= 2;
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit assessment' : 'Create assessment'}
      description={editing
        ? 'Changes apply to the working copy. Candidates who have already started keep the version they received.'
        : 'Create an assessment, attach it to a requisition, then invite candidates from the selected pipeline stage.'}
      size="xl"
      icon={ClipboardList}
      closeOnBackdrop={false}
      fillHeight
      disableFocusLock
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancel</button>
          <button
            type="button"
            onClick={() => onSave({
              title,
              description,
              candidateInstructions: instructions,
              durationMinutes,
              questions,
              rules,
              jobId: jobId || null,
              pipelineStage,
              advanceStage,
              proctoring: canProctor ? { enabled: proctoringEnabled, strictness } : { enabled: false }
            })}
            disabled={saving || !valid}
            className="btn-primary"
          >
            {saving
              ? <><Loader2 size={16} className="animate-spin" /> Saving…</>
              : editing
                ? 'Save changes'
                : <><Plus size={16} /> Create assessment</>}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <section className="space-y-4">
          <h3 className="section-title-ats !mb-0">
            <ClipboardList className="w-4 h-4 text-brand-600" />
            Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label-ats">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-ats"
                placeholder="Assessment title"
                autoFocus
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label-ats">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="textarea-ats !min-h-[72px]"
                placeholder="Optional summary of what this assessment evaluates"
                rows={2}
              />
            </div>
            <div className="sm:col-span-2 rounded-xl border border-stone-200/90 bg-stone-50/50 p-3.5 sm:p-4 space-y-3">
              <p className="text-xs font-semibold text-stone-600">Pipeline</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label-ats">Attach to job</label>
                  <PremiumSelect
                    variant="list"
                    compact
                    searchable
                    allowClear
                    loading={jobsLoading}
                    value={jobId}
                    onChange={(v) => applyJob(v)}
                    placeholder="Select a requisition"
                    emptyLabel="No requisitions available"
                    searchPlaceholder="Search jobs"
                    className="w-full"
                    icon={Briefcase}
                    options={jobs.map((job) => ({
                      value: job._id,
                      label: job.title || job.role || 'Untitled job',
                      description: [job.jobCode, job.status].filter(Boolean).join(' · '),
                    }))}
                  />
                </div>
                <div>
                  <label className="label-ats">Invite from stage</label>
                  <PremiumSelect
                    variant="list"
                    compact
                    searchable
                    value={pipelineStage}
                    onChange={(v) => {
                      const from = v || '';
                      setPipelineStage(from);
                      setAdvanceStage((current) => pickAdvanceStage(stages, from, current));
                    }}
                    placeholder="Select stage"
                    emptyLabel="No pipeline stages"
                    searchPlaceholder="Search stages"
                    className="w-full"
                    options={stageSelectOptions}
                  />
                </div>
                <div>
                  <label className="label-ats">Advance qualified to</label>
                  <PremiumSelect
                    variant="list"
                    compact
                    searchable
                    allowClear
                    value={advanceStage}
                    onChange={(v) => setAdvanceStage(v || '')}
                    placeholder="Select stage"
                    emptyLabel="No pipeline stages"
                    searchPlaceholder="Search stages"
                    className="w-full"
                    options={stageSelectOptions.filter((opt) => opt.value !== pipelineStage)}
                  />
                </div>
              </div>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                Stages are loaded from the selected job, or from your organization pipeline when no job is attached.
              </p>
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
            <div className="sm:col-span-2">
              <label className="label-ats">Candidate instructions</label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="textarea-ats !min-h-[72px]"
                placeholder="What they should know before starting — permitted resources, ID checks, honour code"
                rows={2}
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="section-title-ats !mb-0">Scoring and attempt rules</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label-ats">Passing score %</label>
              <input type="number" min="0" max="100" value={rules.passingScorePercent} onChange={(e) => setRules((r) => ({ ...r, passingScorePercent: Number(e.target.value) }))} className="input-ats" />
            </div>
            <div>
              <label className="label-ats">Negative mark %</label>
              <input type="number" min="0" max="100" value={rules.negativeMarkPercent} onChange={(e) => setRules((r) => ({ ...r, negativeMarkPercent: Number(e.target.value) }))} className="input-ats" />
            </div>
            <div>
              <label className="label-ats">Max attempts</label>
              <input type="number" min="1" max="5" value={rules.maxAttempts} onChange={(e) => setRules((r) => ({ ...r, maxAttempts: Number(e.target.value) }))} className="input-ats" />
            </div>
            <div>
              <label className="label-ats">Candidate results</label>
              <PremiumSelect
                variant="list"
                compact
                value={rules.resultVisibility}
                onChange={(v) => setRules((r) => ({ ...r, resultVisibility: v || 'hidden' }))}
                className="w-full"
                options={[
                  { value: 'hidden', label: 'Hidden until you share' },
                  { value: 'score', label: 'Score only' },
                  { value: 'detailed', label: 'Score and feedback' },
                ]}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-stone-700">
            {[
              ['randomizeQuestions', 'Randomize question order per attempt'],
              ['allowBack', 'Allow going back to previous questions'],
              ['requireAll', 'Require all mandatory questions'],
              ['autoSubmit', 'Auto-submit when time expires'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input type="checkbox" checked={!!rules[key]} onChange={(e) => setRules((r) => ({ ...r, [key]: e.target.checked }))} />
                {label}
              </label>
            ))}
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="label-ats">Section</label>
                      <input value={q.section} onChange={(e) => updateQuestion(idx, { section: e.target.value })} className="input-ats" placeholder="e.g. Aptitude" />
                    </div>
                    <div>
                      <label className="label-ats">Skill tag</label>
                      <input value={q.skillTag} onChange={(e) => updateQuestion(idx, { skillTag: e.target.value })} className="input-ats" placeholder="e.g. React" />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-stone-700 sm:pt-6">
                      <input type="checkbox" checked={q.required !== false} onChange={(e) => updateQuestion(idx, { required: e.target.checked })} />
                      Required
                    </label>
                  </div>
                  {q.type !== 'multiple_choice' && (
                    <div>
                      <label className="label-ats">Evaluator rubric</label>
                      <textarea value={q.rubric} onChange={(e) => updateQuestion(idx, { rubric: e.target.value })} rows={2} className="textarea-ats !min-h-[56px]" placeholder="Scoring criteria for reviewers only — never shown to candidates" />
                    </div>
                  )}
                  {q.type === 'code' && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-stone-500">Visible sample tests (input only is shown to the candidate)</p>
                      {(q.visibleTests || []).map((t, tIdx) => (
                        <div key={`v-${tIdx}`} className="grid grid-cols-3 gap-2">
                          <input className="input-ats" placeholder="Name" value={t.name} onChange={(e) => updateQuestion(idx, { visibleTests: q.visibleTests.map((row, i) => i === tIdx ? { ...row, name: e.target.value } : row) })} />
                          <input className="input-ats" placeholder="Input" value={t.input} onChange={(e) => updateQuestion(idx, { visibleTests: q.visibleTests.map((row, i) => i === tIdx ? { ...row, input: e.target.value } : row) })} />
                          <input className="input-ats" placeholder="Expected (hidden from take page)" value={t.expected} onChange={(e) => updateQuestion(idx, { visibleTests: q.visibleTests.map((row, i) => i === tIdx ? { ...row, expected: e.target.value } : row) })} />
                        </div>
                      ))}
                      <p className="text-xs font-semibold text-stone-500">Hidden tests (never sent to the browser)</p>
                      {(q.hiddenTests || []).map((t, tIdx) => (
                        <div key={`h-${tIdx}`} className="grid grid-cols-3 gap-2">
                          <input className="input-ats" placeholder="Name" value={t.name} onChange={(e) => updateQuestion(idx, { hiddenTests: q.hiddenTests.map((row, i) => i === tIdx ? { ...row, name: e.target.value } : row) })} />
                          <input className="input-ats" placeholder="Input" value={t.input} onChange={(e) => updateQuestion(idx, { hiddenTests: q.hiddenTests.map((row, i) => i === tIdx ? { ...row, input: e.target.value } : row) })} />
                          <input className="input-ats" placeholder="Expected" value={t.expected} onChange={(e) => updateQuestion(idx, { hiddenTests: q.hiddenTests.map((row, i) => i === tIdx ? { ...row, expected: e.target.value } : row) })} />
                        </div>
                      ))}
                    </div>
                  )}

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
