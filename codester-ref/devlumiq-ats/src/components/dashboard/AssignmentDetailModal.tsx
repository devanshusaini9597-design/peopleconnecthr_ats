'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

type BreakdownItem = {
  question: {
    id: string;
    type: string;
    question: string;
    points: number;
    correctAnswer: string | null;
    language: string | null;
  };
  response: {
    id: string;
    answer: string | null;
    codeSubmission: string | null;
    isCorrect: boolean | null;
    pointsEarned: number;
    timeSpent: number | null;
    feedback: string | null;
  } | null;
};

type Props = {
  assignmentId: string | null;
  open: boolean;
  onClose: () => void;
  onGraded?: () => void;
};

export function AssignmentDetailModal({ assignmentId, open, onClose, onGraded }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<{
    assignment: {
      id: string;
      status: string;
      score: number | null;
      maxScore: number | null;
      percentage: number | null;
      passed: boolean | null;
      reviewStatus: string | null;
      feedback: string | null;
      candidate: { id: string; name: string; email: string };
      template: { name: string; passingScore: number; duration: number | null };
      startedAt: string | null;
      submittedAt: string | null;
    };
    breakdown: BreakdownItem[];
  } | null>(null);
  const [grades, setGrades] = useState<Record<string, { pointsEarned: number; feedback: string }>>({});
  const [overallFeedback, setOverallFeedback] = useState('');

  useEffect(() => {
    if (!open || !assignmentId) return;
    setLoading(true);
    setError('');
    fetch(`/api/assessments/assignments/${assignmentId}`, { credentials: 'include' })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || 'Failed to load');
        setData(d);
        setOverallFeedback(d.assignment.feedback || '');
        const g: Record<string, { pointsEarned: number; feedback: string }> = {};
        for (const b of d.breakdown || []) {
          g[b.question.id] = {
            pointsEarned: b.response?.pointsEarned ?? 0,
            feedback: b.response?.feedback || '',
          };
        }
        setGrades(g);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, assignmentId]);

  if (!open) return null;

  const needsManual = (type: string, isCorrect: boolean | null | undefined) =>
    isCorrect === null || isCorrect === undefined
      ? true
      : /open|personality|custom|^language$/i.test(type);

  const saveGrades = async () => {
    if (!assignmentId || !data) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        feedback: overallFeedback,
        grades: data.breakdown
          .filter((b) => needsManual(b.question.type, b.response?.isCorrect))
          .map((b) => ({
            questionId: b.question.id,
            pointsEarned: grades[b.question.id]?.pointsEarned ?? 0,
            feedback: grades[b.question.id]?.feedback || '',
          })),
      };
      const res = await fetch(`/api/assessments/assignments/${assignmentId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Save failed');
      onGraded?.();
      // reload
      const reload = await fetch(`/api/assessments/assignments/${assignmentId}`, { credentials: 'include' });
      const rd = await reload.json();
      if (reload.ok) setData(rd);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
      <div className="bg-white w-full sm:max-w-3xl sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <div>
            <h2 className="font-bold text-stone-900">Assessment result</h2>
            {data && (
              <p className="text-xs text-stone-500">
                {data.assignment.candidate.name} · {data.assignment.template.name}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-stone-100" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 text-stone-500 py-12">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading…
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}
          {data && !loading && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-stone-50 border border-stone-100 p-3">
                  <p className="text-[10px] uppercase font-bold text-stone-400">Score</p>
                  <p className="text-lg font-bold text-stone-900">
                    {data.assignment.score ?? '—'}/{data.assignment.maxScore ?? '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-stone-50 border border-stone-100 p-3">
                  <p className="text-[10px] uppercase font-bold text-stone-400">Percentage</p>
                  <p className="text-lg font-bold text-stone-900">
                    {data.assignment.percentage != null ? `${Math.round(data.assignment.percentage)}%` : '—'}
                    {data.assignment.reviewStatus === 'pending_review' && (
                      <span className="block text-[10px] font-medium text-amber-600">Partial — pending review</span>
                    )}
                  </p>
                </div>
                <div className="rounded-xl bg-stone-50 border border-stone-100 p-3">
                  <p className="text-[10px] uppercase font-bold text-stone-400">Result</p>
                  <p className="text-lg font-bold text-stone-900 flex items-center gap-1">
                    {data.assignment.passed == null ? (
                      'Pending'
                    ) : data.assignment.passed ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Pass
                      </>
                    ) : (
                      'Fail'
                    )}
                  </p>
                </div>
                <div className="rounded-xl bg-stone-50 border border-stone-100 p-3">
                  <p className="text-[10px] uppercase font-bold text-stone-400">Status</p>
                  <p className="text-sm font-semibold text-stone-800 capitalize">{data.assignment.status.replace('_', ' ')}</p>
                </div>
              </div>

              {data.breakdown.map((b, i) => {
                const manual = needsManual(b.question.type, b.response?.isCorrect);
                return (
                  <div key={b.question.id} className="rounded-xl border border-stone-200 p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-stone-900 text-sm">
                        Q{i + 1}. {b.question.question}
                      </p>
                      <span className="text-xs text-stone-400 shrink-0">
                        {b.response?.pointsEarned ?? 0}/{b.question.points} pts
                      </span>
                    </div>
                    <p className="text-[11px] uppercase font-bold text-stone-400">{b.question.type.replace(/_/g, ' ')}</p>
                    {b.response?.timeSpent != null && (
                      <p className="text-xs text-stone-500 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {b.response.timeSpent}s
                      </p>
                    )}
                    <div className="text-sm bg-stone-50 rounded-lg p-3 border border-stone-100 whitespace-pre-wrap font-mono text-stone-800">
                      {b.response?.codeSubmission || b.response?.answer || <em className="text-stone-400 not-italic">No answer</em>}
                    </div>
                    {b.question.correctAnswer && (
                      <p className="text-xs text-stone-500">
                        Correct: <span className="font-medium text-stone-700">{b.question.correctAnswer}</span>
                        {b.response?.isCorrect === true && <span className="text-emerald-600 ml-2">✓</span>}
                        {b.response?.isCorrect === false && <span className="text-red-600 ml-2">✗</span>}
                      </p>
                    )}
                    {manual && data.assignment.status === 'completed' && (
                      <div className="grid sm:grid-cols-2 gap-2 pt-1">
                        <label className="text-xs text-stone-600">
                          Points (max {b.question.points})
                          <input
                            type="number"
                            min={0}
                            max={b.question.points}
                            value={grades[b.question.id]?.pointsEarned ?? 0}
                            onChange={(e) =>
                              setGrades((g) => ({
                                ...g,
                                [b.question.id]: {
                                  ...g[b.question.id],
                                  pointsEarned: Number(e.target.value),
                                  feedback: g[b.question.id]?.feedback || '',
                                },
                              }))
                            }
                            className="mt-1 w-full rounded-lg border border-stone-200 px-2 py-1.5 text-sm"
                          />
                        </label>
                        <label className="text-xs text-stone-600">
                          Feedback
                          <input
                            type="text"
                            value={grades[b.question.id]?.feedback || ''}
                            onChange={(e) =>
                              setGrades((g) => ({
                                ...g,
                                [b.question.id]: {
                                  pointsEarned: g[b.question.id]?.pointsEarned ?? 0,
                                  feedback: e.target.value,
                                },
                              }))
                            }
                            className="mt-1 w-full rounded-lg border border-stone-200 px-2 py-1.5 text-sm"
                            placeholder="Optional feedback"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}

              {data.assignment.status === 'completed' && (
                <label className="block text-xs text-stone-600">
                  Overall feedback
                  <textarea
                    value={overallFeedback}
                    onChange={(e) => setOverallFeedback(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                  />
                </label>
              )}
            </>
          )}
        </div>

        {data?.assignment.status === 'completed' && (
          <div className="px-5 py-4 border-t border-stone-100 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-50">
              Close
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveGrades()}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save grades'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
