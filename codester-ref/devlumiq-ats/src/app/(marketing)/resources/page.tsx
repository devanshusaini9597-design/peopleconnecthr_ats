'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, FileText, Video, Headphones, Download,
  ArrowRight, Search, Clock, TrendingUp, Lightbulb,
  Zap, BarChart3, Layers, ChevronRight, Sparkles, Mail,
} from 'lucide-react';
import CTASection from '@/components/sections/CTASection';
import { useLocale } from '@/components/providers/LocaleProvider';
import { tween, spring } from '@/lib/motion';

/* â”€â”€â”€ Static data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const featuredResources = [
  {
    icon: Lightbulb,
    color: 'from-violet-500 to-purple-600',
    shadow: 'rgba(139,92,246,0.25)',
    type: 'Guide',
    title: 'The Complete Guide to Smart Hiring',
    description: 'Learn how to leverage smart tools to find, attract, and hire the best talent faster than ever.',
    readTime: '15 min read',
  },
  {
    icon: TrendingUp,
    color: 'from-brand-500 to-teal-600',
    shadow: 'rgba(20,184,166,0.2)',
    type: 'Report',
    title: 'Modern Recruitment Trends',
    description: 'Data-driven insights on how hiring teams are adapting to modern tools and workflows.',
    readTime: '20 min read',
  },
  {
    icon: Video,
    color: 'from-amber-500 to-orange-600',
    shadow: 'rgba(245,158,11,0.2)',
    type: 'Webinar',
    title: 'Scaling Hiring: Practical Tips',
    description: 'Practical strategies for growing teams while maintaining quality and culture.',
    readTime: '45 min watch',
  },
];

const blogPosts = [
  {
    category: 'Best Practices',
    title: '10 Interview Questions That Reveal True Cultural Fit',
    excerpt: 'Go beyond surface-level answers to understand if a candidate truly aligns with your values.',
    author: 'Devlumiq Team',
    date: 'Jan 15, 2026',
    readTime: '8',
  },
  {
    category: 'Product Updates',
    title: 'Introducing Smart Resume Parsing v2.0',
    excerpt: 'Our latest update brings improved accuracy and support for additional resume formats.',
    author: 'Product Team',
    date: 'Jan 12, 2026',
    readTime: '5',
  },
  {
    category: 'Industry Insights',
    title: 'The Future of Remote Hiring in 2026',
    excerpt: 'How the best companies are adapting their processes for distributed teams.',
    author: 'Devlumiq Team',
    date: 'Jan 10, 2026',
    readTime: '12',
  },
  {
    category: 'Case Study',
    title: 'How Teams Reduce Time-to-Hire with ATS',
    excerpt: 'A deep dive into the strategies and tools that drive hiring transformation.',
    author: 'Devlumiq Team',
    date: 'Jan 8, 2026',
    readTime: '10',
  },
  {
    category: 'Guides',
    title: 'Building a Diverse Pipeline: A Practical Guide',
    excerpt: 'Actionable strategies for sourcing, attracting, and converting diverse candidates.',
    author: 'Devlumiq Team',
    date: 'Jan 5, 2026',
    readTime: '15',
  },
  {
    category: 'Templates',
    title: '5 Email Templates That Boost Response Rates',
    excerpt: 'Proven templates for outreach, follow-ups, and offer negotiations.',
    author: 'Recruiting Team',
    date: 'Jan 3, 2026',
    readTime: '6',
  },
];

const contentTypes = [
  { icon: FileText,   labelKey: 'resources.typesBlog' },
  { icon: BookOpen,   labelKey: 'resources.typesGuides' },
  { icon: Video,      labelKey: 'resources.typesWebinars' },
  { icon: Headphones, labelKey: 'resources.typesPodcasts' },
  { icon: Download,   labelKey: 'resources.typesTemplates' },
];

const categoryMeta: Record<string, { gradient: string; icon: typeof FileText; tKey: string }> = {
  'Best Practices':    { gradient: 'from-violet-500 to-purple-600', icon: BookOpen,   tKey: 'resources.catBestPractices' },
  'Product Updates':   { gradient: 'from-brand-500 to-teal-600',   icon: Zap,        tKey: 'resources.catUpdates' },
  'Industry Insights': { gradient: 'from-amber-500 to-orange-600', icon: TrendingUp, tKey: 'resources.catInsights' },
  'Case Study':        { gradient: 'from-emerald-500 to-teal-600', icon: BarChart3,  tKey: 'resources.catCaseStudies' },
  'Guides':            { gradient: 'from-cyan-500 to-blue-600',    icon: FileText,   tKey: 'resources.catGuides' },
  'Templates':         { gradient: 'from-rose-500 to-pink-600',    icon: Layers,     tKey: 'resources.catTemplates' },
};

const categoryFilters = [
  { key: 'All',               count: 6, tKey: 'resources.catAll' },
  { key: 'Best Practices',    count: 1, tKey: 'resources.catBestPractices' },
  { key: 'Product Updates',   count: 1, tKey: 'resources.catUpdates' },
  { key: 'Case Studies',      count: 1, tKey: 'resources.catCaseStudies' },
  { key: 'Industry Insights', count: 1, tKey: 'resources.catInsights' },
  { key: 'Guides',            count: 1, tKey: 'resources.catGuides' },
  { key: 'Templates',         count: 1, tKey: 'resources.catTemplates' },
];

/* â”€â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export default function ResourcesPage() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [email, setEmail] = useState('');
  const { t } = useLocale();

  const filteredPosts = activeCategory === 'All'
    ? blogPosts
    : blogPosts.filter((post) => {
        const lookupKey = activeCategory === 'Case Studies' ? 'Case Study' : activeCategory;
        return post.category === lookupKey;
      });

  return (
    <>
      {/* â”€â”€ Hero â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="relative py-16 sm:py-24 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-[#0f0f0f]" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, rgba(20,184,166,0.12) 0%, rgba(13,148,136,0.04) 30%, transparent 70%)' }}
        />
        <div className="absolute top-20 left-1/4 w-80 h-80 bg-violet-500/[0.07] rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-36 right-1/4 w-56 h-56 bg-brand-500/[0.08] rounded-full blur-[80px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={tween.normal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 mb-6"
          >
            <BookOpen className="w-4 h-4 text-brand-400" />
            <span className="text-xs sm:text-sm font-semibold text-stone-300 uppercase tracking-[0.18em]">
              {t('resources.badge')}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...tween.normal, delay: 0.06 }}
            className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight"
          >
            {t('resources.title')}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...tween.normal, delay: 0.12 }}
            className="mt-4 text-sm sm:text-lg text-stone-400 max-w-2xl mx-auto"
          >
            {t('resources.subtitle')}
          </motion.p>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...tween.normal, delay: 0.18 }}
            className="mt-8 max-w-2xl mx-auto"
          >
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 pointer-events-none group-focus-within:text-brand-400 transition-colors" />
              <input
                type="text"
                placeholder={t('resources.searchPlaceholder')}
                className="w-full pl-14 pr-4 py-4 rounded-2xl bg-white/10 border border-white/15 text-white placeholder-stone-500 focus:border-brand-500/60 focus:bg-white/[0.12] focus:outline-none text-sm sm:text-base backdrop-blur-sm transition-all"
              />
            </div>
          </motion.div>

          {/* Content-type pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.28 }}
            className="mt-6 flex items-center justify-center gap-2 flex-wrap"
          >
            {contentTypes.map(({ icon: Icon, labelKey }) => (
              <div
                key={labelKey}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.07] border border-white/10 hover:bg-white/[0.13] hover:border-white/20 transition-all cursor-pointer"
              >
                <Icon className="w-3.5 h-3.5 text-stone-400" />
                <span className="text-stone-400 text-xs font-semibold">{t(labelKey)}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* â”€â”€ Featured Resources â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={tween.normal}
            className="mb-8 sm:mb-10"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 mb-2">
              <Sparkles className="w-3 h-3 text-brand-500" />
              <span className="text-[11px] font-black text-brand-600 uppercase tracking-widest">Featured</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900">{t('resources.featuredTitle')}</h2>
            <p className="text-stone-500 text-sm mt-1">{t('resources.featuredDesc')}</p>
          </motion.div>

          {/* Bento grid: hero (3 cols) + 2 stacked side cards (2 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5">
            {/* Hero card */}
            {(() => {
              const r = featuredResources[0];
              const Icon = r.icon;
              return (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ ...spring.smooth, delay: 0 }}
                  whileHover={{ y: -6 }}
                  style={{ '--hover-shadow': `0 24px 48px -8px ${r.shadow}` } as React.CSSProperties}
                  className="lg:col-span-3 group relative rounded-2xl sm:rounded-3xl overflow-hidden border border-stone-200/80 bg-white hover:border-brand-200/50 hover:shadow-2xl transition-all duration-300 cursor-pointer"
                >
                  <div className={`h-52 sm:h-60 bg-gradient-to-br ${r.color} flex items-end p-6 relative overflow-hidden`}>
                    <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 65% 25%, rgba(255,255,255,0.18) 0%, transparent 55%)' }} />
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 20px)' }} />
                    <div className="absolute top-5 right-5 w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <span className="relative z-10 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white text-xs font-bold uppercase tracking-wider">
                      {r.type}
                    </span>
                  </div>
                  <div className="p-6 sm:p-8">
                    <h3 className="text-xl sm:text-2xl font-extrabold text-stone-900 mb-3 group-hover:text-brand-600 transition-colors leading-snug">{r.title}</h3>
                    <p className="text-stone-500 text-sm sm:text-base mb-5 leading-relaxed">{r.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-sm text-stone-400">
                        <Clock className="w-3.5 h-3.5" /> {r.readTime}
                      </span>
                      <span className="flex items-center gap-1.5 text-brand-600 text-sm font-bold group-hover:gap-2.5 transition-all">
                        {t('resources.readMore')} <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })()}

            {/* Two stacked cards */}
            <div className="lg:col-span-2 flex flex-col gap-4 sm:gap-5">
              {featuredResources.slice(1).map((r, i) => {
                const Icon = r.icon;
                return (
                  <motion.div
                    key={r.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ ...spring.smooth, delay: 0.1 + i * 0.08 }}
                    whileHover={{ y: -4 }}
                    className="group flex-1 relative rounded-2xl overflow-hidden border border-stone-200/80 bg-white hover:border-brand-200/50 hover:shadow-xl transition-all duration-300 cursor-pointer"
                  >
                    <div className={`h-28 bg-gradient-to-br ${r.color} flex items-end p-4 relative overflow-hidden`}>
                      <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, rgba(255,255,255,0.16) 0%, transparent 60%)' }} />
                      <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <span className="relative z-10 px-2.5 py-0.5 rounded-full bg-white/20 border border-white/30 text-white text-[11px] font-bold uppercase tracking-wider">
                        {r.type}
                      </span>
                    </div>
                    <div className="p-5">
                      <h3 className="font-bold text-stone-900 text-base mb-1.5 group-hover:text-brand-600 transition-colors leading-snug line-clamp-2">{r.title}</h3>
                      <p className="text-stone-500 text-xs mb-3 leading-relaxed line-clamp-2">{r.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs text-stone-400"><Clock className="w-3.5 h-3.5" /> {r.readTime}</span>
                        <span className="flex items-center gap-1 text-brand-600 text-xs font-bold">{t('resources.readMore')} <ChevronRight className="w-3.5 h-3.5" /></span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* â”€â”€ Blog grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8 bg-stone-50">
        <div className="max-w-6xl mx-auto">
          {/* Category filter pills */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-8 sm:mb-10">
            {categoryFilters.map((cat) => {
              const isActive = activeCategory === cat.key;
              return (
                <motion.button
                  key={cat.key}
                  type="button"
                  onClick={() => setActiveCategory(cat.key)}
                  whileTap={{ scale: 0.96 }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-500/30'
                      : 'bg-white text-stone-600 border border-stone-200/80 hover:border-brand-300 hover:text-brand-600'
                  }`}
                >
                  {t(cat.tKey)}
                  <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-stone-100 text-stone-400'}`}>
                    {cat.count}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900">{t('resources.latestTitle')}</h2>
            <motion.span
              whileHover={{ x: 3 }}
              className="flex items-center gap-1.5 text-brand-600 text-sm font-bold cursor-pointer"
            >
              {t('resources.viewAll')} <ArrowRight className="w-4 h-4" />
            </motion.span>
          </div>

          {/* Grid */}
          <AnimatePresence mode="wait">
            {filteredPosts.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-20"
              >
                <BookOpen className="w-10 h-10 text-stone-300 mx-auto mb-3" />
                <p className="text-stone-600 font-medium">{t('resources.noArticles')}</p>
                <button
                  onClick={() => setActiveCategory('All')}
                  className="mt-3 text-brand-600 text-sm font-semibold underline underline-offset-2 hover:text-brand-700"
                >
                  {t('resources.viewAllArticles')}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6"
              >
                {filteredPosts.map((post, i) => {
                  const meta = categoryMeta[post.category] ?? { gradient: 'from-stone-400 to-stone-500', icon: FileText, tKey: '' };
                  const Icon = meta.icon;
                  const catLabel = meta.tKey ? t(meta.tKey) : post.category;
                  return (
                    <motion.article
                      key={post.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...tween.normal, delay: i * 0.06 }}
                      whileHover={{ y: -4 }}
                      className="group rounded-2xl bg-white border border-stone-200 hover:border-brand-200 hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer"
                    >
                      {/* Thumbnail strip */}
                      <div className={`h-36 bg-gradient-to-br ${meta.gradient} flex items-center justify-center relative overflow-hidden`}>
                        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 68% 28%, rgba(255,255,255,0.22) 0%, transparent 55%)' }} />
                        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 1px, transparent 1px, transparent 16px)' }} />
                        <Icon className="w-11 h-11 text-white/80 stroke-[1.5] relative z-10" />
                      </div>
                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`px-2.5 py-0.5 rounded-full bg-gradient-to-r ${meta.gradient} text-white text-[11px] font-bold`}>
                            {catLabel}
                          </span>
                          <span className="text-xs text-stone-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {post.readTime} {t('resources.minRead')}
                          </span>
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-stone-900 mb-2 group-hover:text-brand-600 transition-colors leading-snug line-clamp-2">
                          {post.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-stone-500 mb-4 leading-relaxed line-clamp-2">{post.excerpt}</p>
                        <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${meta.gradient} flex items-center justify-center flex-shrink-0`}>
                              <span className="text-[10px] font-black text-white">
                                {post.author.split(' ').map((n) => n[0]).join('')}
                              </span>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-stone-900 leading-tight">{post.author}</p>
                              <p className="text-[11px] text-stone-400">{post.date}</p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* â”€â”€ Newsletter strip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="relative py-14 sm:py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-[#0f0f0f]" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(20,184,166,0.12) 0%, transparent 60%)' }} />

        <div className="relative max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={tween.normal}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/15 border border-brand-500/20 mb-6">
              <Mail className="w-3.5 h-3.5 text-brand-400" />
              <span className="text-xs font-bold text-brand-300 uppercase tracking-widest">Newsletter</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-4">{t('resources.subscribeTitle')}</h2>
            <p className="text-stone-400 sm:text-lg mb-8 max-w-xl mx-auto">{t('resources.subscribeDesc')}</p>
            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('resources.subscribePlaceholder')}
                className="flex-1 px-4 py-3.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-stone-500 focus:border-brand-500/60 focus:outline-none text-sm backdrop-blur-sm transition-all"
              />
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: '0 6px 24px -4px rgba(13,148,136,0.4)' }}
                whileTap={{ scale: 0.97 }}
                className="px-6 py-3.5 bg-gradient-to-r from-brand-600 to-teal-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-brand-500/25 whitespace-nowrap"
              >
                {t('resources.subscribeBtn')}
              </motion.button>
            </div>
            <p className="text-stone-600 text-xs mt-3">{t('resources.noSpam')}</p>
          </motion.div>
        </div>
      </section>

      {/* â”€â”€ CTA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <CTASection title={t('resources.ctaTitle')} subtitle={t('resources.ctaSubtitle')} />
    </>
  );
}
