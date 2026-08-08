'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   Dashboard › Premium Features Page
   Displays all 9 premium recruitment tools organised by category.
   Sections: Hero Banner · Stats Row · Category Filter · Feature Grid ·
             How to Access · Bottom CTA Banner
───────────────────────────────────────────────────────────────────────────── */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown, Sparkles, Mail, Star, FileCheck, Upload, MessageSquare,
  Share2, Search, Zap, TrendingUp, Award, ArrowRight, CheckCircle2,
  MessageCircle, Briefcase, Target, Layers, Users, BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import StatCard from '@/components/ui/StatCard';

type Feature = {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
  iconBg: string;
  iconColor: string;
  link: string;
  stat: string;
  statColor: string;
  category: string;
  featured?: boolean;
  bullets: string[];
};

const categories = ['All', 'Search & Tools', 'Communication', 'Documents', 'Collaboration'];

const premiumFeatures: Feature[] = [
  {
    id: 'smart-search',
    name: 'Smart Search',
    description: 'Advanced candidate discovery with multi-filter querying across skills, experience level, tags, source channel, and pipeline stage.',
    icon: Search,
    gradient: 'from-blue-500 to-indigo-600',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
    link: '/dashboard/premium/search',
    stat: '5+ filters',
    statColor: 'bg-blue-50 text-blue-700 border-blue-200',
    category: 'Search & Tools',
    featured: true,
    bullets: ['Boolean-style filter logic', 'Skill & keyword matching', 'Pipeline stage filters', 'Export filtered results'],
  },
  {
    id: 'email-templates',
    name: 'Email Templates',
    description: 'Professional pre-built and customisable email templates for every stage — interview invites, offer letters, rejections — with dynamic variable substitution.',
    icon: Mail,
    gradient: 'from-teal-500 to-emerald-600',
    iconBg: 'bg-teal-500/10',
    iconColor: 'text-teal-600',
    link: '/dashboard/premium/email',
    stat: '4+ templates',
    statColor: 'bg-teal-50 text-teal-700 border-teal-200',
    category: 'Communication',
    featured: true,
    bullets: ['Interview invite templates', 'Offer & rejection emails', 'Dynamic {{variable}} fields', 'One-click send from profile'],
  },
  {
    id: 'whatsapp-templates',
    name: 'WhatsApp Messaging',
    description: 'Reach candidates instantly on WhatsApp from the unified Messages inbox — templates, consent, and replies in one place.',
    icon: MessageCircle,
    gradient: 'from-green-500 to-teal-500',
    iconBg: 'bg-green-500/10',
    iconColor: 'text-green-600',
    link: '/dashboard/messages',
    stat: 'Instant messaging',
    statColor: 'bg-green-50 text-green-700 border-green-200',
    category: 'Communication',
    bullets: ['WhatsApp Business API', 'Scheduling reminders', 'Status update messages', 'Unified inbox'],
  },
  {
    id: 'interview-scoring',
    name: 'Interview Scoring',
    description: 'Structured candidate evaluation across 5 dimensions: technical skills, communication, problem-solving, cultural fit, and relevant experience.',
    icon: Star,
    gradient: 'from-amber-500 to-orange-600',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-600',
    link: '/dashboard/premium/scoring',
    stat: '5-dimension rating',
    statColor: 'bg-amber-50 text-amber-700 border-amber-200',
    category: 'Search & Tools',
    featured: true,
    bullets: ['Per-criterion scoring', 'Team-wide score visibility', 'Score history & trends', 'PDF scorecard export'],
  },
  {
    id: 'offer-letters',
    name: 'Offer Letter Generator',
    description: 'Auto-generate legally structured offer letters in seconds — pre-filled with salary, benefits, start date, role details and your custom terms.',
    icon: FileCheck,
    gradient: 'from-emerald-500 to-green-600',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-600',
    link: '/dashboard/premium/offers',
    stat: 'One-click generation',
    statColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    category: 'Documents',
    bullets: ['Auto-fill from candidate data', 'Custom clauses & terms', 'PDF download', 'Email directly from app'],
  },
  {
    id: 'team-comments',
    name: 'Team Collaboration',
    description: 'Contextual candidate discussions with @mention support. Keep your team aligned with threaded comments directly on candidate profiles.',
    icon: MessageSquare,
    gradient: 'from-purple-500 to-violet-600',
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-600',
    link: '/dashboard/premium/comments',
    stat: '@mention support',
    statColor: 'bg-purple-50 text-purple-700 border-purple-200',
    category: 'Collaboration',
    bullets: ['@mention teammates', 'Threaded discussions', 'Timestamp history', 'Profile-linked comments'],
  },
  {
    id: 'resume-parser',
    name: 'Resume Parser',
    description: 'Upload a PDF résumé and automatically extract and structure skills, work history, education, and contact details into the candidate record.',
    icon: Upload,
    gradient: 'from-cyan-500 to-blue-600',
    iconBg: 'bg-cyan-500/10',
    iconColor: 'text-cyan-600',
    link: '/dashboard/premium/resume',
    stat: 'Auto extraction',
    statColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    category: 'Search & Tools',
    bullets: ['PDF parsing & extraction', 'Skills auto-tagging', 'Education & experience', 'Instant profile population'],
  },
  {
    id: 'job-posting',
    name: 'Job Posting Manager',
    description: 'Craft and publish polished job listings directly from the dashboard — assign department, salary range, job type, and track applicant counts.',
    icon: Briefcase,
    gradient: 'from-indigo-500 to-blue-600',
    iconBg: 'bg-indigo-500/10',
    iconColor: 'text-indigo-600',
    link: '/dashboard/premium/jobposting',
    stat: 'Structured listings',
    statColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    category: 'Documents',
    bullets: ['Rich job description editor', 'Salary & type fields', 'Department grouping', 'Applicant count tracking'],
  },
  {
    id: 'job-boards',
    name: 'Job Board Distribution',
    description: 'Syndicate your listings to LinkedIn, Indeed, Glassdoor, and Naukri with one click, and track source-level application performance.',
    icon: Share2,
    gradient: 'from-rose-500 to-pink-600',
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-600',
    link: '/dashboard/premium/jobboards',
    stat: '4+ job boards',
    statColor: 'bg-rose-50 text-rose-700 border-rose-200',
    category: 'Communication',
    bullets: ['LinkedIn, Indeed, Glassdoor', 'Source analytics', 'One-click post & update', 'Application tracking per board'],
  },
];

const statCards = [
  { label: 'Premium Tools', value: '9', icon: Sparkles, iconClassName: 'text-amber-600 bg-amber-50' },
  { label: 'Time Saved', value: '50%', icon: Zap, iconClassName: 'text-brand-600 bg-brand-50' },
  { label: 'Productivity', value: '2×', icon: TrendingUp, iconClassName: 'text-emerald-600 bg-emerald-50' },
  { label: 'Avg Score Accuracy', value: '94%', icon: BarChart3, iconClassName: 'text-sky-600 bg-sky-50' },
];

const accessSteps = [
  { step: '01', title: 'Candidate Profiles', desc: 'Open any candidate to access Email Templates, Interview Scoring, Team Comments & Resume Parser.', icon: Users },
  { step: '02', title: 'Jobs Section', desc: 'Open a job listing to manage Job Posting details and syndicate to external Job Boards.', icon: Briefcase },
  { step: '03', title: 'Smart Search', desc: 'Use the Advanced Search button on the Candidates list to unlock multi-criteria filtering.', icon: Search },
];

export default function PremiumFeaturesPage() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filtered = activeCategory === 'All'
    ? premiumFeatures
    : premiumFeatures.filter((f) => f.category === activeCategory);

  return (
    <PageShell>
      <PageHeader
        icon={Crown}
        title="Premium Features"
        subtitle="Pro Plan · Active — The full suite of advanced recruitment tools for professional hiring teams."
      >
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700 tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Pro Plan
          </span>
        </div>
      </PageHeader>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            icon={s.icon}
            iconClassName={s.iconClassName}
          />
        ))}
      </div>

      {/* ── Category Filter ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-all duration-200 ${
              activeCategory === cat
                ? 'bg-stone-900 text-white border-stone-900 shadow-md'
                : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400 hover:text-stone-700'
            }`}
          >
            {cat === 'All' && <Layers className="w-3.5 h-3.5" />}
            {cat}
          </button>
        ))}
        <span className="ml-auto text-xs text-stone-400 font-medium">{filtered.length} tool{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Feature Grid ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeCategory}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filtered.map((feature, index) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              onMouseEnter={() => setHoveredId(feature.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <Link href={feature.link} className="block h-full">
                <div className={`group relative h-full flex flex-col p-5 rounded-2xl border bg-white transition-all duration-300 overflow-hidden ${
                  hoveredId === feature.id
                    ? 'border-stone-300 shadow-xl shadow-stone-900/8 -translate-y-0.5'
                    : 'border-stone-200 shadow-sm hover:shadow-md'
                }`}>
                  {/* Gradient glow on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300 pointer-events-none rounded-2xl`} />

                  {/* Top row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-2.5 rounded-xl ${feature.iconBg}`}>
                      <feature.icon className={`w-5 h-5 ${feature.iconColor}`} />
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${feature.statColor}`}>
                      {feature.stat}
                    </span>
                  </div>

                  {/* Title + desc */}
                  <h3 className="font-bold text-stone-900 mb-1.5 group-hover:text-stone-700 transition-colors text-[15px]">
                    {feature.name}
                  </h3>
                  <p className="text-sm text-stone-500 leading-relaxed mb-4 flex-1">
                    {feature.description}
                  </p>

                  {/* Bullet points */}
                  <ul className="space-y-1.5 mb-5">
                    {feature.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2 text-xs text-stone-500">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className={`flex items-center gap-1.5 text-sm font-semibold bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent`}>
                    <span>Open feature</span>
                    <ArrowRight className={`w-4 h-4 transition-transform duration-200 ${feature.iconColor} ${hoveredId === feature.id ? 'translate-x-1' : ''}`} />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* ── How to Access ── */}
      <div className="rounded-2xl border border-stone-200 bg-gradient-to-br from-stone-50 to-white overflow-hidden">
        <div className="px-6 py-5 border-b border-stone-200 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand-50">
            <Target className="w-4 h-4 text-brand-600" />
          </div>
          <div>
            <h2 className="font-bold text-stone-900 text-base">How to Access Premium Features</h2>
            <p className="text-xs text-stone-500">Three entry points inside your dashboard</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-stone-200">
          {accessSteps.map(({ step, title, desc, icon: Icon }) => (
            <div key={step} className="p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-black text-stone-100 leading-none select-none">{step}</span>
                <div className="p-2 rounded-xl bg-brand-50">
                  <Icon className="w-4 h-4 text-brand-600" />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-stone-900 mb-1 text-sm">{title}</h4>
                <p className="text-xs text-stone-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom CTA Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-600 via-teal-600 to-emerald-600 p-6 sm:p-8"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_90%_50%,rgba(255,255,255,0.08),transparent)] pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-5 h-5 text-white/80" />
              <span className="text-xs font-bold text-white/70 uppercase tracking-widest">All features unlocked</span>
            </div>
            <h3 className="text-xl font-bold text-white leading-tight">You have full Pro access.</h3>
            <p className="text-white/70 text-sm mt-1">Explore every tool above — your entire team can use them right now.</p>
          </div>
          <Link href="/dashboard/candidates" className="flex items-center gap-2 px-5 py-3 bg-white text-brand-700 font-bold text-sm rounded-xl hover:bg-stone-50 transition-colors shadow-lg flex-shrink-0 whitespace-nowrap">
            <Users className="w-4 h-4" />
            Go to Candidates
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </motion.div>

    </PageShell>
  );
}
