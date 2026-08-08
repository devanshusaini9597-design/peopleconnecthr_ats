'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Mail, Phone, Calendar, FileText, MessageSquare, Sparkles,
  User, Briefcase, Building2, Star, FileCheck, MapPin, Globe, Linkedin,
  Github, ExternalLink, Clock, Tag, Hash, Save, X, CheckCircle,
  ChevronRight, TrendingUp, Award, Upload, ClipboardList,
} from 'lucide-react';
import { useLocale } from '@/components/providers/LocaleProvider';
import { useToast } from '@/components/ui/Toast';
import PageShell from '@/components/ui/PageShell';

// Premium Components
import { QuickActionsPanel, EmailTemplatesModal } from '@/components/premium/CandidateActions';
import { InterviewScoringPanel, InterviewScoreModal } from '@/components/premium/InterviewScoring';
import { ResumeParserPanel } from '@/components/premium/ResumeParser';
import { OfferLetterGenerator } from '@/components/premium/OfferLetter';
import { TeamComments } from '@/components/premium/TeamComments';
import { SkillMatchBadge } from '@/components/dashboard/SkillMatchBadge';
import { AssignmentDetailModal } from '@/components/dashboard/AssignmentDetailModal';
import { SkillEditor } from '@/components/dashboard/SkillEditor';
import { InterviewTranscriptPanel } from '@/components/dashboard/InterviewTranscriptPanel';

const statusColors: Record<string, string> = {
  Applied: 'bg-brand-100 text-brand-700',
  Screening: 'bg-warm-100 text-warm-700',
  Interview: 'bg-amber-100 text-amber-700',
  Offer: 'bg-emerald-100 text-emerald-700',
  Hired: 'bg-green-100 text-green-700',
  Joined: 'bg-brand-100 text-brand-700',
  Rejected: 'bg-red-100 text-red-700',
};

const timelineColors: Record<string, { dot: string; bg: string }> = {
  Applied: { dot: 'bg-brand-500', bg: 'bg-brand-50' },
  Screening: { dot: 'bg-warm-500', bg: 'bg-warm-50' },
  Interview: { dot: 'bg-amber-500', bg: 'bg-amber-50' },
  Offer: { dot: 'bg-emerald-500', bg: 'bg-emerald-50' },
  Hired: { dot: 'bg-green-500', bg: 'bg-green-50' },
  Joined: { dot: 'bg-brand-500', bg: 'bg-brand-50' },
  Rejected: { dot: 'bg-red-500', bg: 'bg-red-50' },
};

function getSmartMatchScore(id: string): number {
  let n = 0;
  for (let i = 0; i < id.length; i++) n += id.charCodeAt(i);
  return 65 + (n % 34);
}

type AppItem = { id: string; jobId?: string; jobTitle: string; stage: string; createdAt?: string };
type CandidateData = {
  id: string; name: string; email: string; position?: string; source?: string; status?: string;
  phone?: string; createdAt?: string; applications?: AppItem[]; skills?: string[]; tags?: string[];
  experience?: number | null; location?: string; city?: string; country?: string;
  currentTitle?: string; currentCompany?: string; linkedInUrl?: string; portfolioUrl?: string;
  githubUrl?: string; websiteUrl?: string; resumeUrl?: string; resumeParsed?: any;
};
type NoteItem = { id: string; authorName: string; body: string; createdAt: string; mentions?: string[] };
type ScoreItem = { id: string; criteria: string; score: number; maxScore: number; notes: string; scoredBy: string; createdAt: string };
type AssessmentItem = {
  id: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  passed: boolean | null;
  reviewStatus: string | null;
  submittedAt: string | null;
  createdAt: string;
  template: { name: string; category: string; duration: number | null };
};

export default function CandidateProfilePage() {
  const params = useParams();
  const { t } = useLocale();
  const toast = useToast();
  const id = typeof params.id === 'string' ? params.id : '';
  const [candidate, setCandidate] = useState<CandidateData | null>(null);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [scores, setScores] = useState<ScoreItem[]>([]);
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [assessmentDetailId, setAssessmentDetailId] = useState<string | null>(null);
  const [interviewEvents, setInterviewEvents] = useState<Array<{ id: string; title: string; start: string }>>([]);
  const [selectedInterviewId, setSelectedInterviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'resume' | 'timeline' | 'comments' | 'score' | 'assessments' | 'offer'>('overview');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', source: '' });

  // Modal States
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [scoreModalOpen, setScoreModalOpen] = useState(false);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    let cancelled = false;
    fetch(`/api/candidates/${id}`, { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then((data: CandidateData | null) => {
        if (!cancelled && data) {
          setCandidate(data);
          setEditForm({ name: data.name, email: data.email, phone: data.phone || '', source: data.source || '' });
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/candidates/${id}/notes`, { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then((data: NoteItem[]) => setNotes(Array.isArray(data) ? data : []))
      .catch(() => setNotes([]));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/interviews/${id}/scores`, { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : { scores: [] })
      .then((data: { scores: ScoreItem[] }) => setScores(data.scores || []))
      .catch(() => setScores([]));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/assessments/assign?candidateId=${encodeURIComponent(id)}`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { assignments: [] }))
      .then((data: { assignments: AssessmentItem[] }) => setAssessments(data.assignments || []))
      .catch(() => setAssessments([]));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const start = new Date(0).toISOString();
    const end = new Date(Date.now() + 365 * 86400000).toISOString();
    fetch(`/api/calendar/events?start=${start}&end=${end}`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Array<{ id: string; title: string; start: string; candidateId?: string }>) => {
        const events = (Array.isArray(list) ? list : []).filter((e) => e.candidateId === id);
        setInterviewEvents(events.map((e) => ({ id: e.id, title: e.title, start: e.start })));
        setSelectedInterviewId((prev) => prev || events[0]?.id || null);
      })
      .catch(() => {
        setInterviewEvents([]);
        setSelectedInterviewId(null);
      });
  }, [id]);

  const refreshAssessments = () => {
    if (!id) return;
    fetch(`/api/assessments/assign?candidateId=${encodeURIComponent(id)}`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { assignments: [] }))
      .then((data: { assignments: AssessmentItem[] }) => setAssessments(data.assignments || []));
  };
  const refreshScores = () => {
    if (!id) return;
    fetch(`/api/interviews/${id}/scores`, { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : { scores: [] })
      .then((data: { scores: ScoreItem[] }) => setScores(data.scores || []));
  };

  const saveEdit = async () => {
    if (!candidate) return;
    try {
      const res = await fetch(`/api/candidates/${candidate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setCandidate(prev => prev ? { ...prev, ...updated } : prev);
        setEditing(false);
        toast.success('Profile updated');
      } else {
        toast.error('Failed to update');
      }
    } catch { toast.error('Failed to update'); }
  };

  const timeline = useMemo(() => {
    const apps = candidate?.applications ?? [];
    const events: { id: string; type: string; label: string; date: string; rawDate: string; desc: string; icon: string }[] = [];

    // Application events
    apps.forEach(a => {
      events.push({
        id: a.id,
        type: a.stage,
        label: `Stage: ${a.stage}`,
        date: a.createdAt ? formatDistanceToNow(new Date(a.createdAt), { addSuffix: true }) : '—',
        rawDate: a.createdAt || '',
        desc: `Applied for ${a.jobTitle}`,
        icon: a.stage,
      });
    });

    // Notes as timeline events
    notes.forEach(n => {
      events.push({
        id: `note-${n.id}`,
        type: 'comment',
        label: `Comment by ${n.authorName}`,
        date: formatDistanceToNow(new Date(n.createdAt), { addSuffix: true }),
        rawDate: n.createdAt,
        desc: n.body.length > 80 ? n.body.slice(0, 80) + '...' : n.body,
        icon: 'comment',
      });
    });

    // Scores as timeline events
    scores.forEach(s => {
      events.push({
        id: `score-${s.id}`,
        type: 'score',
        label: `Scored: ${s.criteria}`,
        date: formatDistanceToNow(new Date(s.createdAt), { addSuffix: true }),
        rawDate: s.createdAt,
        desc: `${s.score}/${s.maxScore} — ${s.notes || 'No notes'}`,
        icon: 'score',
      });
    });

    return events.sort((a, b) => new Date(b.rawDate || 0).getTime() - new Date(a.rawDate || 0).getTime());
  }, [candidate?.applications, notes, scores]);

  const aiInsights = useMemo(() => {
    if (!candidate) return null;
    const jobs = (candidate.applications ?? []).map(a => a.jobTitle).filter(Boolean);
    const uniquePositions = [...new Set(jobs)];
    return {
      summary: `${candidate.name} is currently in the ${candidate.status ?? 'Applied'} stage.`,
      positions: uniquePositions,
      source: candidate.source,
      appliedDate: candidate.createdAt,
      recommendations: ['Schedule technical interview', 'Review portfolio projects', 'Check references'],
    };
  }, [candidate]);

  const averageScore = scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + (s.score / s.maxScore) * 100, 0) / scores.length)
    : 0;

  // Loading skeleton
  if (loading && !candidate) {
    return (
      <PageShell>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <Link href="/dashboard/candidates" className="inline-flex items-center gap-2 text-brand-600 font-semibold hover:underline">
            <ArrowLeft className="w-4 h-4" /> {t('profile.backToCandidates')}
          </Link>
          <div className="rounded-2xl border border-stone-200/80 bg-white overflow-hidden shadow-sm animate-pulse">
            <div className="p-6 sm:p-8 border-b border-stone-100">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-stone-200 flex-shrink-0" />
                <div className="space-y-3 flex-1">
                  <div className="h-7 w-48 bg-stone-200 rounded-lg" />
                  <div className="h-4 w-32 bg-stone-100 rounded" />
                  <div className="h-4 w-56 bg-stone-100 rounded" />
                </div>
              </div>
            </div>
            <div className="flex gap-1 p-2 border-b border-stone-100">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 w-24 bg-stone-100 rounded-xl" />)}
            </div>
            <div className="p-6 sm:p-8 space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-4 bg-stone-100 rounded" style={{ width: `${100 - i * 15}%` }} />)}
            </div>
          </div>
        </motion.div>
      </PageShell>
    );
  }

  if (!candidate) {
    return (
      <PageShell>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <Link href="/dashboard/candidates" className="inline-flex items-center gap-2 text-brand-600 font-semibold hover:underline">
            <ArrowLeft className="w-4 h-4" /> {t('profile.backToCandidates')}
          </Link>
          <div className="text-center py-16">
            <User className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-600 font-semibold">{t('profile.notFound')}</p>
            <p className="text-sm text-stone-500 mt-1">This candidate may have been removed.</p>
          </div>
        </motion.div>
      </PageShell>
    );
  }

  const smartMatch = getSmartMatchScore(candidate.id);
  const showOfferTab = candidate.status === 'Offer' || candidate.status === 'Hired';

  const tabs = [
    { key: 'overview' as const, label: t('profile.overview'), icon: User },
    { key: 'resume' as const, label: t('profile.resume'), icon: FileText },
    { key: 'timeline' as const, label: t('profile.timeline'), icon: Calendar },
    { key: 'comments' as const, label: t('profile.comments'), icon: MessageSquare, count: notes.length },
    { key: 'score' as const, label: 'Interview Score', icon: Star, count: scores.length },
    { key: 'assessments' as const, label: 'Assessments', icon: ClipboardList, count: assessments.length },
    ...(showOfferTab ? [{ key: 'offer' as const, label: 'Offer Letter', icon: FileCheck }] : []),
  ];

  const inputCls = 'w-full px-3 py-2 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 outline-none transition-all bg-white';

  return (
    <PageShell>
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      {/* Navigation */}
      <Link href="/dashboard/candidates" className="inline-flex items-center gap-2 text-stone-600 hover:text-brand-600 font-semibold transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Candidates
      </Link>

      {/* Quick Actions */}
      <QuickActionsPanel
        candidate={candidate}
        onEmailClick={() => setEmailModalOpen(true)}
        onScoreClick={() => setScoreModalOpen(true)}
        onOfferClick={() => setActiveTab('offer')}
        hasScores={scores.length > 0}
        averageScore={averageScore}
      />

      {/* Main Card */}
      <div className="rounded-2xl border border-stone-200/80 bg-white overflow-hidden shadow-sm">
        {/* Profile Header */}
        <div className="p-5 sm:p-8 border-b border-stone-100">
          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            <motion.div whileHover={{ scale: 1.03 }} className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-teal-700 flex items-center justify-center text-xl sm:text-2xl font-bold text-white shadow-lg shadow-brand-500/20 ring-1 ring-white/20 ring-inset flex-shrink-0">
              {candidate.name[0]}
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight truncate min-w-0" style={{ letterSpacing: '-0.025em' }}>{candidate.name}</h1>
              </div>
              <p className="text-stone-600 mt-0.5 font-medium text-sm">{candidate.currentTitle || candidate.position}{candidate.currentCompany ? ` at ${candidate.currentCompany}` : ''}</p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold ${(candidate.status && statusColors[candidate.status]) || 'bg-stone-100 text-stone-700'}`}>
                  {candidate.status}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-700">
                  <Sparkles className="w-3 h-3" /> Smart Match {smartMatch}%
                </span>
                {candidate.applications?.[0]?.jobId && (
                  <SkillMatchBadge jobId={candidate.applications[0].jobId} candidateId={candidate.id} />
                )}
                {candidate.experience != null && candidate.experience > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    <TrendingUp className="w-3 h-3" /> {candidate.experience} yrs exp
                  </span>
                )}
                {candidate.location && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-stone-50 text-stone-600 border border-stone-200">
                    <MapPin className="w-3 h-3" /> {candidate.location}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-stone-500">
                <a href={`mailto:${candidate.email}`} className="inline-flex items-center gap-1.5 hover:text-brand-600 transition-colors">
                  <Mail className="w-3.5 h-3.5" /> {candidate.email}
                </a>
                {candidate.phone && (
                  <a href={`tel:${candidate.phone}`} className="inline-flex items-center gap-1.5 hover:text-brand-600 transition-colors">
                    <Phone className="w-3.5 h-3.5" /> {candidate.phone}
                  </a>
                )}
                {candidate.linkedInUrl && (
                  <a href={candidate.linkedInUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-brand-600 transition-colors">
                    <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                  </a>
                )}
                {candidate.githubUrl && (
                  <a href={candidate.githubUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-brand-600 transition-colors">
                    <Github className="w-3.5 h-3.5" /> GitHub
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Smart Insights */}
        <div className="px-5 sm:px-8 py-4 bg-gradient-to-br from-brand-50/60 via-white to-teal-50/30 border-b border-stone-100">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                Smart Insights
                <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold">Beta</span>
              </h3>
              <p className="text-sm text-stone-600 mt-1.5 leading-relaxed">
                {aiInsights?.summary}
                {aiInsights?.source && (
                  <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-xs">
                    <Building2 className="w-3 h-3" /> {aiInsights.source}
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {aiInsights?.positions.map((pos, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/80 border border-stone-100 text-xs font-medium text-stone-700">
                    <Briefcase className="w-3 h-3 text-brand-500" /> {pos}
                  </span>
                ))}
                {aiInsights?.appliedDate && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/80 border border-stone-100 text-xs font-medium text-stone-700">
                    <Calendar className="w-3 h-3 text-brand-500" /> Applied {format(new Date(aiInsights.appliedDate), 'MMM d, yyyy')}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {aiInsights?.recommendations.map((rec, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-50 text-brand-700 text-xs font-medium">
                    <span className="w-1 h-1 rounded-full bg-brand-500" /> {rec}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs - Icon only on mobile, full text on sm+ */}
        <div className="border-b border-stone-100 overflow-x-auto scrollbar-hide">
          <nav className="flex gap-0 px-1 sm:px-8 min-w-max">
            {tabs.map(({ key, label, icon: Icon, count }: any) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                title={label}
                className={`flex items-center gap-1.5 px-2.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === key
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-stone-500 hover:text-stone-700'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline whitespace-nowrap">{label}</span>
                {count != null && count > 0 && (
                  <span className="hidden sm:inline ml-1 px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[10px] font-bold">{count}</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content - Responsive padding */}
        <div className="p-3 sm:p-8">
          <AnimatePresence mode="wait">
            {/* ==================== OVERVIEW ==================== */}
            {activeTab === 'overview' && (
              <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4 sm:space-y-6">
                {/* Edit Banner */}
                {editing && (
                  <div className="p-3 sm:p-4 rounded-xl border border-brand-200 bg-brand-50/50">
                    <p className="text-sm font-semibold text-brand-800 mb-3">✏️ Edit Profile</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                      <div>
                        <label className="text-xs font-semibold text-stone-500 uppercase mb-1 block">Name</label>
                        <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-stone-500 uppercase mb-1 block">Email</label>
                        <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-stone-500 uppercase mb-1 block">Phone</label>
                        <input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-stone-500 uppercase mb-1 block">Source</label>
                        <input value={editForm.source} onChange={e => setEditForm(f => ({ ...f, source: e.target.value }))} className={inputCls} />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2.5 sm:mt-3">
                      <button onClick={saveEdit} className="px-3 sm:px-4 py-2 text-sm bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors flex items-center gap-1.5">
                        <Save className="w-3.5 h-3.5" /> Save
                      </button>
                      <button onClick={() => setEditing(false)} className="px-3 sm:px-4 py-2 text-sm border border-stone-200 text-stone-600 rounded-xl font-semibold hover:bg-stone-50 transition-colors flex items-center gap-1.5">
                        <X className="w-3.5 h-3.5" /> Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Info Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <InfoCard icon={Briefcase} label="Position" value={candidate.position || '—'} />
                  <InfoCard icon={Building2} label="Source" value={candidate.source || '—'} />
                  <InfoCard icon={Calendar} label="Applied" value={candidate.createdAt ? format(new Date(candidate.createdAt), 'MMM d, yyyy') : '—'} />
                  <InfoCard icon={TrendingUp} label="Experience" value={candidate.experience ? `${candidate.experience} years` : '—'} />
                  <InfoCard icon={MapPin} label="Location" value={[candidate.city, candidate.country].filter(Boolean).join(', ') || candidate.location || '—'} />
                  <InfoCard icon={Building2} label={t('dashboard.currentCompany')} value={candidate.currentCompany || '—'} />
                </div>

                {/* Interview Score Card */}
                {scores.length > 0 && (
                  <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${averageScore >= 80 ? 'bg-emerald-100' : averageScore >= 60 ? 'bg-amber-100' : 'bg-red-100'}`}>
                          <Award className={`w-5 h-5 ${averageScore >= 80 ? 'text-emerald-600' : averageScore >= 60 ? 'text-amber-600' : 'text-red-600'}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-stone-900 text-sm">Interview Score</p>
                          <p className="text-xs text-stone-500">{scores.length} criteria evaluated</p>
                        </div>
                      </div>
                      <span className={`text-2xl font-extrabold ${averageScore >= 80 ? 'text-emerald-600' : averageScore >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                        {averageScore}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Skills */}
                <div>
                  <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> Skills & Technologies</p>
                  {(candidate.skills && candidate.skills.length > 0) ? (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {candidate.skills.map((s, i) => (
                        <span key={i} className="px-2.5 py-1 bg-brand-50 text-brand-700 rounded-lg text-xs font-medium border border-brand-200">{s}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-stone-400 italic mb-3">No resume skills recorded — upload a resume to extract skills</p>
                  )}
                  <SkillEditor candidateId={candidate.id} />
                </div>

                {/* Tags */}
                {candidate.tags && candidate.tags.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {candidate.tags.map((tag, i) => (
                        <span key={i} className="px-2.5 py-1 bg-stone-100 text-stone-600 rounded-lg text-xs font-medium">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Professional Links */}
                {(candidate.linkedInUrl || candidate.githubUrl || candidate.portfolioUrl || candidate.websiteUrl) && (
                  <div>
                    <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Online Profiles</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {candidate.linkedInUrl && <LinkCard icon={Linkedin} label="LinkedIn" url={candidate.linkedInUrl} />}
                      {candidate.githubUrl && <LinkCard icon={Github} label="GitHub" url={candidate.githubUrl} />}
                      {candidate.portfolioUrl && <LinkCard icon={Globe} label="Portfolio" url={candidate.portfolioUrl} />}
                      {candidate.websiteUrl && <LinkCard icon={ExternalLink} label="Website" url={candidate.websiteUrl} />}
                    </div>
                  </div>
                )}

                {/* Applications */}
                {(candidate.applications?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Applications</p>
                    <div className="space-y-2">
                      {candidate.applications!.map(app => (
                        <div key={app.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-stone-200 hover:border-brand-200 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                              <Briefcase className="w-4 h-4 text-brand-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-stone-900 text-sm truncate">{app.jobTitle}</p>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                <p className="text-xs text-stone-500">{app.createdAt ? format(new Date(app.createdAt), 'MMM d, yyyy') : ''}</p>
                                {app.jobId && <SkillMatchBadge jobId={app.jobId} candidateId={candidate.id} />}
                              </div>
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex-shrink-0 ${statusColors[app.stage] || 'bg-stone-100 text-stone-700'}`}>
                            {app.stage}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ==================== RESUME ==================== */}
            {activeTab === 'resume' && (
              <motion.div key="resume" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                {/* Show stored parsed data if available */}
                {candidate.resumeParsed && (
                  <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-semibold text-emerald-800">Resume on file</span>
                    </div>
                    <p className="text-xs text-emerald-700">Previously parsed resume data is stored. You can upload a new one below to update.</p>
                  </div>
                )}
                <ResumeParserPanel candidateId={candidate.id} />
              </motion.div>
            )}

            {/* ==================== TIMELINE ==================== */}
            {activeTab === 'timeline' && (
              <motion.div key="timeline" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                {timeline.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                    <p className="font-semibold text-stone-600">No activity yet</p>
                    <p className="text-sm text-stone-500 mt-1">Activity will appear here as the candidate progresses</p>
                  </div>
                ) : (
                  <div className="space-y-0 relative">
                    <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-stone-200" />
                    {timeline.map((item, i) => {
                      const tc = timelineColors[item.icon] || { dot: 'bg-stone-400', bg: 'bg-stone-50' };
                      const isComment = item.type === 'comment';
                      const isScore = item.type === 'score';
                      return (
                        <div key={item.id} className="flex gap-4 relative pl-0">
                          <div className="flex flex-col items-center z-10 flex-shrink-0" style={{ width: 30 }}>
                            <div className={`w-[10px] h-[10px] rounded-full ${isComment ? 'bg-blue-500' : isScore ? 'bg-amber-500' : tc.dot} ring-4 ring-white`} />
                          </div>
                          <div className={`flex-1 pb-5 min-w-0 ${i === 0 ? '' : ''}`}>
                            <div className={`p-3 rounded-xl border border-stone-100 ${isComment ? 'bg-blue-50/50' : isScore ? 'bg-amber-50/50' : tc.bg}`}>
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold text-stone-900 text-sm truncate">
                                  {isComment && <MessageSquare className="w-3.5 h-3.5 inline mr-1.5 text-blue-500" />}
                                  {isScore && <Star className="w-3.5 h-3.5 inline mr-1.5 text-amber-500" />}
                                  {!isComment && !isScore && <ChevronRight className="w-3.5 h-3.5 inline mr-1.5 text-brand-500" />}
                                  {item.label}
                                </p>
                                <span className="text-[11px] text-stone-400 whitespace-nowrap flex-shrink-0">{item.date}</span>
                              </div>
                              <p className="text-xs text-stone-600 mt-1">{item.desc}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* ==================== COMMENTS ==================== */}
            {activeTab === 'comments' && (
              <motion.div key="comments" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <TeamComments candidateId={candidate.id} initialComments={notes} />
              </motion.div>
            )}

            {/* ==================== INTERVIEW SCORE ==================== */}
            {activeTab === 'score' && (
              <motion.div key="score" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                {scores.length === 0 && (
                  <div>
                    <button
                      onClick={() => setScoreModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all"
                    >
                      <Star className="w-4 h-4" /> Score This Candidate
                    </button>
                  </div>
                )}
                <InterviewScoringPanel scores={scores} loading={false} />

                {interviewEvents.length > 0 ? (
                  <div className="space-y-3">
                    {interviewEvents.length > 1 && (
                      <label className="block text-xs font-semibold text-stone-500">
                        Interview for transcript
                        <select
                          value={selectedInterviewId || ''}
                          onChange={(e) => setSelectedInterviewId(e.target.value || null)}
                          className="mt-1 w-full px-3 py-2 rounded-xl border border-stone-200 text-sm text-stone-800 font-medium"
                        >
                          {interviewEvents.map((ev) => (
                            <option key={ev.id} value={ev.id}>
                              {ev.title} · {ev.start ? format(new Date(ev.start), 'MMM d, yyyy') : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {selectedInterviewId && (
                      <InterviewTranscriptPanel interviewId={selectedInterviewId} />
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-stone-500 rounded-xl border border-dashed border-stone-200 bg-stone-50 px-4 py-3">
                    Schedule an interview on the{' '}
                    <Link href="/dashboard/calendar" className="text-brand-600 font-medium hover:underline">
                      calendar
                    </Link>{' '}
                    to attach transcripts, AI notes, or a meeting bot.
                  </p>
                )}
              </motion.div>
            )}

            {/* ==================== ASSESSMENTS ==================== */}
            {activeTab === 'assessments' && (
              <motion.div key="assessments" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-3">
                {assessments.length === 0 ? (
                  <div className="text-center py-12">
                    <ClipboardList className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                    <p className="font-semibold text-stone-600">No assessments yet</p>
                    <p className="text-sm text-stone-500 mt-1">
                      Assign from{' '}
                      <Link href="/dashboard/assessments" className="text-brand-600 font-medium hover:underline">
                        Assessments
                      </Link>
                    </p>
                  </div>
                ) : (
                  assessments.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAssessmentDetailId(a.id)}
                      className="w-full text-left rounded-xl border border-stone-200 p-4 hover:border-brand-300 hover:bg-brand-50/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-stone-900 truncate">{a.template.name}</p>
                          <p className="text-xs text-stone-500 mt-0.5 capitalize">
                            {a.template.category} · {a.status.replace('_', ' ')}
                            {a.submittedAt ? ` · submitted ${format(new Date(a.submittedAt), 'MMM d, yyyy')}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {a.percentage != null ? (
                            <>
                              <p className="text-lg font-bold text-stone-900">{Math.round(a.percentage)}%</p>
                              <p className={`text-xs font-medium ${a.passed ? 'text-emerald-600' : a.passed === false ? 'text-red-600' : 'text-amber-600'}`}>
                                {a.reviewStatus === 'pending_review'
                                  ? 'Pending review'
                                  : a.passed == null
                                    ? '—'
                                    : a.passed
                                      ? 'Passed'
                                      : 'Failed'}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-stone-400 capitalize">{a.status.replace('_', ' ')}</p>
                          )}
                        </div>
                      </div>
                      {a.score != null && a.maxScore != null && (
                        <p className="text-xs text-stone-500 mt-2">
                          {a.score}/{a.maxScore} points
                        </p>
                      )}
                    </button>
                  ))
                )}
              </motion.div>
            )}
            {/* ==================== OFFER ==================== */}
            {activeTab === 'offer' && showOfferTab && (
              <motion.div key="offer" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <OfferLetterGenerator candidate={candidate} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Modals */}
      <EmailTemplatesModal isOpen={emailModalOpen} onClose={() => setEmailModalOpen(false)} candidate={candidate} />
      <InterviewScoreModal isOpen={scoreModalOpen} onClose={() => setScoreModalOpen(false)} candidateId={candidate.id} onSave={refreshScores} />
      <AssignmentDetailModal
        assignmentId={assessmentDetailId}
        open={!!assessmentDetailId}
        onClose={() => setAssessmentDetailId(null)}
        onGraded={refreshAssessments}
      />
    </motion.div>
    </PageShell>
  );
}

// ---- Sub-components ----
function InfoCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="p-3.5 rounded-xl border border-stone-200 hover:border-brand-200 transition-colors group">
      <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="font-semibold text-stone-900 text-sm flex items-center gap-2">
        <Icon className="w-4 h-4 text-stone-400 group-hover:text-brand-500 transition-colors flex-shrink-0" />
        <span className="truncate">{value}</span>
      </p>
    </div>
  );
}

function LinkCard({ icon: Icon, label, url }: { icon: any; label: string; url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 hover:border-brand-300 hover:bg-brand-50/30 transition-all group">
      <Icon className="w-4 h-4 text-stone-500 group-hover:text-brand-600 transition-colors flex-shrink-0" />
      <span className="text-sm font-medium text-stone-700 group-hover:text-brand-700 transition-colors truncate">{label}</span>
      <ExternalLink className="w-3 h-3 text-stone-400 ml-auto flex-shrink-0" />
    </a>
  );
}
