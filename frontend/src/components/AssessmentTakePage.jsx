import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ClipboardList, Clock, CheckCircle, AlertCircle, Loader2, Shield } from 'lucide-react';
import API_URL from '../config';

/**
 * Candidate-facing assessment page — magic-link token, optional proctoring.
 */
const AssessmentTakePage = () => {
  const { token } = useParams();
  const [state, setState] = useState('loading');
  const [assessment, setAssessment] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const eventQueue = useRef([]);
  const flushTimer = useRef(null);

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
    eventQueue.current.push({ type, at: new Date().toISOString(), meta });
    if (!flushTimer.current) {
      flushTimer.current = setTimeout(() => {
        flushTimer.current = null;
        flushEvents();
      }, 800);
    }
  }, [assessment?.proctoring?.enabled, flushEvents]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/assessments/take/${token}`);
        const data = await res.json();
        if (res.status === 410) { setState('expired'); return; }
        if (!res.ok || !data.success) { setState('error'); setError(data.message || 'Failed to load assessment'); return; }
        if (data.data.submitted) { setState('submitted'); return; }
        setAssessment(data.data);
        setState('ready');
      } catch {
        setState('error');
        setError('Failed to load assessment');
      }
    })();
  }, [token]);

  useEffect(() => {
    if (state !== 'ready' || !assessment?.proctoring?.enabled) return undefined;
    const p = assessment.proctoring;
    track('start');

    // Optional identity snapshot (webcam) — best-effort, never blocks the exam
    let stream;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return;
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 }, audio: false });
        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        await video.play();
        await new Promise((r) => setTimeout(r, 400));
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, 320, 240);
        const image = canvas.toDataURL('image/jpeg', 0.45);
        track('snapshot', { image, w: 320, h: 240 });
      } catch {
        track('snapshot', { skipped: true, reason: 'camera_denied_or_unavailable' });
      } finally {
        try { stream?.getTracks()?.forEach((t) => t.stop()); } catch { /* ignore */ }
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
      flushEvents();
    };
  }, [state, assessment, track, flushEvents]);

  const handleAnswer = (questionId, response) => {
    setAnswers((prev) => ({ ...prev, [questionId]: response }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    track('submit');
    await flushEvents();
    try {
      const payload = { answers: Object.entries(answers).map(([questionId, response]) => ({ questionId, response })) };
      const res = await fetch(`${API_URL}/api/assessments/take/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to submit');
      setState('submitted');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (state === 'loading') {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-stone-50">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (state === 'expired' || state === 'error' || state === 'submitted') {
    const map = {
      expired: { icon: Clock, color: 'text-amber-500', title: 'This link has expired', body: 'Contact the hiring team to request a new assessment link.' },
      error: { icon: AlertCircle, color: 'text-red-500', title: 'Something went wrong', body: error },
      submitted: { icon: CheckCircle, color: 'text-emerald-500', title: 'Assessment submitted', body: 'Thanks — the hiring team will review your answers and follow up.' }
    };
    const m = map[state];
    const Icon = m.icon;
    return (
      <div className="min-h-dvh flex items-center justify-center bg-stone-50 p-4">
        <div className="max-w-md w-full text-center bg-white border border-stone-200 rounded-2xl p-8 sm:p-10 shadow-sm">
          <Icon className={`w-10 h-10 ${m.color} mx-auto mb-4`} />
          <h2 className="text-xl font-bold text-stone-900">{m.title}</h2>
          <p className="text-stone-500 mt-2 text-sm leading-relaxed">{m.body}</p>
        </div>
      </div>
    );
  }

  const allAnswered = assessment.questions.every((q) => (answers[q._id] || '').toString().trim().length > 0);

  return (
    <div className="min-h-dvh bg-stone-50 font-sans py-6 sm:py-10 px-3 sm:px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 mb-4 sm:mb-6 shadow-sm">
          <div className="flex items-center gap-2 text-brand-600 mb-2">
            <ClipboardList className="w-5 h-5" />
            <span className="text-sm font-medium">Skills Assessment</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">{assessment.title}</h1>
          {assessment.description && <p className="text-stone-600 mt-2 text-sm sm:text-base">{assessment.description}</p>}
          <p className="text-sm text-stone-400 mt-3 flex items-center gap-1">
            <Clock className="w-4 h-4" /> Estimated time: {assessment.durationMinutes} minutes
          </p>
          {assessment.proctoring?.enabled && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-brand-50 border border-brand-100 px-3 py-2 text-xs text-brand-800">
              <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Integrity monitoring is on. A quick webcam snapshot may be taken at start; tab switches, copy/paste, and leaving the window may be recorded.</span>
            </div>
          )}
        </div>

        <div className="space-y-3 sm:space-y-4">
          {assessment.questions.map((q, idx) => (
            <div key={q._id} className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 shadow-sm">
              <p className="text-sm font-semibold text-stone-900 mb-3">
                Q{idx + 1}. {q.prompt}{' '}
                <span className="text-xs text-stone-400 font-normal">({q.points} pts)</span>
              </p>

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
                  rows={q.type === 'code' ? 8 : 4}
                  placeholder={q.type === 'code' ? `Write your ${q.language || 'code'} solution here…` : 'Type your answer here…'}
                  className={`w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 ${
                    q.type === 'code' ? 'font-mono bg-stone-900 text-stone-100 border-stone-700' : ''
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !allAnswered}
          className="mt-6 w-full py-3 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Submitting…' : allAnswered ? 'Submit Assessment' : 'Answer all questions to submit'}
        </button>
      </div>
    </div>
  );
};

export default AssessmentTakePage;
