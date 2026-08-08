'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, Target, Award, X, Save } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface ScoreItem {
  id: string;
  criteria: string;
  score: number;
  maxScore: number;
  notes: string;
  scoredBy: string;
  createdAt: string;
}

interface InterviewScoringProps {
  scores: ScoreItem[];
  loading?: boolean;
}

export function InterviewScoringPanel({ scores, loading }: InterviewScoringProps) {
  const averageScore = scores.length > 0 
    ? Math.round(scores.reduce((sum, s) => sum + (s.score / s.maxScore) * 100, 0) / scores.length)
    : 0;

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-20 bg-stone-50 rounded-xl" />
        <div className="h-20 bg-stone-50 rounded-xl" />
      </div>
    );
  }

  if (scores.length === 0) {
    return (
      <div className="text-center py-12">
        <Star className="w-12 h-12 text-stone-300 mx-auto mb-4" />
        <p className="text-stone-600 font-medium">No interview scores yet</p>
        <p className="text-sm text-stone-500 mt-1">Score the candidate after interview</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall Score Card */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            averageScore >= 80 ? 'bg-emerald-100 text-emerald-700' : 
            averageScore >= 60 ? 'bg-amber-100 text-amber-700' : 
            'bg-red-100 text-red-700'
          }`}>
            <Target className="w-6 h-6" />
          </div>
          <div>
            <p className="font-bold text-stone-900">Overall Score</p>
            <p className="text-sm text-stone-500">{scores.length} criteria evaluated</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Award className={`w-5 h-5 ${averageScore >= 80 ? 'text-emerald-500' : averageScore >= 60 ? 'text-amber-500' : 'text-red-500'}`} />
          <span className={`text-3xl font-bold ${
            averageScore >= 80 ? 'text-emerald-600' : 
            averageScore >= 60 ? 'text-amber-600' : 
            'text-red-600'
          }`}>
            {averageScore}%
          </span>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {scores.map((score) => (
          <div key={score.id} className="rounded-xl border border-stone-200 p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-stone-900">{score.criteria}</p>
              <span className="text-sm font-bold text-brand-600">{score.score}/{score.maxScore}</span>
            </div>
            <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-brand-500 to-teal-500 rounded-full transition-all duration-500"
                style={{ width: `${(score.score / score.maxScore) * 100}%` }}
              />
            </div>
            {score.notes && (
              <p className="text-xs text-stone-500 mt-2 italic">"{score.notes}"</p>
            )}
            <p className="text-xs text-stone-400 mt-2">by {score.scoredBy} • {new Date(score.createdAt).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId: string;
  onSave: () => void;
}

const CRITERIA_TEMPLATES = [
  { name: 'Technical Skills', description: 'Knowledge and expertise' },
  { name: 'Communication', description: 'Clarity and articulation' },
  { name: 'Problem Solving', description: 'Analytical thinking' },
  { name: 'Cultural Fit', description: 'Team alignment' },
  { name: 'Experience', description: 'Relevant background' },
];

export function InterviewScoreModal({ isOpen, onClose, candidateId, onSave }: ScoreModalProps) {
  const [criteria, setCriteria] = useState(
    CRITERIA_TEMPLATES.map(c => ({ ...c, score: 0, notes: '' }))
  );
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const totalScore = criteria.reduce((sum, c) => sum + c.score, 0);
  const maxTotal = criteria.length * 5;
  const percentage = Math.round((totalScore / maxTotal) * 100);

  const saveScores = async () => {
    setSaving(true);
    try {
      for (const c of criteria) {
        if (c.score > 0) {
          await fetch(`/api/interviews/${candidateId}/scores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              criteria: c.name,
              score: c.score,
              maxScore: 5,
              notes: c.notes,
              scoredBy: 'HR Manager'
            })
          });
        }
      }
      toast.success('Interview scores saved');
      onSave();
      onClose();
    } catch {
      toast.error('Failed to save scores');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl sm:max-w-lg max-h-[95vh] overflow-y-auto"
      >
        {/* Header - Responsive layout */}
        <div className="p-4 sm:p-6 border-b border-stone-100 sticky top-0 bg-white rounded-t-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Star className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-stone-900">Interview Scoring</h2>
                <p className="text-xs sm:text-sm text-stone-500">Rate candidate 1-5 stars</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-lg flex-shrink-0">
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-stone-500" />
            </button>
          </div>
        </div>

        {/* Body - Responsive spacing */}
        <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
          {/* Overall Score */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 p-3 sm:p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl">
            <span className="text-sm sm:text-base font-semibold text-stone-900">Overall Score</span>
            <span className={`text-xl sm:text-2xl font-bold ${
              percentage >= 80 ? 'text-emerald-600' : 
              percentage >= 60 ? 'text-amber-600' : 
              'text-red-600'
            }`}>
              {percentage}%
            </span>
          </div>

          {/* Criteria */}
          <div className="space-y-2.5 sm:space-y-3">
            {criteria.map((criterion, idx) => (
              <div key={criterion.name} className="p-3 sm:p-4 border border-stone-200 rounded-xl space-y-2.5">
                {/* Criterion header - stack on mobile */}
                <div className="flex flex-col gap-2">
                  <div>
                    <span className="text-xs sm:text-sm font-semibold text-stone-900 line-clamp-2">{criterion.name}</span>
                    <p className="text-[11px] sm:text-xs text-stone-500 line-clamp-1">{criterion.description}</p>
                  </div>
                  
                  {/* Stars - responsive grid */}
                  <div className="flex gap-1 flex-wrap">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <motion.button
                        key={star}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          const newCriteria = [...criteria];
                          newCriteria[idx].score = star;
                          setCriteria(newCriteria);
                        }}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg transition-colors flex items-center justify-center ${
                          star <= criterion.score
                            ? 'bg-amber-400 text-white shadow-sm'
                            : 'bg-stone-100 text-stone-400 hover:bg-stone-200'
                        }`}
                      >
                        <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Notes input */}
                <input
                  type="text"
                  value={criterion.notes}
                  onChange={(e) => {
                    const newCriteria = [...criteria];
                    newCriteria[idx].notes = e.target.value;
                    setCriteria(newCriteria);
                  }}
                  placeholder="Add notes..."
                  maxLength={100}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-white text-xs sm:text-sm focus:border-brand-500 outline-none"
                />
              </div>
            ))}
          </div>

          {/* Action buttons - responsive layout */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2 sm:pt-4">
            <button
              onClick={saveScores}
              disabled={saving}
              className="flex-1 py-2.5 sm:py-3 bg-brand-600 text-white rounded-xl text-sm sm:text-base font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="hidden sm:inline">Saving...</span>
                  <span className="sm:hidden">Save...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Save Scores</span>
                  <span className="sm:hidden">Save</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-4 sm:px-6 py-2.5 sm:py-3 border border-stone-200 text-stone-700 rounded-xl text-sm sm:text-base font-semibold hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
