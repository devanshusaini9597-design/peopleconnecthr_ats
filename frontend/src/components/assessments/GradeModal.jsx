import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../../utils/fetchUtils';
import { useToast } from '../Toast';
import Modal from '../ui/Modal';
import ConfirmationModal from '../ConfirmationModal';
import IntegrityPanel from './IntegrityPanel';

function optionLabel(question, index) {
  if (index == null || Number.isNaN(Number(index))) return null;
  return question.options?.[Number(index)] ?? null;
}

function McqResult({ question, answer }) {
  const selectedIndex = answer?.response === '' || answer?.response == null ? null : Number(answer.response);
  const selected = optionLabel(question, selectedIndex);
  const correctIndex = Number.isFinite(Number(question.correctOptionIndex)) ? Number(question.correctOptionIndex) : null;
  const correct = optionLabel(question, correctIndex);
  const points = Number(question.points) || 0;
  const autoScore = Number(answer?.autoScore ?? 0);
  const unanswered = selectedIndex == null || Number.isNaN(selectedIndex);
  const isCorrect = unanswered
    ? false
    : (correctIndex != null ? selectedIndex === correctIndex : autoScore >= points && points > 0);

  if (unanswered) {
    return (
      <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5">
        <p className="text-xs font-bold uppercase tracking-wider text-stone-400">No answer submitted</p>
        {correct ? <p className="text-sm text-stone-600 mt-1">Correct answer: {correct}</p> : null}
      </div>
    );
  }

  return (
    <div className={`mt-3 rounded-xl border px-3 py-2.5 ${
      isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'
    }`}>
      <div className="flex items-center gap-2">
        {isCorrect
          ? <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
          : <XCircle size={16} className="text-rose-600 flex-shrink-0" />}
        <span className={`text-sm font-bold ${isCorrect ? 'text-emerald-800' : 'text-rose-800'}`}>
          {isCorrect ? 'Correct' : 'Incorrect'}
        </span>
        <span className={`ml-auto text-xs font-semibold tabular-nums ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
          {autoScore}/{points} pts
        </span>
      </div>
      <p className={`text-sm mt-1.5 ${isCorrect ? 'text-emerald-900' : 'text-rose-900'}`}>
        Selected: {selected || '—'}
      </p>
      {!isCorrect && correct ? (
        <p className="text-sm text-emerald-800 mt-1 font-medium">Correct answer: {correct}</p>
      ) : null}
    </div>
  );
}

export const GradeModal = ({ invite: inviteProp, open, onClose, onGraded }) => {
  const toast = useToast();
  const [invite, setInvite] = useState(inviteProp);
  const [scores, setScores] = useState({});
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const assessment = invite?.assessmentId;
  const questions = invite?.snapshot?.questions || assessment?.questions || [];

  const refreshInvite = useCallback(async (silent = false) => {
    if (!inviteProp?._id) return;
    try {
      const res = await authenticatedFetch(`/api/assessments/invites/${inviteProp._id}`);
      const data = await readApiJson(res);
      if (res.ok && data.success) setInvite(data.data);
    } catch {
      if (!silent) { /* keep last known */ }
    }
  }, [inviteProp?._id]);

  useEffect(() => {
    if (open && inviteProp) {
      setInvite(inviteProp);
      setFeedback(inviteProp.feedback || '');
      setScores({});
      setConfirmSave(false);
      refreshInvite(true);
    }
  }, [open, inviteProp, refreshInvite]);

  useEffect(() => {
    if (!open || !inviteProp?._id) return undefined;
    const timer = setInterval(() => refreshInvite(true), 4000);
    return () => clearInterval(timer);
  }, [open, inviteProp?._id, refreshInvite]);

  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState(inviteProp?.aiSuggestion || null);

  const applySuggestion = () => {
    const items = suggestion?.items || [];
    const next = {};
    items.forEach((item) => { if (item.questionId) next[item.questionId] = item.suggestedScore; });
    setScores((s) => ({ ...s, ...next }));
  };

  const askAi = async () => {
    setSuggesting(true);
    try {
      const res = await authenticatedFetch(`/api/assessments/invites/${invite._id}/ai-suggest`, { method: 'POST' });
      const data = await readApiJson(res);
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Suggestion unavailable');
        return;
      }
      setSuggestion(data.data);
      toast?.success?.('Suggestion ready — review and confirm scores. Nothing is finalized yet.');
    } catch (err) {
      toast?.error?.(err?.message || 'Suggestion unavailable');
    } finally {
      setSuggesting(false);
    }
  };

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
      setConfirmSave(false);
    }
  };

  if (!invite) return null;

  const earned = invite.totalScore ?? invite.autoScore ?? 0;
  const max = invite.maxScore || assessment?.maxScore || questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={`${invite.candidateId?.name}'s submission`}
      description={assessment?.title}
      size="xl"
      closeOnBackdrop={false}
      footer={
        <>
          <button type="button" onClick={askAi} className="btn-secondary" disabled={suggesting}>
            {suggesting ? 'Suggesting…' : 'Suggest scores'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="button" onClick={() => setConfirmSave(true)} disabled={saving} className="btn-primary">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save grade'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-sm font-semibold text-stone-700">Overall score</p>
          <p className="text-lg font-bold tabular-nums text-stone-900">{earned}/{max}</p>
        </div>
        <IntegrityPanel inviteId={invite._id} live />
        {Array.isArray(invite?.skillBreakdown) && invite.skillBreakdown.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {invite.skillBreakdown.map((row) => (
              <span key={row.skill} className="badge-neutral text-[11px]">{row.skill}: {row.earned}/{row.max}</span>
            ))}
          </div>
        )}
        {suggestion?.pendingHuman && (
          <div className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-900">
            Suggested scores are for review only. Apply them, then save to finalize.
            <button type="button" className="ml-2 font-bold underline" onClick={applySuggestion}>Apply suggestions</button>
          </div>
        )}
        {questions.map((q) => {
          const answer = invite.answers?.find((a) => String(a.questionId) === String(q._id));
          return (
            <div key={q._id} className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-stone-900">
                {q.prompt}{' '}
                <span className="text-xs font-medium text-stone-400">({q.points} pts{q.skillTag ? ` · ${q.skillTag}` : ''})</span>
              </p>
              {q.rubric ? <p className="text-xs text-stone-500 mt-1">Rubric: {q.rubric}</p> : null}
              {q.type === 'multiple_choice' ? (
                <McqResult question={q} answer={answer} />
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
    <ConfirmationModal
      isOpen={confirmSave}
      onClose={() => { if (!saving) setConfirmSave(false); }}
      onConfirm={handleSave}
      zClass="z-[240]"
      type="success"
      isLoading={saving}
      title="Save this grade?"
      message={`Record the evaluation for ${invite.candidateId?.name || 'this candidate'}. The candidate status will move to graded.`}
      confirmText="Save grade"
    />
    </>
  );
};
