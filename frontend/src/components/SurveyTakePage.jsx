import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2, Star, AlertCircle, CheckCircle } from 'lucide-react';
import API_URL from '../config';

export default function SurveyTakePage() {
  const { token } = useParams();
  const [survey, setSurvey] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/surveys/take/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) throw new Error(d.message);
        if (d.data.submitted) setSubmitted(true);
        else setSurvey(d.data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const answerArr = (survey.questions || []).map((q, i) => ({
        questionId: q._id,
        prompt: q.prompt,
        response: answers[i] ?? answers[q._id] ?? ''
      }));
      const res = await fetch(`${API_URL}/api/surveys/take/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answerArr })
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.message);
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        <p className="text-sm text-stone-500 font-medium">Loading survey…</p>
      </div>
    );
  }

  if (error && !survey && !submitted) {
    return (
      <div className="min-h-screen bg-stone-50">
        <header className="bg-white border-b border-stone-200">
          <div className="max-w-lg mx-auto px-4 sm:px-6 py-4 sm:py-5">
            <Link to="/" className="flex items-center gap-2.5 text-stone-900 font-semibold">
              <img src="/atslogo.jpg" alt="SkillNix" className="w-8 h-8 rounded-lg flex-shrink-0" />
              <span className="text-sm sm:text-base">SkillNix</span>
            </Link>
          </div>
        </header>
        <div className="flex items-center justify-center px-4 sm:px-6 py-16">
          <div className="max-w-md w-full card-ats-bordered p-8 text-center relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <p className="text-stone-800 font-semibold">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-stone-50">
        <header className="bg-white border-b border-stone-200">
          <div className="max-w-lg mx-auto px-4 sm:px-6 py-4 sm:py-5">
            <Link to="/" className="flex items-center gap-2.5 text-stone-900 font-semibold">
              <img src="/atslogo.jpg" alt="SkillNix" className="w-8 h-8 rounded-lg flex-shrink-0" />
              <span className="text-sm sm:text-base">SkillNix</span>
            </Link>
          </div>
        </header>
        <div className="flex items-center justify-center px-4 sm:px-6 py-12 sm:py-16 animate-page-enter">
          <div className="max-w-md w-full card-ats-bordered p-8 sm:p-10 text-center relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/70 flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-7 h-7 text-amber-500" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">Thank you!</h1>
            <p className="text-stone-500 mt-2 text-sm sm:text-base leading-relaxed">
              Your feedback helps us improve the hiring experience.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 overflow-x-hidden">
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <Link to="/" className="flex items-center gap-2.5 text-stone-900 font-semibold">
            <img src="/atslogo.jpg" alt="SkillNix" className="w-8 h-8 rounded-lg flex-shrink-0" />
            <span className="text-sm sm:text-base">SkillNix</span>
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-page-enter">
        <form onSubmit={handleSubmit} className="card-ats-bordered p-5 sm:p-8 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />

          <div className="flex items-start gap-3 mb-6 sm:mb-8">
            <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200/70 flex items-center justify-center flex-shrink-0">
              <Star className="w-5 h-5 text-brand-600" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight leading-tight pt-0.5">
              {survey?.title}
            </h1>
          </div>

          <div className="space-y-6 sm:space-y-7">
            {(survey?.questions || []).map((q, i) => (
              <div key={q._id || i}>
                <label className="label-ats !text-sm !text-stone-800">{q.prompt}</label>
                {q.type === 'text' ? (
                  <textarea
                    className="textarea-ats"
                    rows={3}
                    value={answers[i] || ''}
                    onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                  />
                ) : q.type === 'nps' ? (
                  <input
                    type="number"
                    min={0}
                    max={10}
                    className="input-ats w-24"
                    value={answers[i] || ''}
                    onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setAnswers({ ...answers, [i]: n })}
                        className={`w-11 h-11 sm:w-10 sm:h-10 rounded-xl border text-sm font-semibold transition-colors touch-target ${
                          answers[i] === n
                            ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20'
                            : 'border-stone-200 bg-white hover:border-brand-300 text-stone-700'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {error && (
            <p className="field-error flex items-center gap-1.5 mt-4">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full mt-8 touch-target"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
            ) : (
              'Submit feedback'
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
