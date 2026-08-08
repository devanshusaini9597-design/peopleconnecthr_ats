'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList, Plus, Clock, CheckCircle, XCircle, Users, FileText, Star, Award,
  Target, Search, Filter, MoreHorizontal,
  Brain, Puzzle, MessageSquare, Sparkles, Crown, ArrowRight, Loader2, X, Trash2,
  ChevronDown, Send, Copy, AlertCircle,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import StatCard from '@/components/ui/StatCard';
import { useLocale } from '@/components/providers/LocaleProvider';
import { useToast } from '@/components/ui/Toast';
import { format } from 'date-fns';
import { IntegrityReportModal } from '@/components/dashboard/IntegrityReportModal';
import { AssignmentDetailModal } from '@/components/dashboard/AssignmentDetailModal';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type QuestionFormData = {
  id: string;
  type: 'multiple_choice' | 'open_ended' | 'coding';
  question: string;
  description: string;
  options: string[];
  correctAnswer: string;
  points: number;
  language?: string;
};

type AssessmentFormData = {
  name: string;
  description: string;
  category: 'technical' | 'cognitive' | 'personality' | 'language';
  type: 'MULTIPLE_CHOICE' | 'CODING' | 'OPEN_ENDED' | 'PERSONALITY' | 'LOGICAL_REASONING' | 'LANGUAGE';
  duration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  passingScore: number;
  proctoringEnabled: boolean;
  proctoringStrictness: 'off' | 'standard' | 'strict';
  requireFullscreen: boolean;
  snapshotIntervalSec: number;
  questions: QuestionFormData[];
};

type AssessmentTemplate = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  type: string;
  duration: number | null;
  difficulty: string;
  passingScore: number;
  isActive: boolean;
  proctoringEnabled?: boolean;
  proctoringStrictness?: string;
  requireFullscreen?: boolean;
  snapshotIntervalSec?: number;
  _count?: { questions: number; assignments: number };
};

type AssessmentAssignment = {
  id: string;
  candidateId: string;
  candidate: { name: string; email: string };
  template: { name: string; category: string };
  status: string;
  reviewStatus?: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  passed: boolean | null;
  createdAt: string;
};

type CandidateOption = { id: string; name: string; email: string };

// â”€â”€â”€ Portal: Template action menu â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TemplateMenuPortal({
  isOpen, onClose, triggerId, onAssign, onDuplicate, onDelete,
}: {
  isOpen: boolean; onClose: () => void; triggerId: string;
  onAssign: () => void; onDuplicate: () => void; onDelete: () => void;
}) {
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number }>({ right: 20 });

  useEffect(() => {
    if (!isOpen) return;
    const btn = document.getElementById(triggerId);
    if (btn) {
      const r = btn.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      if (spaceBelow < 180 && r.top > spaceBelow) {
        setPos({ bottom: window.innerHeight - r.top + 4, right: Math.max(8, window.innerWidth - r.right) });
      } else {
        setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
      }
    }
  }, [isOpen, triggerId]);

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed w-52 bg-white rounded-xl shadow-2xl border border-stone-200 z-50 overflow-hidden"
        style={{
          ...(pos.top !== undefined ? { top: pos.top } : {}),
          ...(pos.bottom !== undefined ? { bottom: pos.bottom } : {}),
          right: pos.right,
          maxWidth: 'calc(100vw - 16px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 bg-gradient-to-r from-brand-600 to-teal-600">
          <p className="text-xs font-semibold text-white flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" />Template Actions
          </p>
        </div>
        <div className="py-1">
          <button
            onClick={() => { onAssign(); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-stone-700 hover:bg-brand-50 hover:text-brand-700 transition-colors"
          >
            <span className="w-6 h-6 rounded-md bg-brand-100 flex items-center justify-center flex-shrink-0">
              <Send className="w-3 h-3 text-brand-600" />
            </span>
            Assign to Candidate
          </button>
          <button
            onClick={() => { onDuplicate(); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
          >
            <span className="w-6 h-6 rounded-md bg-stone-100 flex items-center justify-center flex-shrink-0">
              <Copy className="w-3 h-3 text-stone-600" />
            </span>
            Duplicate
          </button>
        </div>
        <div className="border-t border-red-100 bg-gradient-to-r from-red-50/50 to-rose-50/50">
          <button
            onClick={() => { onDelete(); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-100/70 transition-colors"
          >
            <span className="w-6 h-6 rounded-md bg-red-100 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-3 h-3 text-red-600" />
            </span>
            <span className="font-semibold">Delete</span>
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

// â”€â”€â”€ Create Assessment Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const BLANK_QUESTION = (): QuestionFormData => ({
  id: String(Date.now() + Math.random()),
  type: 'multiple_choice',
  question: '',
  description: '',
  options: ['', ''],
  correctAnswer: '',
  points: 10,
});

const BLANK_FORM = (): AssessmentFormData => ({
  name: '',
  description: '',
  category: 'technical',
  type: 'MULTIPLE_CHOICE',
  duration: 30,
  difficulty: 'intermediate',
  passingScore: 70,
  proctoringEnabled: false,
  proctoringStrictness: 'standard',
  requireFullscreen: false,
  snapshotIntervalSec: 30,
  questions: [BLANK_QUESTION()],
});

function CreateAssessmentModal({
  open, onClose, onCreated,
}: {
  open: boolean; onClose: () => void; onCreated: () => void;
}) {
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<AssessmentFormData>(BLANK_FORM);

  useEffect(() => {
    if (open) { setStep(1); setFormData(BLANK_FORM()); }
  }, [open]);

  if (!open) return null;

  const addQuestion = () =>
    setFormData(prev => ({ ...prev, questions: [...prev.questions, BLANK_QUESTION()] }));

  const removeQuestion = (i: number) =>
    setFormData(prev => ({ ...prev, questions: prev.questions.filter((_, idx) => idx !== i) }));

  const updateQuestion = (i: number, field: keyof QuestionFormData, value: unknown) =>
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, idx) => (idx === i ? { ...q, [field]: value } : q)),
    }));

  const addOption = (qi: number) =>
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) =>
        i === qi ? { ...q, options: [...q.options, ''] } : q
      ),
    }));

  const updateOption = (qi: number, oi: number, val: string) =>
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) =>
        i === qi ? { ...q, options: q.options.map((o, j) => (j === oi ? val : o)) } : q
      ),
    }));

  const removeOption = (qi: number, oi: number) =>
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) =>
        i === qi ? { ...q, options: q.options.filter((_, j) => j !== oi) } : q
      ),
    }));

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/assessments/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        toast.success('Assessment created successfully');
        onCreated();
        onClose();
      } else {
        toast.error('Failed to create assessment');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isStep1Valid = formData.name.trim() && formData.description.trim();
  const isStep2Valid = formData.questions.every(
    q => q.question.trim() && (q.type !== 'multiple_choice' || (q.options.every(o => o.trim()) && q.correctAnswer))
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between p-5 sm:p-6 border-b border-stone-200 bg-gradient-to-r from-brand-50 to-teal-50 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-brand-600 text-white"><ClipboardList className="w-5 h-5" /></div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-stone-900">Create Assessment</h2>
                <p className="text-xs sm:text-sm text-stone-500">Step {step} of 2</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/80 rounded-lg transition-colors">
              <X className="w-5 h-5 text-stone-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            {step === 1 ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Assessment Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g., React & TypeScript Assessment"
                      className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Description <span className="text-red-500">*</span></label>
                    <textarea
                      value={formData.description}
                      onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                      placeholder="Describe what this assessment evaluates..."
                      rows={3}
                      className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Category</label>
                    <select value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value as AssessmentFormData['category'] }))} className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                      <option value="technical">Technical</option>
                      <option value="cognitive">Cognitive</option>
                      <option value="personality">Personality</option>
                      <option value="language">Language</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Assessment Type</label>
                    <select value={formData.type} onChange={e => setFormData(p => ({ ...p, type: e.target.value as AssessmentFormData['type'] }))} className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                      <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                      <option value="CODING">Coding Challenge</option>
                      <option value="OPEN_ENDED">Open Ended</option>
                      <option value="PERSONALITY">Personality</option>
                      <option value="LOGICAL_REASONING">Logical Reasoning</option>
                      <option value="LANGUAGE">Language</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Duration (minutes)</label>
                    <input type="number" value={formData.duration} onChange={e => setFormData(p => ({ ...p, duration: parseInt(e.target.value) || 0 }))} min={5} max={180} className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Difficulty</label>
                    <select value={formData.difficulty} onChange={e => setFormData(p => ({ ...p, difficulty: e.target.value as AssessmentFormData['difficulty'] }))} className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Passing Score (%)</label>
                    <input type="number" value={formData.passingScore} onChange={e => setFormData(p => ({ ...p, passingScore: parseInt(e.target.value) || 0 }))} min={0} max={100} className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  <div className="sm:col-span-2 rounded-xl border border-amber-100 bg-amber-50/50 p-4 space-y-3">
                    <p className="text-sm font-semibold text-stone-800">Proctoring / anti-cheat</p>
                    <label className="flex items-center gap-2 text-sm text-stone-700">
                      <input type="checkbox" checked={formData.proctoringEnabled} onChange={e => setFormData(p => ({ ...p, proctoringEnabled: e.target.checked }))} />
                      Enable proctoring for this template
                    </label>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <label className="block text-xs font-medium text-stone-600">
                        Strictness
                        <select value={formData.proctoringStrictness} onChange={e => setFormData(p => ({ ...p, proctoringStrictness: e.target.value as AssessmentFormData['proctoringStrictness'] }))} className="mt-1 w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm" disabled={!formData.proctoringEnabled}>
                          <option value="off">Off (monitor only)</option>
                          <option value="standard">Standard</option>
                          <option value="strict">Strict</option>
                        </select>
                      </label>
                      <label className="block text-xs font-medium text-stone-600">
                        Snapshot interval (sec)
                        <input type="number" min={15} max={120} value={formData.snapshotIntervalSec} onChange={e => setFormData(p => ({ ...p, snapshotIntervalSec: parseInt(e.target.value) || 30 }))} className="mt-1 w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm" disabled={!formData.proctoringEnabled} />
                      </label>
                      <label className="flex items-center gap-2 text-sm text-stone-700 mt-5">
                        <input type="checkbox" checked={formData.requireFullscreen} onChange={e => setFormData(p => ({ ...p, requireFullscreen: e.target.checked }))} disabled={!formData.proctoringEnabled} />
                        Require fullscreen lock
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-stone-900">Questions ({formData.questions.length})</h3>
                  <button onClick={addQuestion} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                    <Plus className="w-4 h-4" />Add Question
                  </button>
                </div>
                <div className="space-y-4">
                  {formData.questions.map((question, qi) => (
                    <motion.div key={question.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">{qi + 1}</span>
                          <select value={question.type} onChange={e => updateQuestion(qi, 'type', e.target.value)} className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                            <option value="multiple_choice">Multiple Choice</option>
                            <option value="open_ended">Open Ended</option>
                            <option value="coding">Coding</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" value={question.points} onChange={e => updateQuestion(qi, 'points', parseInt(e.target.value) || 0)} placeholder="Pts" className="w-20 px-2 py-1.5 bg-white border border-stone-200 rounded-lg text-sm text-center" />
                          <button onClick={() => removeQuestion(qi)} disabled={formData.questions.length <= 1} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <input type="text" value={question.question} onChange={e => updateQuestion(qi, 'question', e.target.value)} placeholder="Enter your question..." className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      <input type="text" value={question.description} onChange={e => updateQuestion(qi, 'description', e.target.value)} placeholder="Optional description or hint..." className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-500 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      {question.type === 'multiple_choice' && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-stone-500">Options (select correct answer)</p>
                          {question.options.map((option, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <input type="radio" name={`correct-${qi}`} checked={question.correctAnswer === option && option !== ''} onChange={() => option && updateQuestion(qi, 'correctAnswer', option)} className="w-4 h-4 text-brand-600" />
                              <input type="text" value={option} onChange={e => updateOption(qi, oi, e.target.value)} placeholder={`Option ${oi + 1}`} className="flex-1 px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                              {question.options.length > 2 && (
                                <button onClick={() => removeOption(qi, oi)} className="p-1 text-stone-400 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                              )}
                            </div>
                          ))}
                          <button onClick={() => addOption(qi)} className="text-sm text-brand-600 hover:text-brand-700 font-medium">+ Add Option</button>
                        </div>
                      )}
                      {question.type === 'coding' && (
                        <input type="text" value={question.language || ''} onChange={e => updateQuestion(qi, 'language', e.target.value)} placeholder="Programming language (e.g., javascript, python)" className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between p-5 sm:p-6 border-t border-stone-200 bg-stone-50 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-stone-600 hover:text-stone-800 font-medium text-sm">Cancel</button>
            <div className="flex items-center gap-3">
              {step === 2 && <button onClick={() => setStep(1)} className="px-4 py-2.5 text-stone-600 font-medium text-sm">Back</button>}
              {step === 1 ? (
                <button onClick={() => setStep(2)} disabled={!isStep1Valid} className="px-6 py-2.5 bg-brand-600 text-white rounded-xl font-semibold text-sm hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  Next: Add Questions
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={!isStep2Valid || isSubmitting} className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 text-white rounded-xl font-semibold text-sm hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Assessment
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// â”€â”€â”€ Assign Modal with real-time search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AssignModal({
  open, template, onClose, onAssigned,
}: {
  open: boolean; template: AssessmentTemplate | null;
  onClose: () => void; onAssigned: () => void;
}) {
  const toast = useToast();
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setSearch(''); setSelectedId(''); setDropdownOpen(false);
    fetch('/api/candidates', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { candidates: [] })
      .then(d => setCandidates(d.candidates || []))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!open || !template) return null;

  const filtered = candidates.filter(
    c => c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())
  );
  const selected = candidates.find(c => c.id === selectedId);

  const handleAssign = async () => {
    if (!selectedId) return;
    setIsAssigning(true);
    try {
      const res = await fetch('/api/assessments/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: template.id, candidateId: selectedId, expiresInDays: 7 }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.takeUrl && typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(data.takeUrl).catch(() => {});
          toast.success(
            data.emailSent ? 'Assigned — email sent & link copied' : 'Assigned — take link copied',
            data.takeUrl,
          );
        } else {
          toast.success('Assessment assigned successfully');
        }
        onAssigned();
        onClose();
      } else {
        toast.error('Failed to assign assessment');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-visible"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 sm:p-6 border-b border-stone-200 bg-gradient-to-r from-brand-50 to-teal-50 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-brand-600 text-white"><Send className="w-5 h-5" /></div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-stone-900">Assign Assessment</h2>
                <p className="text-xs sm:text-sm text-stone-500 line-clamp-1 max-w-[200px]">{template.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/80 rounded-lg transition-colors"><X className="w-5 h-5 text-stone-500" /></button>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Select Candidate <span className="text-red-500">*</span>
              </label>

              {/* Searchable dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(v => !v)}
                  className={`w-full flex items-center justify-between px-4 py-3 bg-white border rounded-xl text-sm transition-all ${
                    dropdownOpen ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  {selected ? (
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-teal-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {selected.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-stone-900 truncate text-sm">{selected.name}</p>
                        <p className="text-xs text-stone-500 truncate">{selected.email}</p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-stone-400 text-sm">Select a candidate...</span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform flex-shrink-0 ml-2 ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-stone-200 rounded-xl shadow-2xl z-20 overflow-hidden"
                    >
                      {/* Live search input */}
                      <div className="p-2.5 border-b border-stone-100 bg-stone-50">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                          <input
                            type="text"
                            autoFocus
                            placeholder="Search by name or email..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm bg-white rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div className="max-h-56 overflow-y-auto">
                        {filtered.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <p className="text-sm text-stone-400">
                              {search ? `No results for "${search}"` : 'No candidates found'}
                            </p>
                          </div>
                        ) : (
                          filtered.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => { setSelectedId(c.id); setDropdownOpen(false); setSearch(''); }}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                                selectedId === c.id ? 'bg-brand-50' : 'hover:bg-stone-50'
                              }`}
                            >
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-teal-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-stone-900 truncate">{c.name}</p>
                                <p className="text-xs text-stone-500 truncate">{c.email}</p>
                              </div>
                              {selectedId === c.id && <CheckCircle className="w-4 h-4 text-brand-600 flex-shrink-0" />}
                            </button>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Assessment details */}
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-stone-900">Assessment Details</p>
                  <p className="text-xs text-stone-500 mt-1">Duration: {template.duration} min &bull; Pass: {template.passingScore}%</p>
                  <p className="text-xs text-stone-500">Candidate will receive an email with assessment link</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-5 sm:p-6 border-t border-stone-200 bg-stone-50 rounded-b-2xl">
            <button onClick={onClose} className="px-4 py-2 text-stone-600 hover:text-stone-800 font-medium text-sm">Cancel</button>
            <button
              onClick={handleAssign}
              disabled={!selectedId || isAssigning}
              className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 text-white rounded-xl font-semibold text-sm hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAssigning && <Loader2 className="w-4 h-4 animate-spin" />}
              Assign Assessment
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// â”€â”€â”€ Delete Confirm Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function DeleteModal({
  deleteModal, isDeleting, onCancel, onConfirm,
}: {
  deleteModal: { open: boolean; id: string; name: string } | null;
  isDeleting: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {deleteModal?.open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-red-500 to-red-600 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Delete Template</h3>
                  <p className="text-red-100 text-sm">This action cannot be undone</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <p className="text-stone-600">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-stone-900">&ldquo;{deleteModal?.name}&rdquo;</span>?{' '}
                All associated data will be permanently removed.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 pb-6">
              <button onClick={onCancel} className="px-4 py-2.5 text-stone-600 font-medium text-sm border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isDeleting}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete Template
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// â”€â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CATEGORIES = [
  { id: 'all', name: 'All Categories', icon: Filter },
  { id: 'technical', name: 'Technical', icon: Brain },
  { id: 'cognitive', name: 'Cognitive', icon: Target },
  { id: 'personality', name: 'Personality', icon: Users },
  { id: 'language', name: 'Language', icon: MessageSquare },
  { id: 'coding', name: 'Coding', icon: Puzzle },
];

export default function AssessmentsPage() {
  const { t } = useLocale();

  const [activeTab, setActiveTab] = useState<'templates' | 'assignments' | 'pending_review'>('templates');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<AssessmentTemplate[]>([]);
  const [assignments, setAssignments] = useState<AssessmentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [assignTemplate, setAssignTemplate] = useState<AssessmentTemplate | null>(null);
  const [integrityId, setIntegrityId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Need toast at top-level too for delete
  const toast = useToast();

  useEffect(() => {
    fetchTemplates();
    fetchAssignments();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/assessments/templates', { credentials: 'include' });
      if (res.ok) setTemplates((await res.json()).templates || []);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  const fetchAssignments = async () => {
    try {
      const res = await fetch('/api/assessments/assign?status=all', { credentials: 'include' });
      if (res.ok) setAssignments((await res.json()).assignments || []);
    } catch { /* silent */ }
  };

  const handleDeleteTemplate = (id: string, name: string) => {
    setDeleteModal({ open: true, id, name });
    setOpenMenuId(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/assessments/templates/${deleteModal.id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) { toast.success('Template deleted'); fetchTemplates(); setDeleteModal(null); }
      else if (res.status === 404) { toast.error('Cannot delete sample templates'); setDeleteModal(null); }
      else toast.error('Failed to delete template');
    } catch { toast.error('Something went wrong'); }
    finally { setIsDeleting(false); }
  };

  const handleDuplicateTemplate = async (template: AssessmentTemplate) => {
    setOpenMenuId(null);
    try {
      const res = await fetch(`/api/assessments/templates/${template.id}`, { credentials: 'include' });
      if (!res.ok) {
        toast.error(res.status === 404 ? 'Cannot duplicate sample templates — create your own first' : 'Failed to fetch template');
        return;
      }
      const data = await res.json();
      const dupRes = await fetch('/api/assessments/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data.template, name: `${data.template.name} (Copy)`, isActive: true }),
      });
      if (dupRes.ok) { toast.success('Template duplicated'); fetchTemplates(); }
      else toast.error('Failed to duplicate template');
    } catch { toast.error('Failed to duplicate template'); }
  };

  const difficultyClass = (d: string) =>
    d === 'beginner' ? 'bg-green-100 text-green-700' :
    d === 'intermediate' ? 'bg-amber-100 text-amber-700' :
    d === 'advanced' ? 'bg-red-100 text-red-700' : 'bg-stone-100 text-stone-700';

  const categoryIcon = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'technical': return <Star className="w-4 h-4" />;
      case 'cognitive': return <Award className="w-4 h-4" />;
      case 'personality': return <Users className="w-4 h-4" />;
      case 'language': return <FileText className="w-4 h-4" />;
      case 'coding': return <Puzzle className="w-4 h-4" />;
      default: return <ClipboardList className="w-4 h-4" />;
    }
  };

  const statusIcon = (s: string) => {
    switch (s) {
      case 'completed': case 'clear': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'in_progress': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'expired': case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-amber-500" />;
    }
  };

  const filteredTemplates = templates.filter(tmpl => {
    const q = searchQuery.toLowerCase();
    return (
      (tmpl.name.toLowerCase().includes(q) || tmpl.description?.toLowerCase().includes(q) || !q) &&
      (selectedCategory === 'all' || tmpl.category.toLowerCase() === selectedCategory)
    );
  });

  const completionRate = assignments.length > 0
    ? Math.round((assignments.filter(a => a.status === 'completed').length / assignments.length) * 100) : 0;
  const completedA = assignments.filter(a => a.status === 'completed');
  const passRate = completedA.length > 0
    ? Math.round((assignments.filter(a => a.passed).length / completedA.length) * 100) : 0;

  const pendingReviewAssignments = assignments.filter(
    (a) => a.reviewStatus === 'pending_review' || (a.status === 'completed' && a.reviewStatus === 'pending_review'),
  );
  const displayedAssignments =
    activeTab === 'pending_review' ? pendingReviewAssignments : assignments;

  return (
    <PageShell>
      <PageHeader
        icon={ClipboardList}
        title="Skills Assessments"
        subtitle="Create and manage candidate skill evaluations"
      >
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="px-2 py-0.5 bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 rounded-lg text-xs font-bold shrink-0">
            <Crown className="w-3 h-3 inline mr-1" />Premium
          </span>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateModal(true)}
            className="btn-primary !px-4 !py-2.5 !text-sm inline-flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />Create Assessment
          </motion.button>
        </div>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Assessment Templates"
          value={templates.length}
          icon={ClipboardList}
          iconClassName="text-brand-600 bg-brand-50"
        />
        <StatCard
          label="Candidates Assigned"
          value={assignments.length}
          icon={Users}
          iconClassName="text-sky-600 bg-sky-50"
        />
        <StatCard
          label="Completion Rate"
          value={`${completionRate}%`}
          icon={Target}
          iconClassName="text-emerald-600 bg-emerald-50"
        />
        <StatCard
          label="Pass Rate"
          value={`${passRate}%`}
          icon={Award}
          iconClassName="text-amber-600 bg-amber-50"
        />
      </div>

      {/* Search + Category — templates tab only */}
      {activeTab === 'templates' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                    selectedCategory === cat.id
                      ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/25'
                      : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden xs:inline">{cat.name}</span>
                  <span className="xs:hidden">{cat.id === 'all' ? 'All' : cat.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-stone-200 overflow-x-auto scrollbar-hide items-center gap-1">
        {([
          { id: 'templates' as const, label: 'Templates', icon: ClipboardList, count: templates.length },
          { id: 'assignments' as const, label: 'Assignments', icon: Users, count: assignments.length },
          { id: 'pending_review' as const, label: 'Pending review', icon: AlertCircle, count: pendingReviewAssignments.length },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
              activeTab === tab.id
                ? 'border-brand-500 text-brand-600 bg-brand-50/50'
                : 'border-transparent text-stone-500 hover:text-stone-700 hover:bg-stone-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
              tab.id === 'pending_review' && tab.count > 0
                ? 'bg-amber-100 text-amber-800'
                : activeTab === tab.id ? 'bg-brand-100 text-brand-700' : 'bg-stone-100 text-stone-600'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
        {pendingReviewAssignments.length > 0 && activeTab !== 'pending_review' && (
          <button
            type="button"
            onClick={() => setActiveTab('pending_review')}
            className="ml-auto mr-2 mb-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold hover:bg-amber-100"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            {pendingReviewAssignments.length} pending review
          </button>
        )}
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-stone-200/80 bg-white overflow-hidden"
      >
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-stone-100 rounded-xl animate-pulse" />)}
          </div>
        ) : activeTab === 'templates' ? (
          <div className="divide-y divide-stone-100">
            {filteredTemplates.length === 0 ? (
              <EmptyState
                message={searchQuery ? 'No templates match your search' : 'No assessment templates yet'}
                icon={ClipboardList}
                subMessage={searchQuery ? 'Try adjusting your filters' : 'Create your first assessment template to get started'}
              />
            ) : (
              filteredTemplates.map((template, index) => (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="p-4 sm:p-5 hover:bg-stone-50/50 transition-colors group"
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      template.category.toLowerCase() === 'technical' ? 'bg-blue-50 border border-blue-100 text-blue-600' :
                      template.category.toLowerCase() === 'cognitive' ? 'bg-purple-50 border border-purple-100 text-purple-600' :
                      template.category.toLowerCase() === 'personality' ? 'bg-rose-50 border border-rose-100 text-rose-600' :
                      template.category.toLowerCase() === 'language' ? 'bg-emerald-50 border border-emerald-100 text-emerald-600' :
                      template.category.toLowerCase() === 'coding' ? 'bg-indigo-50 border border-indigo-100 text-indigo-600' :
                      'bg-brand-50 border border-brand-100 text-brand-600'
                    }`}>
                      {categoryIcon(template.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-stone-900 group-hover:text-brand-600 transition-colors">{template.name}</h3>
                            {template.isActive && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium whitespace-nowrap">Active</span>
                            )}
                          </div>
                          <p className="text-sm text-stone-500 mt-0.5 line-clamp-1">{template.description || 'No description'}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-lg hidden sm:inline ${difficultyClass(template.difficulty)}`}>
                            {template.difficulty}
                          </span>
                          <div>
                            <button
                              id={`template-menu-${template.id}`}
                              type="button"
                              onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === template.id ? null : template.id); }}
                              className="p-2 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-600 transition-all"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                            <TemplateMenuPortal
                              isOpen={openMenuId === template.id}
                              onClose={() => setOpenMenuId(null)}
                              triggerId={`template-menu-${template.id}`}
                              onAssign={() => setAssignTemplate(template)}
                              onDuplicate={() => handleDuplicateTemplate(template)}
                              onDelete={() => handleDeleteTemplate(template.id, template.name)}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-stone-500">
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-stone-100 rounded-md whitespace-nowrap">
                          <Clock className="w-3.5 h-3.5" />{template.duration} min
                        </span>
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-stone-100 rounded-md whitespace-nowrap">
                          <Target className="w-3.5 h-3.5" />Pass: {template.passingScore}%
                        </span>
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-stone-100 rounded-md whitespace-nowrap">
                          <FileText className="w-3.5 h-3.5" />{template._count?.questions || 0} questions
                        </span>
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-stone-100 rounded-md whitespace-nowrap">
                          <Users className="w-3.5 h-3.5" />{template._count?.assignments || 0} assigned
                        </span>
                        <span className={`sm:hidden px-2 py-1 rounded-md ${difficultyClass(template.difficulty)}`}>
                          {template.difficulty}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {displayedAssignments.length === 0 ? (
              <EmptyState
                message={activeTab === 'pending_review' ? 'No assessments pending review' : 'No assessments assigned yet'}
                icon={Users}
                subMessage={
                  activeTab === 'pending_review'
                    ? 'Open-ended and coding answers awaiting recruiter review will appear here'
                    : 'Assign assessments to candidates using the Template Actions menu'
                }
              />
            ) : (
              displayedAssignments.map((assignment, index) => (
                <motion.div
                  key={assignment.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="p-4 sm:p-5 hover:bg-stone-50/50 transition-colors group"
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      assignment.status === 'completed'
                        ? assignment.passed ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
                        : assignment.status === 'in_progress' ? 'bg-blue-50 border border-blue-200'
                        : 'bg-amber-50 border border-amber-200'
                    }`}>
                      {statusIcon(assignment.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-stone-900 group-hover:text-brand-600 transition-colors truncate">{assignment.candidate.name}</h3>
                          <p className="text-sm text-stone-500 truncate">{assignment.candidate.email}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg whitespace-nowrap ${
                            assignment.status === 'completed'
                              ? assignment.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                              : assignment.status === 'pending' ? 'bg-amber-100 text-amber-700'
                              : assignment.status === 'in_progress' ? 'bg-blue-100 text-blue-700'
                              : 'bg-stone-100 text-stone-700'
                          }`}>
                            {statusIcon(assignment.status)}
                            <span className="hidden xs:inline">{assignment.status.replace('_', ' ')}</span>
                          </span>
                          {assignment.reviewStatus === 'pending_review' && (
                            <span className="px-2 py-1 text-xs font-bold rounded-lg bg-amber-100 text-amber-800 border border-amber-200">
                              Needs review
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setDetailId(assignment.id)}
                            className="text-xs font-semibold text-brand-600 hover:text-brand-700 px-2 py-1 rounded-lg hover:bg-brand-50"
                          >
                            View results
                          </button>
                          <button
                            type="button"
                            onClick={() => setIntegrityId(assignment.id)}
                            className="px-2 py-1 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-colors"
                            title="Integrity report"
                          >
                            Integrity
                          </button>
                          <Link
                            href={`/dashboard/candidates/${assignment.candidateId}`}
                            className="p-2 hover:bg-brand-50 rounded-lg text-stone-400 hover:text-brand-600 transition-all"
                            title="View candidate profile"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-2.5 text-xs text-stone-500">
                        <span className="font-medium text-stone-700 truncate max-w-[180px]">{assignment.template.name}</span>
                        <span className="capitalize px-1.5 py-0.5 bg-stone-100 rounded-md">{assignment.template.category}</span>
                        <span>Assigned {format(new Date(assignment.createdAt), 'MMM d, yyyy')}</span>
                      </div>
                      {assignment.score !== null && (
                        <div className="flex items-center gap-3 mt-3">
                          <div className="flex-1 max-w-xs">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-stone-500">Score</span>
                              <span className="font-medium">{Number(assignment.percentage ?? 0).toFixed(0)}%</span>
                            </div>
                            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${assignment.passed ? 'bg-emerald-500' : 'bg-red-500'}`}
                                style={{ width: `${Number(assignment.percentage ?? 0)}%` }}
                              />
                            </div>
                          </div>
                          {assignment.passed !== null && (
                            <span className={`flex items-center gap-1 text-xs font-medium ${assignment.passed ? 'text-emerald-600' : 'text-red-600'}`}>
                              {assignment.passed
                                ? <><CheckCircle className="w-3.5 h-3.5" />Passed</>
                                : <><XCircle className="w-3.5 h-3.5" />Failed</>}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </motion.div>

      {/* Quick Actions — filter templates by category */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { category: 'technical', icon: Brain, colorClass: 'from-blue-50 to-indigo-50 border-blue-100 hover:border-blue-300', iconColor: 'text-blue-600', title: 'Technical Assessments', desc: 'Coding challenges, system design, and technical skills' },
          { category: 'cognitive', icon: Puzzle, colorClass: 'from-purple-50 to-pink-50 border-purple-100 hover:border-purple-300', iconColor: 'text-purple-600', title: 'Cognitive Tests', desc: 'Problem solving, logical reasoning, and aptitude' },
          { category: 'personality', icon: Users, colorClass: 'from-emerald-50 to-teal-50 border-emerald-100 hover:border-emerald-300', iconColor: 'text-emerald-600', title: 'Personality Fit', desc: 'Culture fit, behavioral, and soft skills assessments' },
        ].map(item => {
          const Icon = item.icon;
          const active = selectedCategory === item.category && activeTab === 'templates';
          return (
            <button
              key={item.title}
              type="button"
              onClick={() => {
                setActiveTab('templates');
                setSelectedCategory(item.category);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`p-5 rounded-xl bg-gradient-to-br border text-left transition-all ${item.colorClass} ${
                active ? 'ring-2 ring-brand-500 shadow-md' : 'hover:shadow-sm'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center mb-3">
                <Icon className={`w-5 h-5 ${item.iconColor}`} />
              </div>
              <h4 className="font-semibold text-stone-900 mb-1">{item.title}</h4>
              <p className="text-sm text-stone-500">{item.desc}</p>
              <p className="text-xs font-semibold text-brand-600 mt-3">
                {active ? 'Showing this category' : 'View templates →'}
              </p>
            </button>
          );
        })}
      </motion.div>

      {/* Modals â€” top-level, never destroyed on tab switch */}
      <CreateAssessmentModal open={showCreateModal} onClose={() => setShowCreateModal(false)} onCreated={fetchTemplates} />
      <AssignModal open={!!assignTemplate} template={assignTemplate} onClose={() => setAssignTemplate(null)} onAssigned={fetchAssignments} />
      <IntegrityReportModal assignmentId={integrityId} open={!!integrityId} onClose={() => setIntegrityId(null)} />
      <AssignmentDetailModal
        assignmentId={detailId}
        open={!!detailId}
        onClose={() => setDetailId(null)}
        onGraded={fetchAssignments}
      />
      <DeleteModal deleteModal={deleteModal} isDeleting={isDeleting} onCancel={() => setDeleteModal(null)} onConfirm={handleConfirmDelete} />
    </PageShell>
  );
}
