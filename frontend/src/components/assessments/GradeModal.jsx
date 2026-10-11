import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../../utils/fetchUtils';
import { useToast } from '../Toast';
import Modal from '../ui/Modal';

export const GradeModal = ({ invite, open, onClose, onGraded }) => {
  const toast = useToast();
  const [scores, setScores] = useState({});
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const assessment = invite?.assessmentId;
  const questions = invite?.snapshot?.questions || assessment?.questions || [];

  useEffect(() => {
    if (open && invite) {
      setFeedback(invite.feedback || '');
      setScores({});
    }
  }, [open, invite]);

  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState(invite?.aiSuggestion || null);

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
        toast?.error?.(data.message || 'AI suggestion unavailable');
        return;
      }
      setSuggestion(data.data);
      toast?.success?.('Suggestion ready — review and confirm scores. Nothing is finalized yet.');
    } catch (err) {
      toast?.error?.(err?.message || 'AI suggestion unavailable');
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
      closeOnBackdrop={false}
      footer={
        <>
          <button type="button" onClick={askAi} className="btn-secondary" disabled={suggesting}>
            {suggesting ? 'Suggesting…' : 'AI suggest'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save Grade'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {Array.isArray(invite?.skillBreakdown) && invite.skillBreakdown.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {invite.skillBreakdown.map((row) => (
              <span key={row.skill} className="badge-neutral text-[11px]">{row.skill}: {row.earned}/{row.max}</span>
            ))}
          </div>
        )}
        {suggestion?.pendingHuman && (
          <div className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-900">
            AI suggested scores for review only. Apply them, then save to finalize.
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
