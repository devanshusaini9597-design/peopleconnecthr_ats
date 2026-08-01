import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ClipboardList, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import API_URL from '../config';

/**
 * Candidate-facing assessment page — reached via a magic-link token from
 * the invite email, no login required. Mirrors CandidatePortal's
 * token-based auth pattern.
 */
const AssessmentTakePage = () => {
  const { token } = useParams();
  const [state, setState] = useState('loading'); // loading, ready, submitted, expired, error
  const [assessment, setAssessment] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
      } catch (err) {
        setState('error');
        setError('Failed to load assessment');
      }
    })();
  }, [token]);

  const handleAnswer = (questionId, response) => {
    setAnswers((prev) => ({ ...prev, [questionId]: response }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
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
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 text-gray-400 animate-spin" /></div>;
  }

  if (state === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md text-center bg-white border border-gray-200 rounded-2xl p-10 shadow-sm">
          <Clock className="w-10 h-10 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900">This link has expired</h2>
          <p className="text-gray-500 mt-2 text-sm">Contact the hiring team to request a new assessment link.</p>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md text-center bg-white border border-gray-200 rounded-2xl p-10 shadow-sm">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900">Something went wrong</h2>
          <p className="text-gray-500 mt-2 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (state === 'submitted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md text-center bg-white border border-gray-200 rounded-2xl p-10 shadow-sm">
          <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900">Assessment submitted</h2>
          <p className="text-gray-500 mt-2 text-sm">Thanks for completing it — the hiring team will review your answers and follow up.</p>
        </div>
      </div>
    );
  }

  const allAnswered = assessment.questions.every((q) => (answers[q._id] || '').toString().trim().length > 0);

  return (
    <div className="min-h-screen bg-gray-50 font-sans py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex items-center gap-2 text-indigo-600 mb-2">
            <ClipboardList className="w-5 h-5" />
            <span className="text-sm font-medium">Skills Assessment</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{assessment.title}</h1>
          {assessment.description && <p className="text-gray-600 mt-2">{assessment.description}</p>}
          <p className="text-sm text-gray-400 mt-3 flex items-center gap-1"><Clock className="w-4 h-4" /> Estimated time: {assessment.durationMinutes} minutes</p>
        </div>

        <div className="space-y-4">
          {assessment.questions.map((q, idx) => (
            <div key={q._id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <p className="text-sm font-semibold text-gray-900 mb-3">Q{idx + 1}. {q.prompt} <span className="text-xs text-gray-400 font-normal">({q.points} pts)</span></p>

              {q.type === 'multiple_choice' ? (
                <div className="space-y-2">
                  {(q.options || []).map((opt, oIdx) => (
                    <label key={oIdx} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                      <input
                        type="radio"
                        name={q._id}
                        checked={answers[q._id] === String(oIdx)}
                        onChange={() => handleAnswer(q._id, String(oIdx))}
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
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm ${q.type === 'code' ? 'font-mono bg-gray-900 text-gray-100 border-gray-700' : ''}`}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !allAnswered}
          className="mt-6 w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : allAnswered ? 'Submit Assessment' : 'Answer all questions to submit'}
        </button>
      </div>
    </div>
  );
};

export default AssessmentTakePage;
