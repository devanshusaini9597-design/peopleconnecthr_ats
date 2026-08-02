import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Plus, Trash2, Lock, Loader2, Send, ArrowLeft, Clock, FileEdit, Search, AlertCircle, RefreshCw, Type, Code2, ListChecks } from 'lucide-react';
import { authenticatedFetch, handleUnauthorized, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import Modal from './ui/Modal';
import ConfirmationModal from './ConfirmationModal';
import PremiumSelect from './ui/PremiumSelect';

const emptyQuestion = () => ({ type: 'text', prompt: '', options: ['', ''], correctOptionIndex: 0, points: 10, language: '' });

const QUESTION_TYPE_OPTIONS = [
  { value: 'text', label: 'Free text', description: 'Open written answer', icon: Type },
  { value: 'code', label: 'Code', description: 'Code snippet answer', icon: Code2 },
  { value: 'multiple_choice', label: 'Multiple choice', description: 'Pick one correct option', icon: ListChecks },
];

const STATUS_BADGE = {
  pending: 'badge-neutral',
  in_progress: 'badge-brand',
  submitted: 'badge-warning',
  graded: 'badge-success',
  expired: 'badge-danger'
};

const BuilderModal = ({ open, onClose, onSave, saving }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [questions, setQuestions] = useState([emptyQuestion()]);

  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setDurationMinutes(45);
      setQuestions([emptyQuestion()]);
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
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            type="button"
            onClick={() => onSave({ title, description, durationMinutes, questions })}
            disabled={saving || !valid}
            className="btn-primary"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : 'Create Assessment'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="label-ats">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-ats" placeholder="e.g. React Fundamentals" />
          </div>
          <div className="sm:col-span-2">
            <label className="label-ats">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="input-ats" placeholder="Optional" />
          </div>
          <div>
            <label className="label-ats">Duration (minutes)</label>
            <input type="number" min="5" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="input-ats" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-bold text-stone-900">Questions</label>
            <button
              type="button"
              onClick={() => setQuestions((qs) => [...qs, emptyQuestion()])}
              className="text-sm text-brand-600 font-semibold hover:text-brand-700 transition-colors"
            >
              + Add question
            </button>
          </div>

          {questions.map((q, idx) => (
            <div key={idx} className="rounded-2xl border border-stone-200 p-4 space-y-3 bg-stone-50/60 hover:border-brand-200/60 transition-colors">
              <div className="flex items-center justify-between">
                <span className="badge-brand">Question {idx + 1}</span>
                {questions.length > 1 && (
                  <button type="button" onClick={() => removeQuestion(idx)} className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <PremiumSelect
                  compact
                  value={q.type}
                  onChange={(v) => updateQuestion(idx, { type: v })}
                  options={QUESTION_TYPE_OPTIONS}
                  placeholder="Question type"
                  icon={ListChecks}
                  className="w-full"
                />
                {q.type === 'code' && (
                  <input
                    value={q.language}
                    onChange={(e) => updateQuestion(idx, { language: e.target.value })}
                    placeholder="Language (e.g. javascript)"
                    className="input-ats !py-2"
                  />
                )}
                <input
                  type="number"
                  min="0"
                  value={q.points}
                  onChange={(e) => updateQuestion(idx, { points: Number(e.target.value) })}
                  placeholder="Points"
                  className="input-ats !py-2"
                />
              </div>
              <textarea
                value={q.prompt}
                onChange={(e) => updateQuestion(idx, { prompt: e.target.value })}
                placeholder="Question prompt"
                rows={2}
                className="textarea-ats"
              />
              {q.type === 'multiple_choice' && (
                <div className="space-y-1.5">
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={q.correctOptionIndex === oIdx}
                        onChange={() => updateQuestion(idx, { correctOptionIndex: oIdx })}
                        className="text-brand-600 focus:ring-brand-500/30"
                      />
                      <input
                        value={opt}
                        onChange={(e) => updateOption(idx, oIdx, e.target.value)}
                        placeholder={`Option ${oIdx + 1}`}
                        className="flex-1 input-ats !py-2"
                      />
                    </div>
                  ))}
                  <button type="button" onClick={() => addOption(idx)} className="text-xs text-brand-600 font-semibold hover:text-brand-700">
                    + Add option
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};

const InviteModal = ({ assessment, open, onClose, onSent }) => {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handle = setTimeout(async () => {
      if (!query.trim()) { setResults([]); return; }
      try {
        const res = await authenticatedFetch(`/candidates?search=${encodeURIComponent(query.trim())}&limit=10`);
        const data = await res.json();
        if (data.success) setResults(data.data || []);
      } catch { /* best-effort */ }
    }, 350);
    return () => clearTimeout(handle);
  }, [query, open]);

  const handleInvite = async (candidate) => {
    setSending(true);
    try {
      const res = await authenticatedFetch(`/api/assessments/${assessment._id}/invite`, {
        method: 'POST',
        body: JSON.stringify({ candidateId: candidate._id })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to send invite');
        return;
      }
      toast?.success?.(`Invite sent to ${candidate.name}`);
      onSent();
      onClose();
    } catch {
      toast?.error?.('Failed to send invite');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite a candidate"
      description={`Send “${assessment.title}” to a candidate in your database.`}
      size="md"
    >
      <div className="relative">
        <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search candidates…"
          className="input-ats !pl-9"
          autoFocus
        />
      </div>
      <div className="mt-3 max-h-64 overflow-y-auto space-y-0.5">
        {results.length === 0 ? (
          <EmptyState
            icon={Search}
            tone={query ? 'amber' : 'sky'}
            compact
            message={query ? 'No candidates found' : 'Search candidates'}
            subMessage={query ? 'Try a different name or email.' : 'Start typing a name or email.'}
          />
        ) : results.map((c) => (
          <button
            key={c._id}
            type="button"
            onClick={() => handleInvite(c)}
            disabled={sending}
            className="list-row-ats w-full text-left justify-between disabled:opacity-50"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {(c.name || 'N')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-stone-900 truncate">{c.name}</div>
                <div className="text-xs text-stone-500 truncate">{c.email}</div>
              </div>
            </div>
            {sending ? <Loader2 className="w-4 h-4 text-brand-600 animate-spin" /> : <Send className="w-4 h-4 text-brand-600" />}
          </button>
        ))}
      </div>
    </Modal>
  );
};

const GradeModal = ({ invite, open, onClose, onGraded }) => {
  const toast = useToast();
  const [scores, setScores] = useState({});
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const assessment = invite?.assessmentId;

  useEffect(() => {
    if (open && invite) {
      setFeedback(invite.feedback || '');
      setScores({});
    }
  }, [open, invite]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authenticatedFetch(`/api/assessments/invites/${invite._id}/grade`, {
        method: 'POST',
        body: JSON.stringify({
          scores: Object.entries(scores).map(([questionId, manualScore]) => ({ questionId, manualScore: Number(manualScore) })),
          feedback
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to save grade');
        return;
      }
      toast?.success?.('Grade saved');
      onGraded();
      onClose();
    } catch {
      toast?.error?.('Failed to save grade');
    } finally {
      setSaving(false);
    }
  };

  if (!invite) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${invite.candidateId?.name}'s submission`}
      description={assessment?.title}
      size="xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save Grade'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {(assessment?.questions || []).map((q) => {
          const answer = invite.answers?.find((a) => a.questionId === q._id);
          return (
            <div key={q._id} className="rounded-2xl border border-stone-200 p-4 bg-stone-50/40">
              <p className="text-sm font-semibold text-stone-900">
                {q.prompt}{' '}
                <span className="text-xs font-medium text-stone-400">({q.points} pts)</span>
              </p>
              {q.type === 'multiple_choice' ? (
                <p className="text-sm text-stone-600 mt-2">
                  Selected: {q.options?.[Number(answer?.response)] ?? '—'} · Auto-graded: {answer?.autoScore ?? 0}/{q.points}
                </p>
              ) : (
                <>
                  <pre className="text-sm text-stone-700 mt-2 whitespace-pre-wrap bg-white p-3 rounded-xl border border-stone-100">{answer?.response || '(no answer)'}</pre>
                  <div className="flex items-center gap-2 mt-3">
                    <label className="label-ats !mb-0">Score</label>
                    <input
                      type="number"
                      min="0"
                      max={q.points}
                      defaultValue={answer?.manualScore ?? ''}
                      onChange={(e) => setScores((s) => ({ ...s, [q._id]: e.target.value }))}
                      className="w-24 input-ats !py-1.5"
                    />
                    <span className="text-xs text-stone-400">/ {q.points}</span>
                  </div>
                </>
              )}
            </div>
          );
        })}
        <div>
          <label className="label-ats">Overall feedback</label>
          <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} className="textarea-ats" />
        </div>
      </div>
    </Modal>
  );
};

const AssessmentDetail = ({ assessment, onBack, toast }) => {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [gradingInvite, setGradingInvite] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`/api/assessments/invites?assessmentId=${assessment._id}`);
      const data = await res.json();
      if (data.success) setInvites(data.data || []);
    } finally {
      setLoading(false);
    }
  }, [assessment._id]);

  useEffect(() => { load(); }, [load]);

  const openGrade = async (invite) => {
    const res = await authenticatedFetch(`/api/assessments/invites/${invite._id}`);
    const data = await res.json();
    if (data.success) setGradingInvite(data.data);
  };

  return (
    <div className="space-y-6 animate-page-enter">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to assessments
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3 sm:gap-4 min-w-0">
          <div className="icon-box-ats !w-12 !h-12">
            <ClipboardList strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight" style={{ letterSpacing: '-0.025em' }}>
              {assessment.title}
            </h2>
            <p className="text-sm text-stone-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5" /> {assessment.questions.length} questions</span>
              <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {assessment.durationMinutes} min</span>
              <span className="badge-neutral">{assessment.maxScore} pts max</span>
            </p>
          </div>
        </div>
        <button type="button" onClick={() => setShowInvite(true)} className="btn-primary w-full sm:w-auto">
          <Send className="w-4 h-4" /> Invite Candidate
        </button>
      </div>

      <div className="table-shell-ats">
        {loading ? (
          <div className="p-12 flex flex-col items-center gap-2">
            <Loader2 className="w-7 h-7 text-brand-600 animate-spin" />
            <p className="text-sm text-stone-500 font-medium">Loading invites…</p>
          </div>
        ) : invites.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            tone="sky"
            message="No invites sent yet"
            subMessage="Invite a candidate to take this assessment."
            action={
              <button type="button" onClick={() => setShowInvite(true)} className="btn-primary">
                <Send className="w-4 h-4" /> Invite Candidate
              </button>
            }
          />
        ) : (
          <div className="divide-y divide-stone-100">
            {invites.map((inv) => (
              <div key={inv._id} className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-brand-50/20 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {(inv.candidateId?.name || 'N')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-stone-900 truncate">{inv.candidateId?.name}</div>
                    <div className="text-sm text-stone-500 truncate">{inv.candidateId?.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  {inv.totalScore !== undefined && inv.totalScore !== null && (
                    <span className="text-sm font-semibold text-stone-700 tabular-nums">
                      {inv.totalScore}/{inv.maxScore || assessment.maxScore}
                    </span>
                  )}
                  <span className={STATUS_BADGE[inv.status] || 'badge-neutral'}>
                    {String(inv.status || '').replace('_', ' ')}
                  </span>
                  {(inv.status === 'submitted' || inv.status === 'graded') && (
                    <button
                      type="button"
                      onClick={() => openGrade(inv)}
                      className="p-2.5 hover:bg-brand-50 rounded-xl text-brand-600 transition-colors touch-target"
                      title="Review & grade"
                    >
                      <FileEdit className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <InviteModal assessment={assessment} open={showInvite} onClose={() => setShowInvite(false)} onSent={load} />
      <GradeModal
        invite={gradingInvite}
        open={!!gradingInvite}
        onClose={() => setGradingInvite(null)}
        onGraded={load}
      />
    </div>
  );
};

const AssessmentsPage = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [assessments, setAssessments] = useState([]);
  const [query, setQuery] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await authenticatedFetch('/api/assessments');
      if (res.status === 401) return handleUnauthorized();
      const data = await readApiJson(res);
      if (res.status === 403 && data.code === 'UPGRADE_REQUIRED') {
        setUpgradeRequired(true);
        return;
      }
      if (!res.ok || !data.success) {
        setLoadError(data.message || 'Failed to load assessments');
        setAssessments([]);
        return;
      }
      setAssessments(data.data || []);
    } catch (err) {
      setLoadError(err?.message || 'Failed to load assessments');
      setAssessments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = assessments.filter((a) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (a.title || '').toLowerCase().includes(q) ||
      (a.description || '').toLowerCase().includes(q)
    );
  });

  const handleCreate = async (form) => {
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/assessments', { method: 'POST', body: JSON.stringify(form) });
      const data = await readApiJson(res);
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to create assessment');
        return;
      }
      toast?.success?.('Assessment created');
      setShowBuilder(false);
      load();
    } catch (err) {
      toast?.error?.(err?.message || 'Failed to create assessment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authenticatedFetch(`/api/assessments/${deleteTarget._id}`, { method: 'DELETE' });
      const data = await readApiJson(res);
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Failed to delete');
        return;
      }
      toast?.success?.('Assessment deleted');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast?.error?.(err?.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell-ats">
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-9 h-9 text-brand-600 animate-spin" />
          <p className="text-sm font-medium text-stone-500">Loading assessments…</p>
        </div>
      </div>
    );
  }

  if (upgradeRequired) {
    return (
      <div className="page-shell-ats">
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center card-ats-bordered border-amber-200/80 bg-amber-50/40 p-8 sm:p-10 animate-slide-up">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4 ring-4 ring-amber-100/60">
              <Lock className="w-7 h-7 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">Assessments is a Professional feature</h2>
            <p className="text-stone-500 mt-2 text-sm leading-relaxed">
              Upgrade to Professional to build skills tests and invite candidates to complete them.
            </p>
            <a href="/billing" className="btn-primary inline-flex mt-6">View Plans</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-ats">
      {active ? (
        <AssessmentDetail assessment={active} onBack={() => setActive(null)} toast={toast} />
      ) : (
        <>
          <PageHeader
            icon={ClipboardList}
            title="Assessments"
            subtitle="Build skills tests and invite candidates to complete them. Code answers are graded by your team."
            gradientTitle
          >
            <button type="button" onClick={() => setShowBuilder(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> New Assessment
            </button>
          </PageHeader>

          {loadError ? (
            <div className="card-ats-bordered border-red-200/80 bg-red-50/30">
              <EmptyState
                icon={AlertCircle}
                tone="amber"
                message="Couldn’t load assessments"
                subMessage={loadError}
                action={
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button type="button" onClick={load} className="btn-secondary">
                      <RefreshCw className="w-4 h-4" /> Retry
                    </button>
                    <button type="button" onClick={() => setShowBuilder(true)} className="btn-primary">
                      <Plus className="w-4 h-4" /> New Assessment
                    </button>
                  </div>
                }
              />
            </div>
          ) : assessments.length === 0 ? (
            <div className="card-ats-bordered">
              <EmptyState
                icon={ClipboardList}
                tone="violet"
                message="No assessments yet"
                subMessage="Create a skills test and invite candidates to take it."
                action={
                  <button type="button" onClick={() => setShowBuilder(true)} className="btn-primary">
                    <Plus className="w-4 h-4" /> New Assessment
                  </button>
                }
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search assessments…"
                    className="input-ats !pl-9"
                  />
                </div>
                <p className="text-sm font-medium text-stone-500 sm:ml-auto">
                  {filtered.length} assessment{filtered.length === 1 ? '' : 's'}
                </p>
              </div>

              {filtered.length === 0 ? (
                <div className="card-ats-bordered">
                  <EmptyState
                    icon={Search}
                    tone="amber"
                    message="No assessments match your search"
                    subMessage="Try a different title or clear the search."
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
                  {filtered.map((a) => (
                    <div
                      key={a._id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setActive(a)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActive(a); }}
                      className="card-ats p-5 cursor-pointer group hover:border-brand-200/80 relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
                      <div className="flex items-start justify-between gap-2">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-100 to-teal-100 border border-brand-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                          <ClipboardList className="w-5 h-5 text-brand-600" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(a); }}
                          className="p-2 hover:bg-red-50 rounded-xl text-stone-300 hover:text-red-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                          aria-label="Delete assessment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <h3 className="font-bold text-stone-900 mt-3.5 tracking-tight line-clamp-2">{a.title}</h3>
                      {a.description && (
                        <p className="text-sm text-stone-500 mt-1 line-clamp-2 leading-relaxed">{a.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-stone-100 text-xs font-semibold text-stone-500">
                        <span className="inline-flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5" /> {a.questions?.length || 0} questions</span>
                        <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {a.durationMinutes} min</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <BuilderModal open={showBuilder} onClose={() => setShowBuilder(false)} onSave={handleCreate} saving={saving} />
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete assessment?"
        message={`Delete “${deleteTarget?.title}”? All invites for it will be removed too.`}
        confirmText="Delete"
        type="delete"
        isLoading={deleting}
      />
    </div>
  );
};

export default AssessmentsPage;
