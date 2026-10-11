import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ClipboardList, Clock, CheckCircle, AlertCircle, Loader2, Shield, ChevronLeft, ChevronRight, Camera, Lock,
} from 'lucide-react';
import API_URL from '../config';
import ConfirmationModal from './ConfirmationModal';

const staffLoggedIn = () => {
  try { return localStorage.getItem('isLoggedIn') === 'true'; } catch { return false; }
};

const ExamChrome = ({ children, extra, brand, wide }) => {
  const orgName = brand?.name || 'People Connect HR';
  const logo = brand?.logoUrl || '/app-icon.png';
  const site = brand?.websiteUrl || '/';
  const accent = brand?.brandColor || '#0d9488';
  return (
    <div className="min-h-dvh relative overflow-hidden bg-stone-100 font-sans flex flex-col">
      <header className="relative z-20 bg-white/95 backdrop-blur-md border-b border-stone-200/90 sticky top-0">
        <div className={`${wide ? 'max-w-6xl' : 'max-w-3xl'} mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3`}>
          <a href={site} className="flex items-center gap-2.5 text-stone-900 font-semibold min-w-0">
            <img src={logo} alt="" className="w-9 h-9 rounded-xl flex-shrink-0 bg-white object-contain ring-1 ring-stone-200/80" />
            <span className="text-sm sm:text-base truncate">{orgName}</span>
          </a>
          {extra}
        </div>
        <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${accent}, #2dd4bf, ${accent})` }} />
      </header>
      {staffLoggedIn() ? (
        <div className="relative z-10 bg-brand-50 border-b border-brand-100 text-brand-900 text-xs sm:text-sm px-4 py-2 text-center">
          Hiring team: this is the candidate assessment link.
          {' '}
          <Link to="/assessments" className="font-bold underline underline-offset-2">Open Assessments</Link>
        </div>
      ) : null}
      <div className="relative z-10 flex-1 py-6 sm:py-10 px-3 sm:px-4">{children}</div>
      <footer className="relative z-10 border-t border-stone-200 bg-white/80 py-5 mt-auto">
        <p className="text-center text-xs text-stone-400">Secure assessment session · {orgName}</p>
      </footer>
    </div>
  );
};

function isAnswered(value) {
  return String(value || '').trim().length > 0;
}

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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [confirmedIdentity, setConfirmedIdentity] = useState(false);
  const [acceptedMonitor, setAcceptedMonitor] = useState(false);
  const [preflightCamera, setPreflightCamera] = useState('idle');
  const [sessionClosed, setSessionClosed] = useState(false);
  const eventQueue = useRef([]);
  const flushTimer = useRef(null);
  const saveTimer = useRef(null);
  const answersRef = useRef({});
  const videoRef = useRef(null);
  const previewRef = useRef(null);
  const currentRef = useRef(0);
  const streamRef = useRef(null);
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
    const urgent = type === 'tab_switch' || type === 'snapshot' || type === 'devtools' || type === 'camera_denied';
    if (urgent) {
      flushEvents();
      return;
    }
    if (!flushTimer.current) {
      flushTimer.current = setTimeout(() => {
        flushTimer.current = null;
        flushEvents();
      }, 600);
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
        if (!res.ok || !data.success) { setState('error'); setError(data.message || 'Unable to load this assessment'); return; }
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
        setError('Unable to load this assessment');
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

  const captureFrame = useCallback((periodic = false) => {
    const source = videoRef.current;
    if (!source || source.readyState < 2) return;
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    try {
      ctx.drawImage(source, 0, 0, 320, 240);
      track('snapshot', { image: canvas.toDataURL('image/jpeg', 0.5), w: 320, h: 240, periodic });
    } catch { /* ignore */ }
  }, [track]);

  useEffect(() => {
    if (state !== 'ready' || !assessment?.proctoring?.enabled) return undefined;
    const p = assessment.proctoring;
    track('start');
    setCameraStatus('requesting');

    let pulse;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraStatus('unavailable');
          track('camera_denied', { reason: 'no_media_devices' });
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false });
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.muted = true;
          await video.play();
        }
        setCameraStatus('live');
        await new Promise((r) => setTimeout(r, 350));
        captureFrame(false);
        pulse = setInterval(() => captureFrame(true), 20000);
      } catch {
        setCameraStatus('denied');
        track('camera_denied', { reason: 'camera_denied_or_unavailable' });
        track('snapshot', { skipped: true, reason: 'camera_denied_or_unavailable' });
      }
    })();

    try { document.documentElement.requestFullscreen?.(); } catch { /* ignore */ }

    const onVis = () => {
      if (document.hidden && p.trackTabSwitch !== false) {
        track('tab_switch');
        captureFrame(false);
      }
    };
    const onBlur = () => track('window_blur');
    const onCopy = (e) => {
      if (p.trackCopyPaste === false) return;
      track('copy');
      e.preventDefault();
    };
    const onPaste = (e) => {
      if (p.trackCopyPaste === false) return;
      track('paste');
      e.preventDefault();
    };
    const onCut = (e) => {
      if (p.trackCopyPaste === false) return;
      track('copy');
      e.preventDefault();
    };
    const onFs = () => {
      if (p.trackFullscreen !== false && !document.fullscreenElement) track('fullscreen_exit');
    };
    const onMenu = (e) => {
      e.preventDefault();
      track('context_menu');
    };
    const onKey = (e) => {
      const key = e.key?.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (key === 'p' || key === 's')) {
        e.preventDefault();
        track('print');
      }
      if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === 'i' || key === 'j' || key === 'c'))) {
        e.preventDefault();
        track('devtools');
      }
      if ((e.ctrlKey || e.metaKey) && (key === 'c' || key === 'v' || key === 'x') && p.trackCopyPaste !== false) {
        e.preventDefault();
        track(key === 'v' ? 'paste' : 'copy');
      }
    };

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('paste', onPaste);
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('contextmenu', onMenu);
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('contextmenu', onMenu);
      document.removeEventListener('keydown', onKey);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      if (pulse) clearInterval(pulse);
      try { streamRef.current?.getTracks?.()?.forEach((t) => t.stop()); } catch { /* ignore */ }
      streamRef.current = null;
      try { if (videoRef.current) videoRef.current.srcObject = null; } catch { /* ignore */ }
      setCameraStatus('off');
      flushEvents();
      try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch { /* ignore */ }
    };
  }, [state, assessment, track, flushEvents, captureFrame]);

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

  const enableCameraPreflight = async () => {
    setPreflightCamera('requesting');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPreflightCamera('unavailable');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      if (previewRef.current) {
        previewRef.current.srcObject = stream;
        await previewRef.current.play();
      }
      stream.getTracks().forEach((t) => t.stop());
      setPreflightCamera('ready');
    } catch {
      setPreflightCamera('denied');
    }
  };

  const startTest = async () => {
    if (!acceptedTerms || !confirmedIdentity) {
      setError('Confirm your identity and accept the assessment terms to continue.');
      return;
    }
    if (assessment?.proctoring?.enabled && !acceptedMonitor) {
      setError('Integrity monitoring must be acknowledged before the session can begin.');
      return;
    }
    setStarting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/assessments/take/${token}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acceptedTerms: true,
          confirmedIdentity: true,
          cameraReady: preflightCamera === 'ready' || !assessment?.proctoring?.enabled,
        }),
      });
      const data = await res.json();
      if (res.status === 410) { setState('expired'); return; }
      if (!res.ok || !data.success) throw new Error(data.message || 'Unable to begin the session');
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
      if (!res.ok || !data.success) throw new Error(data.message || 'Unable to submit');
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

  const brand = assessment?.brand;
  const questions = assessment?.questions || [];
  const allowBack = assessment?.rules?.allowBack !== false;
  const q = questions[current] || questions[0];
  const allRequiredAnswered = questions.every((item) => {
    if (item.required === false) return true;
    return isAnswered(answers[item._id]);
  });
  const warnExpiry = remaining != null && remaining <= 60 && remaining > 0;
  const answeredCount = questions.filter((item) => isAnswered(answers[item._id])).length;
  const remainingCount = questions.length - answeredCount;
  const goTo = (index) => {
    if (index === current) return;
    if (index < current && !allowBack) return;
    setCurrent(index);
  };
  const firstUnanswered = questions.findIndex((item) => !isAnswered(answers[item._id]));
  const timerExtra = (
    <div className="flex items-center gap-2">
      {assessment?.proctoring?.enabled ? (
        <span className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
          cameraStatus === 'live' ? 'bg-emerald-50 text-emerald-800' : cameraStatus === 'denied' ? 'bg-amber-50 text-amber-800' : 'bg-stone-100 text-stone-600'
        }`}>
          <Camera size={12} /> {cameraStatus === 'live' ? 'Camera active' : cameraStatus === 'denied' ? 'Camera blocked' : 'Camera'}
        </span>
      ) : null}
      <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold tabular-nums ${warnExpiry ? 'bg-red-50 text-red-700' : 'bg-stone-100 text-stone-800'}`}>
        <Clock className="w-4 h-4" /> {formatTime(remaining)}
      </div>
    </div>
  );

  if (state === 'loading') {
    return (
      <ExamChrome brand={brand}>
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      </ExamChrome>
    );
  }

  if (state === 'expired' || state === 'error' || state === 'submitted') {
    const orgName = brand?.name || 'the hiring organisation';
    const map = {
      expired: { icon: Clock, color: 'text-amber-500', title: 'This link is no longer valid', body: 'Please contact the hiring organisation to request a new assessment link.' },
      error: { icon: AlertCircle, color: 'text-red-500', title: 'Unable to open this assessment', body: error },
      submitted: {
        icon: CheckCircle,
        color: 'text-emerald-500',
        title: 'Session complete',
        body: result?.message
          || (result?.pending
            ? 'Your responses have been recorded. Some items require review before a result is available. A confirmation has been sent to your email.'
            : `Your responses have been recorded for ${orgName}. A confirmation has been sent to your email. You will be contacted if a further update is issued.`),
      }
    };
    const m = map[state];
    const Icon = m.icon;
    const closeSession = () => {
      try {
        if (window.opener) {
          window.close();
          return;
        }
      } catch { /* ignore */ }
      setSessionClosed(true);
    };
    if (sessionClosed && state === 'submitted') {
      return (
        <ExamChrome brand={brand}>
          <div className="max-w-md mx-auto w-full text-center py-16">
            <p className="text-sm text-stone-500">You may close this browser tab.</p>
          </div>
        </ExamChrome>
      );
    }
    return (
      <ExamChrome brand={brand}>
        <div className="max-w-lg mx-auto w-full rounded-2xl border border-stone-200/80 bg-white shadow-xl shadow-stone-900/10 overflow-hidden">
          <div className="h-[3px] bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="p-8 sm:p-10 text-center">
            <div className={`mx-auto mb-4 h-14 w-14 rounded-2xl flex items-center justify-center ${
              state === 'submitted' ? 'bg-emerald-50' : state === 'expired' ? 'bg-amber-50' : 'bg-red-50'
            }`}>
              <Icon className={`w-7 h-7 ${m.color}`} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">
              {state === 'submitted' ? 'Assessment' : 'Notice'}
            </p>
            <h2 className="text-xl font-bold text-stone-900 tracking-tight mt-1">{m.title}</h2>
            <p className="text-stone-500 mt-2 text-sm leading-relaxed">{m.body}</p>
            {state === 'submitted' && result && !result.pending && result.totalScore != null && (
              <div className="mt-5 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Recorded score</p>
                <p className="text-lg font-bold tabular-nums text-stone-900 mt-0.5">
                  {result.totalScore}/{result.maxScore}
                  {result.passFail && result.passFail !== 'pending' ? ` · ${result.passFail}` : ''}
                </p>
              </div>
            )}
            <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
              {state === 'submitted' ? (
                <button type="button" className="btn-primary" onClick={closeSession}>Close</button>
              ) : brand?.websiteUrl ? (
                <a href={brand.websiteUrl} className="btn-primary">Return to {orgName}</a>
              ) : null}
            </div>
          </div>
        </div>
      </ExamChrome>
    );
  }

  if (state === 'instructions') {
    const orgName = assessment.brand?.name;
    const candidateName = assessment.candidate?.name;
    const proctorOn = !!assessment.proctoring?.enabled;
    const canBegin = acceptedTerms && confirmedIdentity && (!proctorOn || acceptedMonitor) && assessment.windowOpen !== false;
    return (
      <ExamChrome brand={brand}>
        <div className="max-w-xl mx-auto rounded-2xl border border-stone-200/80 bg-white shadow-xl shadow-stone-900/10 overflow-hidden">
          <div className="px-5 sm:px-7 py-4 border-b border-stone-100 bg-gradient-to-r from-stone-50/90 via-white to-teal-50/25">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">Secure assessment session</p>
            <p className="text-sm text-stone-600 mt-1">
              {orgName ? `${orgName} has invited you to complete this assessment.` : 'You have been invited to complete this assessment.'}
            </p>
          </div>
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2 text-brand-700 mb-2">
              <ClipboardList className="w-5 h-5" />
              <span className="text-sm font-semibold">Assessment</span>
            </div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">{assessment.title}</h1>
            {assessment.description && <p className="text-stone-600 mt-2 text-sm leading-relaxed">{assessment.description}</p>}

            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-2.5">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Duration</dt>
                <dd className="font-semibold text-stone-800 mt-0.5">{assessment.durationMinutes} minutes</dd>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-2.5">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Questions</dt>
                <dd className="font-semibold text-stone-800 mt-0.5">{assessment.questionCount}</dd>
              </div>
            </dl>
            <ul className="mt-4 space-y-1.5 text-sm text-stone-600">
              <li>The timer starts when you begin and is enforced by the server.</li>
              <li>{assessment.rules?.allowBack === false ? 'You cannot return to a previous question after leaving it.' : 'You may move between questions during the session.'}</li>
              <li>{assessment.rules?.requireAll !== false ? 'Required questions must be answered before submission.' : 'Some questions may be optional.'}</li>
              <li>Refreshing the page does not reset the timer or start a new attempt.</li>
            </ul>

            {(assessment.candidateInstructions || assessment.privacyNotice) && (
              <div className="mt-4 rounded-xl bg-stone-50 border border-stone-200 p-4 text-sm text-stone-600 space-y-2">
                {assessment.candidateInstructions ? <p>{assessment.candidateInstructions}</p> : null}
                {assessment.privacyNotice ? <p>{assessment.privacyNotice}</p> : null}
              </div>
            )}

            {proctorOn && (
              <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/70 p-4">
                <p className="text-sm font-semibold text-brand-900 inline-flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Integrity monitoring
                </p>
                <p className="text-xs text-brand-800 mt-1.5 leading-relaxed">
                  Webcam snapshots, tab changes, copy and paste, and similar activity will be recorded for this attempt and stored with your application.
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <video ref={previewRef} playsInline muted className="w-24 h-16 rounded-lg object-cover bg-stone-900" />
                  <button type="button" className="btn-secondary !text-xs" onClick={enableCameraPreflight}>
                    {preflightCamera === 'ready' ? 'Camera ready' : preflightCamera === 'denied' ? 'Camera blocked — retry' : 'Allow camera'}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-5 space-y-2.5">
              <label className="flex items-start gap-2.5 text-sm text-stone-700 cursor-pointer">
                <input type="checkbox" className="mt-1 rounded border-stone-300 text-brand-600" checked={confirmedIdentity} onChange={(e) => setConfirmedIdentity(e.target.checked)} />
                <span>
                  I confirm that I am {candidateName ? <strong>{candidateName}</strong> : 'the invited candidate'} and that I will complete this assessment myself.
                </span>
              </label>
              <label className="flex items-start gap-2.5 text-sm text-stone-700 cursor-pointer">
                <input type="checkbox" className="mt-1 rounded border-stone-300 text-brand-600" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
                <span>
                  I accept the assessment terms: no unauthorised assistance, no sharing of this link, and submission of my own work within the allotted time.
                </span>
              </label>
              {proctorOn ? (
                <label className="flex items-start gap-2.5 text-sm text-stone-700 cursor-pointer">
                  <input type="checkbox" className="mt-1 rounded border-stone-300 text-brand-600" checked={acceptedMonitor} onChange={(e) => setAcceptedMonitor(e.target.checked)} />
                  <span>
                    I consent to webcam capture and session integrity monitoring for this attempt.
                  </span>
                </label>
              ) : null}
            </div>

            {!assessment.windowOpen && (
              <p className="mt-4 text-sm text-amber-700">This assessment is outside its availability window.</p>
            )}
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <button
              type="button"
              onClick={startTest}
              disabled={starting || !canBegin}
              className="btn-primary mt-6 w-full py-3 disabled:opacity-50"
            >
              {starting ? 'Opening session…' : 'Begin assessment'}
            </button>
            <p className="mt-3 text-[11px] text-stone-400 text-center inline-flex items-center justify-center gap-1 w-full">
              <Lock size={11} /> Consent is recorded with this attempt.
            </p>
          </div>
        </div>
      </ExamChrome>
    );
  }

  if (state !== 'ready' || !assessment) {
    return (
      <ExamChrome brand={brand}>
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      </ExamChrome>
    );
  }

  return (
    <ExamChrome brand={brand} extra={timerExtra} wide>
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-4">
        <aside className="card-ats-bordered p-4 h-fit lg:sticky lg:top-24">
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Question palette</p>
          <p className="text-sm font-semibold text-stone-800 mt-1">{assessment.title}</p>
          <p className="text-xs text-stone-500 mt-1">
            {saveState === 'saving' ? 'Saving responses…' : saveState === 'unsaved' ? 'Waiting to save' : 'Responses saved'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {questions.map((item, index) => {
              const done = isAnswered(answers[item._id]);
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
                      ? 'bg-brand-600 text-white border-brand-600 ring-2 ring-brand-200'
                      : done
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-stone-200 text-stone-500 border-stone-200'
                  }`}
                  title={done ? `Question ${index + 1} attempted` : `Question ${index + 1} not attempted`}
                  aria-label={`Question ${index + 1}${done ? ', attempted' : ', not attempted'}${active ? ', current' : ''}`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <ul className="mt-4 space-y-1.5 text-[11px] text-stone-500">
            <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" /> Attempted ({answeredCount})</li>
            <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-stone-300" /> Not attempted ({remainingCount})</li>
            <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-brand-600" /> Current</li>
          </ul>
          {firstUnanswered >= 0 ? (
            <button type="button" className="btn-secondary !text-xs w-full mt-3" onClick={() => goTo(firstUnanswered)}>
              Next unanswered
            </button>
          ) : null}
        </aside>

        <div className="space-y-4 min-w-0">
          {warnExpiry && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">
              Less than one minute remaining. Responses will be submitted automatically when time ends.
            </p>
          )}
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
                    <label key={oIdx} className={`flex items-center gap-2 text-sm text-stone-700 cursor-pointer p-2.5 rounded-xl border ${
                      answers[q._id] === String(oIdx) ? 'border-brand-300 bg-brand-50/60' : 'border-transparent hover:bg-stone-50'
                    }`}>
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
                  placeholder={q.type === 'code' ? `Enter your ${q.language || 'code'} solution` : 'Enter your response'}
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
                    Review and submit
                  </button>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmSubmit}
        onClose={() => { if (!submitting) setConfirmSubmit(false); }}
        onConfirm={() => handleSubmit(false)}
        isLoading={submitting}
        type="warning"
        zClass="z-[400]"
        eyebrow="Final submission"
        title="Submit this assessment?"
        message="Once submitted, you cannot change your responses. Confirm that you have reviewed every question."
        confirmText="Submit assessment"
      />

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
            {cameraStatus === 'live' ? 'Live camera' : 'Integrity monitor'}
          </p>
        </aside>
      ) : (
        <video ref={videoRef} className="hidden" muted playsInline />
      )}
    </ExamChrome>
  );
};

export default AssessmentTakePage;
