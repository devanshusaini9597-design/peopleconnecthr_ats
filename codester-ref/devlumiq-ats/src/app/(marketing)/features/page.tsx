'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { type ElementType } from 'react';
import {
  Users, BarChart3, Briefcase, Zap, LayoutDashboard, Shield,
  Mail, Calendar, FileText, Search, Bell, Filter,
  ArrowRight, CheckCircle2, Sparkles, Star, Globe, Clock,
  TrendingUp, Lock, Cpu, MessageSquare, Layers, ArrowUpRight,
  Target, Activity, Gauge, ChevronRight,
} from 'lucide-react';
import Logo from '@/components/Logo';
import CTASection from '@/components/sections/CTASection';
import { useLocale } from '@/components/providers/LocaleProvider';

/* ─── Data ──────────────────────────────────────────────────────────── */

const heroWords = ['features.heroWord1', 'features.heroWord2', 'features.heroWord3'];
const categories = ['All', 'AI', 'Pipeline', 'Analytics', 'Communications', 'Security'];

const categoryMeta: Record<string, { icon: ElementType; color: string }> = {
  'All':            { icon: Layers,        color: 'text-stone-500' },
  'AI':             { icon: Cpu,           color: 'text-violet-600' },
  'Pipeline':       { icon: TrendingUp,    color: 'text-brand-600'  },
  'Analytics':      { icon: BarChart3,     color: 'text-amber-600'  },
  'Communications': { icon: MessageSquare, color: 'text-rose-600'   },
  'Security':       { icon: Lock,          color: 'text-cyan-600'   },
};

const featureKeys = [
  { icon: Users,           titleKey: 'features.f1Title',  descKey: 'features.f1Desc',  gradient: 'from-brand-500 to-teal-600',       category: 'Pipeline',       popular: true,  size: 'lg', tag: 'Core'     },
  { icon: BarChart3,       titleKey: 'features.f2Title',  descKey: 'features.f2Desc',  gradient: 'from-amber-500 to-orange-600',      category: 'Analytics',      popular: true,  size: 'lg', tag: 'Core'     },
  { icon: Briefcase,       titleKey: 'features.f3Title',  descKey: 'features.f3Desc',  gradient: 'from-violet-500 to-purple-600',     category: 'Pipeline',       popular: false, size: 'sm', tag: null       },
  { icon: Zap,             titleKey: 'features.f4Title',  descKey: 'features.f4Desc',  gradient: 'from-brand-500 to-teal-600',        category: 'AI',             popular: true,  size: 'sm', tag: 'AI'       },
  { icon: LayoutDashboard, titleKey: 'features.f5Title',  descKey: 'features.f5Desc',  gradient: 'from-emerald-500 to-teal-500',      category: 'Pipeline',       popular: false, size: 'sm', tag: null       },
  { icon: Shield,          titleKey: 'features.f6Title',  descKey: 'features.f6Desc',  gradient: 'from-cyan-500 to-blue-600',         category: 'Security',       popular: false, size: 'sm', tag: 'Security' },
  { icon: Mail,            titleKey: 'features.f7Title',  descKey: 'features.f7Desc',  gradient: 'from-rose-500 to-pink-600',         category: 'Communications', popular: false, size: 'sm', tag: null       },
  { icon: Calendar,        titleKey: 'features.f8Title',  descKey: 'features.f8Desc',  gradient: 'from-brand-500 to-cyan-600',        category: 'Communications', popular: true,  size: 'sm', tag: null       },
  { icon: FileText,        titleKey: 'features.f9Title',  descKey: 'features.f9Desc',  gradient: 'from-amber-500 to-orange-600',      category: 'Pipeline',       popular: false, size: 'sm', tag: null       },
  { icon: Search,          titleKey: 'features.f10Title', descKey: 'features.f10Desc', gradient: 'from-brand-500 to-teal-600',        category: 'AI',             popular: false, size: 'sm', tag: 'AI'       },
  { icon: Bell,            titleKey: 'features.f11Title', descKey: 'features.f11Desc', gradient: 'from-violet-500 to-purple-600',     category: 'AI',             popular: false, size: 'sm', tag: null       },
  { icon: Filter,          titleKey: 'features.f12Title', descKey: 'features.f12Desc', gradient: 'from-stone-600 to-stone-700',       category: 'Analytics',      popular: false, size: 'sm', tag: null       },
];

const spotlightsMeta = [
  { icon: Target, badgeColor: 'bg-violet-50 text-violet-700 border-violet-200', iconGradient: 'from-violet-500 to-purple-600', mockupType: 'score' as const,
    badgeKey: 'features.spot1Badge', titleKey: 'features.spot1Title', descKey: 'features.spot1Desc',
    bulletKeys: ['features.spot1B1', 'features.spot1B2', 'features.spot1B3', 'features.spot1B4'] },
  { icon: Activity, badgeColor: 'bg-brand-50 text-brand-700 border-brand-200', iconGradient: 'from-brand-500 to-teal-600', mockupType: 'kanban' as const,
    badgeKey: 'features.spot2Badge', titleKey: 'features.spot2Title', descKey: 'features.spot2Desc',
    bulletKeys: ['features.spot2B1', 'features.spot2B2', 'features.spot2B3', 'features.spot2B4'] },
  { icon: Gauge, badgeColor: 'bg-amber-50 text-amber-700 border-amber-200', iconGradient: 'from-amber-500 to-orange-600', mockupType: 'chart' as const,
    badgeKey: 'features.spot3Badge', titleKey: 'features.spot3Title', descKey: 'features.spot3Desc',
    bulletKeys: ['features.spot3B1', 'features.spot3B2', 'features.spot3B3', 'features.spot3B4'] },
];

const highlightKeys = ['features.h1', 'features.h2', 'features.h3', 'features.h4', 'features.h5', 'features.h6'];

/* ─── Mockup Components ─────────────────────────────────────────────── */

function ScreenshotImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-stone-200/80 shadow-2xl bg-white">
      <Image
        src={src}
        alt={alt}
        width={1200}
        height={750}
        className="w-full h-auto"
        priority
      />
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function FeaturesPage() {
  const { t } = useLocale();
  const [activeCategory, setActiveCategory] = useState('All');
  const [wordIndex, setWordIndex] = useState(0);
  const categoryLabels: Record<string, string> = {
    'All': t('features.cat.all'),
    'AI': t('features.cat.ai'),
    'Pipeline': t('features.cat.pipeline'),
    'Analytics': t('features.cat.analytics'),
    'Communications': t('features.cat.communications'),
    'Security': t('features.cat.security'),
  };

  useEffect(() => {
    const id = setInterval(() => setWordIndex(i => (i + 1) % heroWords.length), 2400);
    return () => clearInterval(id);
  }, []);

  const filtered = activeCategory === 'All' ? featureKeys : featureKeys.filter(f => f.category === activeCategory);
  const isFiltered = activeCategory !== 'All';

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative py-20 sm:py-28 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-slate-950" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(20,184,166,0.2), transparent 60%)' }} />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 rounded-full bg-brand-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-teal-500/10 blur-[100px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.08] border border-white/10 mb-7"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span className="text-xs font-bold text-stone-300 uppercase tracking-widest">{t('features.badge')}</span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
            className="text-4xl sm:text-5xl lg:text-[3.5rem] font-black text-white tracking-tight leading-[1.08] mb-6"
          >
            Recruiting that is{' '}
            <span className="inline-block min-w-[8rem] text-left">
              <AnimatePresence mode="wait">
                <motion.span
                  key={heroWords[wordIndex]}
                  initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -20, filter: 'blur(8px)' }}
                  transition={{ duration: 0.4 }}
                  className="bg-gradient-to-r from-brand-400 via-teal-400 to-brand-300 bg-clip-text text-transparent"
                >
                  {t(heroWords[wordIndex])}
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }}
            className="text-base sm:text-lg text-stone-400 max-w-2xl mx-auto leading-relaxed mb-10"
          >
            {t('features.subtitle')}
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
            className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3"
          >
            {[
              { icon: Sparkles, value: '12+',  label: 'feature areas' },
              { icon: Star,     value: '50+',  label: 'db models'     },
              { icon: Globe,    value: '10',   label: 'languages'     },
              { icon: Clock,    value: 'Self', label: 'hosted deploy' },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                <span className="text-white font-black text-sm">{value}</span>
                <span className="text-stone-500 text-sm">{label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Category filter + Feature grid ───────────────────────────────── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-stone-50">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-10 sm:mb-14">
            {categories.map((cat) => {
              const meta = categoryMeta[cat];
              const CatIcon = meta.icon;
              const isActive = activeCategory === cat;
              return (
                <motion.button key={cat} onClick={() => setActiveCategory(cat)} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all duration-200 ${
                    isActive
                      ? 'bg-stone-900 text-white border-stone-900 shadow-lg'
                      : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300 hover:text-stone-900 shadow-sm'
                  }`}
                >
                  <CatIcon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : meta.color}`} />
                  {categoryLabels[cat]}
                  {cat !== 'All' && (
                    <span className={`text-[10px] font-black rounded-full px-1.5 py-0.5 ${isActive ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500'}`}>
                      {featureKeys.filter(f => f.category === cat).length}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
            >
              {filtered.map((f, i) => {
                const Icon = f.icon;
                const catMeta = categoryMeta[f.category];
                const isLarge = !isFiltered && f.size === 'lg';
                return (
                  <motion.div
                    key={f.titleKey}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 26 }}
                    whileHover={{ y: -4 }}
                    className={`group relative rounded-2xl overflow-hidden border transition-all duration-300 ${
                      isLarge
                        ? 'lg:col-span-2 bg-gradient-to-br from-[#0f0f0f] to-[#0d1a1a] border-brand-500/30 shadow-[0_8px_32px_-8px_rgba(13,148,136,0.2)]'
                        : 'bg-white border-stone-200 hover:border-stone-300 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]'
                    }`}
                  >
                    {!isLarge && (
                      <div className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-[0.04] transition-opacity duration-300`} />
                    )}
                    <div className={`relative p-5 sm:p-6 h-full flex ${isLarge ? 'flex-col sm:flex-row gap-6 items-start' : 'flex-col'}`}>
                      <div className="flex-shrink-0">
                        <motion.div
                          whileHover={{ scale: 1.08, rotate: 3 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                          className={`${isLarge ? 'w-14 h-14' : 'w-11 h-11'} rounded-2xl bg-gradient-to-br ${f.gradient} flex items-center justify-center shadow-lg`}
                        >
                          <Icon className={`${isLarge ? 'w-7 h-7' : 'w-5 h-5'} text-white`} />
                        </motion.div>
                      </div>
                      <div className="flex flex-col flex-1">
                        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                          {f.popular && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${isLarge ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                              <Star className="w-2.5 h-2.5 fill-current" /> Popular
                            </span>
                          )}
                          {f.tag && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${isLarge ? 'bg-white/10 text-stone-300 border-white/10' : 'bg-stone-50 border-stone-200 text-stone-500'}`}>
                              {f.tag}
                            </span>
                          )}
                          {!f.popular && !f.tag && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${isLarge ? 'bg-white/5 text-stone-500 border-white/5' : `bg-stone-50 border-stone-100 ${catMeta.color}`}`}>
                              {f.category}
                            </span>
                          )}
                        </div>
                        <h3 className={`font-black mb-2 ${isLarge ? 'text-xl text-white' : 'text-base text-stone-900 group-hover:text-brand-700 transition-colors'}`}>
                          {t(f.titleKey)}
                        </h3>
                        <p className={`text-sm leading-relaxed flex-1 ${isLarge ? 'text-stone-400 line-clamp-4' : 'text-stone-500 line-clamp-3'}`}>
                          {t(f.descKey)}
                        </p>
                        {isLarge && (
                          <div className="mt-5 flex items-center gap-1.5 text-brand-400 text-sm font-bold">
                            <span>Explore feature</span>
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* ── Feature Spotlights ───────────────────────────────────────────── */}
      <section className="py-16 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white border-t border-stone-100">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16 sm:mb-24">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-stone-100 text-stone-600 text-xs font-black mb-4 uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5" /> Deep dives
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight">Built for how you actually hire</h2>
            <p className="text-stone-500 text-base mt-3 max-w-xl mx-auto">Three areas where Devlumiq ATS goes further than the rest.</p>
          </motion.div>

          <div className="space-y-24 sm:space-y-32">
            {spotlightsMeta.map((s, i) => {
              const Icon = s.icon;
              const isEven = i % 2 === 0;
              return (
                <motion.div
                  key={s.titleKey}
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ type: 'spring', stiffness: 200, damping: 24 }}
                  className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center ${!isEven ? 'lg:[&>*:first-child]:order-2' : ''}`}
                >
                  <div>
                    <div className="flex items-center gap-3 mb-5">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.iconGradient} flex items-center justify-center shadow-lg`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-black border ${s.badgeColor}`}>{t(s.badgeKey)}</span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight leading-tight mb-4">{t(s.titleKey)}</h3>
                    <p className="text-stone-500 text-base leading-relaxed mb-7">{t(s.descKey)}</p>
                    <ul className="space-y-3 mb-8">
                      {s.bulletKeys.map((bKey) => (
                        <li key={bKey} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          </div>
                            <span className="text-stone-700 text-sm font-medium">{t(bKey)}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href="/signup" className="inline-flex items-center gap-2 text-sm font-black text-brand-600 hover:text-brand-700 group">
                      Get Started
                      <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </Link>
                  </div>
                  <div className="relative">
                    <div className={`absolute -inset-6 rounded-3xl bg-gradient-to-br ${s.iconGradient} opacity-[0.06] blur-2xl`} />
                    <div className="relative">
                      {s.mockupType === 'score'  && <ScreenshotImage src="/images/website-candidates-scoring-preview.png" alt="Candidate scoring screenshot" />}
                      {s.mockupType === 'kanban' && <ScreenshotImage src="/images/website-pipeline-preview.png" alt="Pipeline board screenshot" />}
                      {s.mockupType === 'chart'  && <ScreenshotImage src="/images/webite-analytics-preview.png" alt="Analytics dashboard screenshot" />}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── What is included ─────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-stone-50 border-t border-stone-100">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-xs font-black mb-4 uppercase tracking-widest">
              <CheckCircle2 className="w-3.5 h-3.5" /> Every plan includes
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">{t('features.includedTitle')}</h2>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.06 }}
            className="relative rounded-3xl overflow-hidden border border-stone-200 bg-white shadow-[0_8px_48px_-12px_rgba(13,148,136,0.1)]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/[0.03] via-transparent to-teal-500/[0.05] pointer-events-none" />
            <div className="relative p-6 sm:p-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {highlightKeys.map((key, i) => (
                  <motion.div key={key} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                    className="flex items-center gap-3 p-4 rounded-xl bg-stone-50 border border-stone-100 hover:border-brand-200/70 hover:bg-brand-50/30 hover:shadow-sm transition-all duration-200 group"
                  >
                    <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-brand-100 group-hover:bg-brand-200/70 flex items-center justify-center transition-colors">
                      <CheckCircle2 className="w-4 h-4 text-brand-600" />
                    </span>
                    <span className="font-semibold text-stone-700 text-sm">{t(key)}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mt-10">
            <Link href="/login">
              <motion.button whileHover={{ scale: 1.03, boxShadow: '0 8px 32px rgba(13,148,136,0.35)' }} whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2.5 min-h-[52px] px-9 py-4 rounded-2xl font-black text-white bg-gradient-to-r from-brand-600 to-teal-600 shadow-lg shadow-brand-500/30 text-[15px]"
              >
                <Logo className="w-5 h-5 text-white" />
                {t('features.tryFree')} <ArrowRight className="w-5 h-5" />
              </motion.button>
            </Link>
            <p className="text-xs text-stone-400 mt-3">One-time purchase · Full source code · Self-hosted</p>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <CTASection title={t('features.ctaTitle')} subtitle={t('features.ctaSubtitle')} />
    </>
  );
}
