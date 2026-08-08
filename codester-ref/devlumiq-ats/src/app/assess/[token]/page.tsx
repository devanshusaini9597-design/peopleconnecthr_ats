'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2, Shield, AlertTriangle, CheckCircle2, Clock, Play, Save, ChevronLeft, ChevronRight,
} from 'lucide-react';

interface Question {
  id: string;
  type: string;
  question: string;
  description?: string | null;
  codeSnippet?: string | null;
  options?: unknown;
  points: number;
  language?: string | null;
  testCases?: Array<{ input: string; output?: string }>;
}

type AnswerState = { answer?: string; codeSubmission?: string; timeSpent?: number };

function isCoding(type: string) {
  return /code|coding/i.test(type);
}
function isMcq(type: string, options: unknown) {
  return Array.isArray(options) && (options as unknown[]).length > 0;
}
function isPersonality(type: string) {
  return /personality|logical|reasoning/i.test(type);
}

export default function AssessByTokenPage() {
  const params = useParams();
  const token = typeof params.token === 'string' ? params.token : '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveHint, setSaveHint] = useState('');
  const [template, setTemplate] = useState<{
    name: string;
    description?: string | null;
    duration?: number | null;
    proctoringEnabled: boolean;
    requireFullscreen: boolean;
    snapshotIntervalSec: number;
    passingScore: number;
  } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [status, setStatus] = useState('pending');
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    percentage: number;
    passed: boolean | null;
    score: number;
    maxScore: number;
    pendingReview?: boolean;
  } | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [runOutput, setRunOutput] = useState<Record<string, string>>({});
  const [riskHint, setRiskHint] = useState<number | null>(null);
  const [fsBlocked, setFsBlocked] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeSpentRef = useRef<Record<string, number>>({});
  const activeQRef = useRef<string | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [assignmentId, setAssignmentId] = useState('');
  const submitNowRef = useRef<() => Promise<void>>(async () => {});

  const apiBase = `/api/assessments/${token}`;

  const postProcEvent = useCallback(
    async (type: string, extra?: Record<string, unknown>) => {
      if (!template?.proctoringEnabled || !assignmentId) return;
      try {
        const res = await fetch(`/api/assessments/take/${assignmentId}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, type, ...extra }),
        });
        const data = await res.json().catch(() => ({}));
        if (typeof data.riskScore === 'number') setRiskHint(data.riskScore);
      } catch {
        /* ignore */
      }
    },
    [assignmentId, token, template?.proctoringEnabled],
  );

  const flushTimeSpent = useCallback((qid: string | null) => {
    if (!qid) return;
    const now = Date.now();
    const delta = Math.max(0, Math.floor((now - lastTickRef.current) / 1000));
    lastTickRef.current = now;
    timeSpentRef.current[qid] = (timeSpentRef.current[qid] || 0) + delta;
  }, []);

  const autosave = useCallback(
    (qid: string, patch: AnswerState) => {
      if (saveTimers.current[qid]) clearTimeout(saveTimers.current[qid]);
      saveTimers.current[qid] = setTimeout(async () => {
        flushTimeSpent(qid);
        const timeSpent = timeSpentRef.current[qid] || 0;
        try {
          const res = await fetch(`${apiBase}/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionId: qid,
              answer: patch.answer,
              codeSubmission: patch.codeSubmission,
              timeSpent,
            }),
          });
          if (res.status === 403) {
            const data = await res.json().catch(() => ({}));
            if (data.code === 'TIME_UP') {
              void submitNowRef.current();
              return;
            }
          }
          if (res.ok) {
            setSaveHint('Saved');
            setTimeout(() => setSaveHint(''), 1500);
          }
        } catch {
          setSaveHint('Save failed');
        }
      }, 600);
    },
    [apiBase, flushTimeSpent],
  );

  const setAnswer = (qid: string, patch: AnswerState) => {
    setAnswers((prev) => {
      const next = { ...prev[qid], ...patch };
      autosave(qid, next);
      return { ...prev, [qid]: next };
    });
  };

  useEffect(() => {
    if (!token) {
      setError('Invalid assessment link');
      setLoading(false);
      return;
    }
    fetch(apiBase)
      .then((r) => r.json().then((d) => ({ ok: r.ok, status: r.status, d })))
      .then(({ ok, status: http, d }) => {
        if (!ok) throw new Error(d.error || (http === 410 ? 'Assessment expired' : 'Failed to load'));
        setTemplate(d.template);
        setQuestions(d.questions || []);
        setStatus(d.assignment.status);
        setCandidateName(d.candidate?.name || '');
        setAssignmentId(d.assignment.id);
        setStartedAt(d.assignment.startedAt);
        if (d.serverNow) {
          setServerOffsetMs(new Date(d.serverNow).getTime() - Date.now());
        }
        const saved: Record<string, AnswerState> = {};
        for (const a of d.savedAnswers || []) {
          saved[a.questionId] = {
            answer: a.answer ?? undefined,
            codeSubmission: a.codeSubmission ?? undefined,
            timeSpent: a.timeSpent ?? undefined,
          };
          if (typeof a.timeSpent === 'number') timeSpentRef.current[a.questionId] = a.timeSpent;
        }
        setAnswers(saved);
        if (d.assignment.status === 'completed') {
          setResult({
            percentage: d.assignment.percentage ?? 0,
            passed: d.assignment.passed,
            score: d.assignment.score ?? 0,
            maxScore: d.assignment.maxScore ?? 0,
            pendingReview: d.assignment.reviewStatus === 'pending_review',
          });
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, apiBase]);

  // Countdown synced to server start + duration
  useEffect(() => {
    if (status !== 'in_progress' || !startedAt || !template?.duration) {
      setRemainingSec(null);
      return;
    }
    const tick = () => {
      const serverNow = Date.now() + serverOffsetMs;
      const end = new Date(startedAt).getTime() + template.duration! * 60 * 1000;
      const left = Math.max(0, Math.floor((end - serverNow) / 1000));
      setRemainingSec(left);
      if (left <= 0) {
        void autoSubmit();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, startedAt, template?.duration, serverOffsetMs]);

  // Per-question time tracking
  useEffect(() => {
    if (status !== 'in_progress' || !questions[qIndex]) return;
    flushTimeSpent(activeQRef.current);
    activeQRef.current = questions[qIndex].id;
    lastTickRef.current = Date.now();
    return () => flushTimeSpent(activeQRef.current);
  }, [qIndex, status, questions, flushTimeSpent]);

  // Proctoring listeners
  useEffect(() => {
    if (!template?.proctoringEnabled || status !== 'in_progress') return;
    const onVis = () => {
      if (document.hidden) void postProcEvent('tab_switch');
    };
    const onBlur = () => void postProcEvent('window_blur');
    const onCopy = (e: ClipboardEvent) => {
      const qid = (e.target as HTMLElement | null)?.closest('[data-qid]')?.getAttribute('data-qid') || undefined;
      void postProcEvent('copy', { questionId: qid });
    };
    const onPaste = (e: ClipboardEvent) => {
      const qid = (e.target as HTMLElement | null)?.closest('[data-qid]')?.getAttribute('data-qid') || undefined;
      void postProcEvent('paste', { questionId: qid });
    };
    const onFs = () => {
      if (!document.fullscreenElement) {
        if (template.requireFullscreen) setFsBlocked(true);
        void postProcEvent('fullscreen_exit');
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('fullscreenchange', onFs);
    };
  }, [template?.proctoringEnabled, template?.requireFullscreen, status, postProcEvent]);

  // Fullscreen hard lock poll
  useEffect(() => {
    if (!template?.requireFullscreen || status !== 'in_progress') return;
    const id = setInterval(() => {
      if (!document.fullscreenElement) setFsBlocked(true);
    }, 2000);
    return () => clearInterval(id);
  }, [template?.requireFullscreen, status]);

  const resumeFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen?.();
      setFsBlocked(false);
    } catch {
      setFsBlocked(true);
    }
  };

  // Webcam
  useEffect(() => {
    if (!template?.proctoringEnabled || status !== 'in_progress') return;
    let interval: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        const sec = Math.max(15, template.snapshotIntervalSec || 30);
        interval = setInterval(() => {
          const video = videoRef.current;
          if (!video || video.readyState < 2) return;
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = 240;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(video, 0, 0, 320, 240);
          void postProcEvent('snapshot', { snapshotDataUrl: canvas.toDataURL('image/jpeg', 0.5) });
        }, sec * 1000);
      } catch {
        void postProcEvent('snapshot', { meta: { error: 'camera_denied' } });
      }
    })();
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [template, status, postProcEvent]);

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not start');
      setStatus('in_progress');
      setStartedAt(data.startedAt);
      if (data.serverNow) setServerOffsetMs(new Date(data.serverNow).getTime() - Date.now());
      if (template?.requireFullscreen) {
        try {
          await document.documentElement.requestFullscreen?.();
          setFsBlocked(false);
        } catch {
          setFsBlocked(true);
        }
      }
      void postProcEvent('start');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start');
    } finally {
      setBusy(false);
    }
  };

  const doSubmit = async () => {
    setBusy(true);
    setError('');
    try {
      flushTimeSpent(activeQRef.current);
      const payload = questions.map((q) => ({
        questionId: q.id,
        answer: answers[q.id]?.answer,
        codeSubmission: answers[q.id]?.codeSubmission,
        timeSpent: timeSpentRef.current[q.id] || 0,
      }));
      const res = await fetch(`${apiBase}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      setStatus('completed');
      setResult({
        percentage: data.percentage,
        passed: data.passed,
        score: data.score,
        maxScore: data.maxScore,
        pendingReview: data.pendingReview,
      });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (document.fullscreenElement) await document.exitFullscreen?.().catch(() => {});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  };

  const submittingRef = useRef(false);
  const autoSubmit = async () => {
    if (submittingRef.current || status !== 'in_progress') return;
    submittingRef.current = true;
    try {
      await doSubmit();
    } finally {
      // Allow retry if submit failed (e.g. network); doSubmit sets status on success
      submittingRef.current = false;
    }
  };
  submitNowRef.current = autoSubmit;

  const submit = async () => {
    if (!confirm('Submit your assessment? You cannot change answers after this.')) return;
    await doSubmit();
  };

  const runTests = async (q: Question) => {
    const code = answers[q.id]?.codeSubmission || '';
    setRunOutput((o) => ({ ...o, [q.id]: 'Running…' }));
    try {
      const res = await fetch(`${apiBase}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: q.id, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Run failed');
                      if (!data.supported) {
                        setRunOutput((o) => ({
                          ...o,
                          [q.id]: data.disabled
                            ? 'Code runner is disabled on this server. Your code will be saved and reviewed on submit.'
                            : `Language "${data.language}" is graded on submit (or manually). Public runner supports JavaScript when enabled.`,
                        }));
                        return;
                      }
      const lines = (data.results || []).map(
        (r: { index: number; passed: boolean; expected: string; actual: string; error?: string }) =>
          `Case ${r.index + 1}: ${r.passed ? 'PASS' : 'FAIL'}${r.error ? ` — ${r.error}` : ` — got "${r.actual}" expected "${r.expected}"`}`,
      );
      setRunOutput((o) => ({
        ...o,
        [q.id]: `${data.passedCount}/${data.totalCount} passed\n${lines.join('\n')}`,
      }));
    } catch (e: unknown) {
      setRunOutput((o) => ({ ...o, [q.id]: e instanceof Error ? e.message : 'Run failed' }));
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading assessment…
      </div>
    );
  }

  if (error && !template) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="font-semibold text-stone-900">{error}</p>
        </div>
      </div>
    );
  }

  const q = questions[qIndex];
  const timerUrgent = remainingSec != null && remainingSec < 60;

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-100 to-stone-200">
      {fsBlocked && status === 'in_progress' && template?.requireFullscreen && (
        <div className="fixed inset-0 z-[100] bg-stone-950/95 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <Shield className="w-10 h-10 text-amber-400" />
          <p className="text-lg font-bold text-white">Fullscreen required</p>
          <p className="text-sm text-stone-300 max-w-sm">
            This assessment must stay in fullscreen. Click below to continue.
          </p>
          <button
            type="button"
            onClick={() => void resumeFullscreen()}
            className="px-6 py-3 rounded-xl bg-white text-stone-900 font-semibold hover:bg-stone-100"
          >
            Fullscreen required — click to continue
          </button>
        </div>
      )}
      <header className="bg-white/90 backdrop-blur border-b border-stone-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-stone-900">{template?.name}</h1>
            <p className="text-xs text-stone-500">
              {candidateName && `${candidateName} · `}
              {template?.duration ? `${template.duration} min · ` : ''}
              {status.replace('_', ' ')}
              {saveHint && (
                <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
                  <Save className="w-3 h-3" /> {saveHint}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {remainingSec != null && status === 'in_progress' && (
              <span
                className={`inline-flex items-center gap-1 text-sm font-bold tabular-nums px-2.5 py-1 rounded-lg border ${
                  timerUrgent ? 'bg-red-50 text-red-700 border-red-200' : 'bg-stone-50 text-stone-800 border-stone-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                {formatTime(remainingSec)}
              </span>
            )}
            {template?.proctoringEnabled && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg">
                <Shield className="w-3.5 h-3.5" />
                Proctored{riskHint != null ? ` · risk ${riskHint}` : ''}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2">{error}</div>
        )}

        {status === 'completed' && result && (
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center space-y-2 shadow-sm">
            <CheckCircle2 className={`w-10 h-10 mx-auto ${result.passed ? 'text-emerald-600' : 'text-amber-600'}`} />
            <p className="text-xl font-bold text-stone-900">Assessment submitted</p>
            {result.pendingReview ? (
              <p className="text-stone-600">
                Partial score {result.score}/{result.maxScore} ({Math.round(result.percentage)}%) — pending recruiter review
              </p>
            ) : (
              <p className="text-stone-600">
                Score {result.score}/{result.maxScore} ({Math.round(result.percentage)}%)
                {result.passed == null ? '' : result.passed ? ' — Passed' : ' — Not passed'}
              </p>
            )}
          </div>
        )}

        {status === 'pending' && (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 space-y-5 shadow-sm">
            <div>
              <h2 className="text-xl font-bold text-stone-900">{template?.name}</h2>
              <p className="text-stone-600 text-sm mt-2">
                {template?.description || 'Complete the questions and submit when ready.'}
              </p>
            </div>
            <ul className="text-sm text-stone-600 space-y-1.5 list-disc pl-5">
              {template?.duration ? <li>Time limit: <strong>{template.duration} minutes</strong> (starts when you click Start)</li> : null}
              <li>{questions.length} question{questions.length === 1 ? '' : 's'}</li>
              <li>Answers autosave as you go. Submit locks further edits.</li>
              <li>Passing score: {template?.passingScore ?? 70}%</li>
            </ul>
            {template?.proctoringEnabled && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3">
                This assessment is proctored. Tab switches, copy/paste, and (if permitted) webcam snapshots may be monitored.
                {template.requireFullscreen ? ' Fullscreen mode is required.' : ''}
              </p>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void start()}
              className="w-full py-3.5 rounded-xl bg-stone-900 text-white font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {busy ? 'Starting…' : 'Start assessment'}
            </button>
          </div>
        )}

        {status === 'in_progress' && q && (
          <>
            {template?.proctoringEnabled && (
              <video ref={videoRef} muted playsInline className="w-24 h-[72px] rounded-lg border border-stone-200 object-cover ml-auto" />
            )}

            <div className="flex items-center justify-between text-xs text-stone-500">
              <span>
                Question {qIndex + 1} of {questions.length}
              </span>
              <div className="flex gap-1">
                {questions.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setQIndex(i)}
                    className={`w-2 h-2 rounded-full ${i === qIndex ? 'bg-brand-600' : answers[questions[i].id] ? 'bg-stone-400' : 'bg-stone-300'}`}
                    aria-label={`Go to question ${i + 1}`}
                  />
                ))}
              </div>
            </div>

            <div data-qid={q.id} className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-6 space-y-4 shadow-sm">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wide">
                {q.type.replace(/_/g, ' ')} · {q.points} pt
              </p>
              <p className="font-semibold text-stone-900 text-lg leading-snug">{q.question}</p>
              {q.description && <p className="text-sm text-stone-500">{q.description}</p>}
              {q.codeSnippet && (
                <pre className="text-xs bg-stone-900 text-stone-100 p-3 rounded-xl overflow-x-auto">{q.codeSnippet}</pre>
              )}

              {isMcq(q.type, q.options) ? (
                <div className="space-y-2">
                  {(q.options as string[]).map((opt) => (
                    <label
                      key={opt}
                      className={`flex items-center gap-3 text-sm cursor-pointer rounded-xl border px-3 py-2.5 transition-colors ${
                        answers[q.id]?.answer === opt
                          ? 'border-brand-400 bg-brand-50'
                          : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={answers[q.id]?.answer === opt}
                        onChange={() => setAnswer(q.id, { answer: opt })}
                        className="accent-brand-600"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              ) : isPersonality(q.type) ? (
                <div className="space-y-2">
                  <p className="text-xs text-stone-500 mb-1">Rate your agreement</p>
                  {(
                    [
                      ['1', 'Strongly Disagree'],
                      ['2', 'Disagree'],
                      ['3', 'Neutral'],
                      ['4', 'Agree'],
                      ['5', 'Strongly Agree'],
                    ] as const
                  ).map(([val, label]) => (
                    <label
                      key={val}
                      className={`flex items-center gap-3 text-sm cursor-pointer rounded-xl border px-3 py-2.5 transition-colors ${
                        answers[q.id]?.answer === val
                          ? 'border-brand-400 bg-brand-50'
                          : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={answers[q.id]?.answer === val}
                        onChange={() => setAnswer(q.id, { answer: val })}
                        className="accent-brand-600"
                      />
                      <span className="font-semibold text-stone-500 w-4">{val}</span>
                      {label}
                    </label>
                  ))}
                </div>
              ) : isCoding(q.type) ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span>Language: {q.language || 'javascript'}</span>
                    <button
                      type="button"
                      onClick={() => void runTests(q)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-900 text-white font-medium"
                    >
                      <Play className="w-3 h-3" /> Run tests
                    </button>
                  </div>
                  <textarea
                    value={answers[q.id]?.codeSubmission || ''}
                    onChange={(e) => setAnswer(q.id, { codeSubmission: e.target.value })}
                    rows={14}
                    spellCheck={false}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm font-mono bg-stone-950 text-emerald-100"
                    placeholder={'// Define solve(input) and return/print the result\nfunction solve(input) {\n  \n}'}
                  />
                  {q.testCases && q.testCases.length > 0 && (
                    <div className="text-xs text-stone-500 space-y-1">
                      <p className="font-semibold text-stone-600">Public test cases</p>
                      {q.testCases.map((tc, i) => (
                        <pre key={i} className="bg-stone-50 border border-stone-100 rounded-lg p-2 overflow-x-auto">
                          Input: {tc.input}
                          {tc.output != null ? `\nExpected: ${tc.output}` : ''}
                        </pre>
                      ))}
                    </div>
                  )}
                  {runOutput[q.id] && (
                    <pre className="text-xs bg-stone-100 border border-stone-200 rounded-xl p-3 whitespace-pre-wrap">{runOutput[q.id]}</pre>
                  )}
                </div>
              ) : (
                <textarea
                  value={answers[q.id]?.answer || ''}
                  onChange={(e) => setAnswer(q.id, { answer: e.target.value })}
                  rows={6}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                  placeholder="Your answer…"
                />
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={qIndex === 0}
                onClick={() => setQIndex((i) => Math.max(0, i - 1))}
                className="px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm font-medium disabled:opacity-40 inline-flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              {qIndex < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setQIndex((i) => Math.min(questions.length - 1, i + 1))}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-semibold inline-flex items-center justify-center gap-1"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submit()}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {busy ? 'Submitting…' : 'Submit assessment'}
                </button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
