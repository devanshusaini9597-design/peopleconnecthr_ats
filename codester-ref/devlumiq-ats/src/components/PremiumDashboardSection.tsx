/**
 * Premium Dashboard Section
 * ==========================
 * Displays premium feature widgets (Smart Search, Email Studio, Interview Scorer)
 * directly on the main dashboard overview page for quick access.
 */
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Mail, Star, FileText, MessageSquare, Upload, Share2,
  Sparkles, Zap, Crown, X, ChevronRight, Plus, Send, Filter,
  CheckCircle2, Clock, Users, Briefcase, TrendingUp, MoreHorizontal,
  Mic, Bot, Wand2, Target, Award, ThumbsUp, MessageCircle
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

// Premium Feature Card Component
interface PremiumFeatureCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  gradient: string;
  onClick: () => void;
  badge?: string;
  index: number;
}

function PremiumFeatureCard({ icon: Icon, title, description, color, gradient, onClick, badge, index }: PremiumFeatureCardProps) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl p-4 sm:p-5 text-left transition-all duration-300 ${gradient} border border-white/20 backdrop-blur-sm`}
    >
      {/* Animated background glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className={`absolute -top-10 -right-10 w-32 h-32 ${color} opacity-20 blur-3xl rounded-full`} />
        <div className={`absolute -bottom-10 -left-10 w-24 h-24 ${color} opacity-20 blur-3xl rounded-full`} />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2.5 rounded-xl ${color} bg-white/80 shadow-lg`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          {badge && (
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-white/90 text-stone-700 rounded-full shadow-sm">
              {badge}
            </span>
          )}
        </div>
        
        <h3 className="font-bold text-stone-800 text-sm sm:text-base mb-1 group-hover:text-stone-900 transition-colors">
          {title}
        </h3>
        <p className="text-xs text-stone-600 leading-relaxed line-clamp-2">
          {description}
        </p>
        
        <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-stone-700 opacity-0 group-hover:opacity-100 transition-opacity">
          Launch <ChevronRight className="w-3 h-3" />
        </div>
      </div>
    </motion.button>
  );
}

// Quick Search Widget
function QuickSearchWidget() {
  const [query, setQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState({ skills: '', experience: '', source: '' });
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { success } = useToast();

  const search = async () => {
    if (!query && !filters.skills && !filters.experience && !filters.source) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      if (filters.skills) params.append('skills', filters.skills);
      if (filters.experience) params.append('experience', filters.experience);
      if (filters.source) params.append('source', filters.source);
      
      const res = await fetch(`/api/candidates/search?${params}`);
      const data = await res.json();
      setResults(data.candidates || []);
      success(`Found ${data.candidates?.length || 0} candidates`);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 rounded-2xl p-4 sm:p-5 border border-violet-200/50">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-violet-500 rounded-lg">
          <Search className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-stone-800 text-sm">Smart Search</h3>
          <p className="text-xs text-stone-500">Smart candidate finder</p>
        </div>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="ml-auto p-1.5 hover:bg-violet-100 rounded-lg transition-colors"
        >
          <Filter className="w-4 h-4 text-violet-600" />
        </button>
      </div>
      
      <div className="relative">
        <input
          type="text"
          placeholder="Search candidates, skills, positions..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && search()}
          className="w-full pl-10 pr-4 py-2.5 bg-white/80 backdrop-blur-sm border border-violet-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400" />
        <button 
          onClick={search}
          disabled={loading}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300 text-white rounded-lg transition-colors"
        >
          {loading ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-3 gap-2 mt-3">
              <input
                type="text"
                placeholder="Skills"
                value={filters.skills}
                onChange={(e) => setFilters({ ...filters, skills: e.target.value })}
                className="px-3 py-2 bg-white/60 border border-violet-200/50 rounded-lg text-xs focus:outline-none focus:border-violet-400"
              />
              <input
                type="text"
                placeholder="Experience"
                value={filters.experience}
                onChange={(e) => setFilters({ ...filters, experience: e.target.value })}
                className="px-3 py-2 bg-white/60 border border-violet-200/50 rounded-lg text-xs focus:outline-none focus:border-violet-400"
              />
              <input
                type="text"
                placeholder="Source"
                value={filters.source}
                onChange={(e) => setFilters({ ...filters, source: e.target.value })}
                className="px-3 py-2 bg-white/60 border border-violet-200/50 rounded-lg text-xs focus:outline-none focus:border-violet-400"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {results.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 space-y-2 max-h-48 overflow-y-auto"
        >
          {results.slice(0, 5).map((c: any) => (
            <div key={c.id} className="flex items-center gap-2 p-2 bg-white/60 rounded-lg hover:bg-white/80 transition-colors cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-600">
                {c.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800 truncate">{c.name}</p>
                <p className="text-[10px] text-stone-500 truncate">{c.position}</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full">{c.status}</span>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

// Email Composer Widget
function EmailComposerWidget() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [email, setEmail] = useState({ to: '', subject: '', body: '' });
  const [sending, setSending] = useState(false);
  const { success, error: showError } = useToast();

  useEffect(() => {
    fetch('/api/email-templates')
      .then(r => r.json())
      .then(d => setTemplates(d.templates || []));
  }, []);

  const applyTemplate = (t: any) => {
    setSelectedTemplate(t);
    setEmail({ ...email, subject: t.subject, body: t.body });
  };

  const sendEmail = async () => {
    if (!email.to || !email.subject) return;
    setSending(true);
    try {
      await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate: { email: email.to, name: email.to.split('@')[0] }, template: email })
      });
      success('Email sent!');
      setEmail({ to: '', subject: '', body: '' });
    } catch {
      showError('Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 rounded-2xl p-4 sm:p-5 border border-blue-200/50">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-500 rounded-lg">
          <Mail className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-stone-800 text-sm">Email Studio</h3>
          <p className="text-xs text-stone-500">Templates & composer</p>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <input
          type="email"
          placeholder="Recipient email"
          value={email.to}
          onChange={(e) => setEmail({ ...email, to: e.target.value })}
          className="w-full px-3 py-2 bg-white/80 border border-blue-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
        />
        <input
          type="text"
          placeholder="Subject"
          value={email.subject}
          onChange={(e) => setEmail({ ...email, subject: e.target.value })}
          className="w-full px-3 py-2 bg-white/80 border border-blue-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
        />
      </div>

      {templates.length > 0 && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {templates.slice(0, 3).map((t) => (
            <button
              key={t.id}
              onClick={() => applyTemplate(t)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedTemplate?.id === t.id 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-white/60 text-stone-600 hover:bg-white'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={sendEmail}
        disabled={sending || !email.to}
        className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
      >
        {sending ? <Clock className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Send Email
      </button>
    </div>
  );
}

// Interview Scorer Widget
function InterviewScorerWidget() {
  const [candidate, setCandidate] = useState('');
  const [criteria, setCriteria] = useState([
    { name: 'Technical', score: 0, max: 5 },
    { name: 'Communication', score: 0, max: 5 },
    { name: 'Problem Solving', score: 0, max: 5 },
    { name: 'Cultural Fit', score: 0, max: 5 },
  ]);
  const [saving, setSaving] = useState(false);
  const { success } = useToast();

  const totalScore = criteria.reduce((sum, c) => sum + c.score, 0);
  const maxTotal = criteria.reduce((sum, c) => sum + c.max, 0);
  const percentage = Math.round((totalScore / maxTotal) * 100);

  const saveScore = async () => {
    setSaving(true);
    try {
      await fetch('/api/interviews/demo/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate, criteria, totalScore, percentage })
      });
      success(`Score saved: ${percentage}%`);
      setCriteria(criteria.map(c => ({ ...c, score: 0 })));
      setCandidate('');
    } catch {
      // Silent fail
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 rounded-2xl p-4 sm:p-5 border border-amber-200/50">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-amber-500 rounded-lg">
          <Star className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-stone-800 text-sm">Interview Score</h3>
          <p className="text-xs text-stone-500">Rate candidates instantly</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-2xl font-bold text-amber-600">{percentage}%</p>
        </div>
      </div>

      <input
        type="text"
        placeholder="Candidate name"
        value={candidate}
        onChange={(e) => setCandidate(e.target.value)}
        className="w-full px-3 py-2 bg-white/80 border border-amber-200 rounded-lg text-sm mb-3 focus:outline-none focus:border-amber-400"
      />

      <div className="space-y-2 mb-4">
        {criteria.map((c, i) => (
          <div key={c.name} className="flex items-center justify-between">
            <span className="text-xs text-stone-600">{c.name}</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => {
                    const newCriteria = [...criteria];
                    newCriteria[i].score = star;
                    setCriteria(newCriteria);
                  }}
                  className={`w-6 h-6 rounded transition-colors ${
                    star <= c.score ? 'text-amber-500' : 'text-stone-300 hover:text-amber-300'
                  }`}
                >
                  <Star className="w-4 h-4 fill-current" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={saveScore}
        disabled={saving || !candidate}
        className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-lg text-sm font-semibold transition-colors"
      >
        {saving ? 'Saving...' : 'Save Score'}
      </button>
    </div>
  );
}

// Team Chat Widget
function TeamChatWidget() {
  const [comments, setComments] = useState<any[]>([
    { id: '1', author: 'Sarah', text: 'Great interview with John today!', time: '2m ago', mentions: [] },
    { id: '2', author: 'Mike', text: '@Sarah Should we move him to next round?', time: '1m ago', mentions: ['Sarah'] },
  ]);
  const [newComment, setNewComment] = useState('');
  const { success } = useToast();

  const addComment = () => {
    if (!newComment.trim()) return;
    const mentions = newComment.match(/@(\w+)/g)?.map(m => m.slice(1)) || [];
    setComments([...comments, {
      id: Date.now().toString(),
      author: 'You',
      text: newComment,
      time: 'Just now',
      mentions
    }]);
    setNewComment('');
    success('Comment added');
  };

  return (
    <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 rounded-2xl p-4 sm:p-5 border border-emerald-200/50">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-emerald-500 rounded-lg">
          <MessageSquare className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-stone-800 text-sm">Team Chat</h3>
          <p className="text-xs text-stone-500">Collaborate with mentions</p>
        </div>
        <div className="ml-auto flex -space-x-2">
          <div className="w-6 h-6 rounded-full bg-blue-400 border-2 border-white flex items-center justify-center text-[8px] text-white font-bold">S</div>
          <div className="w-6 h-6 rounded-full bg-purple-400 border-2 border-white flex items-center justify-center text-[8px] text-white font-bold">M</div>
          <div className="w-6 h-6 rounded-full bg-emerald-400 border-2 border-white flex items-center justify-center text-[8px] text-white font-bold">+</div>
        </div>
      </div>

      <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
        {comments.map((c) => (
          <div key={c.id} className="p-2 bg-white/60 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-stone-700">{c.author}</span>
              <span className="text-[10px] text-stone-400">{c.time}</span>
            </div>
            <p className="text-xs text-stone-600">{c.text}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <input
          type="text"
          placeholder="Type @ to mention..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addComment()}
          className="w-full pl-3 pr-10 py-2 bg-white/80 border border-emerald-200 rounded-lg text-sm focus:outline-none focus:border-emerald-400"
        />
        <button 
          onClick={addComment}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// Main Premium Dashboard Section
export default function PremiumDashboardSection() {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const { success } = useToast();

  const features = [
    {
      icon: Search,
      title: 'Smart Search',
      description: 'Advanced candidate search with filters for skills, experience & tags',
      color: 'bg-violet-500',
      gradient: 'bg-gradient-to-br from-violet-100 to-purple-100 hover:from-violet-200 hover:to-purple-200',
      badge: 'Pro',
      id: 'search'
    },
    {
      icon: Mail,
      title: 'Email Studio',
      description: 'Professional templates with variables and instant sending',
      color: 'bg-blue-500',
      gradient: 'bg-gradient-to-br from-blue-100 to-sky-100 hover:from-blue-200 hover:to-sky-200',
      id: 'email'
    },
    {
      icon: Star,
      title: 'Score Cards',
      description: 'Interview rating system with custom criteria tracking',
      color: 'bg-amber-500',
      gradient: 'bg-gradient-to-br from-amber-100 to-yellow-100 hover:from-amber-200 hover:to-yellow-200',
      badge: 'NEW',
      id: 'score'
    },
    {
      icon: FileText,
      title: 'Offer Letters',
      description: 'Generate professional offer letters in one click',
      color: 'bg-emerald-500',
      gradient: 'bg-gradient-to-br from-emerald-100 to-teal-100 hover:from-emerald-200 hover:to-teal-200',
      id: 'offer'
    },
    {
      icon: MessageSquare,
      title: 'Team Chat',
      description: 'Collaborate with @mentions and real-time discussions',
      color: 'bg-rose-500',
      gradient: 'bg-gradient-to-br from-rose-100 to-pink-100 hover:from-rose-200 hover:to-pink-200',
      id: 'chat'
    },
    {
      icon: Upload,
      title: 'Resume Parser',
      description: 'Parse PDFs and extract skills automatically',
      color: 'bg-indigo-500',
      gradient: 'bg-gradient-to-br from-indigo-100 to-violet-100 hover:from-indigo-200 hover:to-violet-200',
      badge: 'Pro',
      id: 'resume'
    },
    {
      icon: Share2,
      title: 'Job Boards',
      description: 'Post to LinkedIn, Indeed & Glassdoor instantly',
      color: 'bg-cyan-500',
      gradient: 'bg-gradient-to-br from-cyan-100 to-blue-100 hover:from-cyan-200 hover:to-blue-200',
      id: 'boards'
    },
    {
      icon: Wand2,
      title: 'AI Assistant',
      description: 'Get suggestions and automate repetitive tasks',
      color: 'bg-fuchsia-500',
      gradient: 'bg-gradient-to-br from-fuchsia-100 to-purple-100 hover:from-fuchsia-200 hover:to-purple-200',
      badge: 'BETA',
      id: 'ai'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 p-6 sm:p-8"
      >
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 blur-3xl rounded-full" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-blue-500/20 to-cyan-500/20 blur-3xl rounded-full" />
        </div>
        
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Premium Suite</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">
              Advanced <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-amber-400">Recruitment</span> Tools
            </h2>
            <p className="text-stone-400 text-sm max-w-xl">
              8 powerful features to streamline your hiring process. From AI search to offer generation, everything you need in one place.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/10">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-sm text-white font-medium">8 Tools Active</span>
            </div>
            <button className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl border border-white/10 transition-colors">
              <Zap className="w-5 h-5 text-amber-400" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Quick Action Widgets - Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickSearchWidget />
        <EmailComposerWidget />
        <InterviewScorerWidget />
        <TeamChatWidget />
      </div>

      {/* Feature Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            All Premium Features
          </h3>
          <button className="text-sm text-stone-500 hover:text-stone-700 flex items-center gap-1 transition-colors">
            View All <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {features.map((feature, index) => (
            <PremiumFeatureCard
              key={feature.id}
              {...feature}
              index={index}
              onClick={() => {
                success(`${feature.title} launched!`);
                setActiveModal(feature.id);
              }}
            />
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { icon: Users, label: 'Candidates', value: '12.5K', trend: '+8%', color: 'text-violet-600', bg: 'bg-violet-50' },
          { icon: CheckCircle2, label: 'Offers Sent', value: '48', trend: '+12%', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { icon: Target, label: 'Interviews', value: '156', trend: '+5%', color: 'text-amber-600', bg: 'bg-amber-50' },
          { icon: Award, label: 'Hired', value: '23', trend: '+15%', color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className={`p-2 rounded-lg ${stat.bg} ${stat.color} w-fit mb-3`}>
              <stat.icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-stone-800">{stat.value}</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              <span className="text-xs text-emerald-600 font-medium">{stat.trend}</span>
              <span className="text-xs text-stone-400">this month</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
