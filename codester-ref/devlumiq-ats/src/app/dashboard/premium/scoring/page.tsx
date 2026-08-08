/**
 * Interview Scoring Page
 * =======================
 * Allows interviewers to rate candidates across 5 key criteria (1–5 stars).
 * Scores are persisted to the database and can be reviewed per candidate.
 */
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, Target, Award, Save, TrendingUp } from 'lucide-react';
import { CandidateSelector } from '@/components/ui/CandidateSelector';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import Link from 'next/link';
import { useLocale } from '@/components/providers/LocaleProvider';
import { InterviewTranscriptPanel, type ScorecardSuggestion } from '@/components/dashboard/InterviewTranscriptPanel';

interface Candidate {
  id: string;
  name: string;
  email: string;
  position?: string;
}

interface Score {
  criteria: string;
  score: number;
  notes: string;
}

const CRITERIA = [
  { id: 'technical', name: 'Technical Skills', description: 'Knowledge and expertise in required technologies' },
  { id: 'communication', name: 'Communication', description: 'Clarity and articulation of ideas' },
  { id: 'problemSolving', name: 'Problem Solving', description: 'Analytical thinking and approach to challenges' },
  { id: 'culturalFit', name: 'Cultural Fit', description: 'Alignment with company values and team dynamics' },
  { id: 'experience', name: 'Experience', description: 'Relevant background and past achievements' },
];

export default function InterviewScoringPage() {
  const { t } = useLocale();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [scores, setScores] = useState<Score[]>(
    CRITERIA.map(c => ({ criteria: c.name, score: 0, notes: '' }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedScores, setSavedScores] = useState<any[]>([]);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    fetchCandidates();
  }, []);

  useEffect(() => {
    if (!selectedCandidate) {
      setInterviewId(null);
      return;
    }
    fetch(`/api/calendar/events?start=${new Date(0).toISOString()}&end=${new Date(Date.now() + 365 * 86400000).toISOString()}`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        const events = Array.isArray(list) ? list : [];
        const match = events.find((e: { candidateId?: string }) => e.candidateId === selectedCandidate.id);
        setInterviewId(match?.id ?? null);
      })
      .catch(() => setInterviewId(null));
  }, [selectedCandidate]);

  const fetchCandidates = async () => {
    try {
      const res = await fetch('/api/candidates', { credentials: 'include' });
      const data = await res.json();
      setCandidates(data.candidates || []);
      if (data.candidates?.length > 0) {
        setSelectedCandidate(data.candidates[0]);
        fetchScores(data.candidates[0].id);
      }
    } catch {
      toast.error('Failed to load candidates');
    } finally {
      setLoading(false);
    }
  };

  const fetchScores = async (candidateId: string) => {
    try {
      const res = await fetch(`/api/candidates/${candidateId}/scores`, { credentials: 'include' });
      const data = await res.json();
      if (data.scores?.length > 0) {
        setSavedScores(data.scores);
        const freshScores = CRITERIA.map(c => {
          const saved = data.scores.find((saved: any) => saved.criteria === c.name);
          return saved ? { criteria: c.name, score: saved.score, notes: saved.notes || '' } : { criteria: c.name, score: 0, notes: '' };
        });
        setScores(freshScores);
      } else {
        setSavedScores([]);
        setScores(CRITERIA.map(c => ({ criteria: c.name, score: 0, notes: '' })));
      }
    } catch {
      setSavedScores([]);
      setScores(CRITERIA.map(c => ({ criteria: c.name, score: 0, notes: '' })));
    }
  };

  const selectCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    fetchScores(candidate.id);
  };

  const updateScore = (index: number, score: number) => {
    const newScores = [...scores];
    newScores[index].score = score;
    setScores(newScores);
  };

  const updateNotes = (index: number, notes: string) => {
    const newScores = [...scores];
    newScores[index].notes = notes;
    setScores(newScores);
  };

  const applyAiSuggestions = (suggestions: ScorecardSuggestion[]) => {
    setScores((prev) =>
      prev.map((row) => {
        const match = suggestions.find(
          (s) =>
            s.name.trim().toLowerCase() === row.criteria.toLowerCase() ||
            row.criteria.toLowerCase().includes(s.name.trim().toLowerCase()) ||
            s.name.trim().toLowerCase().includes(row.criteria.toLowerCase()),
        );
        if (!match) return row;
        const score = Math.max(0, Math.min(5, Math.round(Number(match.suggestedScore) || 0)));
        return {
          ...row,
          score: score || row.score,
          notes: match.rationale
            ? row.notes
              ? `${row.notes}\n\nAI: ${match.rationale}`
              : match.rationale
            : row.notes,
        };
      }),
    );
  };

  const saveScores = async () => {
    if (!selectedCandidate) return;
    
    setSaving(true);
    try {
      for (const score of scores) {
        if (score.score > 0) {
          const res = await fetch(`/api/candidates/${selectedCandidate.id}/scores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              criteria: score.criteria,
              score: score.score,
              maxScore: 5,
              notes: score.notes,
            }),
          });
          if (!res.ok) throw new Error('Save failed');
        }
      }
      
      toast.success('Interview scores saved successfully');
      fetchScores(selectedCandidate.id);
    } catch {
      toast.error('Failed to save scores');
    } finally {
      setSaving(false);
    }
  };

  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
  const maxTotal = scores.length * 5;
  const percentage = Math.round((totalScore / maxTotal) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
    <PageShell>
      <PageHeader
        icon={Star}
        title="Interview Scoring"
        subtitle="Rate candidates on 5 key criteria"
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6">
        {/* Left Column - Candidate & Overall */}
        <div className="xl:col-span-4 space-y-4">
          {/* Candidate Selector */}
          <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-sm">
            <h3 className="font-bold text-stone-900 mb-3 text-sm">
              Select Candidate
            </h3>
            <CandidateSelector
              candidates={candidates}
              selected={selectedCandidate}
              onSelect={(c) => selectCandidate(c as Candidate)}
              subtitle="position"
            />

            {selectedCandidate && (
              <Link
                href={`/dashboard/candidates/${selectedCandidate.id}`}
                className="mt-3 text-sm text-brand-600 hover:text-brand-700 font-medium block"
              >
                View full profile →
              </Link>
            )}
          </div>

          {/* Overall Score */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-stone-900">Overall Score</h3>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                percentage >= 80 ? 'bg-emerald-100 text-emerald-700' :
                percentage >= 60 ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {percentage}%
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-bold text-stone-900">{totalScore}</span>
                <span className="text-xl text-stone-500">/ {maxTotal}</span>
              </div>
              <p className="text-center text-sm text-stone-500 mt-1">
                {scores.filter(s => s.score > 0).length} of {scores.length} criteria rated
              </p>
            </div>

            <div className="h-3 bg-white rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  percentage >= 80 ? 'bg-emerald-500' :
                  percentage >= 60 ? 'bg-amber-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          {/* Save Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={saveScores}
            disabled={saving || !selectedCandidate}
            className="w-full p-4 bg-gradient-to-r from-brand-600 to-teal-600 text-white rounded-xl font-bold hover:from-brand-700 hover:to-teal-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Scores
              </>
            )}
          </motion.button>
        </div>

        {/* Right Column - Scoring Criteria */}
        <div className="xl:col-span-8 space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-sm">
            <h3 className="font-bold text-stone-900 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-brand-600" />
              Rate Each Criteria (1-5 Stars)
            </h3>

            <div className="space-y-4">
              {CRITERIA.map((criterion, index) => (
                <div key={criterion.id} className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-stone-900">{criterion.name}</h4>
                      <p className="text-sm text-stone-500">{criterion.description}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <motion.button
                          key={star}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => updateScore(index, star)}
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg transition-colors flex-shrink-0 ${
                            star <= scores[index].score
                              ? 'bg-amber-400 text-white'
                              : 'bg-stone-200 text-stone-400 hover:bg-stone-300'
                          }`}
                        >
                          <Star className="w-4 h-4 mx-auto" />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={scores[index].notes}
                    onChange={(e) => updateNotes(index, e.target.value)}
                    placeholder={`Add notes about ${criterion.name.toLowerCase()}...`}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm focus:border-brand-500 outline-none resize-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {interviewId && (
            <InterviewTranscriptPanel
              interviewId={interviewId}
              onApplySuggestions={applyAiSuggestions}
            />
          )}

          {/* Previous Scores */}
          {savedScores.length > 0 && (
            <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-sm">
              <h3 className="font-bold text-stone-900 mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-brand-600" />
                Previous Evaluations
              </h3>
              <div className="space-y-2">
                {savedScores.slice(0, 3).map((score, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-stone-50">
                    <div>
                      <p className="font-medium text-stone-900">{score.criteria}</p>
                      <p className="text-xs text-stone-500">by {score.scoredBy} • {new Date(score.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(score.score)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
    </motion.div>
  );
}
