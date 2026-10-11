import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ClipboardList, Clock, CheckCircle, AlertCircle, Loader2, Shield, ChevronLeft, ChevronRight, Camera, Check,
} from 'lucide-react';
import API_URL from '../config';

const staffLoggedIn = () => {
  try { return localStorage.getItem('isLoggedIn') === 'true'; } catch { return false; }
};

const ExamChrome = ({ children, extra }) => (
  <div className="min-h-dvh bg-stone-50 font-sans flex flex-col">
    <header className="bg-white border-b border-stone-200/90 sticky top-0 z-20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2.5 text-stone-900 font-semibold min-w-0">
          <img src="/app-icon.png?v=5" alt="" className="w-8 h-8 rounded-lg flex-shrink-0 bg-white object-contain" />
          <span className="text-sm sm:text-base truncate">People Connect HR</span>
        </Link>
        {extra}
      </div>
    </header>
    {staffLoggedIn() ? (
      <div className="bg-brand-50 border-b border-brand-100 text-brand-900 text-xs sm:text-sm px-4 py-2 text-center">
        Hiring team: this is the candidate test link.
        {' '}
        <Link to="/assessments" className="font-bold underline underline-offset-2">Open Assessments to edit, invite, or grade</Link>
      </div>
    ) : null}
    <div className="flex-1 py-6 sm:py-10 px-3 sm:px-4">{children}</div>
    <footer className="border-t border-stone-200 bg-white py-5 mt-auto">
      <p className="text-center text-xs text-stone-400">Secure assessment · People Connect HR</p>
    </footer>
  </div>
);

const AssessmentTakePage = () => {
  const { token } = useParams();
  const [state, setState] = useState('loading');
  const [assessment, setAssessment] = useState(null);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState('saved');
  const [remaining, setRemaining] = useState(null);
  const [result, setResult] = useState(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const eventQueue = useRef([]);
  const flushTimer = useRef(null);
  const saveTimer = useRef(null);
  const answersRef = useRef({});
  const videoRef = useRef(null);
  const currentRef = useRef(0);
  const [cameraStatus, setCameraStatus] = useState('off');

  const applySession = (data) => {
    setAssessment(data);
    const next = {};
    (data.answers || []).forEach((row) => {
      next[row.questionId] = row.response;
    });
    answersRef.current = next;
    setAnswers(next);
    setRemaining(data.remainingSeconds ?? null);
    setState('ready');
  };

  const flushEvents = useCallback(async () => {
    if (!eventQueue.current.length || !token) return;
    const batch = eventQueue.current.splice(0, 50);
    try {
      await fetch(`${API_URL}/api/assessments/take/${token}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch })
      });
    } catch { /* non-blocking */ }
  }, [token]);

  const track = useCallback((type, meta = {}) => {
    if (!assessment?.proctoring?.enabled) return;
    eventQueue.current.push({
      type,
      at: new Date().toISOString(),
      questionId: currentRef.current,
      meta,
    });
    if (!flushTimer.current) {
      flushTimer.current = setTimeout(() => {
        flushTimer.current = null;
        flushEvents();
      }, 800);
    }
  }, [assessment?.proctoring?.enabled, flushEvents]);

  const persistAnswers = useCallback(async (payload) => {
    setSaveState('saving');
    try {
      const res = await fetch(`${API_URL}/api/assessments/take/${token}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: Object.entries(payload).map(([questionId, response]) => ({ questionId, response })),
        }),
      });
      const data = await res.json();
      if (data?.data?.submitted) {
        setState('submitted');
        setResult(data.data.result);
        return;
      }
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not save');
      if (typeof data.data?.remainingSeconds === 'number') setRemaining(data.data.remainingSeconds);
      setSaveState('saved');
    } catch {
      setSaveState('unsaved');
    }
  }, [token]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/assessments/take/${token}`);
        const data = await res.json();
        if (res.status === 410) { setState('expired'); return; }
        if (!res.ok || !data.success) { setState('error'); setError(data.message || 'Failed to load assessment'); return; }
        if (data.data.submitted) {
          setResult(data.data.result);
          setState('submitted');
          return;
        }
        if (data.data.phase === 'instructions') {
          setAssessment(data.data);
          setState('instructions');
          return;
        }
        applySession(data.data);
      } catch {
        setState('error');
        setError('Failed to load assessment');
      }
    })();
  }, [token]);

  useEffect(() => {
    if (state !== 'ready' || remaining == null) return undefined;
    const timer = setInterval(() => {
      setRemaining((secs) => {
        if (secs == null) return secs;
        if (secs <= 1) return 0;
        return secs - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [state, remaining != null]);

  useEffect(() => {
    if (state !== 'ready' || remaining !== 0 || !assessment?.rules?.autoSubmit) return;
    handleSubmit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, state]);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => {
    if (state !== 'ready' || !assessment?.proctoring?.enabled) return undefined;
    const p = assessment.proctoring;
    track('start');
    setCameraStatus('requesting');

    let stream;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraStatus('unavailable');
          track('camera_denied', { reason: 'no_media_devices' });
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false });
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.muted = true;
          await video.play();
        }
        setCameraStatus('live');
        await new Promise((r) => setTimeout(r, 400));
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        const grab = (periodic = false) => {
          const source = videoRef.current;
          if (!source) return;
          ctx.drawImage(source, 0, 0, 320, 240);
          track('snapshot', { image: canvas.toDataURL('image/jpeg', 0.45), w: 320, h: 240, periodic });
        };
        grab(false);
        const pulse = setInterval(() => {
          try { grab(true); } catch { /* ignore */ }
        }, 30000);
        stream._pulse = pulse;
      } catch {
        setCameraStatus('denied');
        track('camera_denied', { reason: 'camera_denied_or_unavailable' });
        track('snapshot', { skipped: true, reason: 'camera_denied_or_unavailable' });
      }
    })();

    const onVis = () => {
      if (document.hidden && p.trackTabSwitch !== false) track('tab_switch');
    };
    const onBlur = () => track('window_blur');
    const onCopy = () => { if (p.trackCopyPaste !== false) track('copy'); };
    const onPaste = () => { if (p.trackCopyPaste !== false) track('paste'); };
    const onFs = () => {
      if (p.trackFullscreen !== false && !document.fullscreenElement) track('fullscreen_exit');
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
      if (flushTimer.current) clearTimeout(flushTimer.current);
      try { if (stream?._pulse) clearInterval(stream._pulse); } catch { /* ignore */ }
      try { stream?.getTracks?.()?.forEach((t) => t.stop()); } catch { /* ignore */ }
      try { if (videoRef.current) videoRef.current.srcObject = null; } catch { /* ignore */ }
      setCameraStatus('off');
      flushEvents();
    };
  }, [state, assessment, track, flushEvents]);

  const handleAnswer = (questionId, response) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: response };
      answersRef.current = next;
      return next;
    });
    setSaveState('unsaved');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persistAnswers(answersRef.current), 700);
  };

  const startTest = async () => {
    setStarting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/assessments/take/${token}/start`, { method: 'POST' });
      const data = await res.json();
      if (res.status === 410) { setState('expired'); return; }
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not start');
      if (data.data.submitted) {
        setResult(data.data.result);
        setState('submitted');
        return;
      }
      applySession(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  };

  const handleSubmit = async (auto = false) => {
    if (submitting) return;
    setSubmitting(true);
    track('submit');
    await flushEvents();
    try {
      const payload = { answers: Object.entries(answersRef.current).map(([questionId, response]) => ({ questionId, response })), auto };
      const res = await fetch(`${API_URL}/api/assessments/take/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to submit');
      setResult(data.result || data.data?.result);
      setState('submitted');
    } catch (err) {
      setError(err.message);
      setConfirmSubmit(false);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (secs) => {
    if (secs == null) return '';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  if (state === 'loading') {
    return (
      <ExamChrome>
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      </ExamChrome>
    );
  }

  if (state === 'expired' || state === 'error' || state === 'submitted') {
    const map = {
      expired: { icon: Clock, color: 'text-amber-500', title: 'This link has expired', body: 'Contact the hiring team to request a new assessment link.' },
      error: { icon: AlertCircle, color: 'text-red-500', title: 'Something went wrong', body: error },
      submitted: {
        icon: CheckCircle,
        color: 'text-emerald-500',
        title: 'Assessment submitted',
        body: result?.message
          || (result?.pending ? 'Submitted. Some answers still need review before a result is ready.' : 'Thanks — the hiring team will review your answers and follow up.'),
      }
    };
    const m = map[state];
    const Icon = m.icon;
    return (
      <ExamChrome>
        <div className="max-w-md mx-auto w-full text-center card-ats-bordered p-8 sm:p-10">
          <Icon className={`w-10 h-10 ${m.color} mx-auto mb-4`} />
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">{m.title}</h2>
          <p className="text-stone-500 mt-2 text-sm leading-relaxed">{m.body}</p>
          {state === 'submitted' && result && !result.pending && result.totalScore != null && (
            <p className="mt-4 text-sm font-semibold text-stone-800">
              Score: {result.totalScore}/{result.maxScore}
              {result.passFail && result.passFail !== 'pending' ? ` · ${result.passFail}` : ''}
            </p>
          )}
        </div>
      </ExamChrome>
    );
  }

  if (state === 'instructions') {
    return (
      <ExamChrome>
        <div className="max-w-2xl mx-auto card-ats-bordered p-6 sm:p-8">
          <div className="flex items-center gap-2 text-brand-600 mb-2">
            <ClipboardList className="w-5 h-5" />
            <span className="text-sm font-medium">Skills Assessment</span>
          </div>
          <h1 className="text-2xl font-bold text-stone-900">{assessment.title}</h1>
          {assessment.description && <p className="text-stone-600 mt-2">{assessment.description}</p>}
          <ul className="mt-4 space-y-1.5 text-sm text-stone-600">
            <li>Duration: {assessment.durationMinutes} minutes (server-timed once you start)</li>
            <li>Questions: {assessment.questionCount}</li>
            <li>{assessment.rules?.allowBack === false ? 'You cannot go back after leaving a question.' : 'You can move between questions.'}</li>
            <li>{assessment.rules?.requireAll !== false ? 'Required questions must be answered.' : 'Some questions may be optional.'}</li>
            <li>Refreshing the page will not reset the timer or start a new attempt.</li>
          </ul>
          {(assessment.candidateInstructions || assessment.privacyNotice) && (
            <div className="mt-4 rounded-xl bg-stone-50 border border-stone-200 p-4 text-sm text-stone-600 space-y-2">
              {assessment.candidateInstructions ? <p>{assessment.candidateInstructions}</p> : null}
              {assessment.privacyNotice ? <p>{assessment.privacyNotice}</p> : null}
            </div>
          )}
          {assessment.proctoring?.enabled && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-brand-50 border border-brand-100 px-3 py-2 text-xs text-brand-800">
              <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
              Integrity monitoring is on. A webcam snapshot may be taken; tab switches and copy/paste may be recorded.
            </div>
          )}
          {!assessment.windowOpen && (
            <p className="mt-4 text-sm text-amber-700">This assessment is outside its availability window.</p>
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={startTest}
            disabled={starting || assessment.windowOpen === false}
            className="btn-primary mt-6 w-full py-3 disabled:opacity-50"
          >
            {starting ? 'Starting…' : 'Start assessment'}
          </button>
        </div>
      </ExamChrome>
    );
  }

  const questions = assessment.questions || [];
  const allowBack = assessment.rules?.allowBack !== false;
  const q = questions[current] || questions[0];
  const allRequiredAnswered = questions.every((item) => {
    if (item.required === false) return true;
    return String(answers[item._id] || '').trim().length > 0;
  });
  const warnExpiry = remaining != null && remaining <= 60 && remaining > 0;

  const answeredCount = questions.filter((item) => String(answers[item._id] || '').trim()).length;
  const remainingCount = questions.length - answeredCount;
  const goTo = (index) => {
    if (index === current) return;
    if (index < current && !allowBack) return;
    setCurrent(index);
  };

  return (
    <ExamChrome
      extra={(
        <div className="flex items-center gap-2">
          {assessment.proctoring?.enabled ? (
            <span className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              cameraStatus === 'live' ? 'bg-emerald-50 text-emerald-800' : cameraStatus === 'denied' ? 'bg-amber-50 text-amber-800' : 'bg-stone-100 text-stone-600'
            }`}>
              <Camera size={12} /> {cameraStatus === 'live' ? 'Webcam on' : cameraStatus === 'denied' ? 'Camera blocked' : 'Webcam'}
            </span>
          ) : null}
          <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold tabular-nums ${warnExpiry ? 'bg-red-50 text-red-700' : 'bg-stone-100 text-stone-800'}`}>
            <Clock className="w-4 h-4" /> {formatTime(remaining)}
          </div>
        </div>
      )}
    >
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="card-ats-bordered p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight">{assessment.title}</h1>
              <p className="text-xs text-stone-500 mt-1">
                {saveState === 'saving' ? 'Saving…' : saveState === 'unsaved' ? 'Unsaved changes' : 'Answers saved'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-bold">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5">{answeredCount} done</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-800 border border-brand-100 px-2 py-0.5">{Math.max(0, remainingCount)} remaining</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {questions.map((item, index) => {
              const done = String(answers[item._id] || '').trim().length > 0;
              const active = index === current;
              const lockedBack = index < current && !allowBack;
              return (
                <button
                  key={item._id || index}
                  type="button"
                  disabled={lockedBack}
                  onClick={() => goTo(index)}
                  className={`h-9 w-9 rounded-full text-[12px] font-bold tabular-nums border transition-all disabled:opacity-40 ${
                    active
                      ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-600/25'
                      : done
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-white text-stone-500 border-stone-200 hover:border-brand-300'
                  }`}
                  title={done ? `Question ${index + 1} answered` : `Question ${index + 1} remaining`}
                  aria-label={`Question ${index + 1}${done ? ', answered' : ', remaining'}${active ? ', current' : ''}`}
                >
                  {done && !active ? <Check size={14} className="mx-auto" strokeWidth={2.75} /> : index + 1}
                </button>
              );
            })}
          </div>
          {warnExpiry && <p className="mt-3 text-xs font-semibold text-red-700">Time is almost up. Your answers will submit automatically.</p>}
        </div>

        {q && (
          <div className="card-ats-bordered p-4 sm:p-6">
            <p className="text-xs font-semibold text-stone-400 mb-2">Question {current + 1} of {questions.length}{q.section ? ` · ${q.section}` : ''}</p>
            <p className="text-sm font-semibold text-stone-900 mb-3">
              {q.prompt}{' '}
              <span className="text-xs text-stone-400 font-normal">({q.points} pts{q.required === false ? ', optional' : ''})</span>
            </p>
            {q.type === 'code' && q.visibleTests?.length ? (
              <div className="mb-3 rounded-xl bg-stone-50 border border-stone-200 p-3 text-xs text-stone-600">
                <p className="font-semibold text-stone-700 mb-1">Sample inputs</p>
                {q.visibleTests.map((t, i) => (
                  <p key={i} className="font-mono">{t.name || `Case ${i + 1}`}: {t.input || '(empty)'}</p>
                ))}
              </div>
            ) : null}
            {q.type === 'multiple_choice' ? (
              <div className="space-y-2">
                {(q.options || []).map((opt, oIdx) => (
                  <label key={oIdx} className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer p-2 rounded-lg hover:bg-stone-50">
                    <input
                      type="radio"
                      name={q._id}
                      checked={answers[q._id] === String(oIdx)}
                      onChange={() => handleAnswer(q._id, String(oIdx))}
                      className="text-brand-600 focus:ring-brand-500"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                value={answers[q._id] || ''}
                onChange={(e) => handleAnswer(q._id, e.target.value)}
                rows={q.type === 'code' ? 10 : 5}
                placeholder={q.type === 'code' ? `Write your ${q.language || 'code'} solution here…` : 'Type your answer here…'}
                className={`w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 ${
                  q.type === 'code' ? 'font-mono bg-stone-900 text-stone-100 border-stone-700' : ''
                }`}
              />
            )}
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={!allowBack || current === 0}
                onClick={() => setCurrent((i) => Math.max(0, i - 1))}
                className="btn-secondary !text-xs disabled:opacity-40"
              >
                <ChevronLeft size={14} /> Previous
              </button>
              {current < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrent((i) => Math.min(questions.length - 1, i + 1))}
                  className="btn-primary !text-xs"
                >
                  Next <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmSubmit(true)}
                  disabled={submitting || (assessment.rules?.requireAll !== false && !allRequiredAnswered)}
                  className="btn-primary !text-xs disabled:opacity-50"
                >
                  Review & submit
                </button>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {confirmSubmit && (
          <div className="card-ats-bordered p-4">
            <p className="text-sm font-semibold text-stone-900">Submit this assessment?</p>
            <p className="text-xs text-stone-500 mt-1">You will not be able to change answers after this.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn-secondary" onClick={() => setConfirmSubmit(false)}>Cancel</button>
              <button type="button" className="btn-primary" disabled={submitting} onClick={() => handleSubmit(false)}>
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        )}

        {assessment.proctoring?.enabled ? (
          <aside className="fixed bottom-4 right-4 z-30 w-36 sm:w-44 rounded-2xl overflow-hidden border border-white/80 shadow-xl bg-stone-900">
            <video ref={videoRef} playsInline muted autoPlay className={`w-full h-24 sm:h-28 object-cover ${cameraStatus === 'live' ? '' : 'hidden'}`} />
            {cameraStatus !== 'live' ? (
              <div className="h-24 sm:h-28 flex flex-col items-center justify-center text-center px-2">
                <Camera size={16} className="text-white/70 mb-1" />
                <p className="text-[10px] font-semibold text-white/80">
                  {cameraStatus === 'denied' ? 'Camera blocked' : 'Starting camera…'}
                </p>
              </div>
            ) : null}
            <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white bg-black/50">
              {cameraStatus === 'live' ? 'Live webcam' : 'Integrity monitor'}
            </p>
          </aside>
        ) : (
          <video ref={videoRef} className="hidden" muted playsInline />
        )}
      </div>
    </ExamChrome>
  );
};

export default AssessmentTakePage;
